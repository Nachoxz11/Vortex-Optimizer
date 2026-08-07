import { motion } from 'framer-motion'
import { ChevronsLeft, CircleUser, Crown, HeartPulse, Lock, LogOut, MessageCircle, Settings2 } from 'lucide-react'
import { NAV, type NavItem, type ScreenId } from '@/nav'
import { useCleanerScan, useSystemInfo } from '@/lib/system'
import { useAuth } from '@/lib/auth'
import { usePremium } from '@/lib/premium'
import { isPremiumScreen } from '@/lib/premium-tweaks'
import { useT, type TKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Tooltip } from './ui/tooltip'
import { Progress } from './ui/progress'
import { DropdownMenu } from './ui/menu'
import logo from '@/assets/vortex-logo.png'

const DISCORD_INVITE_URL = 'https://discord.gg/urCpqx4MAW'

async function openDiscord() {
  if (window.xtweaks?.openUrl) {
    try {
      await window.xtweaks.openUrl(DISCORD_INVITE_URL)
      return
    } catch {
      // fall through to browser fallback below
    }
  }
  window.open(DISCORD_INVITE_URL, '_blank', 'noopener,noreferrer')
}

function NavButton({
  item,
  label,
  active,
  collapsed,
  onClick,
  badge,
}: {
  item: NavItem
  label: string
  active: boolean
  collapsed: boolean
  onClick: () => void
  badge?: string
}) {
  const { isPremium, showUpgradeModal } = usePremium()
  const isLocked = isPremiumScreen(item.id) && !isPremium

  const handleClick = () => {
    if (isLocked) {
      showUpgradeModal()
      return
    }
    onClick()
  }

  const body = (
    <button
      type="button"
      onClick={handleClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-[32px] w-full items-center gap-2.5 rounded-[6px] px-2.5 text-left transition-colors duration-200',
        active ? 'bg-card-hover text-fg' : 'text-muted hover:bg-card hover:text-fg',
        collapsed && 'justify-center px-0',
      )}
    >
      {active ? (
        <motion.span
          layoutId="nav-indicator"
          transition={{ type: 'spring', stiffness: 560, damping: 42 }}
          className="absolute left-0 h-4 w-[3px] rounded-r-full bg-[var(--accent)]"
        />
      ) : null}
      <item.Icon
        className={cn(
          'h-[15px] w-[15px] shrink-0 transition-transform duration-200 group-hover:scale-110',
          active && 'text-[var(--accent)]',
          item.danger && !active && 'text-[color-mix(in_srgb,var(--danger)_75%,var(--muted))]',
          isLocked && 'text-amber-400',
        )}
        strokeWidth={active ? 2.2 : 1.85}
      />
      {!collapsed ? (
        <>
          <span className={cn('flex-1 truncate text-[13px]', active && 'font-medium')}>{label}</span>
          {isLocked ? (
            <span className="flex items-center gap-1 text-[10px] text-amber-400 font-semibold bg-amber-500/10 border border-amber-500/20 rounded px-1 py-0.5">
              <Lock className="h-2.5 w-2.5" />
              PRO
            </span>
          ) : (badge ?? item.badge) ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-[1px] text-[10.5px] font-medium tabular-nums',
                active ? 'bg-accent-soft text-[var(--accent)]' : 'bg-[var(--sunken)] text-subtle',
              )}
            >
              {badge ?? item.badge}
            </span>
          ) : null}
        </>
      ) : null}
    </button>
  )

  return collapsed ? (
    <Tooltip content={label} side="right" delay={120}>
      {body}
    </Tooltip>
  ) : (
    body
  )
}

export function Sidebar({
  current,
  onNavigate,
  collapsed,
  onToggleCollapse,
}: {
  current: ScreenId
  onNavigate: (id: ScreenId) => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  const { info: system } = useSystemInfo()
  const { categories: cleanerCategories, real: cleanerReal } = useCleanerScan()
  const cleanerBadge = cleanerReal ? `${cleanerCategories.reduce((sum, category) => sum + category.size, 0).toFixed(2)} GB` : '—'
  const { user, signOut } = useAuth()
  const { isPremium, showUpgradeModal } = usePremium()
  const t = useT()
  const groups: NavItem['group'][] = ['main', 'system', 'bottom']
  const GROUP_KEY: Record<NavItem['group'], TKey> = {
    main: 'nav.group.main',
    system: 'nav.group.system',
    bottom: 'nav.group.bottom',
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 62 : 228 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="relative z-30 flex shrink-0 flex-col border-r border-line bg-[var(--rail)]"
    >
      <div className={cn('flex items-center gap-2.5 px-3 py-3.5', collapsed && 'justify-center px-0')}>
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-[9px] shadow-[0_2px_10px_-2px_rgba(0,0,0,.5)]">
          <img src={logo} alt="Vortex Optimizer" className="h-full w-full object-cover" />
          <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-[var(--scrim)] bg-[var(--success)]" />
        </div>
        {!collapsed ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-w-0">
            <p className="truncate text-[14px] font-semibold leading-tight tracking-[-0.015em]">Vortex-Optimizer</p>
            <p className="truncate text-[11px] text-subtle">{system.edition}</p>
          </motion.div>
        ) : null}
      </div>

      <nav className="scroll-area flex-1 px-2 pb-2">
        {groups.map((g) => (
          <div key={g} className="mb-2">
            {!collapsed ? (
              <p className="mb-1 px-2.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-subtle">
                {t(GROUP_KEY[g])}
              </p>
            ) : (
              <div className="mx-auto mb-2 h-px w-6 bg-[var(--border)]" />
            )}
            <div className="space-y-[2px]">
              {NAV.filter((n) => n.group === g).map((item) => (
                <NavButton
                  key={item.id}
                  item={item}
                  label={t(`nav.${item.id}.label` as TKey)}
                  active={item.id === current}
                  collapsed={collapsed}
                  onClick={() => onNavigate(item.id)}
                  badge={item.id === 'cleaner' ? cleanerBadge : undefined}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {!collapsed ? (
        <div className="mx-2 mb-2 rounded-[4px] border border-line bg-card p-2">
          <div className="mb-1.5 flex items-center gap-1.5">
            <HeartPulse className="h-3.5 w-3.5 text-[var(--success)]" />
            <span className="text-[11.5px] font-medium">{t('shell.systemHealth')}</span>
            <span className="ml-auto text-[12px] font-semibold tabular-nums">{system.health}</span>
          </div>
          <Progress value={system.health} color="var(--success)" height={4} />
          <p className="mt-1.5 text-[10.5px] leading-snug text-subtle">{t('shell.liveHealth')}</p>
        </div>
      ) : null}

      {!isPremium ? (
        <div className={cn('mx-2 mb-2', collapsed && 'mx-1')}>
          <button
            type="button"
            onClick={showUpgradeModal}
            aria-label="Comprar Premium"
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-[4px] border border-amber-500/35 bg-gradient-to-r from-amber-500/15 to-yellow-500/10 px-2.5 py-2 text-[12px] font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/20 hover:text-amber-100',
              collapsed && 'px-0',
            )}
          >
            <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400" />
            {!collapsed ? <span>Comprar Premium</span> : null}
          </button>
        </div>
      ) : null}

      <div className={cn('flex items-center gap-1.5 border-t border-line px-2.5 py-2', collapsed && 'flex-col-reverse justify-center px-0 gap-2')}>
        <Tooltip content={t('shell.joinDiscord')} side={collapsed ? 'right' : 'top'} delay={120}>
          <button
            type="button"
            onClick={openDiscord}
            aria-label={t('shell.joinDiscord')}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-muted transition-colors hover:bg-card-hover hover:text-[#5865f2]"
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        </Tooltip>

        <DropdownMenu
          align={collapsed ? 'start' : 'end'}
          items={[
            { id: 'settings', label: t('shell.profileSettings'), icon: <Settings2 className="h-3.5 w-3.5" /> },
            { id: 'signout', label: t('shell.profileSignOut'), icon: <LogOut className="h-3.5 w-3.5" />, danger: true, separatorBefore: true },
          ]}
          onSelect={(id) => {
            if (id === 'settings') onNavigate('settings')
            if (id === 'signout') signOut()
          }}
          trigger={({ toggle }) => (
            <button
              type="button"
              onClick={toggle}
              className={cn(
                'flex min-w-0 flex-1 items-center gap-2 rounded-[6px] px-1 py-1 text-left transition-colors hover:bg-card-hover',
                collapsed && 'flex-none justify-center px-0',
              )}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--sunken)]">
                <CircleUser className="h-4 w-4 text-muted" />
              </div>
              {!collapsed ? (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-medium leading-tight">{user?.user_metadata?.username || user?.email || system.user}</p>
                  <p className="truncate text-[10.5px] text-subtle">{t('shell.userProfile')}</p>
                </div>
              ) : null}
            </button>
          )}
        />

        {!collapsed ? (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={t('shell.collapseNav')}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-subtle transition-colors hover:bg-card-hover hover:text-fg"
          >
            <ChevronsLeft className="h-3.5 w-3.5 transition-transform duration-200" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={t('shell.expandNav')}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] text-subtle transition-colors hover:bg-card-hover hover:text-fg"
          >
            <ChevronsLeft className="h-3.5 w-3.5 rotate-180 transition-transform duration-200" />
          </button>
        )}
      </div>
    </motion.aside>
  )
}
