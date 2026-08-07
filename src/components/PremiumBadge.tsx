import { Sparkles, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './ui/button'
import { usePremium } from '@/lib/premium'

export function PremiumBadge({
  className,
  size = 'md',
}: {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px] gap-1',
    md: 'px-2.5 py-1 text-[11px] gap-1.5',
    lg: 'px-3 py-1.5 text-[12.5px] gap-2 font-semibold',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium tracking-wide text-amber-200 border border-amber-500/40 bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.25)] backdrop-blur-md',
        sizes[size],
        className
      )}
    >
      <Sparkles className="h-3 w-3 text-amber-400 animate-pulse shrink-0" />
      <span className="bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 bg-clip-text text-transparent drop-shadow-sm">
        ✦ Premium
      </span>
    </span>
  )
}

export function PremiumOverlay({
  title = 'Función Premium',
  description = 'Desbloquea optimizaciones avanzadas de kernel y rendimiento sin límites.',
  className,
  compact = false,
}: {
  title?: string
  description?: string
  className?: string
  compact?: boolean
}) {
  const { showUpgradeModal } = usePremium()

  return (
    <div
      className={cn(
        'absolute inset-0 z-20 flex flex-col items-center justify-center p-4 rounded-[5px] bg-scrim/80 backdrop-blur-[6px] border border-amber-500/30 text-center animate-in fade-in duration-200',
        className
      )}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-violet-600/20 border border-amber-500/40 mb-2 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
        <Lock className="h-5 w-5 text-amber-400" />
      </div>

      <PremiumBadge size="sm" className="mb-2" />

      <h4 className={cn('font-semibold text-fg', compact ? 'text-[13px]' : 'text-[15px]')}>
        {title}
      </h4>

      {!compact && (
        <p className="mt-1 max-w-[280px] text-[12px] text-muted leading-relaxed">
          {description}
        </p>
      )}

      <Button
        variant="primary"
        size={compact ? 'sm' : 'md'}
        onClick={showUpgradeModal}
        className="mt-3 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold shadow-[0_0_20px_rgba(245,158,11,0.4)] border-none"
      >
        <Sparkles className="h-3.5 w-3.5 mr-1.5 text-slate-950" />
        Desbloquear ahora
      </Button>
    </div>
  )
}
