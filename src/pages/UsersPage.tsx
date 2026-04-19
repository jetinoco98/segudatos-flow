import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type { Profile, UserRole } from '../context/ProfileContext'
import { 
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Search, Plus, Pencil, X, Save, Filter, ChevronDown, Table as TableIcon, Clipboard, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useEditableTable } from '../hooks/useEditableTable'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'admin', label: 'Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'member', label: 'Miembro' },
  { value: 'guest', label: 'Invitado' },
]

const STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activo' },
  { value: 'inactive', label: 'Inactivo' },
]

const columnHelper = createColumnHelper<Profile>()

export default function UsersPage() {
  const [data, setData] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  
  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showRoleFilter, setShowRoleFilter] = useState(false)
  const [showStatusFilter, setShowStatusFilter] = useState(false)

  // Add Modal state (kept for creation only)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [modalRole, setModalRole] = useState<UserRole>('member')
  const [modalIsActive, setModalIsActive] = useState(true)

  const handleSaveAll = async (pendingChanges: Map<string, Partial<Profile>>) => {
    const promises = Array.from(pendingChanges.entries()).map(([id, changes]) =>
      supabase.from('profiles').update(changes).eq('id', id)
    )
    const results = await Promise.all(promises)
    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      console.error('Some updates failed:', errors)
      alert(`${errors.length} actualización(es) fallaron.`)
    }
    fetchProfiles()
  }

  const {
    isEditMode, enterEditMode, cancelEditMode,
    selectedIds, toggleSelect, toggleSelectAll,
    pendingChanges, handleFieldChange, getEffectiveValue,
    saving, handleSave, changeCount,
    isBatchModalOpen, setIsBatchModalOpen,
    batchData, setBatchData
  } = useEditableTable<Profile>({
    data,
    onSave: handleSaveAll
  })

  useEffect(() => {
    fetchProfiles()
  }, [])

  // Close filter dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      if (!target.closest('[data-filter-role]')) setShowRoleFilter(false)
      if (!target.closest('[data-filter-status]')) setShowStatusFilter(false)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [])

  const fetchProfiles = async () => {
    setLoading(true)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*')
      .order('name')
    
    if (profiles) setData(profiles)
    setLoading(false)
  }

  // Filtered data
  const filteredData = useMemo(() => {
    let result = data
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(p => 
        (p.name?.toLowerCase().includes(q)) || 
        p.email.toLowerCase().includes(q)
      )
    }
    if (roleFilter !== 'all') {
      result = result.filter(p => p.role === roleFilter)
    }
    if (statusFilter !== 'all') {
      result = result.filter(p => 
        statusFilter === 'active' ? p.is_active : !p.is_active
      )
    }
    return result
  }, [data, searchQuery, roleFilter, statusFilter])

  // --- Add modal ---
  const openAddModal = () => {
    setEmail('')
    setName('')
    setModalRole('member')
    setModalIsActive(true)
    setIsModalOpen(true)
  }

  const handleAddSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { error } = await supabase
        .from('profiles')
        .insert({ email, name, role: modalRole, is_active: modalIsActive })
      if (error) throw error
      setIsModalOpen(false)
      fetchProfiles()
    } catch (err) {
      console.error('Error saving profile:', err)
      alert('Error al guardar el perfil')
    }
  }

  // --- Batch Add Logic ---
  const handlePaste = (e: React.ClipboardEvent) => {
    const text = e.clipboardData.getData('text')
    if (!text) return

    const rows = text.split(/\r?\n/).filter(line => line.trim() !== '')
    const parsed = rows.map(row => {
      const cols = row.split('\t')
      const name = cols[0]?.trim() || ''
      const email = cols[1]?.trim() || ''
      
      // Basic role mapping
      let role: UserRole = 'member'
      const rawRole = cols[2]?.trim().toLowerCase() || ''
      if (['owner', 'propietario'].includes(rawRole)) role = 'owner'
      else if (['admin', 'administrador'].includes(rawRole)) role = 'admin'
      else if (['supervisor'].includes(rawRole)) role = 'supervisor'
      else if (['member', 'miembro', 'tecnico', 'técnico'].includes(rawRole)) role = 'member'
      else if (['guest', 'invitado'].includes(rawRole)) role = 'guest'

      // Basic status mapping
      const rawStatus = cols[3]?.trim().toLowerCase() || ''
      const isActive = !['inactivo', 'inactive', '0', 'false', 'no'].includes(rawStatus)

      return { name, email, role, is_active: isActive, isValid: name && email && email.includes('@') }
    })

    setBatchData(parsed)
  }

  const handleBatchImport = async () => {
    const validRows = batchData.filter(r => r.isValid)
    if (validRows.length === 0) return
    
    try {
      // Prepare data for insertion (remove isValid property)
      const toInsert = validRows.map(({ isValid, ...rest }) => rest)
      const { error } = await supabase.from('profiles').insert(toInsert)
      if (error) throw error
      
      setIsBatchModalOpen(false)
      setBatchData([])
      fetchProfiles()
    } catch (err) {
      console.error('Error in batch import:', err)
      alert('Error al importar usuarios. Verifique que los correos no estén duplicados.')
    }
  }

  const handleRowClick = (id: string, e: React.MouseEvent) => {
    if (!isEditMode) return
    const target = e.target as HTMLElement
    if (target.closest('button, input, select, textarea, a')) return
    toggleSelect(id)
  }

  // --- Table columns ---
  const columns = useMemo(() => {
    const cols = []

    // Checkbox column (Edit Mode only)
    if (isEditMode) {
      cols.push(
        columnHelper.display({
          id: 'select',
          header: () => (
            <input
              type="checkbox"
              checked={filteredData.length > 0 && selectedIds.size === filteredData.length}
              onChange={() => toggleSelectAll(filteredData.map(p => p.id))}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          ),
          cell: props => (
            <input
              type="checkbox"
              checked={selectedIds.has(props.row.original.id)}
              onChange={(e) => {
                e.stopPropagation()
                toggleSelect(props.row.original.id)
              }}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          ),
        })
      )
    }

    cols.push(
      columnHelper.accessor('name', {
        header: 'Nombre',
        cell: info => <span className="font-medium text-gray-900">{info.getValue() || '—'}</span>,
      }),
      columnHelper.accessor('email', {
        header: 'Correo Electrónico',
        cell: info => <span className="text-gray-500">{info.getValue()}</span>,
      }),
      columnHelper.accessor('role', {
        header: 'Rol',
        cell: info => {
          const profile = info.row.original
          const effectiveRole = getEffectiveValue(profile, 'role') as UserRole

          if (!isEditMode) {
            return (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 capitalize">
                {effectiveRole}
              </span>
            )
          }

          return (
            <select
              value={effectiveRole}
              onChange={e => handleFieldChange(profile.id, 'role', e.target.value as UserRole)}
              className="h-8 rounded-md border border-gray-300 bg-white px-2 text-xs font-medium text-gray-700 outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 cursor-pointer transition-colors hover:border-blue-400"
            >
              {ROLE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          )
        },
      }),
      columnHelper.accessor('is_active', {
        header: 'Estado',
        cell: info => {
          const profile = info.row.original
          const effectiveActive = getEffectiveValue(profile, 'is_active') as boolean

          if (!isEditMode) {
            return (
              <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium ${
                effectiveActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {effectiveActive ? 'Activo' : 'Inactivo'}
              </span>
            )
          }

          return (
            <button
              type="button"
              onClick={() => handleFieldChange(profile.id, 'is_active', !effectiveActive)}
              className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium cursor-pointer transition-all duration-150 ring-1 ring-inset ${
                effectiveActive 
                  ? 'bg-green-50 text-green-700 ring-green-200 hover:bg-green-100' 
                  : 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100'
              }`}
            >
              {effectiveActive ? 'Activo' : 'Inactivo'}
            </button>
          )
        },
      })
    )

    return cols
  }, [isEditMode, selectedIds, filteredData, toggleSelect, toggleSelectAll, getEffectiveValue, handleFieldChange])

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  return (
    <div className="p-8 h-full flex flex-col max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-1">Gestión de Usuarios</h1>
          <p className="text-sm text-gray-500">
            Administre los perfiles de usuario, roles y niveles de acceso al sistema.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isEditMode ? (
            <>
              <Button
                onClick={enterEditMode}
                variant="outline"
                className="gap-2"
              >
                <Pencil size={15} />
                Editar
              </Button>
              <Button
                onClick={() => setIsBatchModalOpen(true)}
                variant="outline"
                className="gap-2 border-dashed border-2 hover:border-blue-400 hover:bg-blue-50"
              >
                <TableIcon size={15} />
                Carga Masiva
              </Button>
              <Button onClick={openAddModal} className="bg-blue-600 hover:bg-blue-700 text-white">
                <Plus size={16} className="mr-2" />
                Añadir Usuario
              </Button>
            </>
          ) : (
            <>
              <span className="text-sm text-gray-500 mr-1">
                {changeCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 border border-amber-200">
                    {changeCount} cambio{changeCount !== 1 ? 's' : ''} pendiente{changeCount !== 1 ? 's' : ''}
                  </span>
                )}
              </span>
              <Button
                onClick={cancelEditMode}
                variant="outline"
                className="gap-2"
              >
                <X size={15} />
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={changeCount === 0 || saving}
                className="bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 gap-2"
              >
                <Save size={15} />
                {saving ? 'Guardando...' : 'Guardar Cambios'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-sm">
        {/* Table Toolbar — Search + Filters */}
        <div className="p-4 border-b border-gray-100 flex items-center gap-3 bg-gray-50/50 flex-wrap">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <Input 
              placeholder="Buscar por nombre o correo..." 
              className="pl-9 h-9 bg-white"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Role Filter */}
          <div className="relative" data-filter-role>
            <button
              onClick={() => setShowRoleFilter(!showRoleFilter)}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
                roleFilter !== 'all'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter size={14} />
              Rol{roleFilter !== 'all' ? `: ${ROLE_OPTIONS.find(r => r.value === roleFilter)?.label}` : ''}
              <ChevronDown size={14} className={`transition-transform ${showRoleFilter ? 'rotate-180' : ''}`} />
            </button>
            {showRoleFilter && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-150">
                <button
                  onClick={() => { setRoleFilter('all'); setShowRoleFilter(false) }}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${roleFilter === 'all' ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  Todos los Roles
                </button>
                {ROLE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setRoleFilter(opt.value); setShowRoleFilter(false) }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${roleFilter === opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative" data-filter-status>
            <button
              onClick={() => setShowStatusFilter(!showStatusFilter)}
              className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
                statusFilter !== 'all'
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Filter size={14} />
              Estado{statusFilter !== 'all' ? `: ${STATUS_OPTIONS.find(s => s.value === statusFilter)?.label}` : ''}
              <ChevronDown size={14} className={`transition-transform ${showStatusFilter ? 'rotate-180' : ''}`} />
            </button>
            {showStatusFilter && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[160px] animate-in fade-in slide-in-from-top-1 duration-150">
                {STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => { setStatusFilter(opt.value); setShowStatusFilter(false) }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${statusFilter === opt.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Clear filters */}
          {(searchQuery || roleFilter !== 'all' || statusFilter !== 'all') && (
            <button
              onClick={() => { setSearchQuery(''); setRoleFilter('all'); setStatusFilter('all') }}
              className="text-xs text-gray-500 hover:text-gray-700 underline underline-offset-2 transition-colors"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
            </div>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 border-b border-gray-200 z-10">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th key={header.id} className={`px-6 py-3.5 font-medium tracking-wider ${header.id === 'select' ? 'w-12 px-4' : ''}`}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-gray-100">
                {table.getRowModel().rows.map(row => {
                  const isDirty = pendingChanges.has(row.original.id)
                  const isSelected = selectedIds.has(row.original.id)
                  return (
                    <tr
                      key={row.id}
                      onClick={(e) => handleRowClick(row.original.id, e)}
                      className={`transition-colors group ${
                        isEditMode ? 'cursor-pointer' : ''
                      } ${
                        isDirty
                          ? 'bg-amber-50/60 border-l-4 border-l-amber-400'
                          : isSelected && isEditMode
                            ? 'bg-blue-50/30 border-l-4 border-l-blue-300'
                            : 'hover:bg-gray-50/50 border-l-4 border-l-transparent'
                      }`}
                    >
                      {row.getVisibleCells().map(cell => (
                        <td key={cell.id} className={`px-6 py-4 whitespace-nowrap ${cell.column.id === 'select' ? 'w-12 px-4' : ''}`}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  )
                })}
                {filteredData.length === 0 && (
                  <tr>
                    <td colSpan={columns.length} className="px-6 py-12 text-center text-gray-500">
                      No se encontraron usuarios
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add User Modal (creation only) */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Añadir Usuario
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleAddSave} className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Nombre</label>
                <Input 
                  required 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Correo Electrónico</label>
                <Input 
                  required 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  placeholder="usuario@empresa.com"
                />
              </div>
              
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-gray-700">Rol del Sistema</label>
                <select 
                  className="h-9 w-full rounded-lg border border-input bg-transparent px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:border-ring"
                  value={modalRole}
                  onChange={e => setModalRole(e.target.value as UserRole)}
                >
                  {ROLE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 mt-2">
                <input 
                  type="checkbox" 
                  id="isActive" 
                  checked={modalIsActive}
                  onChange={e => setModalIsActive(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                  Cuenta Activa
                </label>
              </div>

              <div className="pt-4 flex gap-3 justify-end border-t border-gray-100 mt-2">
                <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white min-w-[100px]">
                  Guardar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Add Modal */}
      {isBatchModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => { setIsBatchModalOpen(false); setBatchData([]) }}
        >
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <TableIcon className="text-blue-600" />
                  Carga Masiva de Usuarios
                </h2>
                <p className="text-sm text-gray-500">Copie y pegue datos directamente desde Excel o Google Sheets.</p>
              </div>
              <button onClick={() => { setIsBatchModalOpen(false); setBatchData([]) }} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {batchData.length === 0 ? (
                <div 
                  className="h-64 border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center gap-4 bg-gray-50/50 hover:bg-blue-50/30 hover:border-blue-300 transition-all group"
                  onPaste={handlePaste}
                  tabIndex={0}
                >
                  <div className="p-4 rounded-full bg-white shadow-sm group-hover:scale-110 transition-transform">
                    <Clipboard className="text-blue-500" size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-gray-700">Haga clic aquí y pegue su contenido (Ctrl + V)</p>
                    <p className="text-xs text-gray-500 mt-1">El orden debe ser: Nombre, Email, Rol, Estado</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg border border-blue-100">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="text-blue-600" size={20} />
                      <div>
                        <p className="text-sm font-bold text-blue-900">{batchData.length} filas detectadas</p>
                        <p className="text-xs text-blue-700">{batchData.filter(r => r.isValid).length} listas para importar</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setBatchData([])} className="h-8">
                      Limpiar y Pegar de Nuevo
                    </Button>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Nombre</th>
                          <th className="px-4 py-3 font-semibold">Email</th>
                          <th className="px-4 py-3 font-semibold">Rol</th>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                          <th className="px-4 py-3 font-semibold text-center">Validez</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {batchData.map((row, idx) => (
                          <tr key={idx} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3">{row.name || <span className="text-red-400">Faltante</span>}</td>
                            <td className="px-4 py-3 font-medium">{row.email || <span className="text-red-400">Faltante</span>}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 capitalize">{row.role}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${row.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {row.is_active ? 'Activo' : 'Inactivo'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {row.isValid ? (
                                <CheckCircle2 size={16} className="text-green-500 mx-auto" />
                              ) : (
                                <AlertCircle size={16} className="text-red-500 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3 sticky bottom-0">
              <Button variant="outline" onClick={() => { setIsBatchModalOpen(false); setBatchData([]) }}>
                Cancelar
              </Button>
              <Button 
                onClick={handleBatchImport} 
                disabled={saving || batchData.filter(r => r.isValid).length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white min-w-[120px] gap-2 shadow-lg shadow-blue-500/20"
              >
                <Save size={16} />
                {saving ? 'Importando...' : `Importar ${batchData.filter(r => r.isValid).length} Usuarios`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
