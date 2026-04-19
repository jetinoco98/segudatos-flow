# Segudatos Flow — Complete Schema & Build Guide
_Last updated: design session April 2026_

---

## Project Context

**Segudatos** is an electronic security field service company (B2B). This internal tool — **Segudatos Flow** — replaces Monday.com for managing contracts, tickets, field assignments, and work logs. Built on Supabase (PostgreSQL) with a React + Vite + Tailwind CSS frontend.

---

## Core Design Decisions

- **Naming**: Top-level entity is `contracts`. Work types: Corrective, Preventive, Requirement, Project.
- **Auth**: Google Sign In + email/password via Supabase Auth. No self-signup. Users pre-registered by admins. `profiles` extends `auth.users`. Email is the shared identifier across all systems.
- **Roles** (ceiling-based, restrictions only subtract): `owner → admin → supervisor → member → guest`
- **Restrictions**: `user_restrictions` table subtracts from role ceiling. Never adds. A row existing is the restriction.
- **Lookups**: All operational dropdowns live in `lookup_values`. No `check` constraints on operational values — only on architectural ones (role, source, layout, contract_view status, anomaly_flag).
- **Audit log**: Deferred but confirmed. A full `audit_logs` table with before/after JSONB will be added later.
- **External integration**: AppSheet mobile app connects via Edge Functions only. Never direct DB access. Posts worklogs via a controlled API endpoint. Identified by company email matching `profiles.email`.
- **Files**: Stored in Supabase Storage. Tables store URLs and metadata only.
- **Computed fields**: `days_since_creation`, planning summaries, assignment aggregates — never stored, always derived by frontend or database views.
- **Settlements**: No separate settlements table. Settlement state lives on tickets via `settlement_status` and `last_settled_at`. Billing instructions live on worklogs via `billing_tag` and `billing_notes`. External Python script handles calculations. `settled_at` on worklogs marks when each was included in a confirmed run.
- **Ticket reopening**: Warranty returns and follow-up work always create a new ticket linked via `parent_ticket_id`. Original ticket history is never modified.
- **Terminology**: "Technician" is a company term only. In code and schema, always use `profile`, `user`, `profile_id`.
- **Language**: DB values and code are English. Display labels (`label` column in `lookup_values`) are Spanish.

---

## The Main Chain

```
contracts
  └── tickets
        ├── assignments   (plan — date required, person optional)
        └── worklogs      (source of truth — sibling to assignments)
```

Assignments and worklogs are siblings. Both belong directly to a ticket. Neither depends on the other to exist. A worklog links to an assignment optionally via `assignment_id`.

---

## Table Reference

### `clients`
Client companies that own contracts.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | auto generated |
| name | text NOT NULL | company name |
| created_at | timestamptz | auto |

---

### `client_contacts`
Individual contacts per client. One client has many contacts.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK → clients | cascade delete |
| name | text NOT NULL | |
| email | text | |
| phone | text | |
| is_primary | boolean | default false |
| created_at | timestamptz | auto |

---

### `profiles`
Internal user profiles. Extends `auth.users` for Google OAuth.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| auth_user_id | uuid FK → auth.users | nullable, set null on delete |
| name | text NOT NULL | |
| email | text NOT NULL UNIQUE | pre-registered before first login — shared identifier |
| role | text NOT NULL | check: owner, admin, supervisor, member, guest |
| phone | text | |
| is_active | boolean | default true |
| created_at | timestamptz | auto |

**Notes:**
- `auth_user_id` nullable — if Google auth entry is removed, profile and all historical data survive.
- Email is the unique identifier used to link Google OAuth, email/password auth, and the external mobile app.
- Role has a `check` constraint — architectural. Changing a role has RLS implications across the whole system.
- First users created directly in Supabase dashboard. Subsequent users added via User Management module in the app (creates `profiles` row only). Auth entry created by Supabase on first Google sign-in, or manually by admin for email/password users.

---

### `user_restrictions`
Per-user restrictions that subtract from their role ceiling.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK → profiles | cascade delete |
| resource | text NOT NULL | e.g. tickets, assignments, worklogs |
| actions | text NOT NULL | e.g. insert, update, delete |
| created_at | timestamptz | auto |
| — | unique(profile_id, resource, actions) | one rule per combination |

**Notes:**
- A row existing IS the restriction. No boolean needed.
- Only owners can write to this table.
- Phase 2 RLS will consult this table per query.

---

### `lookup_values`
Central reference table for all UI dropdowns. Admin-managed.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| category | text NOT NULL | snake_case code-level key e.g. contract_status |
| value | text NOT NULL | snake_case code-level key used in DB columns |
| label | text NOT NULL | Spanish display name shown in UI |
| sort_order | integer | default 0 |
| is_active | boolean | controls dropdown visibility, default true |
| status | text | check: new, reviewed |
| added_by | uuid FK → profiles | set null on delete |
| created_at | timestamptz | auto |
| — | unique(category, value) | |

**Notes:**
- `is_active` and `status` are independent. `is_active=false` hides from dropdowns regardless of status.
- `status=new` flags recent additions for admin review. `status=reviewed` means vetted and stable.
- Admins create values as reviewed. Supervisors/members add as new for admin review.
- `value` is always what code references. `label` is always what users see.

**Seeded categories and values:**

| Category | Values (value → label) |
|---|---|
| contract_status | activo→Activo, inactivo→Inactivo, vencido→Vencido, completado→Completado, cancelado→Cancelado |
| ticket_status | pendiente→Pendiente, coordinado→Coordinado, en_proceso→En Proceso, postergado→Postergado, realizado→Realizado |
| ticket_type | correctivo→Correctivo, preventivo→Preventivo, requerimiento→Requerimiento, proyecto→Proyecto |
| ticket_subtype | atm→ATM, agencia→Agencia, estandarizacion→Estandarización, nueva_instalacion→Nueva Instalación |
| ticket_priority | critica→Crítica, alta→Alta, normal→Normal, baja→Baja |
| assignment_status | pendiente→Pendiente, confirmado→Confirmado, cancelado→Cancelado, perdido→Perdido |
| settlement_status | pendiente→Pendiente, parcial→Parcial, completa→Completa |
| ticket_file_type | informes→Informes, adicionales→Adicionales |
| system_type | alarmas→Alarmas, acceso→Acceso, video→Video, incendio→Incendio, otros→Otros |
| billing_tag | no_liquidar→No Liquidar, por_tiempo→Por Tiempo, liquidar_independiente→Liquidar Independiente |
| responsible_party | segudatos→Segudatos, cliente→Cliente, terceros→Terceros |
| ticket_category | atm→ATM, agencia→Agencia, oficina→Oficina, edificio→Edificio |

**Note on billing_tag:** A worklog with no `billing_tag` (null) is treated as full charge by the external script. No "charge full" row is needed — absence of a tag is the instruction.

---

### `contracts`
Top-level entity. Each contract belongs to a client and contains tickets.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK → clients | restrict delete |
| name | text NOT NULL | e.g. Banco Pichincha Framework 2024 |
| code_prefix | text NOT NULL UNIQUE | e.g. BP, SG — drives ticket numbering |
| status | text NOT NULL | default activo, references lookup_values |
| start_date | date | |
| end_date | date | |
| notes | text | |
| created_at | timestamptz | auto |

**Notes:**
- `on delete restrict` on client — cannot delete a client with existing contracts.
- `code_prefix` unique — guarantees ticket numbers never collide across contracts.
- One contract named "General Services" serves as catch-all. No special flag needed.
- Ticket number format: `BP001`, `SG1479` — prefix concatenated with zero-padded incrementing number.

---

### `contract_supervisors`
Junction table assigning supervisors to contracts. Many-to-many.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| contract_id | uuid FK → contracts | cascade delete |
| profile_id | uuid FK → profiles | cascade delete |
| is_lead | boolean | default false — flags primary coordinator |
| created_at | timestamptz | auto |
| — | unique(contract_id, profile_id) | no duplicate assignments |

---

### `locations`
Global list of Ecuador cities and provinces. Seeded from official INEC data.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| city | text NOT NULL | |
| province | text NOT NULL | |
| created_at | timestamptz | auto |
| — | unique(city, province) | |

---

### `client_regions`
Regions defined per client. Only relevant for clients using regional cost structures.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| client_id | uuid FK → clients | cascade delete |
| name | text NOT NULL | region name as defined by that client |
| created_at | timestamptz | auto |
| — | unique(client_id, name) | |

**Notes:**
- City-to-region mapping not enforced at DB level. Frontend will flag likely mismatches as future functionality.
- Currently critical for 2 clients with region-based cost structures.

---

### `tickets`
Core operational table. Each ticket is a unit of work within a contract.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| contract_id | uuid FK → contracts | restrict delete |
| parent_ticket_id | uuid FK → tickets | nullable, set null on delete |
| ticket_number | text NOT NULL UNIQUE | auto-generated by DB trigger |
| title | text | nullable — auto-populated by frontend |
| status | text NOT NULL | default pendiente, references lookup_values |
| type | text | references lookup_values category=ticket_type |
| subtype | text | references lookup_values category=ticket_subtype |
| priority | text | references lookup_values category=ticket_priority |
| needs_report | boolean | default false |
| description | text | |
| general_comments | text | operational notes by coordinators |
| final_observations | text | closing note once work is done |
| report_notes | text | admin/supervisor notes on uploaded report |
| location_id | uuid FK → locations | set null on delete |
| client_region_id | uuid FK → client_regions | set null on delete |
| category | text | references lookup_values category=ticket_category |
| client_contact_id | uuid FK → client_contacts | set null on delete |
| client_ticket_ref | text | client's own ticket number if they have one |
| responsible_party | text | references lookup_values category=responsible_party |
| planned_month | integer | check 1–12 |
| planned_year | integer | check >= 2000 |
| settlement_status | text | references lookup_values category=settlement_status |
| last_settled_at | timestamptz | boundary date for next settlement run |
| coordinator_id | uuid FK → profiles | set null on delete |
| created_by | uuid FK → profiles | set null on delete |
| created_at | timestamptz | auto |

**Notes:**
- `parent_ticket_id` self-references tickets. Warranty returns and follow-up work create a new ticket pointing back to the original.
- `planned_month` + `planned_year` represent a known target month with no specific date. Independent from assignments.
- `title` auto-populated as `ticket_number + site_name` by frontend automation.
- `general_comments`, `final_observations`, `report_notes` are structured text fields, not a conversation thread.
- `last_settled_at` is the boundary used by the external settlement script. Only worklogs with `entry_time` after this date are considered unsettled.
- `settlement_status` lifecycle: pendiente → parcial / completa → pendiente (cycles).
- Ticket number auto-generated by `generate_ticket_number()` trigger — fires before insert when `ticket_number` is null. Allows manual ticket numbers during migration.

---

### `assignments`
Planning table. Each row is a planned visit or date range for a ticket.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| ticket_id | uuid FK → tickets | cascade delete |
| profile_id | uuid FK → profiles | nullable, set null on delete |
| planned_date | date NOT NULL | start date |
| planned_end_date | date | nullable — if null, single day |
| planned_start | time | start hour |
| planned_end | time | end hour |
| status | text NOT NULL | default pendiente, references lookup_values |
| notes | text | |
| created_by | uuid FK → profiles | set null on delete |
| created_at | timestamptz | auto |
| — | check | planned_end_date >= planned_date |

**Notes:**
- `profile_id` nullable — assignment with no person is a valid date placeholder.
- "Separate into individual days" is a frontend operation. Restricted by frontend if existing worklogs are linked to that assignment — cannot separate once worklogs exist.
- Clash detection handled frontend-side by querying existing assignments before saving.
- `status` lifecycle: pendiente → confirmado → completado / perdido / cancelado

---

### `worklogs`
Source of truth for actual work performed. Sibling to assignments.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| ticket_id | uuid FK → tickets | restrict delete |
| assignment_id | uuid FK → assignments | nullable, set null on delete |
| profile_id | uuid FK → profiles | nullable, set null on delete |
| entry_time | timestamptz NOT NULL | actual entry |
| exit_time | timestamptz NOT NULL | actual exit |
| source | text NOT NULL | check: mobile_app, supervisor_entry |
| anomaly_flag | text | check: unplanned_visit, wrong_technician, no_assignment |
| billing_tag | text | references lookup_values category=billing_tag |
| billing_notes | text | free text for edge cases |
| settled_at | timestamptz | stamped when included in confirmed settlement |
| notes | text | |
| reviewed_by | uuid FK → profiles | set null on delete |
| reviewed_at | timestamptz | stamped when supervisor confirms worklog |
| created_by | uuid FK → profiles | set null on delete |
| created_at | timestamptz | auto |
| — | check | exit_time > entry_time |

**Notes:**
- `source = mobile_app` — trigger attempts to match assignment by ticket_id + date range + profile_id before checking anomalies.
- `source = supervisor_entry` — assignment_id provided explicitly by UI. Anomaly check runs immediately.
- `anomaly_flag` set automatically by `check_worklog_anomaly` trigger on insert. Null means clean.
- `billing_tag` null = charge full (default). No explicit "charge full" lookup value needed.
- `reviewed_by` + `reviewed_at` null = pending supervisor confirmation.
- `settled_at` null = unsettled.

---

### `contract_views`
Admin-configured hard views. One per contract. Controls what supervisors see.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| contract_id | uuid FK → contracts | cascade delete |
| display_name | text NOT NULL | |
| visible_columns | jsonb | default [] — ordered list of ticket columns |
| default_filters | jsonb | default {} — pre-applied filters |
| status | text NOT NULL | check: draft, published |
| published_at | timestamptz | |
| created_by | uuid FK → profiles | set null on delete |
| published_by | uuid FK → profiles | set null on delete |
| created_at | timestamptz | auto |

**Notes:**
- `draft` — visible to admins only.
- `published` — appears in assigned supervisors' sidebars.
- `visible_columns` example: `["ticket_number", "title", "status", "type"]`
- `default_filters` example: `{"type": "preventivo"}`

---

### `saved_views`
User-saved soft views within a contract_view.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| contract_view_id | uuid FK → contract_views | cascade delete |
| created_by | uuid FK → profiles | set null on delete |
| name | text NOT NULL | |
| layout | text NOT NULL | check: grid, kanban, calendar |
| filters | jsonb | default {} |
| column_order | jsonb | default [] |
| is_shared | boolean | default false |
| created_at | timestamptz | auto |

**Notes:**
- `is_shared=true` — visible to all supervisors on that contract.
- Users can hide columns the hard view shows, but cannot reveal hidden columns. Enforced frontend-side.

---

### `ticket_files`
File metadata for tickets. Actual files in Supabase Storage.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| ticket_id | uuid FK → tickets | cascade delete |
| file_type | text NOT NULL | references lookup_values category=ticket_file_type |
| file_name | text NOT NULL | |
| file_url | text NOT NULL | Supabase Storage URL |
| file_size | integer | bytes, nullable |
| uploaded_by | uuid FK → profiles | set null on delete |
| notes | text | per-file annotations |
| created_at | timestamptz | auto |

---

### `ticket_systems`
Affected systems per ticket. Replaces per-system column pattern.

| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| ticket_id | uuid FK → tickets | cascade delete |
| system_type | text NOT NULL | references lookup_values category=system_type |
| impact_description | text | specific detail of what was affected |
| created_by | uuid FK → profiles | set null on delete |
| created_at | timestamptz | auto |

---

## Database Functions & Triggers

### `generate_ticket_number()`
Fires before insert on `tickets` when `ticket_number` is null. Reads `code_prefix` from the contract, counts existing tickets for that contract, generates next number as `prefix || lpad(count+1, 3, '0')`. Falls back to `TK` prefix if none found. Allows manual ticket numbers during migration.

### `set_anomaly_flag()`
Fires before insert on `worklogs`.
- If `source = mobile_app` and no `assignment_id`: attempts to match an assignment using `ticket_id + entry_time::date between planned_date and coalesce(planned_end_date, planned_date) + profile_id`. Attaches `assignment_id` if found.
- Then checks in order: no assignment → `no_assignment`, assignment has no profile → `unplanned_visit`, profile mismatch → `wrong_technician`, all clear → null.

### `handle_auth_user_login()`
Fires after insert on `auth.users`. Finds matching `profiles` row by email where `auth_user_id` is null and links them. Runs once per user — the `auth_user_id is null` condition prevents re-running on subsequent logins.

### `get_my_role()`
Helper function. Returns the role of the currently authenticated user from `profiles`. Used by all RLS policies. Marked `stable` for query-level caching.

### `is_assigned_to_contract(p_contract_id uuid)`
Helper function. Returns boolean — whether the current user has an entry in `contract_supervisors` for the given contract. Used by RLS policies for member-level access.

---

## RLS Policy Summary (Phase 1)

RLS is enabled on all tables automatically via `rls_auto_enable` event trigger created at project setup.

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| profiles | all authenticated | — | own row only | — |
| clients | all authenticated | admin+ | admin+ | admin+ |
| client_contacts | all authenticated | admin+ | admin+ | admin+ |
| lookup_values | all authenticated | admin+ | admin+ | admin+ |
| contracts | supervisor+ (all), member (assigned) | admin+ | admin+ | admin+ |
| contract_supervisors | all authenticated | admin+ | admin+ | admin+ |
| locations | all authenticated | admin+ | admin+ | admin+ |
| client_regions | all authenticated | admin+ | admin+ | admin+ |
| tickets | supervisor+ (all), member (assigned contract) | supervisor+ | admin+ or own coordinator | — |
| assignments | supervisor+ (all), member (assigned contract) | supervisor+ | supervisor+ | — |
| worklogs | supervisor+ (all), member (assigned contract) | supervisor+ and member | supervisor+ | — |
| contract_views | admin+ or published+assigned | admin+ | admin+ | admin+ |
| saved_views | admin+, shared, or own | any authenticated | admin+ or own | admin+ or own |
| ticket_files | supervisor+ | supervisor+ | supervisor+ | supervisor+ |
| ticket_systems | supervisor+ | supervisor+ | supervisor+ | supervisor+ |
| user_restrictions | admin+ | owner only | owner only | owner only |

---

## Settlement Flow

1. Coordinator flags tickets as `settlement_status = parcial or completa` in the UI
2. External Python script queries ready tickets and their unsettled worklogs (`entry_time > last_settled_at`)
3. Script reads `billing_tag` per worklog — null means charge full
4. Script runs calculations and produces its own evidence report externally
5. Admin confirms in the UI — system stamps `settled_at = now()` on each included worklog and `last_settled_at = now()` on each ticket
6. To find all worklogs from a specific settlement run: query worklogs by client where `settled_at` matches the run date

---

## External API Integration (AppSheet / Mobile App)

The external app never accesses Supabase directly. All communication goes through Edge Functions.

**Read endpoints (GET):**
- `/my-tickets?email=user@segudatos.com` — returns active tickets with assignments for that user on or near today. Returns: `ticket_id, ticket_number, site_name, status, work_type, client_name, contract_id`
- `/tickets?search=BP001` — search by ticket number for unplanned visits

**Write endpoint (POST):**
- `/worklogs` — payload: `ticket_id, user_email, entry_time, exit_time, pdf_url (optional)`
- Edge Function resolves `profile_id` from email, validates ticket is active, inserts worklog with `source = mobile_app`
- Trigger handles assignment matching and anomaly detection automatically

**User matching:** Company email is the shared identifier. No separate user mapping table needed.

---

## Navigation & UI Structure

**Left sidebar (two levels):**
- Fixed items: Dashboard, My Work
- Contracts section: each published contract_view appears as a collapsible item. Expanding shows saved_views as sub-items.
- Admin section: View configuration, User management, Lookup values

**Soft views appear as tabs** within the contract workspace (not in the sidebar).

**Hard view / soft view terminology** is internal only. Users see contract names and view tabs — never the words "hard" or "soft."

---

## What Remains — Backend (Supabase)

These are deferred and not needed before starting the frontend:

- [ ] `audit_logs` table + triggers on all tables (Phase 2+)
- [ ] `ticket_messages` table for conversation threading (future feature)
- [ ] `ticket_custom_fields` table for admin-configurable columns per contract (future feature)
- [ ] Phase 2 RLS — consult `user_restrictions` per query
- [ ] Phase 3 RLS — final tightening before production
- [ ] Edge Function: `/my-tickets` endpoint for external app
- [ ] Edge Function: `/tickets` search endpoint for external app
- [ ] Edge Function: `/worklogs` write endpoint for external app
- [ ] Supabase Storage bucket configuration for ticket files
- [ ] File cleanup trigger or Edge Function when `ticket_files` row is deleted
- [ ] Google OAuth provider configuration in Supabase Auth settings (disable sign-up)
- [ ] Email/password auth configuration (disable sign-up)
- [ ] Backup and branching setup before moving to production

---

## What Remains — Frontend (React + Vite + Tailwind + shadcn/ui)

Recommended build order:

1. **Auth** — Sign in page (Google + email/password). No sign up. Redirect to access denied if no profile found.
2. **User Management** — Admin module to create profiles, assign roles. Does not touch auth.users directly.
3. **Lookup Values** — Admin module to manage all dropdown lists. Foundation for everything else.
4. **Contracts** — Create, view, assign supervisors. Auto-creates contract_view in draft on creation.
5. **Contract View Config** — Admin configures visible columns and default filters. Publish to make visible.
6. **Tickets table** — Core view. TanStack Table for grid layout with filtering, sorting, column visibility. Reads contract_view config to render correct columns.
7. **Ticket detail panel** — All ticket fields, linked files, affected systems, parent/child ticket links.
8. **Assignments** — Planning view per ticket. Date range picker, person selector, clash detection via pre-query before save. Separate into individual days action (blocked if worklogs exist).
9. **Worklogs** — Confirmation flow from assignments. Manual entry form. Anomaly flag display.
10. **Saved views** — Allow supervisors to save filters and layouts. Share toggle.
11. **My Work** — Personal view across all contracts for current user.
12. **Dashboard** — Real-time summary graphs using Supabase Realtime.
13. **Settlement workflow** — Flag tickets as ready, confirm run, stamp dates.
14. **Client & Contact management** — Admin module.
15. **Lookup value suggestions** — Allow supervisors/members to suggest new values for admin review.

---

## Are You Ready to Start the Frontend?

Yes, start with the authentication part.