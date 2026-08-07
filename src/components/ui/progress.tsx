import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function Progress({
  value,
  color,
  className,
  height = 6,
  indeterminate,
  striped,
}: {
  value: number
  color?: string
  className?: string
  height?: number
  indeterminate?: boolean
  striped?: boolean
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={100}
      style={{ height }}
      className={cn('relative w-full overflow-hidden rounded-full bg-[var(--sunken)]', className)}
    >
      {indeterminate ? (
        <motion.div
          className="absolute inset-y-0 w-1/3 rounded-full"
          style={{ background: color ?? 'var(--accent)' }}
          animate={{ x: ['-100%', '320%'] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : (
        <motion.div
          className="h-full rounded-full"
          style={{
            background: color ?? 'var(--accent)',
            backgroundImage: striped
              ? 'linear-gradient(115deg, rgba(255,255,255,.22) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.22) 50%, rgba(255,255,255,.22) 75%, transparent 75%)'
              : undefined,
            backgroundSize: striped ? '14px 14px' : undefined,
          }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(0, Math.min(100, value))}%` }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        />
      )}
    </div>
  )
}

/** Multi-segment bar used for storage and cleaner breakdowns. */
export function SegmentedBar({
  segments,
  height = 14,
  className,
}: {
  segments: Array<{ id: string; value: number; color: string; label?: string }>
  height?: number
  className?: string
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  return (
    <div
      style={{ height }}
      className={cn('flex w-full overflow-hidden rounded-full bg-[var(--sunken)]', className)}
    >
      {segments.map((s, i) => (
        <motion.div
          key={s.id}
          title={s.label}
          className="h-full border-r-2 border-[var(--scrim)] last:border-r-0 transition-[filter] duration-200 hover:brightness-125"
          style={{ background: s.color }}
          initial={{ width: 0 }}
          animate={{ width: `${(s.value / total) * 100}%` }}
          transition={{ duration: 0.6, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
    </div>
  )
}
