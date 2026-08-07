import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDownAZ, ExternalLink, Filter, Info, Loader2, Search, ShieldCheck, TriangleAlert, Zap } from 'lucide-react'
import { Page } from '@/components/shell'
import { Card, CardBody } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip } from '@/components/ui/tooltip'
import { OPTIMIZE_SECTIONS, type OptimizeItem, type OptimizeRisk, type OptimizeSection } from '@/lib/optimize-data'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { rebuildShaderCache, hasSystemApi } from '@/lib/system'
import { cn } from '@/lib/utils'

const NVIDIA_INSPECTOR_RELEASES_URL = 'https://github.com/Orbmu2k/nvidiaProfileInspector/releases'

function RiskPill({ risk }: { risk: OptimizeItem['risk'] }) {
  const t = useT()
  if (risk === 'Safe') {
    return (
      <span className="flex items-center gap-1 text-[10.5px] text-subtle">
        <ShieldCheck className="h-3 w-3" />
        {t.lang === 'es' ? 'Seguro' : 'Safe'}
      </span>
    )
  }
  return (
    <span className={cn('flex items-center gap-1 text-[10.5px]', risk === 'Advanced' ? 'text-[var(--danger)]' : 'text-[var(--warning)]')}>
      <TriangleAlert className="h-3 w-3" />
      {t.lang === 'es' ? (risk === 'Advanced' ? 'Avanzado' : 'Advertencia') : (risk === 'Advanced' ? 'Advanced' : 'Warning')}
    </span>
  )
}

function OptimizeCard({ item }: { item: OptimizeItem }) {
  const { isOn, setToggle, toast, log } = useApp()
  const t = useT()
  const [busy, setBusy] = useState(false)
  const on = isOn(item.id, false)

  const runAction = async () => {
    if (busy) return
    setBusy(true)
    try {
      if (item.action === 'ultimate') {
        if (!window.xtweaks?.actions) {
          toast({ title: t.lang === 'es' ? 'Requiere la app de escritorio' : 'Requires the desktop app', tone: 'info' })
          return
        }
        const result = await window.xtweaks.actions.run('ultimate')
        log(result.message, result.detail, result.ok ? 'success' : 'warning')
        toast({ title: result.message, description: result.detail, tone: result.ok ? 'success' : 'warning' })
      } else if (item.action === 'shaderCache') {
        if (!hasSystemApi()) {
          toast({ title: t.lang === 'es' ? 'Requiere la app de escritorio' : 'Requires the desktop app', tone: 'info' })
          return
        }
        const result = await rebuildShaderCache()
        log(t.lang === 'es' ? 'Caché de shaders vaciado' : 'Shader cache cleared', `${result.filesRemoved} · ${result.freedGB.toFixed(2)} GB`, 'success')
        toast({
          title: t.lang === 'es' ? 'Caché de shaders reconstruido' : 'Shader cache rebuilt',
          description: t.lang === 'es' ? `${result.filesRemoved} archivos · ${result.freedGB.toFixed(2)} GB liberados` : `${result.filesRemoved} files · ${result.freedGB.toFixed(2)} GB freed`,
          tone: 'success',
        })
      } else if (item.action === 'nvidiaInspector') {
        if (!window.xtweaks?.tools) {
          toast({ title: t.lang === 'es' ? 'Requiere la app de escritorio' : 'Requires the desktop app', tone: 'info' })
          return
        }
        const result = await window.xtweaks.tools.open('nvidiaProfileInspector.exe')
        if (result.ok) {
          toast({ title: t.lang === 'es' ? 'NVIDIA Profile Inspector abierto' : 'NVIDIA Profile Inspector opened', tone: 'success' })
        } else {
          toast({
            title: t.lang === 'es' ? 'No se encontró NVIDIA Profile Inspector' : 'NVIDIA Profile Inspector not found',
            description: t.lang === 'es'
              ? `Descargalo desde GitHub y copiá el .exe a ${result.path}. Abriendo la página de descarga…`
              : `Download it from GitHub and copy the .exe to ${result.path}. Opening the download page…`,
            tone: 'warning',
          })
          window.xtweaks?.openUrl(NVIDIA_INSPECTOR_RELEASES_URL)
        }
      }
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'La acción falló' : 'Action failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setBusy(false)
    }
  }

  const name = t.lang === 'es' ? item.name.es : item.name.en
  const description = t.lang === 'es' ? item.description.es : item.description.en
  const technical = t.lang === 'es' ? item.technical.es : item.technical.en
  const reversibleLabel = item.reversible
    ? (t.lang === 'es' ? 'Reversible' : 'Reversible')
    : (t.lang === 'es' ? 'No reversible' : 'Not reversible')

  return (
    <Card interactive className="rounded-[4px] flex h-[196px] flex-col shadow-[0_4px_16px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
      <CardBody className="flex h-full flex-col p-4">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              'flex h-9 w-9 shrink-0 items-center justify-center rounded-[5px]',
              on ? 'bg-accent-soft text-[var(--accent)]' : 'bg-[var(--sunken)] text-muted',
            )}
          >
            <item.Icon className="h-4.5 w-4.5" />
          </span>
          <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold leading-tight">{name}</p>
          <Tooltip content={`${technical} · ${reversibleLabel}`}>
            <Info className="h-3.5 w-3.5 shrink-0 cursor-help text-subtle" />
          </Tooltip>
        </div>

        <p className="mt-2.5 line-clamp-3 flex-1 text-[12px] leading-relaxed text-muted">{description}</p>

        <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
          <RiskPill risk={item.risk} />

          {item.action ? (
            <Button variant="secondary" onClick={runAction} disabled={busy}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : item.action === 'nvidiaInspector' ? <ExternalLink className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
              {t.lang === 'es' ? 'Ejecutar' : 'Run'}
            </Button>
          ) : (
            <Switch checked={on} onChange={(v) => void setToggle(item.id, v, name)} label={name} />
          )}
        </div>
      </CardBody>
    </Card>
  )
}

export default function Optimize() {
  const t = useT()
  const [sectionId, setSectionId] = useState(OPTIMIZE_SECTIONS[0].id)
  const [query, setQuery] = useState('')
  const [riskFilter, setRiskFilter] = useState<'All' | OptimizeRisk>('All')
  const [sortBy, setSortBy] = useState<'name' | 'risk'>('name')

  const section: OptimizeSection = useMemo(
    () => OPTIMIZE_SECTIONS.find((s) => s.id === sectionId) ?? OPTIMIZE_SECTIONS[0],
    [sectionId],
  )

  const visibleItems = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase()
    return section.items
      .filter((item) => {
        const name = t.lang === 'es' ? item.name.es : item.name.en
        const description = t.lang === 'es' ? item.description.es : item.description.en
        return (riskFilter === 'All' || item.risk === riskFilter)
          && (!needle || `${name} ${description}`.toLocaleLowerCase().includes(needle))
      })
      .sort((a, b) => {
        if (sortBy === 'risk') {
          const rank = { Safe: 0, Moderate: 1, Advanced: 2 }
          return rank[a.risk] - rank[b.risk] || a.name.en.localeCompare(b.name.en)
        }
        const aName = t.lang === 'es' ? a.name.es : a.name.en
        const bName = t.lang === 'es' ? b.name.es : b.name.en
        return aName.localeCompare(bName)
      })
  }, [query, riskFilter, section, sortBy, t.lang])

  return (
    <Page
      title={t('nav.optimize.label')}
      description={t.lang === 'es'
        ? 'Tweaks organizados por área de hardware — pasá el mouse sobre el ícono ⓘ para ver qué toca técnicamente'
        : 'Tweaks organized by hardware area — hover the ⓘ icon to see what each one touches technically'}
    >
      <div className="mb-4 flex gap-1.5 overflow-x-auto border-b border-line pb-2">
        {OPTIMIZE_SECTIONS.map((s) => {
          const active = s.id === section.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSectionId(s.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-[4px] px-3.5 py-2 text-[13px] font-medium transition-all duration-200',
                active ? 'bg-accent-soft text-fg shadow-[0_2px_12px_color-mix(in_srgb,var(--accent)_12%,transparent)]' : 'text-muted hover:bg-card hover:text-fg',
              )}
            >
              <s.Icon className={cn('h-4 w-4 shrink-0', active && 'text-[var(--accent)]')} />
              {t.lang === 'es' ? s.label.es : s.label.en}
            </button>
          )
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-[5px] border border-line bg-card/45 p-2.5">
        <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-[4px] border border-line bg-[var(--sunken)] px-2.5 text-muted focus-within:border-line-strong">
          <Search className="h-3.5 w-3.5 shrink-0" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t.lang === 'es' ? 'Buscar tweaks…' : 'Search tweaks…'}
            className="h-8 w-full bg-transparent text-[12.5px] text-fg outline-none placeholder:text-subtle"
          />
        </label>
        <div className="flex items-center gap-1">
          <Filter className="mx-1 h-3.5 w-3.5 text-subtle" />
          {(['All', 'Safe', 'Moderate', 'Advanced'] as const).map((risk) => (
            <button
              key={risk}
              type="button"
              onClick={() => setRiskFilter(risk === 'All' ? 'All' : risk)}
              className={cn(
                'rounded-[6px] px-2.5 py-1.5 text-[11.5px] font-medium transition-colors',
                riskFilter === risk ? 'bg-accent-soft text-[var(--accent)]' : 'text-muted hover:bg-card-hover hover:text-fg',
              )}
            >
              {risk === 'All' ? (t.lang === 'es' ? 'Todos' : 'All') : risk === 'Safe' ? (t.lang === 'es' ? 'Seguros' : 'Safe') : risk === 'Moderate' ? (t.lang === 'es' ? 'Advertencia' : 'Warning') : (t.lang === 'es' ? 'Avanzados' : 'Advanced')}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSortBy(sortBy === 'name' ? 'risk' : 'name')}
          className="flex items-center gap-1.5 rounded-[6px] border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-muted transition-colors hover:bg-card-hover hover:text-fg"
        >
          <ArrowDownAZ className="h-3.5 w-3.5" />
          {sortBy === 'name' ? (t.lang === 'es' ? 'Nombre' : 'Name') : (t.lang === 'es' ? 'Riesgo' : 'Risk')}
        </button>
        <span className="ml-auto whitespace-nowrap px-1 text-[11.5px] text-subtle">
          {visibleItems.length} / {section.items.length} {t.lang === 'es' ? 'visibles' : 'visible'}
        </span>
      </div>

      <motion.div
        key={`${section.id}-${riskFilter}-${query}-${sortBy}`}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.16 }}
        className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        {visibleItems.map((item) => (
          <OptimizeCard key={item.id} item={item} />
        ))}
      </motion.div>

      {visibleItems.length === 0 ? (
        <Card className="mt-3 rounded-[4px]">
          <CardBody className="py-10 text-center text-[12.5px] text-muted">
            {t.lang === 'es' ? 'No hay tweaks que coincidan con estos filtros.' : 'No tweaks match these filters.'}
          </CardBody>
        </Card>
      ) : null}
    </Page>
  )
}
