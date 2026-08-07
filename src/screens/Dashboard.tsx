import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowUpRight, CheckCircle2, ChevronRight, CircleDot, Cpu, Gauge, HardDrive, Info,
  MemoryStick, MonitorCog, RefreshCw, ShieldCheck, Sparkles, Ticket, TrendingUp, User,
} from 'lucide-react'
import { Page, StatTile } from '@/components/shell'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tooltip } from '@/components/ui/tooltip'
import { Divider, KeyValue, SectionTitle, Stagger, StaggerItem } from '@/components/ui/primitives'
import { Legend, Ring, Sparkline } from '@/components/charts'
import { QUICK_ACTIONS, type ActivityItem } from '@/lib/mock'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { useCleanerScan, useStartupItems, useSystemInfo, useSystemMetrics } from '@/lib/system'
import { relTime } from '@/lib/utils'
import type { ScreenId } from '@/nav'

const KIND_STYLE = {
  success: 'text-[var(--success)] bg-success-soft',
  warning: 'text-[var(--warning)] bg-warning-soft',
  danger: 'text-[var(--danger)] bg-danger-soft',
  info: 'text-[var(--info)] bg-info-soft',
  muted: 'text-muted bg-[var(--sunken)]',
} as const

const TONE_COLOR: Record<string, string> = {
  accent: 'var(--accent)',
  info: 'var(--info)',
  violet: 'var(--brand-a)',
  teal: 'var(--brand-b)',
  amber: 'var(--warning)',
  success: 'var(--success)',
}

export default function Dashboard({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const t = useT()
  const { activity, log, toast, refreshTweakStatuses, pendingRestart } = useApp()
  const { info: system, real: realData, refresh } = useSystemInfo()
  const { current, series, loading: metricsLoading } = useSystemMetrics(40, 5000, true)
  const { items: startupItems, real: startupReal } = useStartupItems()
  const { categories: cleanerCategories, real: cleanerReal } = useCleanerScan()
  const [running, setRunning] = useState<string | null>(null)
  const [done, setDone] = useState<string[]>([])

  const healthFactors = realData
    ? [
        { label: t.tt('healthFactors', 'Memory usage', 'label', 'Memory usage'), score: Math.max(20, 100 - Math.round(current.ram)), note: `${current.ramUsedGB} / ${current.ramTotalGB} GB ${t.lang === 'es' ? 'en uso' : 'in use'}` },
        { label: t.tt('healthFactors', 'Storage headroom', 'label', 'Storage headroom'), score: system.storageTotalGB ? Math.min(100, Math.round((system.storageFreeGB! / system.storageTotalGB) * 100)) : 70, note: t.lang === 'es' ? `${system.storageFreeGB ?? '—'} GB libres de ${system.storageTotalGB ?? '—'} GB` : `${system.storageFreeGB ?? '—'} GB free of ${system.storageTotalGB ?? '—'} GB` },
        { label: t.tt('healthFactors', 'Processor load', 'label', 'Processor load'), score: Math.max(15, 100 - Math.round(current.cpu)), note: t.lang === 'es' ? `${Math.round(current.cpu)}% de CPU ahora mismo` : `${Math.round(current.cpu)}% CPU right now` },
        { label: t.lang === 'es' ? 'Inicio de Windows' : 'Windows startup', score: startupReal ? Math.max(35, 100 - startupItems.filter((item) => item.defaultOn && item.impact === 'High').length * 12 - startupItems.filter((item) => item.defaultOn && item.impact === 'Medium').length * 4) : 90, note: startupReal ? `${startupItems.filter((item) => item.defaultOn).length} ${t.lang === 'es' ? 'elementos activos' : 'active items'}` : t.lang === 'es' ? 'Análisis pendiente' : 'Scan pending' },
        { label: t.lang === 'es' ? 'Limpieza disponible' : 'Cleanup available', score: cleanerReal ? Math.max(40, 100 - Math.min(60, cleanerCategories.reduce((sum, category) => sum + category.size, 0) * 3)) : 90, note: cleanerReal ? `${cleanerCategories.reduce((sum, category) => sum + category.size, 0).toFixed(1)} GB ${t.lang === 'es' ? 'detectados' : 'detected'}` : t.lang === 'es' ? 'Análisis pendiente' : 'Scan pending' },
        { label: t.tt('healthFactors', 'System uptime', 'label', 'System uptime'), score: 90, note: `${t.lang === 'es' ? 'Activo hace' : 'Up'} ${system.uptime}` },
        { label: t.tt('healthFactors', 'Overall health', 'label', 'Overall health'), score: system.health, note: t.lang === 'es' ? 'Basado en memoria, almacenamiento y carga' : 'Based on memory, storage and load' },
      ]
    : []
  const healthScore = realData
    ? Math.round(healthFactors.reduce((sum, factor) => sum + factor.score, 0) / Math.max(1, healthFactors.length))
    : 0

  const runAction = async (id: string, label: string) => {
    if (running) return
    setRunning(id)

    const finish = (success: boolean) => {
      setRunning(null)
      if (success) {
        setDone((d) => [...d, id])
        window.setTimeout(() => setDone((d) => d.filter((x) => x !== id)), 2400)
      }
    }

    if (!window.xtweaks?.actions) {
      finish(false)
      toast({ title: `${label} ${t.lang === 'es' ? 'no disponible' : 'unavailable'}`, description: t.lang === 'es' ? 'Abrí la aplicación de escritorio para ejecutar esta acción real.' : 'Open the desktop app to run this real action.', tone: 'info' })
      return
    }

    try {
      const result = await window.xtweaks.actions.run(id)
      if (id === 'optimize' || id === 'game') await refreshTweakStatuses().catch(() => {})
      if (id === 'scan' || id === 'temp') refresh()
      log(result.message, result.detail, result.ok ? 'success' : 'warning')
      toast({
        title: result.message,
        description: result.detail,
        tone: result.ok ? 'success' : 'warning',
      })
      finish(result.ok)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log(`${label} ${t.lang === 'es' ? 'falló' : 'failed'}`, message, 'danger')
      toast({ title: `No se pudo ejecutar ${label}`, description: message, tone: 'danger' })
      finish(false)
    }
  }

  const metricSeries: Record<string, number[]> = { cpu: series.cpu, ram: series.ram, gpu: series.gpu, disk: series.disk }
  const tiles = [
    { key: 'cpu', label: t.tt('monitor', 'cpu', 'label', 'Processor'), Icon: Cpu, color: 'var(--accent)', sub: system.cpu, unit: '%' },
    { key: 'ram', label: t.tt('monitor', 'ram', 'label', 'Memory'), Icon: MemoryStick, color: 'var(--brand-a)', sub: `${current.ramUsedGB} GB ${t.lang === 'es' ? 'de' : 'of'} ${current.ramTotalGB} GB`, unit: '%' },
    { key: 'gpu', label: t.tt('monitor', 'gpu', 'label', 'Graphics'), Icon: Gauge, color: 'var(--brand-b)', sub: system.gpu, unit: '%' },
    { key: 'disk', label: t.tt('monitor', 'disk', 'label', 'Disk activity'), Icon: HardDrive, color: 'var(--warning)', sub: system.disk, unit: '%' },
  ]

  const recommendations = [
    { title: t.lang === 'es' ? 'Revisar aplicaciones de inicio' : 'Review startup applications', detail: t.lang === 'es' ? 'El impacto se calcula con el inventario real' : 'Impact is calculated from the real inventory', tone: 'accent' as const, screen: 'startup' as ScreenId },
    { title: t.lang === 'es' ? 'Revisar espacio recuperable' : 'Review reclaimable space', detail: t.lang === 'es' ? 'Cachés, registros y restos de actualizaciones medidos al escanear' : 'Caches, logs and update leftovers measured during scan', tone: 'success' as const, screen: 'cleaner' as ScreenId },
    { title: t.lang === 'es' ? 'Revisar privacidad' : 'Review privacy', detail: t.lang === 'es' ? 'Telemetría e identificadores según el estado real' : 'Telemetry and identifiers based on actual state', tone: 'warning' as const, screen: 'privacy' as ScreenId }
  ]

  return (
    <Page
      title={t('nav.dashboard.label')}
      description={t.lang === 'es' ? `${system.device} · ${system.edition} ${system.version} · activo hace ${system.uptime}` : `${system.device} · ${system.edition} ${system.version} · up ${system.uptime}`}
      actions={
        <>
          <Button variant="secondary" size="md" onClick={() => { refresh(true); toast({ title: t.lang === 'es' ? 'Datos del sistema actualizados' : 'System data refreshed', tone: 'info' }) }}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t('common.refresh')}
          </Button>
          <Button variant="primary" size="md" onClick={() => onNavigate('performance')}>
            <Sparkles className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Tweaks recomendados' : 'Recommended tweaks'}
          </Button>
        </>
      }
    >
      {/* Live resource tiles ------------------------------------------------ */}
      <Stagger className="grid grid-cols-4 gap-3">
        {tiles.map((tile) => {
          const data = metricSeries[tile.key]
          const value = Math.round(data[data.length - 1] ?? 0)
          return (
            <StaggerItem key={tile.key}>
              <StatTile
                label={tile.label}
                value={value}
                unit={tile.unit}
                sub={tile.sub}
                accent={tile.color}
                icon={<tile.Icon className="h-4 w-4" />}
                loading={metricsLoading}
              >
                <Sparkline data={data} color={tile.color} height={38} />
              </StatTile>
            </StaggerItem>
          )
        })}
      </Stagger>

      {/* System, health and recommendations --------------------------------- */}
      <div className="mt-4 grid grid-cols-12 gap-3">
        <Card className="col-span-4">
          <CardHeader
            title="Windows"
            description={t.lang === 'es' ? 'Edición, compilación y activación' : 'Edition, build and activation'}
            icon={<MonitorCog className="h-4 w-4" />}
            action={<Badge tone="success" dot>{t.te('Activated')}</Badge>}
          />
          <CardBody className="pt-0">
            <KeyValue label={t.lang === 'es' ? 'Edición' : 'Edition'} value={system.edition} />
            <Divider />
            <KeyValue label={t('common.version')} value={system.version} />
            <Divider />
            <KeyValue label={t.lang === 'es' ? 'Compilación de SO' : 'OS build'} value={system.build} mono />
            <Divider />
            <KeyValue label={t.lang === 'es' ? 'Instalado el' : 'Installed on'} value={system.install} />
            <Divider />
            <KeyValue label={t.lang === 'es' ? 'Placa madre' : 'Motherboard'} value={system.board} />
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => onNavigate('windows')}>
                {t.lang === 'es' ? 'Opciones del shell' : 'Shell options'}
              </Button>
              <Button size="sm" variant="subtle" onClick={() => onNavigate('restore')}>
                {t('common.restore')}
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-4">
          <CardHeader
            title={t.lang === 'es' ? 'Usuario' : 'User'}
            description={t.lang === 'es' ? 'Cuenta actual y carpeta de perfil' : 'Current account and profile folder'}
            icon={<User className="h-4 w-4" />}
          />
          <CardBody className="pt-0">
            <KeyValue label={t.lang === 'es' ? 'Nombre' : 'Name'} value={system.user} />
            <Divider />
            <KeyValue label={t.lang === 'es' ? 'Perfil' : 'Profile'} value={system.userProfile} mono />
            <Divider />
            <KeyValue label={t.lang === 'es' ? 'Equipo' : 'Device'} value={system.device} />
          </CardBody>
        </Card>

        <Card className="col-span-4">
          <CardHeader
            title={t('shell.systemHealth')}
            description={t.lang === 'es' ? 'Ponderado entre cinco verificaciones' : 'Weighted across five checks'}
            icon={<ShieldCheck className="h-4 w-4" />}
            action={<Badge tone={healthScore >= 80 ? 'success' : healthScore >= 60 ? 'warning' : 'danger'}>{healthScore >= 80 ? t.te('Good') : healthScore >= 60 ? (t.lang === 'es' ? 'Revisar' : 'Review') : (t.lang === 'es' ? 'Atención' : 'Attention')}</Badge>}
          />
          <CardBody className="pt-0">
            <div className="flex items-center gap-4">
              <Ring value={healthScore} size={92} thickness={9} color={healthScore >= 80 ? 'var(--success)' : healthScore >= 60 ? 'var(--warning)' : 'var(--danger)'} sub={t.lang === 'es' ? 'puntaje' : 'score'} />
              <div className="min-w-0 flex-1 space-y-2">
                {healthFactors.slice(0, 3).map((f) => (
                  <div key={f.label}>
                    <div className="flex items-center justify-between text-[11.5px]">
                      <span className="truncate text-muted">{f.label}</span>
                      <span className="font-medium tabular-nums">{f.score}</span>
                    </div>
                    <Progress
                      value={f.score}
                      height={4}
                      color={f.score > 85 ? 'var(--success)' : f.score > 70 ? 'var(--accent)' : 'var(--warning)'}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            </div>
            <Divider className="my-3" />
            <div className="space-y-1.5">
              {healthFactors.slice(3).map((f) => (
                <div key={f.label} className="flex items-center gap-2 text-[12px]">
                  <CircleDot className="h-3 w-3 shrink-0 text-subtle" />
                  <span className="min-w-0 flex-1 truncate text-muted">{f.note}</span>
                  <span className="shrink-0 font-medium tabular-nums">{f.score}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-4">
          <CardHeader
            title={t.lang === 'es' ? 'Recomendaciones' : 'Recommendations'}
            description={t.lang === 'es' ? '3 elementos que Vortex-Optimizer aplicaría' : '3 items Vortex-Optimizer would apply'}
            icon={<TrendingUp className="h-4 w-4" />}
            action={
              <Button size="sm" variant="primary" onClick={() => runAction('optimize', t.lang === 'es' ? 'Perfil recomendado' : 'Recommended profile')}>
                {t('common.applyAll')}
              </Button>
            }
          />
          <CardBody className="pt-0 space-y-2">
            {recommendations.map((r) => (
              <button
                key={r.title}
                onClick={() => onNavigate(r.screen)}
                className="group flex w-full items-center gap-3 rounded-[8px] border border-line bg-[var(--sunken)] p-2.5 text-left transition-all duration-200 hover:border-line-strong hover:bg-card-hover"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] font-medium">{r.title}</span>
                  <span className="block truncate text-[11.5px] text-muted">{r.detail}</span>
                </span>
                <Badge tone={r.tone}>{t('common.review')}</Badge>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-subtle transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
              </button>
            ))}
            <Divider className="!my-3" />
            <Legend
              className="pt-0.5"
              items={[
                { id: 'a', label: t.lang === 'es' ? 'Aplicado en esta sesión' : 'Applied this session', color: 'var(--success)', value: '12' },
                { id: 'b', label: t.lang === 'es' ? 'Reinicio pendiente' : 'Pending restart', color: 'var(--warning)', value: String(pendingRestart.length) },
                { id: 'c', label: t('common.skipped'), color: 'var(--subtle)', value: '5' },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      {/* Quick actions ------------------------------------------------------ */}
      <div className="mt-6">
        <SectionTitle
          title={t.lang === 'es' ? 'Acciones rápidas' : 'Quick actions'}
          description={realData ? 'Rutinas de un clic que ejecutan cambios reales en Windows' : (t.lang === 'es' ? 'Rutinas de un clic — cada ejecución de abajo es simulada' : 'One-click routines — every run below is simulated')}
          action={
            <Tooltip content={realData ? 'Cada acción ejecuta comandos o tweaks reales en este equipo.' : (t.lang === 'es' ? 'Nada en esta pantalla toca el sistema operativo.' : 'Nothing on this screen touches the operating system.')}>
              <Badge tone={realData ? 'success' : 'info'}>
                <Info className="h-3 w-3" />
                {t.te(realData ? 'Live data' : 'Preview mode')}
              </Badge>
            </Tooltip>
          }
        />
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACTIONS.map((a) => {
            const isRunning = running === a.id
            const isDone = done.includes(a.id)
            const color = TONE_COLOR[a.tone] ?? 'var(--accent)'
            const label = t.tt('quickActions', a.id, 'label', a.label)
            const hint = t.tt('quickActions', a.id, 'hint', a.hint)
            return (
              <motion.button
                key={a.id}
                whileHover={{ y: -3 }}
                whileTap={{ scale: 0.985 }}
                transition={{ duration: 0.18 }}
                onClick={() => runAction(a.id, label)}
                className="card-surface group relative overflow-hidden rounded-[10px] p-4 text-left transition-colors duration-200 hover:border-line-strong hover:bg-card-hover"
              >
                <span
                  className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-[0.09] blur-xl transition-opacity duration-300 group-hover:opacity-[0.2]"
                  style={{ background: color }}
                />
                <span
                  className="mb-3 flex h-10 w-10 items-center justify-center rounded-[10px] transition-transform duration-200 group-hover:scale-110"
                  style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
                >
                  <a.Icon className="h-5 w-5" />
                </span>
                <span className="block text-[13.5px] font-semibold tracking-[-0.01em]">{label}</span>
                <span className="mt-0.5 block text-[11.5px] text-muted">{hint}</span>
                <span className="mt-3 block h-[4px]">
                  <AnimatePresence mode="wait">
                    {isRunning ? (
                      <motion.span key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="block">
                        <Progress value={60} indeterminate height={4} color={color} />
                      </motion.span>
                    ) : isDone ? (
                      <motion.span
                        key="done"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center gap-1 text-[11px] font-medium text-[var(--success)]"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        {t('common.completed')}
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Timeline ----------------------------------------------------------- */}
      <div className="mt-6">
        <SectionTitle
          title={t.lang === 'es' ? 'Cronología' : 'Timeline'}
          description={t.lang === 'es' ? 'Actividad reciente en esta sesión' : 'Recent activity in this session'}
          action={
            <Button size="sm" variant="subtle" onClick={() => onNavigate('restore')}>
              <Ticket className="h-3.5 w-3.5" />
              {t.lang === 'es' ? 'Ver puntos de restauración' : 'View restore points'}
            </Button>
          }
        />
        <Card>
          <div className="relative px-4 py-3">
            <span className="absolute left-[30px] top-6 bottom-6 w-px bg-[var(--border)]" />
            <AnimatePresence initial={false}>
              {activity.slice(0, 8).map((a: ActivityItem) => (
                <motion.div
                  key={a.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                  className="relative flex items-start gap-3 py-2"
                >
                  <span
                    className={`z-10 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ring-4 ring-[var(--scrim)] ${KIND_STYLE[a.kind as keyof typeof KIND_STYLE]}`}
                  >
                    <CircleDot className="h-3 w-3" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-medium">{t.tt('activity', a.id, 'title', a.title)}</p>
                    <p className="truncate text-[11.5px] text-muted">{t.tt('activity', a.id, 'detail', a.detail)}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-subtle">{relTime(a.minutesAgo, t.lang)}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>
      </div>
    </Page>
  )
}
