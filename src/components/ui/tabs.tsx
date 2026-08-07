import { motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: Array<{ id: string; label: string; icon?: ReactNode; count?: number }>
  value: string
  onChange: (id: string) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center gap-1 border-b border-line', className)}>
      {tabs.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'relative flex h-9 items-center gap-2 rounded-t-[6px] px-3 text-[13px] font-medium transition-colors duration-200',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {t.icon}
            {t.label}
            {typeof t.count === 'number' ? (
              <span className="rounded-full bg-[var(--sunken)] px-1.5 text-[11px] text-muted">{t.count}</span>
            ) : null}
            {active ? (
              <motion.span
                layoutId="tab-underline"
                className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-[var(--accent)]"
                transition={{ type: 'spring', stiffness: 520, damping: 40 }}
              />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  options: Array<{ id: string; label: string; icon?: ReactNode }>
  value: string
  onChange: (id: string) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-0.5 rounded-[4px] border border-line bg-[var(--sunken)] p-0.5',
        className,
      )}
    >
      {options.map((o) => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            className={cn(
              'relative flex items-center gap-1.5 rounded-[4px] px-2.5 font-medium transition-colors duration-200',
              size === 'sm' ? 'h-6 text-[11.5px]' : 'h-7 text-[12.5px]',
              active ? 'text-fg' : 'text-muted hover:text-fg',
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${options.map((x) => x.id).join('')}`}
                className="absolute inset-0 rounded-[6px] border border-line bg-card shadow-[0_1px_2px_rgba(0,0,0,.12)]"
                transition={{ type: 'spring', stiffness: 560, damping: 42 }}
              />
            ) : null}
            <span className="relative z-10 flex items-center gap-1.5">
              {o.icon}
              {o.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
