import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useApp } from '@/lib/store'
import { cn } from '@/lib/utils'

const TONE = {
  default: { Icon: Info, cls: 'text-[var(--accent)] bg-accent-soft' },
  success: { Icon: CheckCircle2, cls: 'text-[var(--success)] bg-success-soft' },
  warning: { Icon: AlertTriangle, cls: 'text-[var(--warning)] bg-warning-soft' },
  danger: { Icon: XCircle, cls: 'text-[var(--danger)] bg-danger-soft' },
  info: { Icon: Info, cls: 'text-[var(--info)] bg-info-soft' },
}

export function Toaster() {
  const { toasts, dismissToast } = useApp()
  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[980] flex w-[340px] flex-col gap-2">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const tone = TONE[t.tone ?? 'default']
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 30, scale: 0.97 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="acrylic pointer-events-auto flex items-start gap-3 rounded-[4px] border border-line-strong p-3 shadow-[var(--shadow-pop)]"
            >
              <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-[4px]', tone.cls)}>
                <tone.Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium leading-tight">{t.title}</p>
                {t.description ? (
                  <p className="mt-0.5 text-[12px] leading-snug text-muted">{t.description}</p>
                ) : null}
              </div>
              <button
                onClick={() => dismissToast(t.id)}
                className="rounded p-0.5 text-subtle transition-colors hover:text-fg"
                aria-label="Dismiss"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <motion.span
                className="absolute inset-x-0 bottom-0 h-[2px] origin-left rounded-b-[10px] bg-[var(--accent)]/60"
                initial={{ scaleX: 1 }}
                animate={{ scaleX: 0 }}
                transition={{ duration: 4.2, ease: 'linear' }}
              />
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
