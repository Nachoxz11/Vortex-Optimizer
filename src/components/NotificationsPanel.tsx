import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, BellOff } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { Tooltip } from './ui/tooltip'
import type { ActivityItem } from '@/lib/mock'

const KIND_COLOR: Record<string, string> = {
  success: 'var(--success)',
  warning: 'var(--warning)',
  danger: 'var(--danger)',
  info: 'var(--accent)',
  muted: 'var(--subtle)',
}

function relativeTime(minutesAgo: number, lang: 'en' | 'es') {
  if (lang === 'es') {
    if (minutesAgo < 1) return 'Recién'
    if (minutesAgo < 60) return `hace ${minutesAgo}m`
    const hours = Math.round(minutesAgo / 60)
    if (hours < 24) return `hace ${hours}h`
    return `hace ${Math.round(hours / 24)}d`
  }
  if (minutesAgo < 1) return 'Just now'
  if (minutesAgo < 60) return `${minutesAgo}m ago`
  const hours = Math.round(minutesAgo / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/** Bell button in the title bar — opens a popover with the real activity log from the store. */
export function NotificationsBell() {
  const { activity, unreadCount, markActivityRead } = useApp()
  const t = useT()
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  const toggle = () => {
    if (open) {
      setOpen(false)
      return
    }
    const r = anchorRef.current?.getBoundingClientRect()
    if (!r) return
    const panelWidth = 340
    const left = Math.max(12, Math.min(r.right - panelWidth, window.innerWidth - panelWidth - 12))
    const top = Math.max(12, Math.min(r.bottom + 8, window.innerHeight - 440))
    setPos({ x: left, y: top })
    setOpen(true)
    markActivityRead()
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
    }
  }, [open])

  return (
    <>
      <Tooltip content={`${t('shell.notifications')} · ${activity.length} ${t('shell.recent')}`} side="bottom">
        <button
          ref={anchorRef}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            toggle()
          }}
          className="no-drag relative flex h-[28px] w-[28px] items-center justify-center rounded-[6px] text-muted transition-colors hover:bg-card hover:text-fg"
          aria-label={t('shell.notifications')}
        >
          <Bell className="h-3.5 w-3.5" />
          {unreadCount > 0 ? (
            <span className="absolute right-0.5 top-0.5 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-[var(--accent)] px-[3px] text-[9px] font-semibold leading-none text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>
      </Tooltip>
      {createPortal(
        <AnimatePresence>
          {open && pos ? (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -3, scale: 0.985 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              style={{ left: pos.x, top: pos.y }}
              className="acrylic fixed z-[950] w-[340px] overflow-hidden rounded-[5px] border border-line-strong shadow-[var(--shadow-pop)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                <span className="text-[12.5px] font-semibold">{t('shell.notifications')}</span>
                <span className="text-[11px] text-subtle">{activity.length} {t('shell.recent')}</span>
              </div>
              <div className="max-h-[360px] overflow-y-auto">
                {activity.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                    <BellOff className="h-5 w-5 text-subtle" />
                    <p className="text-[12px] text-muted">{t('shell.notificationsEmpty')}</p>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    {activity.slice(0, 12).map((a: ActivityItem) => (
                      <div key={a.id} className="flex gap-2.5 px-3 py-2.5">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: KIND_COLOR[a.kind] ?? 'var(--subtle)' }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12.5px] font-medium">{t.tt('activity', a.id, 'title', a.title)}</p>
                          <p className="mt-0.5 truncate text-[11.5px] text-muted">{t.tt('activity', a.id, 'detail', a.detail)}</p>
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-[10.5px] text-subtle">
                          {relativeTime(a.minutesAgo, t.lang)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
