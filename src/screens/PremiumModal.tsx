import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { Check, Sparkles, X, Crown, ExternalLink, KeyRound } from 'lucide-react'
import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js'
import { usePremium } from '@/lib/premium'
import { useAuth } from '@/lib/auth'
import { PremiumBadge } from '@/components/PremiumBadge'
import { TextField } from '@/components/ui/input'

// El Client ID de PayPal es público y se incluye en el bundle del frontend.
// El fallback permite que el botón siga apareciendo en despliegues donde Vercel
// todavía no tiene configurada la variable VITE_PAYPAL_CLIENT_ID.
const PUBLIC_PAYPAL_CLIENT_ID = 'AYEyB05i4fEo0LGlm_3_Svoiqsz0Q3v1u0KlfnwA6IKJV4RuviHt9unAqcuubBSGjKf7aTuLmuzPJtXM'
const PAYPAL_API_BASE = import.meta.env.VITE_API_BASE_URL
  || (window.location.hostname === 'tauri.localhost' ? 'https://xtweaks-update.vercel.app' : '')

function apiUrl(path: string) {
  return `${PAYPAL_API_BASE}${path}`
}

export function PremiumModal() {
  const { modalOpen, hideUpgradeModal, refreshPremiumStatus } = usePremium()
  const { session } = useAuth()
  const [licenseKey, setLicenseKey] = useState('')
  const [activatingKey, setActivatingKey] = useState(false)
  const [ownerCount, setOwnerCount] = useState('1')
  const [ownerDuration, setOwnerDuration] = useState('')
  const [generatedKeys, setGeneratedKeys] = useState<string[]>([])
  const [generatingKeys, setGeneratingKeys] = useState(false)

  if (!modalOpen) return null

  const freeFeatures = [
    'Tweaks básicos de sistema',
    'Limpieza temporal y accesos',
    'Monitoreo básico de hardware',
    'Información general de sistema',
  ]

  const premiumFeatures = [
    'Advanced Tweaks & Danger Zone',
    'Gaming Optimizer & Profiles',
    'Kernel Optimizations & Timer Resolution',
    'CPU Scheduler & Core Unparking',
    'GPU Latency Optimization & HAGS',
    'Memory Compression Control',
    'Backup y Restore Center automatizado',
  ]

  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID || PUBLIC_PAYPAL_CLIENT_ID

  const activateKey = async () => {
    if (!session) {
      window.alert('Inicia sesión para activar una key.')
      return
    }
    if (!licenseKey.trim()) return
    setActivatingKey(true)
    try {
      const response = await fetch(apiUrl('/api/keys/activate'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: licenseKey }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error ?? 'No se pudo activar la key.')
      await refreshPremiumStatus()
      setLicenseKey('')
      window.alert('Key activada. Premium ya está disponible en tu cuenta.')
      hideUpgradeModal()
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudo activar la key.')
    } finally {
      setActivatingKey(false)
    }
  }

  const isOwner = session?.user.email?.trim().toLowerCase() === 'ig.devgo@gmail.com'

  const generateOwnerKeys = async () => {
    if (!session || !isOwner || generatingKeys) return
    setGeneratingKeys(true)
    try {
      const response = await fetch(apiUrl('/api/keys/generate'), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          count: Number(ownerCount),
          durationDays: ownerDuration.trim() ? Number(ownerDuration) : null,
        }),
      })
      const data = await response.json().catch(() => ({})) as { keys?: string[]; error?: string }
      if (!response.ok || !Array.isArray(data.keys)) throw new Error(data.error ?? 'No se pudieron generar las keys.')
      setGeneratedKeys(data.keys)
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'No se pudieron generar las keys.')
    } finally {
      setGeneratingKeys(false)
    }
  }

  const openPayPal = async () => {
    if (!session) {
      window.alert('Inicia sesión para comprar Premium.')
      return
    }

    try {
      let approvalUrl: string
      if (window.xtweaks?.paypalCreateOrder) {
        approvalUrl = await window.xtweaks.paypalCreateOrder(session.access_token)
      } else {
        const response = await fetch(apiUrl('/api/paypal/createOrder'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok || !data.approvalUrl) throw new Error(data.error ?? 'No se pudo crear la orden de PayPal')
        approvalUrl = data.approvalUrl
      }

      if (window.xtweaks?.openUrl) {
        await window.xtweaks.openUrl(approvalUrl)
      } else {
        window.open(approvalUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : typeof error === 'string' ? error : JSON.stringify(error)
      window.alert(`No se pudo abrir el pago de PayPal.\n\n${message}`)
    }
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={hideUpgradeModal}
          className="absolute inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative z-10 w-full max-w-[720px] overflow-hidden rounded-[20px] border border-amber-500/30 bg-[#0f0e17]/90 p-6 shadow-[0_0_50px_rgba(245,158,11,0.2)] backdrop-blur-2xl"
        >
          {/* Background Glow */}
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-500/10 blur-[100px]" />
          <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-violet-600/15 blur-[100px]" />

          {/* Close Button */}
          <button
            type="button"
            onClick={hideUpgradeModal}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-muted transition-colors hover:bg-white/10 hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Header */}
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-600 shadow-[0_0_25px_rgba(245,158,11,0.4)]">
              <Crown className="h-6 w-6 text-slate-950" />
            </div>
            <PremiumBadge size="lg" className="mb-2" />
            <h2 className="text-[26px] font-bold tracking-tight text-fg">
              Desbloquea el máximo potencial
            </h2>
            <p className="mt-1 text-[13.5px] text-muted max-w-[480px] mx-auto">
              Accede a tweaks de kernel sin restricciones, optimización avanzada de gaming y soporte prioritario.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            {/* Free Tier */}
            <div className="rounded-[14px] border border-white/5 bg-white/[0.02] p-4">
              <h3 className="font-semibold text-fg text-[15px] flex items-center justify-between">
                Plan Free
                <span className="text-[12px] font-normal text-muted">$0 / siempre</span>
              </h3>
              <ul className="mt-3 space-y-2 text-[12.5px] text-subtle">
                {freeFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-3.5 w-3.5 text-muted shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Premium Tier */}
            <div className="relative rounded-[14px] border border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-violet-600/10 p-4 shadow-[0_0_20px_rgba(245,158,11,0.1)]">
              <div className="absolute -top-3 right-3 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-2.5 py-0.5 text-[10px] font-bold text-slate-950 uppercase tracking-wider">
                Recomendado
              </div>
              <h3 className="font-semibold text-amber-200 text-[15px] flex items-center justify-between">
                Plan Premium
                <span className="text-[14px] font-bold text-amber-400">Pago único</span>
              </h3>
              <ul className="mt-3 space-y-2 text-[12.5px] text-fg">
                {premiumFeatures.map((f, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                    <span className="font-medium">{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Payment CTA / PayPal */}
          <div className="mt-5 rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-white/[0.03] to-violet-500/10 p-4">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-amber-300">Acceso permanente</p>
                <p className="mt-1 text-[12px] text-muted">Sin mensualidades ni renovación automática</p>
              </div>
              <p className="text-2xl font-bold text-fg">$4.99 <span className="text-xs font-normal text-muted">USD</span></p>
            </div>
            {paypalClientId && session ? (
              <PayPalScriptProvider options={{ clientId: paypalClientId, currency: 'USD', intent: 'capture' }}>
                <PayPalButtons
                  style={{ layout: 'horizontal', color: 'gold', shape: 'rect', label: 'pay' }}
                  createOrder={async () => {
                    const response = await fetch(apiUrl('/api/paypal/createOrder'), {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${session.access_token}` },
                    })
                    const data = await response.json()
                    if (!response.ok || !data.id) throw new Error(data.error ?? 'No se pudo crear la orden')
                    return data.id
                  }}
                  onApprove={async (data) => {
                    const response = await fetch(apiUrl('/api/paypal/captureOrder'), {
                      method: 'POST',
                      headers: {
                        Authorization: `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({ orderID: data.orderID }),
                    })
                    if (!response.ok) throw new Error('No se pudo verificar el pago')
                    await refreshPremiumStatus()
                    hideUpgradeModal()
                  }}
                  onError={() => window.alert('No se pudo procesar el pago. Inténtalo nuevamente.')}
                />
              </PayPalScriptProvider>
            ) : (
              <button
                type="button"
                onClick={() => window.alert(session ? 'El pago no está disponible en este momento. Inténtalo nuevamente.' : 'Inicia sesión para comprar Premium.')}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-3 text-sm font-bold text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.25)] transition hover:brightness-110"
              >
                Comprar Premium — $4.99 USD
              </button>
            )}
            <button
              type="button"
              onClick={openPayPal}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-fg transition hover:border-amber-400/50 hover:bg-white/[0.08]"
            >
              Abrir PayPal en navegador externo
              <ExternalLink className="h-4 w-4" />
            </button>
            <p className="mt-2 text-center text-[11px] text-muted">
              Puedes pagar con el botón integrado o abrir PayPal en tu navegador. Guarda el comprobante del pago.
            </p>
          </div>

          {isOwner ? (
            <div className="mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/[0.04] p-4">
              <div className="mb-3 flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-cyan-300" />
                <div>
                  <p className="text-[12px] font-semibold uppercase tracking-wider text-cyan-200">Generador del owner</p>
                  <p className="mt-1 text-[11px] text-muted">Keys autorizadas para {session?.user.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-[1fr_1.4fr_auto] items-end gap-2">
                <TextField aria-label="Cantidad de keys" type="number" min="1" max="100" value={ownerCount} onChange={(event) => setOwnerCount(event.target.value)} placeholder="Cantidad" />
                <TextField aria-label="Duración en días" type="number" min="1" max="3650" value={ownerDuration} onChange={(event) => setOwnerDuration(event.target.value)} placeholder="Días (vacío = permanente)" />
                <button type="button" disabled={generatingKeys} onClick={generateOwnerKeys} className="h-8 rounded-[6px] bg-cyan-400 px-3 text-[12px] font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:pointer-events-none disabled:opacity-45">
                  {generatingKeys ? 'Generando…' : 'Generar'}
                </button>
              </div>
              {generatedKeys.length > 0 ? (
                <textarea readOnly value={generatedKeys.join('\n')} onFocus={(event) => event.currentTarget.select()} className="mt-3 min-h-20 w-full rounded-[6px] border border-cyan-400/25 bg-black/20 p-2 font-mono text-[12px] text-cyan-100 outline-none" aria-label="Keys generadas" />
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
            <div className="mb-3 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-amber-400" />
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wider text-fg">¿Tenés una key?</p>
                <p className="mt-1 text-[11px] text-muted">Activá Premium directamente en tu cuenta.</p>
              </div>
            </div>
            <div className="flex items-end gap-2">
              <TextField
                aria-label="Key de Premium"
                value={licenseKey}
                onChange={(event) => setLicenseKey(event.target.value.toUpperCase())}
                placeholder="VX-XXXX-XXXX-XXXX"
                className="font-mono uppercase"
              />
              <button
                type="button"
                disabled={activatingKey || !licenseKey.trim()}
                onClick={activateKey}
                className="h-8 shrink-0 rounded-[6px] bg-amber-500 px-3 text-[12px] font-semibold text-slate-950 transition hover:bg-amber-400 disabled:pointer-events-none disabled:opacity-45"
              >
                {activatingKey ? 'Activando…' : 'Activar key'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
