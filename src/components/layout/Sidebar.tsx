import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useProfile } from '../../context/ProfileContext'
import { 
  Home, 
  Briefcase, 
  LayoutDashboard, 
  FileText, 
  Ticket, 
  ClipboardCheck,
  Database, 
  ChevronDown,
  Search,
  ChevronLeft,
  ChevronRight as ChevronRightSmall
} from 'lucide-react'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
}

interface FolderItem {
  id: string
  label: string
  children?: FolderItem[]
}

const NAV_TOP: NavItem[] = [
  { label: 'Inicio', path: '/', icon: <Home size={15} strokeWidth={1.5} /> },
  { label: 'Mi Trabajo', path: '/work', icon: <Briefcase size={15} strokeWidth={1.5} /> },
]

const NAV_DASHBOARDS: NavItem[] = [
  { label: 'Panel Principal', path: '/dashboard', icon: <LayoutDashboard size={15} strokeWidth={1.5} /> },
]

const NAV_MAIN_TABLES: NavItem[] = [
  { label: 'Contratos', path: '/contracts', icon: <FileText size={15} strokeWidth={1.5} /> },
  { label: 'Tickets', path: '/tickets', icon: <Ticket size={15} strokeWidth={1.5} /> },
  { label: 'Asignaciones', path: '/assignments', icon: <ClipboardCheck size={15} strokeWidth={1.5} /> },
  { label: 'Registros', path: '/logs', icon: <Database size={15} strokeWidth={1.5} /> },
]

const INITIAL_FOLDERS: FolderItem[] = [
  {
    id: 'bancos',
    label: 'Bancos',
    children: [
      { id: 'bp', label: 'Banco Pichincha' },
      { id: 'bg', label: 'Banco Guayaquil' },
    ]
  },
  {
    id: 'retail',
    label: 'Retail',
    children: [
      { id: 'sm', label: 'Supermaxi' },
    ]
  },
  { id: 'general', label: 'Servicios Generales' },
]

export default function Sidebar({ collapsed, onToggle }: {
  collapsed: boolean
  onToggle: () => void
}) {
  const { profile } = useProfile()
  const location = useLocation()
  const navigate = useNavigate()
  
  const [favoritesOpen, setFavoritesOpen] = useState(true)
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['bancos']))
  // For dummy folders
  const [activeFolder, setActiveFolder] = useState('')

  const toggleFolder = (id: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleNavClick = (path: string) => {
    navigate(path)
  }

  return (
    <aside
      className="flex flex-col h-full shrink-0 transition-all duration-200"
      style={{
        width: collapsed ? '48px' : '224px',
        backgroundColor: 'white',
        borderRight: '1px solid var(--gray-200)',
        overflow: 'hidden',
      }}
    >
      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        className="flex items-center justify-center shrink-0 transition-all"
        style={{
          height: '40px',
          width: '100%',
          backgroundColor: 'transparent',
          border: 'none',
          borderBottom: '1px solid var(--gray-100)',
          cursor: 'pointer',
          color: 'var(--gray-400)',
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--gray-600)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--gray-400)'}
      >
        {collapsed ? <ChevronRightSmall size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">

        {/* Top nav */}
        {NAV_TOP.map(item => (
          <NavRow
            key={item.label}
            item={item}
            active={location.pathname === item.path}
            collapsed={collapsed}
            onClick={() => handleNavClick(item.path)}
          />
        ))}

        {/* Favorites */}
        {!collapsed && (
          <button
            onClick={() => setFavoritesOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-medium transition-all"
            style={{ color: 'var(--gray-400)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', letterSpacing: '0.06em' }}
          >
            <span>MIS FAVORITOS</span>
            <ChevronDown 
              size={12} 
              style={{ transform: favoritesOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} 
            />
          </button>
        )}
        {favoritesOpen && !collapsed && (
          <div
            className="mx-3 mb-2 rounded-lg flex items-center justify-center"
            style={{ height: '36px', backgroundColor: 'var(--gray-50)', border: '1px dashed var(--gray-200)' }}
          >
            <span className="text-xs" style={{ color: 'var(--gray-400)' }}>Sin favoritos aún</span>
          </div>
        )}

        <div style={{ height: '1px', backgroundColor: 'var(--gray-100)', margin: '6px 0' }} />

        {/* Dashboards */}
        <SectionHeader label="TABLEROS" collapsed={collapsed} />
        {NAV_DASHBOARDS.map(item => (
          <NavRow
            key={item.label}
            item={item}
            active={location.pathname === item.path}
            collapsed={collapsed}
            onClick={() => handleNavClick(item.path)}
          />
        ))}

        <div style={{ height: '1px', backgroundColor: 'var(--gray-100)', margin: '6px 0' }} />

        {/* Main Tables */}
        <SectionHeader label="TABLAS PRINCIPALES" collapsed={collapsed} />
        {NAV_MAIN_TABLES.map(item => (
          <NavRow
            key={item.label}
            item={item}
            active={location.pathname === item.path}
            collapsed={collapsed}
            onClick={() => handleNavClick(item.path)}
          />
        ))}

        <div style={{ height: '1px', backgroundColor: 'var(--gray-100)', margin: '6px 0' }} />

        {/* All Tables */}
        {!collapsed && (
          <div className="flex items-center justify-between px-3 py-1.5">
            <span
              className="text-xs font-medium"
              style={{ color: 'var(--gray-400)', letterSpacing: '0.06em' }}
            >
              TODAS LAS TABLAS
            </span>
            <button
              style={{ backgroundColor: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--gray-400)', padding: '0' }}
              title="Buscar tabla"
            >
              <Search size={12} />
            </button>
          </div>
        )}

        {!collapsed && INITIAL_FOLDERS.map(folder => (
          <FolderRow
            key={folder.id}
            folder={folder}
            depth={0}
            expanded={expandedFolders}
            onToggle={toggleFolder}
            activeItem={activeFolder}
            onSelect={setActiveFolder}
          />
        ))}

      </div>

      {/* Role badge */}
      {!collapsed && profile && (
        <div
          className="px-3 py-3 shrink-0"
          style={{ borderTop: '1px solid var(--gray-100)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{ backgroundColor: 'var(--blue-light)', color: 'var(--blue-accent)' }}
            >
              {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
            </div>
            <span className="text-xs truncate" style={{ color: 'var(--gray-400)' }}>
              {profile.name}
            </span>
          </div>
        </div>
      )}
    </aside>
  )
}

function SectionHeader({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <div style={{ height: '8px' }} />
  return (
    <p
      className="px-3 py-1.5 text-xs font-medium"
      style={{ color: 'var(--gray-400)', letterSpacing: '0.06em' }}
    >
      {label}
    </p>
  )
}

function NavRow({ item, active, collapsed, onClick }: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? item.label : undefined}
      className="w-full flex items-center gap-2.5 transition-all"
      style={{
        padding: collapsed ? '8px 0' : '6px 12px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        backgroundColor: active ? 'var(--blue-light)' : 'transparent',
        color: active ? 'var(--blue-accent)' : 'var(--gray-600)',
        border: 'none',
        cursor: 'pointer',
        borderRadius: collapsed ? '0' : '6px',
        margin: collapsed ? '0' : '1px 4px',
        width: collapsed ? '100%' : 'calc(100% - 8px)',
        fontSize: '13px',
        fontWeight: active ? '500' : '400',
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.backgroundColor = 'var(--gray-50)'
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent'
      }}
    >
      <span className="shrink-0">{item.icon}</span>
      {!collapsed && <span className="truncate">{item.label}</span>}
    </button>
  )
}

function FolderRow({ folder, depth, expanded, onToggle, activeItem, onSelect }: {
  folder: FolderItem
  depth: number
  expanded: Set<string>
  onToggle: (id: string) => void
  activeItem: string
  onSelect: (label: string) => void
}) {
  const hasChildren = folder.children && folder.children.length > 0
  const isExpanded = expanded.has(folder.id)
  const isActive = activeItem === folder.label

  return (
    <div>
      <button
        onClick={() => hasChildren ? onToggle(folder.id) : onSelect(folder.label)}
        className="w-full flex items-center gap-1.5 transition-all text-left"
        style={{
          padding: '5px 12px',
          paddingLeft: `${12 + depth * 14}px`,
          backgroundColor: isActive ? 'var(--blue-light)' : 'transparent',
          color: isActive ? 'var(--blue-accent)' : 'var(--gray-600)',
          border: 'none',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: isActive ? '500' : '400',
          borderRadius: '6px',
          margin: '1px 4px',
          width: 'calc(100% - 8px)',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--gray-50)' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent' }}
      >
        {hasChildren && (
          <ChevronDown 
            size={12} 
            style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', flexShrink: 0 }} 
          />
        )}
        {!hasChildren && <span style={{ width: '12px', flexShrink: 0 }} />}
        
        {hasChildren ? <Database size={13} strokeWidth={1.5} /> : <FileText size={13} strokeWidth={1.5} />}
        <span className="truncate">{folder.label}</span>
      </button>

      {hasChildren && isExpanded && folder.children!.map(child => (
        <FolderRow
          key={child.id}
          folder={child}
          depth={depth + 1}
          expanded={expanded}
          onToggle={onToggle}
          activeItem={activeItem}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}