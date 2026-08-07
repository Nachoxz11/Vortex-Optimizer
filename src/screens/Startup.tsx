import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowDownUp, Clock, ExternalLink, FolderOpen, Info, Rocket, ShieldQuestion, Timer, Trash2,
} from 'lucide-react'
import { Page, StatTile } from '@/components/shell'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, Pill } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { SearchInput } from '@/components/ui/input'
import { ContextMenu } from '@/components/ui/menu'
import { Tooltip } from '@/components/ui/tooltip'
import { EmptyState, ImpactMeter, SectionTitle } from '@/components/ui/primitives'
import { Bars } from '@/components/charts'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { hasSystemApi, openFileLocation, setStartupItemState, startupRemoveEntry, useStartupItems, type StartupItemData } from '@/lib/system'
import { cn, seeded } from '@/lib/utils'

type SortKey = 'name' | 'publisher' | 'impact' | 'delay'
const IMPACT_ORDER = { High: 3, Medium: 2, Low: 1 } as const
const FILTERS = ['All', 'Enabled', 'Disabled', 'High impact'] as const

export default function Startup() {
  const { isOn, setToggle, setMany, log, toast } = useApp()
  const t = useT()
  const { items: STARTUP_ITEMS, real: realData, refresh: refreshStartup } = useStartupItems()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All')
  const [sort, setSort] = useState<SortKey>('impact')
  const [asc, setAsc] = useState(false)

  const FILTER_LABEL: Record<(typeof FILTERS)[number], string> = {
    All: t('common.all'),
    Enabled: t('common.enabled'),
    Disabled: t('common.disabled'),
    'High impact': t.lang === 'es' ? 'Alto impacto' : 'High impact',
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    let list = STARTUP_ITEMS.filter((s) => {
      const on = isOn(s.id, s.defaultOn)
      if (filter === 'Enabled' && !on) return false
      if (filter === 'Disabled' && on) return false
      if (filter === 'High impact' && s.impact !== 'High') return false
      return !needle || s.name.toLowerCase().includes(needle) || s.publisher.toLowerCase().includes(needle)
    })
    list = [...list].sort((a, b) => {
      const dir = asc ? 1 : -1
      if (sort === 'impact') return (IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact]) * dir
      if (sort === 'delay') return (parseFloat(a.delay) - parseFloat(b.delay)) * dir
      return a[sort].localeCompare(b[sort]) * dir
    })
    return list
  }, [q, filter, sort, asc, isOn, STARTUP_ITEMS])

  const enabled = STARTUP_ITEMS.filter((s) => isOn(s.id, s.defaultOn))
  const bootDelay = enabled.reduce((a, s) => a + (parseFloat(s.delay) || 0), 0)
  const bootHistory = Array.from({ length: 16 }, (_, i) => 18 + seeded(i * 5 + 3) * 22)

  const header = (key: SortKey, label: string, className?: string) => (
    <button
      type="button"
      onClick={() => {
        if (sort === key) setAsc((a) => !a)
        else {
          setSort(key)
          setAsc(false)
        }
      }}
      className={cn(
        'flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.06em] transition-colors',
        sort === key ? 'text-fg' : 'text-subtle hover:text-muted',
        className,
      )}
    >
      {label}
      <ArrowDownUp className={cn('h-3 w-3 transition-opacity', sort === key ? 'opacity-100' : 'opacity-0')} />
    </button>
  )

  const toggleItem = async (item: StartupItemData, next: boolean) => {
    if (!realData) {
      setToggle(item.id, next, item.name)
      return
    }
    try {
      await setStartupItemState(item, next)
      log(`${item.name} ${next ? (t.lang === 'es' ? 'activado' : 'enabled') : (t.lang === 'es' ? 'desactivado' : 'disabled')}`, t.lang === 'es' ? 'Cambio aplicado vía StartupApproved.' : 'Change applied via StartupApproved.', next ? 'success' : 'muted')
      await refreshStartup()
    } catch (error) {
      toast({ title: t.lang === 'es' ? `No se pudo ${next ? 'activar' : 'desactivar'} ${item.name}` : `Couldn't ${next ? 'enable' : 'disable'} ${item.name}`, description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    }
  }

  const setManyItems = async (items: StartupItemData[], next: boolean, label: string) => {
    if (!realData) {
      setMany(items.map((s) => s.id), next, label)
      return
    }
    await Promise.all(items.map((item) => setStartupItemState(item, next).catch(() => null)))
    log(label, t.lang === 'es' ? `${items.length} entrada${items.length === 1 ? '' : 's'} actualizada${items.length === 1 ? '' : 's'}.` : `${items.length} entr${items.length === 1 ? 'y' : 'ies'} updated.`, 'info')
    await refreshStartup()
  }

  return (
    <Page
      title={t('nav.startup.label')}
      description={realData
        ? (t.lang === 'es' ? 'Programas que se inician al iniciar sesión — activar o desactivar acá cambia el estado real de StartupApproved' : 'Programs that launch when you sign in — enabling/disabling here changes the real StartupApproved state')
        : (t.lang === 'es' ? 'Todo lo que se inicia al iniciar sesión — las cifras de impacto son ficticias' : 'Everything that launches when you sign in — impact figures are fabricated')}
      actions={
        <>
          <SearchInput value={q} onChange={setQ} placeholder={t.lang === 'es' ? 'Buscar por nombre o editor' : 'Search by name or publisher'} className="w-[260px]" />
          <Button
            variant="primary"
            onClick={() => {
              const highImpact = STARTUP_ITEMS.filter((s) => s.impact === 'High' && isOn(s.id, s.defaultOn))
              setManyItems(highImpact, false, 'High-impact startup items disabled')
              if (!realData) toast({ title: t.lang === 'es' ? 'Elementos de alto impacto desactivados' : 'High-impact items disabled', description: t.lang === 'es' ? 'Ahorro estimado de 27 s · simulado' : 'Estimated 27 s saved · simulated', tone: 'success' })
            }}
          >
            <Rocket className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Optimizar inicio' : 'Optimize startup'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-12 gap-3">
        <div className="col-span-8 grid grid-cols-3 gap-3">
          <StatTile
            label={t.lang === 'es' ? 'Último arranque' : 'Last boot'}
            value="34.2"
            unit="s"
            sub={t.lang === 'es' ? 'Del encendido al escritorio' : 'From power-on to desktop'}
            accent="var(--accent)"
            icon={<Timer className="h-4 w-4" />}
          />
          <StatTile
            label={t.lang === 'es' ? 'Retraso de inicio' : 'Startup delay'}
            value={bootDelay.toFixed(1)}
            unit="s"
            sub={t.lang === 'es' ? `${enabled.length} elementos activados` : `${enabled.length} enabled items`}
            accent="var(--warning)"
            icon={<Clock className="h-4 w-4" />}
          />
          <StatTile
            label={t.lang === 'es' ? 'Ahorro potencial' : 'Potential saving'}
            value={(bootDelay * 0.62).toFixed(1)}
            unit="s"
            sub={t.lang === 'es' ? 'Si se desactivan los elementos de alto impacto' : 'If high-impact items are disabled'}
            accent="var(--success)"
            icon={<Rocket className="h-4 w-4" />}
          />
        </div>
        <Card className="col-span-4">
          <CardHeader title={t.lang === 'es' ? 'Tendencia de arranque' : 'Boot time trend'} description={t.lang === 'es' ? 'Últimos 16 inicios de sesión' : 'Last 16 sign-ins'} icon={<Clock className="h-4 w-4" />} action={<Badge tone="success">−12%</Badge>} />
          <CardBody className="pt-0">
            <Bars data={bootHistory} color="var(--brand-b)" height={54} />
          </CardBody>
        </Card>
      </div>

      <SectionTitle
        className="mt-6"
        title={t.lang === 'es' ? 'Entradas de inicio' : 'Startup entries'}
        description={t.lang === 'es' ? `${rows.length} de ${STARTUP_ITEMS.length} mostradas` : `${rows.length} of ${STARTUP_ITEMS.length} shown`}
        action={
          <div className="flex items-center gap-2">
            {FILTERS.map((f) => (
              <Pill key={f} active={filter === f} onClick={() => setFilter(f)}>
                {FILTER_LABEL[f]}
              </Pill>
            ))}
          </div>
        }
      />

      <Card className="overflow-hidden">
        <div className="grid grid-cols-[36px_minmax(0,2.4fr)_minmax(0,1.6fr)_92px_110px_84px_46px] items-center gap-3 border-b border-line bg-[var(--sunken)] px-4 py-2">
          <span />
          {header('name', t('common.name'))}
          {header('publisher', t('common.publisher'))}
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">{t('common.type')}</span>
          {header('impact', t('common.impact'))}
          {header('delay', t.lang === 'es' ? 'Retraso' : 'Delay')}
          <span className="text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">{t.lang === 'es' ? 'Activo' : 'On'}</span>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={<ShieldQuestion className="h-5 w-5" />}
            title={t.lang === 'es' ? 'Ninguna entrada de inicio coincide' : 'No startup entries match'}
            description={t.lang === 'es' ? 'Ajustá los filtros o limpiá el cuadro de búsqueda para ver todas las entradas de nuevo.' : 'Adjust the filter chips or clear the search box to see every entry again.'}
          />
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {rows.map((s, i) => {
              const on = isOn(s.id, s.defaultOn)
              return (
                <ContextMenu
                  key={s.id}
                  items={[
                    { id: 'open', label: t.lang === 'es' ? 'Abrir ubicación del archivo' : 'Open file location', icon: <FolderOpen className="h-3.5 w-3.5" /> },
                    { id: 'props', label: t.lang === 'es' ? 'Propiedades' : 'Properties', icon: <Info className="h-3.5 w-3.5" /> },
                    { id: 'search', label: t.lang === 'es' ? 'Buscar en línea' : 'Search online', icon: <ExternalLink className="h-3.5 w-3.5" /> },
                    { id: 'delete', label: t.lang === 'es' ? 'Quitar entrada' : 'Remove entry', danger: true, separatorBefore: true, icon: <Trash2 className="h-3.5 w-3.5" /> },
                  ]}
                  onSelect={async (actionId) => {
                    if (actionId === 'search') {
                      const query = encodeURIComponent(`${s.name} ${s.publisher} windows startup`)
                      window.open(`https://www.google.com/search?q=${query}`, '_blank')
                      return
                    }
                    if (!hasSystemApi() || !realData) {
                      toast({ title: `“${actionId}” on ${s.name}`, description: t.lang === 'es' ? 'Acción simulada' : 'Simulated action', tone: 'info' })
                      return
                    }
                    if (actionId === 'open' && s.command) {
                      try {
                        await openFileLocation(s.command)
                        toast({ title: t.lang === 'es' ? 'Ubicación abierta' : 'Location opened', description: s.command, tone: 'info' })
                      } catch (error) {
                        toast({ title: 'Error opening location', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
                      }
                    } else if (actionId === 'delete' && s.hive && s.location && s.approvedName) {
                      try {
                        await startupRemoveEntry(s.hive, s.location, s.approvedName, s.command)
                        log('Startup entry removed', `${s.name} (${s.hive}\\${s.location})`, 'warning')
                        toast({ title: t.lang === 'es' ? 'Entrada eliminada' : 'Entry removed', description: s.name, tone: 'success' })
                        refreshStartup()
                      } catch (error) {
                        toast({ title: 'Error removing entry', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
                      }
                    }
                  }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.2) }}
                    className="grid grid-cols-[36px_minmax(0,2.4fr)_minmax(0,1.6fr)_92px_110px_84px_46px] items-center gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-card-hover"
                  >
                    <span
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors duration-200',
                        on ? 'bg-accent-soft text-[var(--accent)]' : 'bg-[var(--sunken)] text-subtle',
                      )}
                    >
                      <s.Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{s.name}</p>
                      <p className="truncate text-[11px] text-subtle">{t.lang === 'es' ? 'Clic derecho para más opciones' : 'Right-click for more options'}</p>
                    </div>
                    <span className="truncate text-[12.5px] text-muted">{s.publisher}</span>
                    <Badge tone="neutral">{t.te(s.type)}</Badge>
                    <span className="flex items-center gap-2">
                      <ImpactMeter impact={s.impact} />
                      <span className="text-[12px] text-muted">{t.te(s.impact)}</span>
                    </span>
                    <Tooltip content={t.lang === 'es' ? 'Contribución medida al tiempo de inicio de sesión' : 'Measured contribution to sign-in time'}>
                      <span className="cursor-help font-mono text-[12px] tabular-nums text-muted">{s.delay}</span>
                    </Tooltip>
                    <span className="flex justify-end">
                      <Switch checked={on} onChange={(v) => toggleItem(s, v)} size="sm" label={s.name} />
                    </span>
                  </motion.div>
                </ContextMenu>
              )
            })}
          </div>
        )}
      </Card>
    </Page>
  )
}
