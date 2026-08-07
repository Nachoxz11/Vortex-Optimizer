import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { LogIn, UserPlus, Key, Mail, User as UserIcon, Loader2, AlertCircle } from 'lucide-react'

function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [username, setUsername] = useState('')

  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'discord' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recoverySent, setRecoverySent] = useState(false)
  const oauthTimeoutRef = useRef<number | null>(null)

  const handleOAuth = async (provider: 'google' | 'discord') => {
    setError(null)
    setOauthLoading(provider)
    // Si el usuario cierra el navegador antes de volver a la aplicación, no
    // recibimos ningún evento de Supabase. Liberamos el botón para que pueda
    // cancelar o volver a intentarlo.
    oauthTimeoutRef.current = window.setTimeout(() => {
      oauthTimeoutRef.current = null
      setOauthLoading(null)
      setError('El inicio de sesión fue cancelado o tardó demasiado. Podés intentarlo nuevamente.')
    }, 120000)
    try {
      if (isTauri() && window.xtweaks) {
        // El webview no puede recibir el redirect de vuelta: abrimos el navegador del sistema
        // y esperamos el token por el servidor loopback local (ver lib/auth.tsx).
        await window.xtweaks.auth.startOAuthServer()
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: 'http://127.0.0.1:14251',
            skipBrowserRedirect: true,
          },
        })
        if (error) throw error
        if (data?.url) await window.xtweaks.openUrl(data.url)
      } else {
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: { redirectTo: window.location.origin },
        })
        if (error) throw error
      }
    } catch (err: any) {
      if (oauthTimeoutRef.current !== null) {
        window.clearTimeout(oauthTimeoutRef.current)
        oauthTimeoutRef.current = null
      }
      setError(err.message || 'No se pudo iniciar sesión con el proveedor.')
      setOauthLoading(null)
    }
  }

  const handleForgotPassword = async () => {
    setError(null)
    setRecoverySent(false)
    if (!email.trim()) {
      setError('Ingresá tu email para enviarte el enlace de recuperación.')
      return
    }
    setLoading(true)
    try {
      const desktopAuth = isTauri() ? window.xtweaks : undefined
      if (desktopAuth) await desktopAuth.auth.startOAuthServer()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: desktopAuth ? 'http://127.0.0.1:14251' : window.location.origin,
      })
      if (resetError) throw resetError
      setRecoverySent(true)
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'No se pudo enviar el enlace de recuperación.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setRecoverySent(false)

    // Validations
    if (!email || !password) {
      setError('Please fill in all required fields.')
      return
    }
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (!isLogin && !username) {
      setError('Username is required for registration.')
      return
    }

    setLoading(true)

    try {
      if (isLogin) {
        // En caso de que pongan un username en lugar de email, no funcionará nativamente
        // con Supabase sin un lookup previo, pero le damos soporte base a email/password.
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username,
            },
          },
        })
        if (error) throw error
        
        // Sometimes signup requires email confirmation, we might want to inform the user
        // but for now we assume they are logged in or get an error.
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-scrim p-4 text-[var(--fg)]">
      {/* Background decorations matching Shell */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--accent)] opacity-[0.07] blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-[var(--brand-a)] opacity-[0.06] blur-[90px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex w-full max-w-sm flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-dim)] text-[var(--accent)]">
            {isLogin ? <LogIn size={24} /> : <UserPlus size={24} />}
          </div>
          <h2 className="text-xl font-medium tracking-tight">
            {isLogin ? 'Welcome back' : 'Create an account'}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {isLogin
              ? 'Enter your credentials to access your dashboard'
              : 'Sign up to sync your tweaks and preferences'}
          </p>
        </div>

        <AnimatePresence mode="wait">
          {recoverySent ? (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-4 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-400">
              Revisá tu email: te enviamos un enlace para recuperar la contraseña.
            </motion.div>
          ) : null}
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 flex items-start gap-2 overflow-hidden rounded-lg bg-red-500/10 p-3 text-sm text-red-500"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <p>{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                  <input
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <div className="relative">
            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
            />
          </div>

          <AnimatePresence initial={false}>
            {!isLogin && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 pl-10 pr-4 text-sm transition-colors focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : isLogin ? (
              'Sign in'
            ) : (
              'Create account'
            )}
          </button>
        </form>

        {isLogin ? (
          <button type="button" onClick={handleForgotPassword} disabled={loading} className="mt-3 text-center text-xs text-[var(--accent)] underline-offset-2 hover:underline disabled:pointer-events-none disabled:opacity-50">
            ¿Olvidaste tu contraseña?
          </button>
        ) : null}

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-[var(--border)]" />
          <span className="text-xs text-[var(--muted)]">o continuá con</span>
          <div className="h-px flex-1 bg-[var(--border)]" />
        </div>

        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={oauthLoading !== null}
            onClick={() => handleOAuth('google')}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-elevated)]/70 disabled:pointer-events-none disabled:opacity-50"
          >
            {oauthLoading === 'google' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3c-1.08.72-2.46 1.15-4.08 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z" />
                <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.27A12 12 0 0 0 0 12c0 1.94.46 3.77 1.27 5.38l4-3.1Z" />
                <path fill="#EA4335" d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.62l4 3.1c.95-2.85 3.6-4.95 6.73-4.95Z" />
              </svg>
            )}
            Google
          </button>

          <button
            type="button"
            disabled={oauthLoading !== null}
            onClick={() => handleOAuth('discord')}
            className="flex w-full items-center justify-center gap-2 rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 text-sm font-medium transition-colors hover:bg-[var(--bg-elevated)]/70 disabled:pointer-events-none disabled:opacity-50"
          >
            {oauthLoading === 'discord' ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2">
                <path d="M20.32 4.37a19.8 19.8 0 0 0-4.9-1.52.07.07 0 0 0-.08.04c-.21.38-.45.87-.61 1.26a18.3 18.3 0 0 0-5.46 0 12.6 12.6 0 0 0-.62-1.26.08.08 0 0 0-.08-.04c-1.7.29-3.36.8-4.9 1.52a.07.07 0 0 0-.03.03C.53 8.6-.32 12.71.1 16.77a.08.08 0 0 0 .03.06 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.11 13.1 13.1 0 0 1-1.87-.9.08.08 0 0 1 0-.13c.13-.09.25-.19.37-.28a.08.08 0 0 1 .08 0c3.93 1.8 8.18 1.8 12.06 0a.08.08 0 0 1 .08 0c.13.1.25.2.37.29a.08.08 0 0 1 0 .13c-.6.35-1.22.65-1.87.9a.08.08 0 0 0-.05.11c.36.7.78 1.37 1.24 2a.08.08 0 0 0 .08.03 19.8 19.8 0 0 0 6.01-3.03.08.08 0 0 0 .03-.06c.5-4.7-.83-8.77-3.5-12.37a.06.06 0 0 0-.03-.03ZM8.02 14.32c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.95 2.42-2.16 2.42Z" />
              </svg>
            )}
            Discord
          </button>
        </div>

        {oauthLoading && (
          <button
            type="button"
            onClick={() => {
              if (oauthTimeoutRef.current !== null) {
                window.clearTimeout(oauthTimeoutRef.current)
                oauthTimeoutRef.current = null
              }
              setOauthLoading(null)
              setError('Inicio de sesión cancelado.')
            }}
            className="mt-3 text-center text-xs text-[var(--muted)] underline underline-offset-2 hover:text-[var(--fg)]"
          >
            Cancelar inicio de sesión
          </button>
        )}

        <div className="mt-6 flex items-center justify-center gap-1 text-sm text-[var(--muted)]">
          <span>{isLogin ? "Don't have an account?" : 'Already have an account?'}</span>
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError(null)
            }}
            className="font-medium text-[var(--accent)] hover:underline"
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
