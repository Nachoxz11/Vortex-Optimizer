import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n'

export function SectionTitle({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('mb-3 flex items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-[14.5px] font-semibold tracking-[-0.012em]">{title}</h2>
        {description ? <p className="mt-0.5 text-[12px] text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function KeyValue({
  label,
  value,
  mono,
  className,
}: {
  label: ReactNode
  value: ReactNode
  mono?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-4 py-[7px] text-[12.5px]', className)}>
      <span className="shrink-0 text-muted">{label}</span>
      <span className={cn('truncate text-right font-medium', mono && 'font-mono text-[12px]')}>{value}</span>
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-[var(--border)]', className)} />
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('relative overflow-hidden rounded-[6px] bg-[var(--sunken)]', className)}>
      <span
        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        style={{ animation: 'xt-shimmer 1.4s infinite' }}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-[4px] bg-[var(--sunken)] text-subtle">
        {icon}
      </div>
      <p className="text-[13.5px] font-semibold">{title}</p>
      <p className="max-w-[380px] text-[12.5px] leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}

export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.035 } } }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function RiskChip({ risk }: { risk: 'Safe' | 'Moderate' | 'Advanced' }) {
  const t = useT()
  const map = {
    Safe: 'text-[var(--success)] bg-success-soft',
    Moderate: 'text-[var(--warning)] bg-warning-soft',
    Advanced: 'text-[var(--danger)] bg-danger-soft',
  } as const
  return (
    <span className={cn('rounded-[4px] px-1.5 py-[1px] text-[10.5px] font-semibold tracking-wide uppercase', map[risk])}>
      {t.te(risk)}
    </span>
  )
}

export function ImpactMeter({ impact }: { impact: 'Low' | 'Medium' | 'High' }) {
  const t = useT()
  const bars = impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1
  const color = impact === 'High' ? 'var(--danger)' : impact === 'Medium' ? 'var(--warning)' : 'var(--success)'
  return (
    <span className="inline-flex items-end gap-[2px]" title={`${t.te(impact)} ${t.lang === 'es' ? 'impacto' : 'impact'}`}>
      {[6, 9, 12].map((h, i) => (
        <span
          key={h}
          style={{ height: h, background: i < bars ? color : 'var(--border-strong)' }}
          className="w-[3px] rounded-[1px] transition-colors duration-200"
        />
      ))}
    </span>
  )
}
