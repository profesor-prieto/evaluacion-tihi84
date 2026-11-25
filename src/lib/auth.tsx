import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Teacher } from '../types'
import { normalizeRut } from './rut'
import { errorMessage, supabase } from './supabase'

interface AuthState {
  teacher: Teacher | null
  loading: boolean
  login: (rut: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function fetchCurrentTeacher(): Promise<Teacher | null> {
  const { data: sessionData } = await supabase.auth.getSession()
  const uid = sessionData.session?.user.id
  if (!uid) return null
  const { data, error } = await supabase
    .from('teacher_logins')
    .select('teacher:teachers(*)')
    .eq('auth_uid', uid)
    .maybeSingle()
  if (error) throw error
  return (data?.teacher as unknown as Teacher | null) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [teacher, setTeacher] = useState<Teacher | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCurrentTeacher()
      .then(setTeacher)
      .catch(() => setTeacher(null))
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (rut: string) => {
    const { data: s } = await supabase.auth.getSession()
    if (!s.session) {
      const { error } = await supabase.auth.signInAnonymously()
      if (error) throw new Error(`No se pudo iniciar la sesión: ${error.message}`)
    }
    const { data, error } = await supabase.rpc('login_with_rut', { p_rut: normalizeRut(rut) })
    if (error) throw new Error(errorMessage(error))
    setTeacher(data as Teacher)
  }, [])

  const logout = useCallback(async () => {
    await supabase.rpc('logout_teacher')
    await supabase.auth.signOut()
    setTeacher(null)
  }, [])

  return <AuthContext.Provider value={{ teacher, loading, login, logout }}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
