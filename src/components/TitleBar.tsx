import { Minus, Search, X } from 'lucide-react'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { NotificationsBell } from './NotificationsPanel'
import logo from '@/assets/vortex-logo.png'
import { APP_VERSION } from '@/lib/version'

function WinButton({
  onClick,
  label,
  danger,
  children,
}: {
  onClick: () => void
  label: string
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        'no-drag flex h-[32px] w-[46px] items-center justify-center text-fg/80 transition-colors duration-150',
        danger ? 'hover:bg-[#c42b1c] hover:text-white' : 'hover:bg-[color-mix(in_srgb,var(--fg)_10%,transparent)]',
      )}
    >
      {children}
    </button>
  )
}

export function TitleBar({ onOpenCommand }: { onOpenCommand: () => void }) {
  const { prefs } = useApp()
  const t = useT()
  const api = window.xtweaks

  return (
    <header
      data-tauri-drag-region
      className="drag-region relative z-50 flex h-[38px] shrink-0 items-center gap-3 border-b border-line bg-[color-mix(in_srgb,var(--fg)_2%,transparent)] pl-3"
    >
      <div className="flex items-center gap-2">
        <img src={logo} alt="Vortex Optimizer" className="h-[22px] w-[22px] rounded-[5px] object-cover shadow-[0_1px_4px_rgba(0,0,0,.35)]" />
        <span className="text-[12.5px] font-semibold tracking-[-0.01em]">Vortex-Optimizer</span>
        <span className="text-[11px] text-subtle">{APP_VERSION}</span>
      </div>

      <button
        type="button"
        onClick={onOpenCommand}
        className="no-drag ml-4 flex h-[24px] w-[300px] items-center gap-2 rounded-[6px] border border-line bg-card px-2 text-[12px] text-subtle transition-colors duration-200 hover:bg-card-hover"
      >
        <Search className="h-3 w-3" />
        <span className="flex-1 text-left">{t('shell.search')}</span>
        <kbd className="rounded-[3px] border border-line px-1 font-mono text-[10px]">Ctrl K</kbd>
      </button>

      <div className="ml-auto flex items-center gap-1 pr-1">
        <NotificationsBell />
        <span className="mx-1 hidden text-[11px] text-subtle sm:inline">
          {prefs.language.split(' ')[0]}
        </span>
      </div>

      <div className="flex h-full items-stretch">
        <WinButton label={t.lang === 'es' ? 'Minimizar' : 'Minimize'} onClick={() => api?.minimize()}>
          <Minus className="h-3.5 w-3.5" />
        </WinButton>
        <WinButton label={t.lang === 'es' ? 'Cerrar' : 'Close'} danger onClick={() => api?.close()}>
          <X className="h-3.5 w-3.5" />
        </WinButton>
      </div>
    </header>
  )
}
