import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole = 'owner' | 'admin' | 'supervisor' | 'member' | 'guest'

export interface Profile {
  id: string
  name: string
  email: string
  role: UserRole
  is_active: boolean
}

interface ProfileContextType {
  profile: Profile | null
  loading: boolean
}

const ProfileContext = createContext<ProfileContextType>({ profile: null, loading: true })

export function ProfileProvider({ session, children }: { session: Session; children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, email, role, is_active')
        .eq('email', session.user.email)
        .single()
      setProfile(data ?? null)
      setLoading(false)
    }
    fetchProfile()
  }, [session])

  return (
    <ProfileContext.Provider value={{ profile, loading }}>
      {children}
    </ProfileContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useProfile = () => useContext(ProfileContext)