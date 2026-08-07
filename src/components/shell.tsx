import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Info, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { Switch } from './ui/switch'
import { Tooltip } from './ui/tooltip'
import { Badge } from './ui/badge'
import { Button } from './ui/button'
import { ImpactMeter, RiskChip } from './ui/primitives'
import type { Tweak } from '@/lib/mock'
import { PremiumBadge } from './PremiumBadge'
import { usePremium } from '@/lib/premium'
import { isPremiumTweak } from '@/lib/premium-tweaks'

export function Page({
  title,
  description,
  actions,
  children,
  banner,
}: {
  title: string
  description: string
  actions?: ReactNode
  banner?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 items-start gap-4 px-7 pb-4 pt-6">
        <div className="min-w-0 flex-1">
          <motion.h1
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24 }}
            className="text-[24px] font-semibold leading-tight tracking-[-0.028em]"
          >
            {title}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="mt-1 text-[13px] text-muted"
          >
            {description}
          </motion.p>
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2 pt-1">{actions}</div> : null}
      </div>
      {banner ? <div className="shrink-0 px-7 pb-4">{banner}</div> : null}
      <div className="scroll-area flex-1 px-7 pb-8">{children}</div>
    </div>
  )
}

export function Notice({
  tone = 'info',
  title,
  children,
  action,
  icon,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success'
  title: string
  children?: ReactNode
  action?: ReactNode
  icon?: ReactNode
}) {
  const map = {
    info: 'border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-info-soft text-[var(--info)]',
    warning: 'border-[color-mix(in_srgb,var(--warning)_32%,transparent)] bg-warning-soft text-[var(--warning)]',
    danger: 'border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-danger-soft text-[var(--danger)]',
    success: 'border-[color-mix(in_srgb,var(--success)_30%,transparent)] bg-success-soft text-[var(--success)]',
  } as const
  return (
    <div className={cn('flex items-start gap-3 rounded-[4px] border p-3.5', map[tone])}>
      <span className="mt-[1px] shrink-0">{icon ?? <Info className="h-4 w-4" />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold leading-tight">{title}</p>
        {children ? <div className="mt-1 text-[12.5px] leading-relaxed text-fg/80">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

/** Shared responsive tweak card used across Performance, Privacy, Network and Windows. */
export function TweakRow({
  id,
  name,
  description,
  tooltip,
  impact,
  risk,
  requiresRestart,
  icon,
  defaultOn,
  className,
  compact,
  premium,
}: {
  id: string
  name: string
  description: string
  tooltip?: string
  impact?: Tweak['impact']
  risk?: Tweak['risk']
  requiresRestart?: boolean
  icon?: ReactNode
  defaultOn?: boolean
  className?: string
  compact?: boolean
  premium?: boolean
}) {
  const { isOn, isSystemTweak, setToggle } = useApp()
  const { isPremium, showUpgradeModal } = usePremium()
  const t = useT()
  const on = isOn(id, defaultOn ?? false)
  const available = isSystemTweak(id)
  const isLocked = (premium || isPremiumTweak(id)) && !isPremium

  const handleToggle = (v: boolean) => {
    if (isLocked) {
      showUpgradeModal()
      return
    }
    void setToggle(id, v, name)
  }

  return (
    <div
      onClick={isLocked ? showUpgradeModal : undefined}
      className={cn(
        'group flex min-h-[148px] flex-col gap-3 rounded-[4px] border border-line bg-card p-3.5 transition-[background,border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:bg-card-hover hover:shadow-[0_6px_18px_rgba(0,0,0,0.14)]',
        compact && 'min-h-[132px] p-3',
        !available && 'bg-[var(--sunken)]/35',
        isLocked && 'cursor-pointer bg-amber-500/[0.02]',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? (
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[4px] transition-colors duration-200',
              on ? 'bg-accent-soft text-[var(--accent)]' : 'bg-[var(--sunken)] text-muted',
              isLocked && 'bg-amber-500/10 text-amber-400',
              !available && 'blur-[3px] opacity-45',
            )}
          >
            {icon}
          </span>
        ) : null}

        <div className={cn('min-w-0 flex-1', !available && 'blur-[3px] opacity-45')}>
          <div className="flex items-center gap-2">
            <span className="truncate text-[13px] font-semibold">{name}</span>
          {isLocked && <PremiumBadge size="sm" />}
          {available && tooltip ? (
            <Tooltip content={tooltip}>
              <Info className="h-3 w-3 shrink-0 cursor-help text-subtle opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
            </Tooltip>
          ) : null}
            {available && requiresRestart ? (
              <Tooltip content={t.lang === 'es' ? 'Aplica después de reiniciar' : 'Takes effect after a restart'}>
                <RotateCcw className="h-3 w-3 shrink-0 text-[var(--warning)]" />
              </Tooltip>
            ) : null}
          </div>
          <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-muted">{description}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line pt-2.5">
        {available && impact ? <ImpactMeter impact={impact} /> : null}
        {available && risk ? <RiskChip risk={risk} /> : null}
        {isLocked ? (
          <Button
            size="sm"
            variant="subtle"
            onClick={(e: React.MouseEvent) => {
              e.stopPropagation()
              showUpgradeModal()
            }}
            className="text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[11px]"
          >
            ✦ Upgrade
          </Button>
        ) : (
          <>
            <Badge tone={on ? 'success' : 'neutral'} className="w-[96px] min-w-[96px] justify-center text-center">
              {available ? (on ? t('common.applied') : (t.lang === 'es' ? 'Predeterminado' : 'Default')) : (t.lang === 'es' ? 'Próximamente' : 'Coming soon')}
            </Badge>
            {available ? <Switch checked={on} onChange={handleToggle} label={name} /> : null}
          </>
        )}
      </div>
    </div>
  )
}

export function StatTile({
  label,
  value,
  unit,
  sub,
  icon,
  accent = 'var(--accent)',
  children,
  onClick,
  loading = false,
}: {
  label: string
  value: string | number
  unit?: string
  sub?: string
  icon?: ReactNode
  accent?: string
  children?: ReactNode
  onClick?: () => void
  /** Shows skeleton placeholders instead of value/sub/children while the first real sample is in flight. */
  loading?: boolean
}) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        'card-surface relative overflow-hidden rounded-[4px] p-3.5',
        onClick && 'cursor-pointer hover:border-line-strong',
      )}
    >
      <span
        className="absolute inset-x-0 top-0 h-[2px] opacity-70"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }}
      />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11.5px] font-medium uppercase tracking-[0.06em] text-subtle">{label}</p>
          {loading ? (
            <span className="mt-1.5 block h-[26px] w-14 animate-pulse rounded-[6px] bg-[var(--sunken)]" />
          ) : (
            <p className="mt-1 flex items-baseline gap-1">
              <span className="text-[26px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{value}</span>
              {unit ? <span className="text-[13px] text-muted">{unit}</span> : null}
            </p>
          )}
        </div>
        {icon ? (
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px]"
            style={{ background: `color-mix(in srgb, ${accent} 16%, transparent)`, color: accent }}
          >
            {icon}
          </span>
        ) : null}
      </div>
      {loading ? (
        <span className="mt-2 block h-[13px] w-24 animate-pulse rounded-[4px] bg-[var(--sunken)]" />
      ) : sub ? (
        <p className="mt-1.5 truncate text-[11.5px] text-muted">{sub}</p>
      ) : null}
      {loading ? (
        <span className="mt-2.5 block h-[38px] w-full animate-pulse rounded-[6px] bg-[var(--sunken)]" />
      ) : children ? (
        <div className="mt-2.5">{children}</div>
      ) : null}
    </motion.div>
  )
}
