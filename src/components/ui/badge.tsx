import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

const TONES = {
  neutral: 'bg-[var(--sunken)] text-muted border-line',
  accent: 'bg-accent-soft text-[var(--accent)] border-[color-mix(in_srgb,var(--accent)_28%,transparent)]',
  success: 'bg-success-soft text-[var(--success)] border-[color-mix(in_srgb,var(--success)_28%,transparent)]',
  warning: 'bg-warning-soft text-[var(--warning)] border-[color-mix(in_srgb,var(--warning)_28%,transparent)]',
  danger: 'bg-danger-soft text-[var(--danger)] border-[color-mix(in_srgb,var(--danger)_28%,transparent)]',
  info: 'bg-info-soft text-[var(--info)] border-[color-mix(in_srgb,var(--info)_28%,transparent)]',
} as const

export type BadgeTone = keyof typeof TONES

export function Badge({
  children,
  tone = 'neutral',
  dot,
  className,
}: {
  children: ReactNode
  tone?: BadgeTone
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-[2px] text-[11px] font-medium leading-4 whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  )
}

export function Pill({
  children,
  active,
  onClick,
  className,
}: {
  children: ReactNode
  active?: boolean
  onClick?: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-7 rounded-full border px-3 text-[12px] font-medium transition-all duration-200',
        active
          ? 'border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-accent-soft text-[var(--accent)]'
          : 'border-line bg-card text-muted hover:bg-card-hover hover:text-fg',
        className,
      )}
    >
      {children}
    </button>
  )
}
