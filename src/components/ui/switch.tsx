import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function Switch({
  checked,
  onChange,
  disabled,
  size = 'md',
  label,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  label?: string
  className?: string
}) {
  const w = size === 'sm' ? 34 : 40
  const h = size === 'sm' ? 18 : 21
  const knob = size === 'sm' ? 10 : 12

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      style={{ width: w, height: h }}
      className={cn(
        'group relative shrink-0 rounded-full border transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-40',
        checked
          ? 'border-[color-mix(in_srgb,var(--accent)_60%,transparent)] bg-[var(--accent)]'
          : 'border-line-strong bg-[var(--sunken)] hover:border-[color-mix(in_srgb,var(--fg)_35%,transparent)]',
        className,
      )}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 620, damping: 34 }}
        style={{ width: knob, height: knob }}
        className={cn(
          'absolute top-1/2 block -translate-y-1/2 rounded-full transition-colors duration-200',
          checked
            ? 'right-[4px] bg-[var(--accent-fg)] group-active:w-[16px]'
            : 'left-[4px] bg-[color-mix(in_srgb,var(--fg)_62%,transparent)] group-hover:bg-[var(--fg)]',
        )}
      />
    </button>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  className?: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border transition-all duration-200',
        checked
          ? 'border-[var(--accent)] bg-[var(--accent)]'
          : 'border-line-strong bg-[var(--sunken)] hover:border-[color-mix(in_srgb,var(--fg)_40%,transparent)]',
        className,
      )}
    >
      <motion.svg
        viewBox="0 0 16 16"
        className="h-3 w-3"
        initial={false}
        animate={{ opacity: checked ? 1 : 0, scale: checked ? 1 : 0.6 }}
        transition={{ duration: 0.16 }}
      >
        <path
          d="M3.5 8.4 6.4 11.2 12.5 4.9"
          fill="none"
          stroke="var(--accent-fg)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    </button>
  )
}
