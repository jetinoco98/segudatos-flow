import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import AuthPage from './components/auth/AuthPage'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: 'var(--gray-50)' }}
      >
        <div
          className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--blue-accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (!session) {
    return <AuthPage />
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: 'var(--gray-50)' }}
    >
      <div
        className="text-center p-10 rounded-xl"
        style={{ backgroundColor: 'white', border: '1px solid var(--gray-200)' }}
      >
        <p className="text-sm font-medium mb-1" style={{ color: 'var(--gray-600)' }}>
          Sesión activa
        </p>
        <p className="text-lg font-semibold mb-6" style={{ color: 'var(--gray-900)' }}>
          {session.user.email}
        </p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
          style={{
            backgroundColor: 'var(--gray-100)',
            border: '1px solid var(--gray-200)',
            color: 'var(--gray-700)',
            cursor: 'pointer'
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}