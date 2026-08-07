import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import type { User, Session } from '@supabase/supabase-js'

type AuthContextType = {
  user: User | null
  session: Session | null
  loading: boolean
  signOut: () => Promise<void>
  recoveryMode: boolean
  clearRecoveryMode: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [recoveryMode, setRecoveryMode] = useState(false)

  useEffect(() => {
    // Restaurar sesión activa
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Escuchar cambios (login, logout, refresco de token)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true)
      setLoading(false)
    })

    // En Tauri, el login OAuth (Google/Discord) abre el navegador del sistema y el resultado
    // vuelve por un servidor loopback local, no por un redirect dentro del webview.
    const unlistenOAuth = window.xtweaks?.auth.onOAuthSession((hash) => {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (params.get('type') === 'recovery') setRecoveryMode(true)
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token })
      }
    })

    return () => {
      subscription.unsubscribe()
      unlistenOAuth?.()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const clearRecoveryMode = () => setRecoveryMode(false)

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut, recoveryMode, clearRecoveryMode }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
