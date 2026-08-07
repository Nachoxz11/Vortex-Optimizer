import { motion } from 'framer-motion'
import { useT } from '@/lib/i18n'
import type { BootStep } from '@/App'
import logo from '@/assets/vortex-logo.png'

const STEP_PROGRESS: Record<BootStep, number> = {
  system: 0.35,
  tweaks: 0.7,
  timeout: 0.7,
  error: 1,
  done: 1,
}

const STEP_LABEL_KEY: Record<BootStep, 'splash.step.system' | 'splash.step.tweaks' | 'splash.step.timeout' | 'splash.step.error'> = {
  system: 'splash.step.system',
  tweaks: 'splash.step.tweaks',
  timeout: 'splash.step.timeout',
  error: 'splash.step.error',
  done: 'splash.step.tweaks',
}

/** Shown while the app does its first real read of system state (`useBoot` in App.tsx). */
export function Splash({ step = 'system' }: { step?: BootStep }) {
  const t = useT()
  const progress = STEP_PROGRESS[step]
  const isError = step === 'error'

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="flex h-full flex-col items-center justify-center gap-4 bg-scrim"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="overflow-hidden rounded-[6px] shadow-[0_4px_24px_rgba(0,0,0,.35)]"
      >
        <img src={logo} alt="Vortex Optimizer" className="h-14 w-14 object-cover" />
      </motion.div>
      <div className="text-center">
        <p className="text-[13.5px] font-semibold tracking-[-0.01em]">Vortex-Optimizer</p>
        <p className={`mt-0.5 text-[12px] ${isError ? 'text-[var(--danger,#e5484d)]' : 'text-muted'}`}>
          {t(STEP_LABEL_KEY[step])}
        </p>
      </div>
      <div className="h-[3px] w-[160px] overflow-hidden rounded-full bg-[var(--sunken)]">
        <motion.div
          className={`h-full rounded-full ${isError ? 'bg-[var(--danger,#e5484d)]' : 'bg-[var(--accent)]'}`}
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </motion.div>
  )
}
