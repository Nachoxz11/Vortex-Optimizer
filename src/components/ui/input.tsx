import { Search, X } from 'lucide-react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  className,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
  autoFocus?: boolean
}) {
  return (
    <div
      className={cn(
        'group relative flex h-8 items-center gap-2 rounded-[4px] border border-line bg-card px-2.5 transition-colors duration-200 focus-within:border-[color-mix(in_srgb,var(--accent)_55%,transparent)] hover:bg-card-hover',
        className,
      )}
    >
      <Search className="h-3.5 w-3.5 shrink-0 text-subtle" />
      <input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-full w-full min-w-0 bg-transparent text-[13px] text-fg placeholder:text-subtle focus:outline-none"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="rounded-full p-0.5 text-subtle transition-colors hover:bg-[var(--sunken)] hover:text-fg"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      ) : null}
      <span className="pointer-events-none absolute inset-x-0 -bottom-px h-[2px] scale-x-0 rounded-full bg-[var(--accent)] transition-transform duration-200 group-focus-within:scale-x-100" />
    </div>
  )
}

export function TextField({
  label,
  hint,
  adornment,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; adornment?: ReactNode }) {
  return (
    <label className="block">
      {label ? <span className="mb-1.5 block text-[12.5px] font-medium">{label}</span> : null}
      <span className="flex h-8 items-center gap-2 rounded-[4px] border border-line bg-card px-2.5 transition-colors duration-200 focus-within:border-[color-mix(in_srgb,var(--accent)_55%,transparent)]">
        {adornment}
        <input
          className={cn(
            'h-full w-full bg-transparent text-[13px] text-fg placeholder:text-subtle focus:outline-none',
            className,
          )}
          {...props}
        />
      </span>
      {hint ? <span className="mt-1 block text-[11.5px] text-subtle">{hint}</span> : null}
    </label>
  )
}

export function Slider({
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  className,
  format,
}: {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (v: number) => void
  className?: string
  format?: (v: number) => string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className="relative flex h-5 flex-1 items-center">
        <div className="absolute inset-x-0 h-1 rounded-full bg-[var(--sunken)]" />
        <motion.div
          className="absolute h-1 rounded-full bg-[var(--accent)]"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.18 }}
        />
        <motion.div
          className="pointer-events-none absolute h-3.5 w-3.5 rounded-full border-[3px] border-[var(--accent)] bg-[var(--elevated)] shadow-[0_1px_3px_rgba(0,0,0,.3)]"
          animate={{ left: `calc(${pct}% - 7px)` }}
          transition={{ duration: 0.18 }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full cursor-pointer opacity-0"
        />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-[12px] text-muted">
        {format ? format(value) : value}
      </span>
    </div>
  )
}
