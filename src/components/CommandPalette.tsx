import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { CornerDownLeft, Search } from 'lucide-react'
import { NAV, type ScreenId } from '@/nav'
import { INSTALLED_APPS, PERFORMANCE_TWEAKS, PRIVACY_GROUPS } from '@/lib/mock'
import { cn } from '@/lib/utils'

type Entry = { id: string; label: string; hint: string; screen: ScreenId; kind: string }

export function CommandPalette({
  open,
  onClose,
  onNavigate,
}: {
  open: boolean
  onClose: () => void
  onNavigate: (id: ScreenId) => void
}) {
  const [q, setQ] = useState('')
  const [index, setIndex] = useState(0)

  const entries = useMemo<Entry[]>(() => {
    const nav: Entry[] = NAV.map((n) => ({
      id: `nav-${n.id}`, label: n.label, hint: n.description, screen: n.id, kind: 'Screen',
    }))
    const perf: Entry[] = PERFORMANCE_TWEAKS.map((t) => ({
      id: `perf-${t.id}`, label: t.name, hint: t.group, screen: 'performance', kind: 'Performance',
    }))
    const priv: Entry[] = PRIVACY_GROUPS.flatMap((g) =>
      g.items.map((t) => ({ id: `pr-${t.id}`, label: t.name, hint: g.title, screen: 'privacy' as ScreenId, kind: 'Privacy' })),
    )
    const apps: Entry[] = INSTALLED_APPS.map((a) => ({
      id: `app-${a.id}`, label: a.name, hint: a.publisher, screen: 'apps', kind: 'App',
    }))
    return [...nav, ...perf, ...priv, ...apps]
  }, [])

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = needle
      ? entries.filter((e) => e.label.toLowerCase().includes(needle) || e.hint.toLowerCase().includes(needle))
      : entries.slice(0, 15)
    return list.slice(0, 40)
  }, [q, entries])

  useEffect(() => setIndex(0), [q])

  useEffect(() => {
    if (!open) return
    setQ('')
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setIndex((i) => Math.min(i + 1, results.length - 1))
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setIndex((i) => Math.max(i - 1, 0))
      }
      if (e.key === 'Enter' && results[index]) {
        onNavigate(results[index].screen)
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose, results, index, onNavigate])

  return createPortal(
    <AnimatePresence>
      {open ? (
        <div className="fixed inset-0 z-[970] flex items-start justify-center pt-[14vh]">
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="acrylic relative w-[560px] overflow-hidden rounded-[5px] border border-line-strong shadow-[var(--shadow-pop)]"
          >
            <div className="flex items-center gap-2.5 border-b border-line px-4">
              <Search className="h-4 w-4 shrink-0 text-subtle" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Jump to a screen, tweak or app…"
                className="h-12 w-full bg-transparent text-[14px] placeholder:text-subtle focus:outline-none"
              />
              <kbd className="rounded-[4px] border border-line px-1.5 py-0.5 font-mono text-[10px] text-subtle">
                Esc
              </kbd>
            </div>
            <div className="scroll-area max-h-[340px] p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-8 text-center text-[13px] text-muted">No matches for “{q}”</p>
              ) : (
                results.map((r, i) => (
                  <button
                    key={r.id}
                    onMouseEnter={() => setIndex(i)}
                    onClick={() => {
                      onNavigate(r.screen)
                      onClose()
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-[4px] px-2.5 py-2 text-left transition-colors duration-150',
                      i === index ? 'bg-accent-soft' : 'hover:bg-card-hover',
                    )}
                  >
                    <span className="w-[86px] shrink-0 truncate rounded-[4px] bg-[var(--sunken)] px-1.5 py-[2px] text-center text-[10.5px] font-medium uppercase tracking-wide text-subtle">
                      {r.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{r.label}</span>
                      <span className="block truncate text-[11.5px] text-muted">{r.hint}</span>
                    </span>
                    {i === index ? <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-subtle" /> : null}
                  </button>
                ))
              )}
            </div>
            <div className="flex items-center gap-4 border-t border-line bg-[var(--sunken)] px-4 py-2 text-[11px] text-subtle">
              <span>↑ ↓ to navigate</span>
              <span>↵ to open</span>
              <span className="ml-auto">{results.length} results</span>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
