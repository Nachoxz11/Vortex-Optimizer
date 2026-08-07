import { useState } from 'react'
import { KeyRound, Loader2, LockKeyhole, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth'

export function ResetPasswordScreen() {
  const { clearRecoveryMode, signOut } = useAuth()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const cancelReset = async () => {
    await signOut().catch(() => {})
    clearRecoveryMode()
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.')
      return
    }

    setLoading(true)
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      setDone(true)
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'No se pudo actualizar la contraseña.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-scrim p-4 text-[var(--fg)]">
      <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--accent)] opacity-[0.07] blur-[80px]" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-[var(--brand-a)] opacity-[0.06] blur-[90px]" />
      <div className="relative w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--bg)] p-6 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--accent-dim)] text-[var(--accent)]">
            <LockKeyhole size={24} />
          </div>
          <h2 className="text-xl font-medium tracking-tight">Nueva contraseña</h2>
          <p className="text-sm text-[var(--muted)]">Elegí una contraseña nueva para tu cuenta.</p>
        </div>

        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-500">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        ) : null}

        {done ? (
          <div className="space-y-4 text-center">
            <div className="rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-400">Contraseña actualizada correctamente.</div>
            <button type="button" onClick={clearRecoveryMode} className="w-full rounded-md bg-[var(--accent)] py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)]">Continuar</button>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <label className="relative block">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
              <input type="password" autoComplete="new-password" placeholder="Nueva contraseña" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 pl-10 pr-4 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" />
            </label>
            <label className="relative block">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
              <input type="password" autoComplete="new-password" placeholder="Repetir contraseña" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="w-full rounded-md border border-[var(--border)] bg-[var(--bg-elevated)] py-2.5 pl-10 pr-4 text-sm focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]" />
            </label>
            <button type="submit" disabled={loading} className="mt-2 flex w-full items-center justify-center gap-2 rounded-md bg-[var(--accent)] py-2.5 text-sm font-medium text-white hover:bg-[var(--accent-hover)] disabled:pointer-events-none disabled:opacity-50">
              {loading ? <Loader2 size={16} className="animate-spin" /> : 'Actualizar contraseña'}
            </button>
            <button type="button" onClick={cancelReset} disabled={loading} className="w-full rounded-md border border-[var(--border)] py-2.5 text-sm font-medium text-[var(--muted)] transition-colors hover:bg-[var(--bg-elevated)] hover:text-[var(--fg)] disabled:pointer-events-none disabled:opacity-50">
              Cancelar
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
