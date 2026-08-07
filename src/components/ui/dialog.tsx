import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IconButton } from './button'

export function Dialog({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  width = 460,
  tone = 'default',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  width?: number
  tone?: 'default' | 'danger' | 'warning'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[900] flex items-center justify-center p-6">
          <motion.div
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            style={{ width }}
            className="acrylic relative max-h-[80vh] overflow-hidden rounded-[5px] border border-line-strong shadow-[var(--shadow-pop)]"
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 6 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-start gap-3 px-5 pt-5">
              {icon ? (
                <div
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px]',
                    tone === 'danger'
                      ? 'bg-danger-soft text-[var(--danger)]'
                      : tone === 'warning'
                        ? 'bg-warning-soft text-[var(--warning)]'
                        : 'bg-accent-soft text-[var(--accent)]',
                  )}
                >
                  {icon}
                </div>
              ) : null}
              <div className="min-w-0 flex-1">
                <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
                {description ? (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{description}</p>
                ) : null}
              </div>
              <IconButton label="Close" size="iconSm" onClick={onClose}>
                <X className="h-4 w-4" />
              </IconButton>
            </div>
            {children ? (
              <div className="scroll-area max-h-[46vh] px-5 py-4 text-[13px]">{children}</div>
            ) : (
              <div className="h-4" />
            )}
            {footer ? (
              <div className="flex items-center justify-end gap-2 border-t border-line bg-[var(--sunken)] px-5 py-3">
                {footer}
              </div>
            ) : null}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
