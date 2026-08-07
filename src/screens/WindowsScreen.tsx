import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AppWindow, Eye, LayoutGrid, RotateCcw, Search, Sparkles, Wifi } from 'lucide-react'
import { Page, TweakRow } from '@/components/shell'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs } from '@/components/ui/tabs'
import { SectionTitle } from '@/components/ui/primitives'
import { WINDOWS_SECTIONS } from '@/lib/mock'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'

export default function WindowsScreen() {
  const { isOn, setMany, isSystemTweak, log, toast } = useApp()
  const t = useT()
  const [tab, setTab] = useState(WINDOWS_SECTIONS[0].id)
  const [restarting, setRestarting] = useState(false)

  const restartExplorer = async () => {
    if (restarting) return
    setRestarting(true)

    if (!window.xtweaks?.actions) {
      window.setTimeout(() => {
        setRestarting(false)
        toast({ title: t.lang === 'es' ? 'Explorer reiniciado' : 'Explorer restarted', description: t.lang === 'es' ? 'Recarga simulada del shell' : 'Simulated shell reload', tone: 'info' })
      }, 600)
      return
    }

    try {
      const result = await window.xtweaks.actions.run('explorer')
      log(result.message, result.detail, result.ok ? 'success' : 'warning')
      toast({ title: result.message, description: result.detail, tone: result.ok ? 'success' : 'warning' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      log(t.lang === 'es' ? 'No se pudo reiniciar Explorer' : 'Could not restart Explorer', message, 'danger')
      toast({ title: t.lang === 'es' ? 'No se pudo reiniciar Explorer' : 'Could not restart Explorer', description: message, tone: 'danger' })
    } finally {
      setRestarting(false)
    }
  }

  const sections = useMemo(
    () => WINDOWS_SECTIONS.map((s) => ({
      ...s,
      title: t.tt('windowsSections', s.id, 'title', s.title),
      items: s.items.map((it) => ({
        ...it,
        name: t.tt('windowsItems', it.id, 'name', it.name),
        description: t.tt('windowsItems', it.id, 'description', it.description),
      })),
    })),
    [t.lang],
  )

  const section = sections.find((s) => s.id === tab) ?? sections[0]
  const all = WINDOWS_SECTIONS.flatMap((s) => s.items)
  const applied = all.filter((i) => isOn(i.id, i.defaultOn)).length

  const leftAligned = isOn('w.tb.align', false)
  const hideChat = isOn('w.tb.chat', true)
  const hideTaskView = isOn('w.tb.taskview', false)
  const hideCopilot = isOn('w.cp.copilot', false)
  const showWidgets = isOn('w.wd.widgets', false)
  const iconOnlySearch = isOn('w.sr.box', true)

  return (
    <Page
      title={t('nav.windows.label')}
      description={t.lang === 'es'
        ? 'Comportamiento del shell para la barra de tareas, Explorador, menú contextual, búsqueda y pantalla de bloqueo'
        : 'Shell behaviour for the taskbar, Explorer, context menu, search and lock screen'}
      actions={
        <>
          <Button variant="secondary" disabled={restarting} onClick={restartExplorer}>
            <RotateCcw className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Reiniciar Explorer' : 'Restart Explorer'}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const ids = all.map((i) => i.id)
              const realCount = window.xtweaks?.tweaks ? ids.filter(isSystemTweak).length : 0
              setMany(ids, true, 'Shell preferences applied')
              toast({
                title: t.lang === 'es' ? 'Preferencias de shell aplicadas' : 'Shell preferences applied',
                description: realCount === ids.length
                  ? (t.lang === 'es' ? `${ids.length} interruptores aplicados de verdad` : `${ids.length} switches applied for real`)
                  : realCount > 0
                    ? (t.lang === 'es' ? `${realCount} de ${ids.length} aplicados de verdad, el resto solo vista previa` : `${realCount} of ${ids.length} applied for real, the rest is preview only`)
                    : (t.lang === 'es' ? `${ids.length} interruptores · simulado` : `${ids.length} switches · simulated`),
                tone: 'success',
              })
            }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t('common.applyAll')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-12 gap-3">
        {/* Live taskbar mock ------------------------------------------------ */}
        <Card className="col-span-8 overflow-hidden">
          <CardHeader
            title={t.lang === 'es' ? 'Vista previa en vivo' : 'Live preview'}
            description={t.lang === 'es' ? 'Un escritorio simulado que reacciona a los interruptores de abajo' : 'A mock desktop reacting to the switches below'}
            icon={<Eye className="h-4 w-4" />}
            action={<Badge tone="accent">{applied}/{all.length} {t('common.applied').toLowerCase()}</Badge>}
          />
          <CardBody className="pt-0">
            <div className="relative overflow-hidden rounded-[10px] border border-line bg-[#14121e] p-3">
              <div className="grid-lines absolute inset-0 opacity-25" />
              <div className="relative flex h-[128px] flex-col justify-end">
                <motion.div
                  layout
                  className="mx-auto flex w-full max-w-[520px] items-center gap-2 rounded-[10px] border border-white/10 bg-[#1e202a] px-2.5 py-1.5 shadow-md"
                >
                  <motion.div layout className={cn('flex min-w-0 flex-1 flex-wrap items-center justify-center gap-1.5 overflow-hidden', leftAligned ? 'justify-start' : 'mx-auto')}>
                    {[
                      { id: 'start', el: <span className="brand-gradient block h-4 w-4 rounded-[3px]" /> },
                      ...(iconOnlySearch
                        ? [{ id: 'search', el: <Search className="h-3.5 w-3.5 text-white/80" /> }]
                        : [{ id: 'searchbox', el: <span className="flex h-5 w-24 items-center gap-1 rounded-full bg-white/10 px-2 text-[9px] text-white/70"><Search className="h-2.5 w-2.5" />{t.lang === 'es' ? 'Buscar' : 'Search'}</span> }]),
                      ...(hideTaskView ? [] : [{ id: 'tv', el: <LayoutGrid className="h-3.5 w-3.5 text-white/75" /> }]),
                      ...(showWidgets ? [{ id: 'wd', el: <span className="h-3.5 w-3.5 rounded-[3px] bg-white/25" /> }] : []),
                      ...(hideChat ? [] : [{ id: 'chat', el: <span className="h-3.5 w-3.5 rounded-[3px] bg-[#4f7cff]/70" /> }]),
                      ...(hideCopilot ? [] : [{ id: 'cp', el: <Sparkles className="h-3.5 w-3.5 text-white/80" /> }]),
                      { id: 'ex', el: <span className="h-3.5 w-3.5 rounded-[3px] bg-[#ffc24b]/80" /> },
                      { id: 'ed', el: <span className="h-3.5 w-3.5 rounded-full bg-[#29c7ff]/80" /> },
                    ].map((i) => (
                      <motion.span
                        key={i.id}
                        layout
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        transition={{ duration: 0.2 }}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[5px] transition-colors hover:bg-white/10"
                      >
                        {i.el}
                      </motion.span>
                    ))}
                  </motion.div>
                  <motion.div layout className="ml-auto flex items-center gap-2 pl-2 text-[9.5px] text-white/80">
                    <Wifi className="h-3 w-3" />
                    <span className="tabular-nums">14:12{isOn('w.tb.seconds', false) ? ':38' : ''}</span>
                  </motion.div>
                </motion.div>
              </div>
            </div>
            <p className="mt-2 text-[11.5px] text-subtle">
              {t.lang === 'es'
                ? 'La vista previa de arriba es decorativa: reacciona a los interruptores de barra de tareas, búsqueda, widgets y Copilot.'
                : 'The mock above is decorative: it responds to the taskbar, search, widgets and Copilot switches.'}
            </p>
          </CardBody>
        </Card>

        <Card className="col-span-4">
          <CardHeader title={t.lang === 'es' ? 'Resumen del shell' : 'Shell summary'} description={t.lang === 'es' ? 'Interruptores aplicados por área' : 'Applied switches per area'} icon={<AppWindow className="h-4 w-4" />} />
          <CardBody className="space-y-2 pt-0">
            {sections.map((s) => {
              const on = s.items.filter((i) => isOn(i.id, i.defaultOn)).length
              const active = tab === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setTab(s.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[8px] border px-3 py-2 text-left transition-all duration-200',
                    active
                      ? 'border-[color-mix(in_srgb,var(--accent)_50%,transparent)] bg-accent-soft text-fg font-medium shadow-sm'
                      : 'border-line bg-card/60 text-muted hover:bg-card-hover hover:text-fg',
                  )}
                >
                  <s.Icon className={cn('h-4 w-4 shrink-0', active ? 'text-[var(--accent)]' : 'text-subtle')} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{s.title}</span>
                  <Badge tone={on === s.items.length ? 'success' : on > 0 ? 'accent' : 'neutral'}>
                    {on}/{s.items.length}
                  </Badge>
                </button>
              )
            })}
          </CardBody>
        </Card>
      </div>

      <SectionTitle
        className="mt-6"
        title={t.lang === 'es' ? 'Opciones del shell' : 'Shell options'}
        description={t.lang === 'es' ? 'Agrupadas por la superficie que afectan' : 'Grouped by the surface they affect'}
        action={
          <Button size="sm" variant="subtle" onClick={() => setMany(all.map((i) => i.id), false, 'Shell switches reset')}>
            {t.lang === 'es' ? 'Restablecer sección' : 'Reset section'}
          </Button>
        }
      />

      <Tabs
        className="mb-3"
        value={tab}
        onChange={setTab}
        tabs={sections.map((s) => ({ id: s.id, label: s.title, icon: <s.Icon className="h-3.5 w-3.5" />, count: s.items.length }))}
      />

      <Card className="rounded-[4px]">
        <motion.div
          key={section.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
        >
          {section.items.map((i) => (
            <TweakRow key={i.id} id={i.id} name={i.name} description={i.description} defaultOn={i.defaultOn} />
          ))}
        </motion.div>
      </Card>
    </Page>
  )
}
