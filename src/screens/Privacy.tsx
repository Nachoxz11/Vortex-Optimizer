import { useMemo, useState } from 'react'
import { EyeOff, Lock, Search, Shield, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Notice, Page, TweakRow } from '@/components/shell'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, Pill } from '@/components/ui/badge'
import { SearchInput } from '@/components/ui/input'
import { Accordion } from '@/components/ui/accordion'
import { Progress } from '@/components/ui/progress'
import { EmptyState, SectionTitle } from '@/components/ui/primitives'
import { Ring } from '@/components/charts'
import { PRIVACY_GROUPS } from '@/lib/mock'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'

export default function Privacy() {
  const { isOn, setMany, isSystemTweak, toast } = useApp()
  const t = useT()
  const [q, setQ] = useState('')
  const [level, setLevel] = useState('strict')

  const LEVELS = [
    { id: 'balanced', label: t.te('Balanced') },
    { id: 'strict', label: t.lang === 'es' ? 'Estricto' : 'Strict' },
    { id: 'paranoid', label: t.lang === 'es' ? 'Paranoico' : 'Paranoid' },
  ]

  const translatedGroups = useMemo(
    () => PRIVACY_GROUPS.map((g) => ({
      ...g,
      title: t.tt('privacyGroups', g.id, 'title', g.title),
      description: t.tt('privacyGroups', g.id, 'description', g.description),
      items: g.items.map((it) => ({
        ...it,
        name: t.tt('privacyItems', it.id, 'name', it.name),
        description: t.tt('privacyItems', it.id, 'description', it.description),
        tooltip: t.tt('privacyItems', it.id, 'tooltip', it.tooltip),
      })),
    })),
    [t.lang],
  )

  const allItems = useMemo(() => translatedGroups.flatMap((g) => g.items), [translatedGroups])
  const hardened = allItems.filter((tw) => isOn(tw.id, tw.defaultOn)).length
  const score = Math.round((hardened / allItems.length) * 100)

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return translatedGroups
    return translatedGroups.map((g) => ({
      ...g,
      items: g.items.filter(
        (tw) => tw.name.toLowerCase().includes(needle) || tw.description.toLowerCase().includes(needle),
      ),
    })).filter((g) => g.items.length > 0)
  }, [translatedGroups, q])

  const endpoints = [
    { host: 'settings-win.data.microsoft.com', hits: 412, blocked: true },
    { host: 'telemetry.microsoft.com', hits: 288, blocked: true },
    { host: 'watson.telemetry.microsoft.com', hits: 96, blocked: true },
    { host: 'vortex.data.microsoft.com', hits: 61, blocked: false },
    { host: 'browser.events.data.msn.com', hits: 34, blocked: false },
  ]

  const bars = [
    { label: t.lang === 'es' ? 'Diagnósticos' : 'Diagnostics', value: level === 'paranoid' ? 100 : level === 'strict' ? 82 : 48 },
    { label: t.lang === 'es' ? 'Permisos de apps' : 'App permissions', value: level === 'paranoid' ? 96 : level === 'strict' ? 70 : 40 },
    { label: t.lang === 'es' ? 'Integración con la nube' : 'Cloud integration', value: level === 'paranoid' ? 90 : level === 'strict' ? 62 : 30 },
  ]

  return (
    <Page
      title={t('nav.privacy.label')}
      description={t.lang === 'es' ? `${allItems.length} interruptores entre telemetría, sensores, apps y servicios de Microsoft` : `${allItems.length} switches across telemetry, sensors, apps and Microsoft services`}
      actions={
        <>
          <SearchInput value={q} onChange={setQ} placeholder={t.lang === 'es' ? 'Buscar interruptores de privacidad' : 'Search privacy switches'} className="w-[240px]" />
          <Button
            variant="primary"
            onClick={() => {
              const ids = allItems.map((tw) => tw.id)
              const realCount = window.xtweaks?.tweaks ? ids.filter(isSystemTweak).length : 0
              setMany(ids, true, 'Privacy hardening applied')
              toast({
                title: t.lang === 'es' ? 'Tweaks de privacidad aplicados' : 'Privacy tweaks applied',
                description: realCount > 0
                  ? (t.lang === 'es' ? `${realCount} de ${ids.length} módulos aplicados de verdad en el sistema` : `${realCount} of ${ids.length} modules applied for real on the system`)
                  : (t.lang === 'es' ? 'Próximamente — no hay módulos disponibles en esta vista' : 'Coming soon — no modules are available in this view'),
                tone: 'success',
              })
            }}
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Aplicar disponibles' : 'Apply available'}
          </Button>
        </>
      }
      banner={
        <Notice tone="info" title="Módulos reales y catálogo en progreso" icon={<EyeOff className="h-4 w-4" />}>
          Los controles habilitados guardan el estado previo y aplican cambios reales de registro para el usuario actual. El resto es informativo hasta contar con un módulo validado.
        </Notice>
      }
    >
      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-4">
          <CardHeader title={t.lang === 'es' ? 'Puntaje de privacidad' : 'Privacy score'} description={t.lang === 'es' ? 'Proporción de interruptores reforzados' : 'Share of switches hardened'} icon={<Shield className="h-4 w-4" />} />
          <CardBody className="flex items-center gap-4 pt-0">
            <Ring value={score} size={96} thickness={9} color={score > 70 ? 'var(--success)' : 'var(--warning)'} sub={t.lang === 'es' ? 'reforzado' : 'hardened'} />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium">
                {t.lang === 'es' ? `${hardened} de ${allItems.length} interruptores` : `${hardened} of ${allItems.length} switches`}
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted">
                {score > 80
                  ? (t.lang === 'es' ? 'Excelente postura. Solo quedan activadas comodidades opcionales.' : 'Excellent posture. Only optional conveniences remain enabled.')
                  : (t.lang === 'es' ? 'Todavía hay varios recolectores activos. Revisá los grupos de abajo.' : 'Several collectors are still active. Review the groups below.')}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="success">{t.lang === 'es' ? 'Telemetría' : 'Telemetry'} {PRIVACY_GROUPS[3].items.filter((tw) => isOn(tw.id, tw.defaultOn)).length}/5</Badge>
                <Badge tone="warning">{t.lang === 'es' ? 'Sensores' : 'Sensors'} {PRIVACY_GROUPS[4].items.filter((tw) => isOn(tw.id, tw.defaultOn)).length}/8</Badge>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-4">
          <CardHeader title={t.lang === 'es' ? 'Nivel de protección' : 'Protection level'} description={t.lang === 'es' ? 'Paquetes aplicados a cada grupo' : 'Bundles applied to every group'} icon={<SlidersHorizontal className="h-4 w-4" />} />
          <CardBody className="pt-0">
            <div className="flex gap-2">
              {LEVELS.map((l) => (
                <Pill key={l.id} active={level === l.id} onClick={() => setLevel(l.id)} className="flex-1 justify-center">
                  {l.label}
                </Pill>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              {bars.map((b) => (
                <div key={b.label}>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-muted">{b.label}</span>
                    <span className="font-medium tabular-nums">{b.value}%</span>
                  </div>
                  <Progress value={b.value} height={4} className="mt-1" />
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="col-span-4">
          <CardHeader title={t.lang === 'es' ? 'Endpoints de datos' : 'Data endpoints'} description={t.lang === 'es' ? 'Hosts de telemetría saliente simulados' : 'Simulated outbound telemetry hosts'} icon={<Lock className="h-4 w-4" />} action={<Badge tone="danger">{t.lang === 'es' ? '6 bloqueados' : '6 blocked'}</Badge>} />
          <CardBody className="space-y-1.5 pt-0">
            {endpoints.map((e) => (
              <div key={e.host} className="flex items-center gap-2 rounded-[6px] bg-[var(--sunken)] px-2.5 py-1.5">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${e.blocked ? 'bg-[var(--danger)]' : 'bg-[var(--warning)]'}`} />
                <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{e.host}</span>
                <span className="shrink-0 text-[11px] text-subtle tabular-nums">{e.hits}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <SectionTitle
        className="mt-6"
        title={t.lang === 'es' ? 'Grupos de interruptores' : 'Switch groups'}
        description="Los controles marcados “Próximamente” todavía no están disponibles"
        action={
          <Button size="sm" variant="subtle" onClick={() => void setMany(allItems.map((tw) => tw.id), false, 'Privacy tweaks reverted')}>
            {t.lang === 'es' ? 'Revertir disponibles' : 'Revert available'}
          </Button>
        }
      />

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title={t.lang === 'es' ? 'Nada coincide con esa búsqueda' : 'Nothing matches that search'}
            description={t.lang === 'es' ? 'Los interruptores de privacidad se agrupan en Windows, Apps, Microsoft, Telemetría y Sensores.' : 'Privacy switches are grouped by Windows, Apps, Microsoft, Telemetry and Sensors.'}
            action={<Button size="sm" variant="secondary" onClick={() => setQ('')}>{t.lang === 'es' ? 'Limpiar búsqueda' : 'Clear search'}</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((g) => {
            const on = g.items.filter((tw) => isOn(tw.id, tw.defaultOn)).length
            return (
              <Accordion
                key={g.id}
                title={g.title}
                description={t.lang === 'es' ? `${g.description} · ${on}/${g.items.length} reforzados` : `${g.description} · ${on}/${g.items.length} hardened`}
                icon={<g.Icon className="h-4 w-4" />}
                badge={<Badge tone={on === g.items.length ? 'success' : on > 0 ? 'accent' : 'neutral'}>{on}/{g.items.length}</Badge>}
              >
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {g.items.map((tw) => (
                    <TweakRow
                      key={tw.id}
                      id={tw.id}
                      name={tw.name}
                      description={tw.description}
                      tooltip={tw.tooltip}
                      impact={tw.impact}
                      risk={tw.risk}
                      defaultOn={tw.defaultOn}
                      icon={<tw.Icon className="h-4 w-4" />}
                      compact
                    />
                  ))}
                </div>
              </Accordion>
            )
          })}
        </div>
      )}
    </Page>
  )
}
