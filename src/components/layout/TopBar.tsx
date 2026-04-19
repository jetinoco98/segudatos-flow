import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProfile } from '../../context/ProfileContext'
import { supabase } from '../../lib/supabase'

export default function TopBar() {
  const { profile } = useProfile()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = profile?.name
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? '?'

  return (
    <header
      className="h-12 flex items-center justify-between px-4 shrink-0"
      style={{
        backgroundColor: 'white',
        borderBottom: '1px solid var(--gray-200)',
      }}
    >
      {/* Left — logo */}
      <div className="flex items-center gap-2.5">
        <div
          className="w-6 h-6 rounded"
          style={{ backgroundColor: 'var(--blue-accent)' }}
        />
        <span
          className="text-sm font-semibold tracking-wide"
          style={{ color: 'var(--gray-800)', letterSpacing: '0.01em' }}
        >
          Segudatos Flow
        </span>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1">

        {/* Notifications */}
        <TopBarIcon title="Notificaciones">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
          </svg>
        </TopBarIcon>

        {/* Conversations */}
        <TopBarIcon title="Conversaciones">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
          </svg>
        </TopBarIcon>

        {/* Quick Add User */}
        <TopBarIcon title="Agregar usuario">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24">
            <path stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"/>
          </svg>
        </TopBarIcon>

        {/* Divider */}
        <div
          className="mx-2 h-5"
          style={{ width: '1px', backgroundColor: 'var(--gray-200)' }}
        />

        {/* Profile */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="flex items-center justify-center rounded-full text-xs font-semibold transition-all"
            style={{
              width: '30px',
              height: '30px',
              backgroundColor: 'var(--blue-accent)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {initials}
          </button>

          {menuOpen && (
            <div
              className="absolute right-0 mt-2 rounded-xl overflow-hidden z-50"
              style={{
                width: '220px',
                backgroundColor: 'white',
                border: '1px solid var(--gray-200)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              }}
            >
              {/* Profile header */}
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid var(--gray-100)' }}
              >
                <div
                  className="flex items-center justify-center rounded-full text-xs font-semibold shrink-0"
                  style={{
                    width: '34px',
                    height: '34px',
                    backgroundColor: 'var(--blue-accent)',
                    color: 'white',
                  }}
                >
                  {initials}
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--gray-900)' }}
                  >
                    {profile?.name}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: 'var(--gray-500)' }}
                  >
                    {profile?.email}
                  </p>
                </div>
              </div>

              {/* Menu items */}
              <div className="py-1">
                {[
                  { label: 'Mi Perfil', path: '/profile' },
                  { label: 'Configuraciones', path: '/settings' },
                  ...(profile && ['owner', 'admin'].includes(profile.role) ? [
                    { label: 'Gestión de Usuarios', path: '/users' },
                    { label: 'Valores de Lista', path: '/lookup' },
                  ] : []),
                  { label: 'Archivo', path: '/archive' },
                  { label: 'Papelera', path: '/trash' },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={() => {
                      setMenuOpen(false)
                      navigate(item.path)
                    }}
                    className="w-full text-left px-4 py-2 text-sm transition-all"
                    style={{ color: 'var(--gray-700)', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--gray-50)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Sign out */}
              <div
                className="py-1"
                style={{ borderTop: '1px solid var(--gray-100)' }}
              >
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="w-full text-left px-4 py-2 text-sm transition-all"
                  style={{ color: '#B91C1C', backgroundColor: 'transparent', border: 'none', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

function TopBarIcon({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <button
      title={title}
      className="flex items-center justify-center rounded-lg transition-all"
      style={{
        width: '32px',
        height: '32px',
        color: 'var(--gray-500)',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.backgroundColor = 'var(--gray-100)'
        e.currentTarget.style.color = 'var(--gray-700)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.backgroundColor = 'transparent'
        e.currentTarget.style.color = 'var(--gray-500)'
      }}
    >
      {children}
    </button>
  )
}