import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Boxes, PackagePlus, RotateCcw, Search } from 'lucide-react'
import { Notice, Page, StatTile } from '@/components/shell'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, Pill } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { SearchInput } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { Divider, EmptyState, SectionTitle, Stagger, StaggerItem } from '@/components/ui/primitives'
import { FEATURES } from '@/lib/mock'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { changeOptionalFeature, hasSystemApi, optionalFeatures } from '@/lib/system'

const CATEGORIES = ['All', 'Developer', 'Virtualization', 'Runtime', 'Networking', 'Legacy'] as const

export default function Features() {
  const { isOn, toast } = useApp()
  const t = useT()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<(typeof CATEGORIES)[number]>('All')
  const [featureStates, setFeatureStates] = useState<Record<string, boolean>>(() => Object.fromEntries(FEATURES.map((f) => [f.id, f.defaultOn])))
  const [originalStates, setOriginalStates] = useState<Record<string, boolean>>(() => Object.fromEntries(FEATURES.map((f) => [f.id, f.defaultOn])))
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    if (!hasSystemApi()) return
    setLoading(true)
    optionalFeatures()
      .then((states) => {
        const byName = new Map(states.map((s) => [s.featureName, s.state]))
        const names: Record<string, string> = {
          'f.wsl': 'Microsoft-Windows-Subsystem-Linux', 'f.hyperv': 'Microsoft-Hyper-V-All', 'f.sandbox': 'Containers-DisposableClientVM',
          'f.vmp': 'VirtualMachinePlatform', 'f.net35': 'NetFx3', 'f.net48': 'NetFx4-AdvSrvs', 'f.smb1': 'SMB1Protocol',
          'f.smbdirect': 'SMBDirect', 'f.telnet': 'TelnetClient', 'f.tftp': 'TFTP', 'f.wcf': 'WCF-Services45',
          'f.printvirt': 'Printing-Foundation-InternetPrinting-Client', 'f.mediafeat': 'MediaPlayback',
        }
        const next = Object.fromEntries(FEATURES.map((f) => [f.id, ['Enabled', 'EnablePending'].includes(byName.get(names[f.id]) ?? '')]))
        setFeatureStates(next)
        setOriginalStates(next)
      })
      .catch((error) => toast({ title: t.lang === 'es' ? 'No se pudieron leer las características' : 'Could not read Windows features', description: String(error), tone: 'danger' }))
      .finally(() => setLoading(false))
  }, [t.lang])

  const isFeatureOn = (id: string, fallback: boolean) => featureStates[id] ?? fallback

  const translated = useMemo(
    () => FEATURES.map((f) => ({
      ...f,
      name: t.tt('features', f.id, 'name', f.name),
      description: t.tt('features', f.id, 'description', f.description),
    })),
    [t.lang],
  )

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return translated.filter(
      (f) =>
        (cat === 'All' || f.category === cat) &&
        (!needle || f.name.toLowerCase().includes(needle) || f.description.toLowerCase().includes(needle)),
    )
  }, [translated, q, cat])

  const enabled = FEATURES.filter((f) => isFeatureOn(f.id, isOn(f.id, f.defaultOn)))
  const pendingChanges = FEATURES.filter((f) => featureStates[f.id] !== originalStates[f.id])
  const pendingRestart = pendingChanges.filter((f) => f.restart).length
  const diskUse = enabled.reduce((a, f) => a + parseFloat(f.size), 0)

  const applyChanges = async () => {
    if (!hasSystemApi()) {
      toast({ title: t.lang === 'es' ? 'Aplicación simulada' : 'Simulated apply', description: t.lang === 'es' ? 'Abrí la aplicación de escritorio para cambiar Windows.' : 'Open the desktop app to change Windows.', tone: 'info' })
      return
    }
    const changes = FEATURES.filter((f) => featureStates[f.id] !== originalStates[f.id])
    if (changes.length === 0) return
    if (!window.confirm(t.lang === 'es' ? `Se cambiarán ${changes.length} características de Windows. ¿Continuar?` : `${changes.length} Windows features will change. Continue?`)) return
    setApplying(true)
    let restart = false
    let applied = 0
    try {
      for (const feature of changes) {
        const result = await changeOptionalFeature(feature.id, Boolean(featureStates[feature.id]))
        restart ||= result.restartNeeded
        applied += 1
      }
      setOriginalStates({ ...featureStates })
      toast({ title: t.lang === 'es' ? 'Características aplicadas' : 'Features applied', description: t.lang === 'es' ? `${applied} cambios completados${restart ? ' · reinicio requerido' : ''}` : `${applied} changes completed${restart ? ' · restart required' : ''}`, tone: restart ? 'warning' : 'success' })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'La aplicación se detuvo' : 'Apply stopped', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setApplying(false)
    }
  }

  const storeSummary = [
    { l: t.lang === 'es' ? 'Tamaño de WinSxS' : 'WinSxS size', v: t.lang === 'es' ? 'Consultar al ejecutar DISM' : 'Query by running DISM' },
    { l: t.lang === 'es' ? 'Paquetes reemplazados' : 'Superseded packages', v: t.lang === 'es' ? 'Consultar al ejecutar DISM' : 'Query by running DISM' },
    { l: t.lang === 'es' ? 'Última limpieza' : 'Last cleanup', v: '—' },
    { l: t.lang === 'es' ? 'Estado de salud' : 'Health state', v: t.lang === 'es' ? 'No consultado' : 'Not queried' },
  ]

  return (
    <Page
      title={t('nav.features.label')}
      description={hasSystemApi() ? (t.lang === 'es' ? 'Componentes opcionales reales de Windows — los cambios se aplican mediante DISM' : 'Real Windows optional components — changes are applied through DISM') : (t.lang === 'es' ? 'Vista web: los cambios no modifican el dispositivo' : 'Web preview: changes do not modify the device')}
      actions={
        <>
          <SearchInput value={q} onChange={setQ} placeholder={t.lang === 'es' ? 'Buscar componentes' : 'Search components'} className="w-[240px]" />
          <Button variant="secondary" disabled={applying} onClick={() => setFeatureStates(Object.fromEntries(FEATURES.map((f) => [f.id, false])))}>
            <RotateCcw className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Restablecer selección' : 'Reset selection'}
          </Button>
          <Button variant="primary" loading={applying || loading} disabled={pendingChanges.length === 0} onClick={applyChanges}>
            <PackagePlus className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Aplicar cambios' : 'Apply changes'}
          </Button>
        </>
      }
      banner={
        pendingRestart > 0 ? (
          <Notice tone="warning" title={t.lang === 'es' ? `${pendingRestart} componentes requerirían reiniciar` : `${pendingRestart} components would require a restart`}>
            {t.lang === 'es' ? 'Windows normalmente prepara estos paquetes y termina la instalación después de reiniciar.' : 'Windows normally stages these packages and finishes the install after a reboot.'}
          </Notice>
        ) : undefined
      }
    >
      <div className="grid grid-cols-4 gap-3">
        <StatTile label={t.lang === 'es' ? 'Disponibles' : 'Available'} value={FEATURES.length} sub={t.lang === 'es' ? 'Componentes opcionales listados' : 'Optional components listed'} accent="var(--accent)" icon={<Boxes className="h-4 w-4" />} />
        <StatTile label={t.lang === 'es' ? 'Activados' : 'Enabled'} value={enabled.length} sub={hasSystemApi() ? (t.lang === 'es' ? 'Estado real de Windows' : 'Actual Windows state') : (t.lang === 'es' ? 'Estado de vista previa' : 'Preview state')} accent="var(--success)" icon={<Boxes className="h-4 w-4" />} />
        <StatTile label={t.lang === 'es' ? 'Huella en disco' : 'Disk footprint'} value={diskUse.toFixed(1)} unit="GB" sub={t.lang === 'es' ? 'Tamaño combinado de los elementos activados' : 'Combined size of enabled items'} accent="var(--brand-a)" icon={<Boxes className="h-4 w-4" />} />
        <StatTile label={t.lang === 'es' ? 'Requiere reinicio' : 'Needs restart'} value={pendingRestart} sub={t.lang === 'es' ? 'Preparado tras aplicar' : 'Staged after apply'} accent="var(--warning)" icon={<RotateCcw className="h-4 w-4" />} />
      </div>

      <SectionTitle
        className="mt-6"
        title={t.lang === 'es' ? 'Componentes de Windows' : 'Windows components'}
        description={t.lang === 'es' ? `${list.length} de ${FEATURES.length} mostrados` : `${list.length} of ${FEATURES.length} shown`}
        action={
          <div className="flex items-center gap-2">
            {CATEGORIES.map((c) => (
              <Pill key={c} active={cat === c} onClick={() => setCat(c)}>
                {c === 'All' ? t('common.all') : t.te(c)}
              </Pill>
            ))}
          </div>
        }
      />

      {list.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title={t.lang === 'es' ? 'Ningún componente coincide' : 'No components match'}
            description={t.lang === 'es' ? 'Limpiá el cuadro de búsqueda o elegí otra categoría para ver la lista completa.' : 'Clear the search box or pick a different category to browse the full list.'}
            action={<Button size="sm" variant="secondary" onClick={() => { setQ(''); setCat('All') }}>{t.lang === 'es' ? 'Limpiar filtros' : 'Clear filters'}</Button>}
          />
        </Card>
      ) : (
        <Stagger className="grid grid-cols-3 gap-3">
          {list.map((f) => {
            const on = isFeatureOn(f.id, isOn(f.id, f.defaultOn))
            return (
              <StaggerItem key={f.id}>
                <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }} className="h-full">
                  <Card className={cn('h-full', on && 'border-[color-mix(in_srgb,var(--accent)_32%,transparent)]')}>
                    <div className="flex h-full flex-col p-4">
                      <div className="mb-3 flex items-start justify-between gap-2">
                        <span
                          className={cn(
                            'flex h-9 w-9 items-center justify-center rounded-[9px] transition-colors duration-200',
                            on ? 'bg-accent-soft text-[var(--accent)]' : 'bg-[var(--sunken)] text-muted',
                          )}
                        >
                          <f.Icon className="h-4 w-4" />
                        </span>
                        <Switch checked={on} disabled={loading || applying} onChange={(v) => setFeatureStates((current) => ({ ...current, [f.id]: v }))} label={f.name} />
                      </div>
                      <p className="text-[13px] font-semibold leading-snug">{f.name}</p>
                      <p className="mt-1 flex-1 text-[12px] leading-relaxed text-muted">{f.description}</p>
                      <Divider className="my-2.5" />
                      <div className="flex items-center justify-between">
                        <Badge tone={on ? 'accent' : 'neutral'}>{t.te(f.category)}</Badge>
                        <span className="flex items-center gap-2 text-[11.5px] text-subtle">
                          {f.restart ? (
                            <Tooltip content={t.lang === 'es' ? 'Se requiere reiniciar después de cambiar este componente' : 'A restart is required after changing this component'}>
                              <RotateCcw className="h-3 w-3 cursor-help text-[var(--warning)]" />
                            </Tooltip>
                          ) : null}
                          {f.size}
                        </span>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              </StaggerItem>
            )
          })}
        </Stagger>
      )}

      <Card className="mt-4">
        <CardHeader title={t.lang === 'es' ? 'Almacén de componentes' : 'Component store'} description={t.lang === 'es' ? 'Estado del almacén de componentes de Windows' : 'Windows component store status'} icon={<Boxes className="h-4 w-4" />} />
        <CardBody className="grid grid-cols-4 gap-3 pt-0">
          {storeSummary.map((x) => (
            <div key={x.l} className="rounded-[8px] border border-line bg-[var(--sunken)] p-3">
              <p className="text-[11px] uppercase tracking-[0.06em] text-subtle">{x.l}</p>
              <p className="mt-1 text-[15px] font-semibold">{x.v}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </Page>
  )
}
