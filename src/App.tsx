import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import AuthPage from './components/auth/AuthPage'
import AppShell from './components/layout/AppShell'
import Home from './pages/Home'
import UsersPage from './pages/UsersPage'
import LookupPage from './pages/LookupPage'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import { ProfileProvider, useProfile } from './context/ProfileContext'

function AppContent() {
  const { profile, loading } = useProfile()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--gray-50)' }}>
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--blue-accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (!profile || !profile.is_active) return <AuthPage accessDenied={true} />

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/lookup" element={<LookupPage />} />
        {/* Catch-all route to redirect unknown paths to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--gray-50)' }}>
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin"
          style={{ borderColor: 'var(--blue-accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (!session) return <AuthPage />

  return (
    <BrowserRouter>
      <ProfileProvider session={session}>
        <AppContent />
      </ProfileProvider>
    </BrowserRouter>
  )
}