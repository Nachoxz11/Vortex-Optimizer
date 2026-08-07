import { useEffect, useMemo, useState } from 'react'
import { CheckCheck, ChevronDown, Download, Gauge, ListFilter, RotateCcw, Rocket, Search, Timer, Undo2 } from 'lucide-react'
import { Notice, Page, TweakRow } from '@/components/shell'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, Pill } from '@/components/ui/badge'
import { SearchInput } from '@/components/ui/input'
import { Accordion } from '@/components/ui/accordion'
import { DropdownMenu, Select } from '@/components/ui/menu'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState, SectionTitle } from '@/components/ui/primitives'
import { Progress } from '@/components/ui/progress'
import { PERFORMANCE_TWEAKS } from '@/lib/mock'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'

const RISKS = ['All', 'Safe', 'Moderate', 'Advanced'] as const

export default function Performance() {
  const { isOn, setMany, isSystemTweak, toast } = useApp()
  const t = useT()
  const [q, setQ] = useState('')
  const [risk, setRisk] = useState<(typeof RISKS)[number]>('All')
  const [preset, setPreset] = useState('balanced')
  const [confirm, setConfirm] = useState<null | 'apply' | 'revert'>(null)
  const [timerStatus, setTimerStatus] = useState<{ currentMs: number; enabled: boolean } | null>(null)
  const [timerBusy, setTimerBusy] = useState(false)

  useEffect(() => {
    window.xtweaks?.system?.timerResolutionGet?.()
      .then((status) => setTimerStatus({ currentMs: status.currentMs, enabled: status.enabled }))
      .catch(() => setTimerStatus(null))
  }, [])

  const setTimerResolution = async (enabled: boolean) => {
    if (!window.xtweaks?.system?.timerResolutionSet || timerBusy) return
    setTimerBusy(true)
    try {
      const status = await window.xtweaks.system.timerResolutionSet(enabled)
      setTimerStatus({ currentMs: status.currentMs, enabled: status.enabled })
      toast({
        title: enabled ? (t.lang === 'es' ? 'Resolución del temporizador activada' : 'Timer resolution enabled') : (t.lang === 'es' ? 'Resolución del temporizador revertida' : 'Timer resolution reverted'),
        description: `${status.currentMs.toFixed(4)} ms`,
        tone: 'success',
      })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'No se pudo cambiar la resolución' : 'Could not change timer resolution', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setTimerBusy(false)
    }
  }

  const PRESETS = [
    { id: 'balanced', label: t.lang === 'es' ? 'Equilibrado (recomendado)' : 'Balanced (recommended)' },
    { id: 'performance', label: t.lang === 'es' ? 'Rendimiento' : 'Performance' },
    { id: 'silent', label: t.lang === 'es' ? 'Silencioso / bajo consumo' : 'Silent / low power' },
    { id: 'custom', label: t.lang === 'es' ? 'Perfil personalizado' : 'Custom profile' },
  ]

  const translated = useMemo(
    () => PERFORMANCE_TWEAKS.map((tw) => ({
      ...tw,
      name: t.tt('performance', tw.id, 'name', tw.name),
      description: t.tt('performance', tw.id, 'description', tw.description),
      tooltip: t.tt('performance', tw.id, 'tooltip', tw.tooltip),
    })),
    [t.lang],
  )

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const filtered = translated.filter(
      (tw) =>
        (risk === 'All' || tw.risk === risk) &&
        (!needle || tw.name.toLowerCase().includes(needle) || tw.description.toLowerCase().includes(needle)),
    )
    const map = new Map<string, typeof translated>()
    for (const tw of filtered) map.set(tw.group, [...(map.get(tw.group) ?? []), tw])
    return [...map.entries()]
  }, [translated, q, risk])

  const applied = PERFORMANCE_TWEAKS.filter((tw) => isOn(tw.id, tw.defaultOn)).length
  const pct = Math.round((applied / PERFORMANCE_TWEAKS.length) * 100)
  const recommended = PERFORMANCE_TWEAKS.filter((tw) => tw.risk === 'Safe')

  return (
    <Page
      title={t('nav.performance.label')}
      description={t.lang === 'es'
        ? `${PERFORMANCE_TWEAKS.length} tweaks entre servicios, kernel, energía, segundo plano y almacenamiento`
        : `${PERFORMANCE_TWEAKS.length} tweaks across services, kernel, power, background work and storage`}
      actions={
        <>
          <DropdownMenu
            align="end"
            items={[
              { id: 'export', label: t.lang === 'es' ? 'Exportar perfil como .json' : 'Export profile as .json', icon: <Download className="h-3.5 w-3.5" /> },
              { id: 'import', label: t.lang === 'es' ? 'Importar perfil' : 'Import profile', icon: <Undo2 className="h-3.5 w-3.5" /> },
              { id: 'reset', label: t.lang === 'es' ? 'Restablecer todos los tweaks' : 'Reset every tweak', danger: true, separatorBefore: true, icon: <RotateCcw className="h-3.5 w-3.5" /> },
            ]}
            onSelect={(id) =>
              id === 'reset' ? setConfirm('revert') : toast({ title: t.lang === 'es' ? 'Acción de perfil simulada' : 'Profile action simulated', description: id, tone: 'info' })
            }
            trigger={({ toggle }) => (
              <Button variant="secondary" onClick={toggle}>
                <ListFilter className="h-3.5 w-3.5" />
                {t.lang === 'es' ? 'Perfil' : 'Profile'}
                <ChevronDown className="h-3 w-3" />
              </Button>
            )}
          />
          <Button variant="primary" onClick={() => setConfirm('apply')}>
            <Rocket className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Aplicar recomendado' : 'Apply recommended'}
          </Button>
        </>
      }
      banner={
        <Notice tone="info" title="Módulos disponibles y próximos">
          Los controles habilitados aplican cambios reales y restaurables. Los demás están marcados como Próximamente.
        </Notice>
      }
    >
      <Card className="mb-4 border-[color-mix(in_srgb,var(--accent)_35%,var(--line))] bg-[linear-gradient(110deg,var(--card),color-mix(in_srgb,var(--accent)_8%,var(--card)))]">
        <CardBody className="flex flex-wrap items-center justify-between gap-5 p-5">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-accent-soft text-[var(--accent)]">
              <Timer className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[16px] font-semibold">{t.lang === 'es' ? 'Resolución del temporizador' : 'Timer Resolution'}</h2>
                <Badge tone={timerStatus?.enabled ? 'success' : 'neutral'}>
                  {timerStatus ? `${timerStatus.currentMs.toFixed(4)} ms` : '—'}
                </Badge>
              </div>
              <p className="mt-1 max-w-[720px] text-[12px] leading-relaxed text-muted">
                {t.lang === 'es'
                  ? 'Reduce la resolución del temporizador de Windows a aproximadamente 0.5000 ms para mejorar la consistencia del frametime y la respuesta de entrada. Se revierte al cerrar la aplicación o usando el botón.'
                  : 'Requests approximately 0.5000 ms Windows timer resolution to improve frametime consistency and input response. It is released when the app closes or with the revert button.'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant={timerStatus?.enabled ? 'subtle' : 'primary'} onClick={() => setTimerResolution(true)} disabled={timerBusy || timerStatus?.enabled === true}>
              <Timer className="h-3.5 w-3.5" />
              {t.lang === 'es' ? 'Activar 0.5 ms' : 'Set 0.5 ms'}
            </Button>
            <Button variant="secondary" onClick={() => setTimerResolution(false)} disabled={timerBusy || timerStatus?.enabled !== true}>
              <Undo2 className="h-3.5 w-3.5" />
              {t.lang === 'es' ? 'Revertir' : 'Revert'}
            </Button>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-8">
          <CardHeader
            title={t.lang === 'es' ? 'Cobertura de optimización' : 'Optimization coverage'}
            description={t.lang === 'es' ? `${applied} de ${PERFORMANCE_TWEAKS.length} tweaks activos actualmente` : `${applied} of ${PERFORMANCE_TWEAKS.length} tweaks currently active`}
            icon={<Gauge className="h-4 w-4" />}
            action={<Badge tone={pct > 60 ? 'success' : 'accent'}>{pct}%</Badge>}
          />
          <CardBody className="pt-0">
            <Progress value={pct} height={8} striped />
            <div className="mt-3 grid grid-cols-5 gap-2">
              {['System services', 'Shell', 'Power', 'Kernel', 'Background'].map((g) => {
                const items = PERFORMANCE_TWEAKS.filter((tw) => tw.group === g)
                const on = items.filter((tw) => isOn(tw.id, tw.defaultOn)).length
                return (
                  <div key={g} className="rounded-[8px] border border-line bg-[var(--sunken)] p-2">
                    <p className="truncate text-[11px] text-muted">{t.te(g)}</p>
                    <p className="mt-0.5 text-[15px] font-semibold tabular-nums">
                      {on}
                      <span className="text-[11px] font-normal text-subtle">/{items.length}</span>
                    </p>
                  </div>
                )
              })}
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-4">
          <CardHeader
            title={t.lang === 'es' ? 'Perfil activo' : 'Active profile'}
            description={t.lang === 'es' ? 'Los perfiles agrupan un conjunto de tweaks' : 'Presets bundle a set of tweaks'}
            icon={<Rocket className="h-4 w-4" />}
          />
          <CardBody className="pt-0">
            <Select value={preset} options={PRESETS} onChange={setPreset} className="w-full" />
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={() => setMany(recommended.map((tw) => tw.id), true, 'Recommended set enabled')}
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t.lang === 'es' ? 'Activar conjunto seguro' : 'Enable safe set'}
              </Button>
              <Button
                size="sm"
                variant="subtle"
                onClick={() => setMany(PERFORMANCE_TWEAKS.map((tw) => tw.id), false, 'All tweaks reverted')}
              >
                <Undo2 className="h-3.5 w-3.5" />
                {t.lang === 'es' ? 'Revertir' : 'Revert'}
              </Button>
            </div>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-subtle">
              {t.lang === 'es'
                ? `El conjunto seguro contiene ${recommended.length} tweaks que nunca afectan los límites de seguridad.`
                : `The safe set contains ${recommended.length} tweaks that never affect security boundaries.`}
            </p>
          </CardBody>
        </Card>
      </div>

      <SectionTitle
        className="mt-6"
        title={t.lang === 'es' ? 'Todos los tweaks' : 'All tweaks'}
        description={t.lang === 'es' ? 'Agrupados por subsistema' : 'Grouped by subsystem'}
        action={
          <div className="flex items-center gap-2">
            {RISKS.map((r) => (
              <Pill key={r} active={risk === r} onClick={() => setRisk(r)}>
                {r === 'All' ? t('common.all') : t.te(r)}
              </Pill>
            ))}
            <SearchInput value={q} onChange={setQ} placeholder={t.lang === 'es' ? 'Filtrar tweaks' : 'Filter tweaks'} className="w-[220px]" />
          </div>
        }
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title={t.lang === 'es' ? 'Ningún tweak coincide con este filtro' : 'No tweaks match this filter'}
            description={t.lang === 'es'
              ? 'Probá con otra palabra clave o limpiá el filtro de riesgo para ver el catálogo completo de nuevo.'
              : 'Try a different keyword or clear the risk filter to see the full catalogue again.'}
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setQ('')
                  setRisk('All')
                }}
              >
                {t.lang === 'es' ? 'Limpiar filtros' : 'Clear filters'}
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map(([group, items]) => {
            const on = items.filter((tw) => isOn(tw.id, tw.defaultOn)).length
            const GroupIcon = items[0].Icon
            return (
              <Accordion
                key={group}
                title={t.te(group)}
                description={t.lang === 'es' ? `${items.length} tweaks · ${on} aplicados` : `${items.length} tweaks · ${on} applied`}
                icon={<GroupIcon className="h-4 w-4" />}
                badge={on > 0 ? <Badge tone="accent">{on}</Badge> : null}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((tw) => (
                    <TweakRow
                      key={tw.id}
                      id={tw.id}
                      name={tw.name}
                      description={tw.description}
                      tooltip={tw.tooltip}
                      impact={tw.impact}
                      risk={tw.risk}
                      requiresRestart={tw.requiresRestart}
                      defaultOn={tw.defaultOn}
                      icon={<tw.Icon className="h-4 w-4" />}
                    />
                  ))}
                </div>
              </Accordion>
            )
          })}
        </div>
      )}

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        tone={confirm === 'revert' ? 'danger' : 'default'}
        icon={confirm === 'revert' ? <RotateCcw className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
        title={confirm === 'revert'
          ? (t.lang === 'es' ? '¿Revertir todos los tweaks de rendimiento?' : 'Revert every performance tweak?')
          : (t.lang === 'es' ? '¿Aplicar el perfil recomendado?' : 'Apply the recommended profile?')}
        description={
          confirm === 'revert'
            ? (t.lang === 'es' ? 'Todos los interruptores de esta pantalla vuelven a su posición predeterminada.' : 'All switches on this screen return to their default position.')
            : (t.lang === 'es' ? `${recommended.length} tweaks seguros disponibles se activarán.` : `${recommended.length} safe available tweaks will be switched on.`)
        }
        footer={
          <>
            <Button variant="subtle" onClick={() => setConfirm(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={confirm === 'revert' ? 'danger' : 'primary'}
              onClick={() => {
                const ids = confirm === 'revert' ? PERFORMANCE_TWEAKS.map((tw) => tw.id) : recommended.map((tw) => tw.id)
                const realCount = window.xtweaks?.tweaks ? ids.filter(isSystemTweak).length : 0
                if (confirm === 'revert') setMany(ids, false, 'All tweaks reverted')
                else setMany(ids, true, 'Recommended profile applied')
                toast({
                  title: confirm === 'revert' ? (t.lang === 'es' ? 'Tweaks revertidos' : 'Tweaks reverted') : (t.lang === 'es' ? 'Perfil recomendado aplicado' : 'Recommended profile applied'),
                  description: realCount === ids.length
                    ? (t.lang === 'es' ? `${ids.length} tweaks reales aplicados en el sistema` : `${ids.length} real tweaks applied on the system`)
                    : realCount > 0
                      ? (t.lang === 'es' ? `${realCount} de ${ids.length} disponibles; el resto está Próximamente` : `${realCount} of ${ids.length} available; the rest is coming soon`)
                      : (t.lang === 'es' ? 'Próximamente — no hay módulos disponibles en esta vista' : 'Coming soon — no modules are available in this view'),
                  tone: confirm === 'revert' ? 'warning' : 'success',
                })
                setConfirm(null)
              }}
            >
              {confirm === 'revert' ? (t.lang === 'es' ? 'Revertir todo' : 'Revert all') : (t.lang === 'es' ? 'Aplicar' : 'Apply')}
            </Button>
          </>
        }
      >
        <ul className="space-y-1.5 text-[12.5px] text-muted">
          <li>· {t.lang === 'es' ? 'Primero se crearía un punto de restauración.' : 'A restore point would be created first.'}</li>
          <li>· {t.lang === 'es' ? 'Tres tweaks de este conjunto requieren reinicio.' : 'Three tweaks in this set require a restart.'}</li>
          <li>· {t.lang === 'es' ? 'Nada se escribe en ningún lado en este build.' : 'Nothing is written anywhere in this build.'}</li>
        </ul>
      </Dialog>
    </Page>
  )
}
