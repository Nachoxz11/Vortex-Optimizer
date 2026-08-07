import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Brush, CheckCircle2, FolderSearch, HardDrive, Loader2, Sparkles, Trash2 } from 'lucide-react'
import { Notice, Page } from '@/components/shell'
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/switch'
import { Progress, SegmentedBar } from '@/components/ui/progress'
import { Dialog } from '@/components/ui/dialog'
import { Tooltip } from '@/components/ui/tooltip'
import { Divider, SectionTitle } from '@/components/ui/primitives'
import { Bars, Donut, Legend } from '@/components/charts'
import { CLEANER_CATEGORIES } from '@/lib/mock'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { cleanCategories, deepClean, hasSystemApi, useCleanerScan } from '@/lib/system'


type Phase = 'idle' | 'scanning' | 'ready' | 'cleaning' | 'done'

const CLEANER_META = Object.fromEntries(CLEANER_CATEGORIES.map((c) => [c.id, c]))

export default function Cleaner() {
  const { isOn, setToggle, log, toast } = useApp()
  const t = useT()
  const { categories: liveCategories, real: realData, loading, refresh } = useCleanerScan()
  const [phase, setPhase] = useState<Phase>(loading ? 'scanning' : 'ready')
  const [progress] = useState(0)
  const [confirm, setConfirm] = useState(false)
  const [hover, setHover] = useState<string | null>(null)
  const [deepRunning, setDeepRunning] = useState(false)
  const [duplicateRunning, setDuplicateRunning] = useState(false)
  const [duplicateResult, setDuplicateResult] = useState<{ groups: { sizeBytes: number; files: string[] }[]; scannedFiles: number } | null>(null)

  const scanDuplicates = async () => {
    if (!window.xtweaks?.system?.duplicateCandidates || duplicateRunning) return
    setDuplicateRunning(true)
    try {
      const result = await window.xtweaks.system.duplicateCandidates(50)
      setDuplicateResult(result)
      toast({ title: t.lang === 'es' ? 'Búsqueda de duplicados completada' : 'Duplicate scan complete', description: t.lang === 'es' ? `${result.groups.length} grupos en ${result.scannedFiles} archivos` : `${result.groups.length} groups across ${result.scannedFiles} files`, tone: 'info' })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'No se pudo buscar duplicados' : 'Duplicate scan failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setDuplicateRunning(false)
    }
  }

  const rawCategories = realData
    ? liveCategories.map((c) => {
        const meta = CLEANER_META[c.id]
        return { ...c, color: meta?.color ?? 'var(--accent)', Icon: meta?.Icon ?? Trash2 }
      })
    : CLEANER_CATEGORIES

  const categories = useMemo(
    () => rawCategories.map((c) => ({
      ...c,
      name: t.tt('cleaner', c.id, 'name', c.name),
      detail: t.tt('cleaner', c.id, 'detail', c.detail),
    })),
    [rawCategories, t.lang],
  )

  const selected = categories.filter((c) => isOn(c.id, c.defaultOn))
  const total = useMemo(() => selected.reduce((a, c) => a + c.size, 0), [selected, categories])
  const totalFiles = selected.reduce((a, c) => a + c.files, 0)
  const grand = categories.reduce((a, c) => a + c.size, 0)
  const [history, setHistory] = useState<number[]>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem('xtweaks:cleaner-history:v1') ?? '[]')
      return Array.isArray(saved) ? saved.filter((value): value is number => typeof value === 'number').slice(-14) : []
    } catch {
      return []
    }
  })

  const recordCleanResult = (freedGB: number) => {
    setHistory((current) => {
      const next = [...current, freedGB].slice(-14)
      try { window.localStorage.setItem('xtweaks:cleaner-history:v1', JSON.stringify(next)) } catch { /* storage unavailable */ }
      return next
    })
  }

  const deepCleanRows = [
    { t: t.lang === 'es' ? 'Almacén de componentes (WinSxS)' : 'Component store (WinSxS)', d: t.lang === 'es' ? 'Elimina paquetes de actualización reemplazados' : 'Removes superseded update payloads', v: t.lang === 'es' ? 'Se calcula al ejecutar' : 'Measured on run' },
    { t: t.lang === 'es' ? 'Instalación anterior de Windows' : 'Old Windows installation', d: t.lang === 'es' ? 'Windows.old de la actualización a 24H2' : 'Windows.old from the 24H2 upgrade', v: t.lang === 'es' ? 'Se calcula al ejecutar' : 'Measured on run' },
    { t: t.lang === 'es' ? 'Buscador de duplicados' : 'Duplicate finder', d: t.lang === 'es' ? 'Comparación por hash entre carpetas de usuario' : 'Hash-compare across user folders', v: duplicateResult ? `${duplicateResult.groups.length} grupos` : (t.lang === 'es' ? 'Ejecutar búsqueda' : 'Run scan') },
  ]

  const runDeepClean = async (mode: 'component_store' | 'upgrade_leftovers', label: string) => {
    if (!hasSystemApi() || deepRunning) return
    if (!window.confirm(t.lang === 'es' ? `${label} elimina archivos que Windows no puede restaurar. ¿Continuar?` : `${label} removes files Windows cannot restore. Continue?`)) return
    setDeepRunning(true)
    try {
      await deepClean(mode)
      log(label, t.lang === 'es' ? 'Operación oficial de Windows completada.' : 'Official Windows operation completed.', 'warning')
      toast({ title: t.lang === 'es' ? 'Limpieza profunda completada' : 'Deep clean completed', description: label, tone: 'warning' })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'Falló la limpieza profunda' : 'Deep clean failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally { setDeepRunning(false) }
  }


  return (
    <Page
      title={t('nav.cleaner.label')}
      description={realData ? 'Espacio recuperable medido en carpetas reales del sistema' : (t.lang === 'es' ? 'Abrí la aplicación de escritorio para medir y limpiar el sistema real' : 'Open the desktop app to measure and clean the real system')}
      actions={
        <>
          <Button
            variant="secondary"
            disabled={phase === 'scanning' || phase === 'cleaning' || loading}
            onClick={async () => {
              setPhase('scanning')
              try {
                await refresh()
                setPhase('ready')
                toast({ title: t.lang === 'es' ? 'Escaneo finalizado' : 'Scan finished', description: t.lang === 'es' ? `${grand.toFixed(2)} GB encontrados en ${categories.length} categorías` : `${grand.toFixed(2)} GB found across ${categories.length} categories`, tone: 'info' })
              } catch (error) {
                setPhase('ready')
                toast({ title: t.lang === 'es' ? 'Falló el escaneo' : 'Scan failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
              }
            }}
          >
            <FolderSearch className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Reescanear' : 'Rescan'}
          </Button>
          <Button variant="primary" disabled={selected.length === 0 || phase === 'cleaning'} onClick={() => setConfirm(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            {t.lang === 'es' ? `Limpiar ${total.toFixed(2)} GB` : `Clean ${total.toFixed(2)} GB`}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-5">
          <CardHeader title={t.lang === 'es' ? 'Espacio recuperable' : 'Reclaimable space'} description={t.lang === 'es' ? 'Distribución entre las categorías seleccionadas' : 'Distribution across the selected categories'} icon={<Brush className="h-4 w-4" />} />
          <CardBody className="pt-0">
            <div className="flex items-center gap-5">
              <Donut
                segments={categories.map((c) => ({ id: c.id, value: c.size, color: c.color, label: c.name }))}
                size={172}
                thickness={20}
                centerValue={`${grand.toFixed(1)}`}
                centerLabel={t.lang === 'es' ? 'GB total' : 'GB total'}
                onHover={setHover}
              />
              <div className="min-w-0 flex-1">
                <Legend
                  items={categories.map((c) => ({
                    id: c.id,
                    label: c.name,
                    color: c.color,
                    value: `${c.size.toFixed(2)} GB`,
                  }))}
                />
              </div>
            </div>
            <Divider className="my-3" />
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted">{t.lang === 'es' ? 'Al pasar el mouse' : 'Hovering'}</span>
              <span className="font-medium">
                {hover ? categories.find((c) => c.id === hover)?.name : '—'}
              </span>
            </div>
          </CardBody>
        </Card>

        <div className="col-span-7 space-y-3">
          <Card>
            <CardBody className="p-4">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-[11.5px] uppercase tracking-[0.06em] text-subtle">{t.lang === 'es' ? 'Seleccionado para limpiar' : 'Selected for cleaning'}</p>
                  <p className="mt-1 flex items-baseline gap-2">
                    <span className="text-[34px] font-semibold leading-none tracking-[-0.035em] tabular-nums">
                      {total.toFixed(2)}
                    </span>
                    <span className="text-[15px] text-muted">GB</span>
                  </p>
                  <p className="mt-1 text-[12px] text-muted">
                    {t.lang === 'es' ? `${totalFiles.toLocaleString()} archivos en ${selected.length} categorías` : `${totalFiles.toLocaleString()} files in ${selected.length} categories`}
                  </p>
                </div>
                <div className="text-right">
                  <Badge tone={phase === 'cleaning' ? 'warning' : 'success'} dot>
                    {phase === 'scanning' ? (t.lang === 'es' ? 'Escaneando' : 'Scanning') : phase === 'cleaning' ? (t.lang === 'es' ? 'Limpiando' : 'Cleaning') : (t.lang === 'es' ? 'Listo' : 'Ready')}
                  </Badge>
                  <p className="mt-2 text-[11.5px] text-subtle">{t.lang === 'es' ? 'El espacio libre se volverá a medir después de limpiar' : 'Free space will be measured again after cleaning'}</p>
                </div>
              </div>
              <div className="mt-4">
                <SegmentedBar
                  segments={selected.map((c) => ({ id: c.id, value: c.size, color: c.color, label: c.name }))}
                  height={16}
                />
              </div>
              <AnimatePresence>
                {phase === 'scanning' || phase === 'cleaning' ? (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <div className="mt-3 flex items-center gap-2.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--accent)]" />
                      <Progress value={progress} height={5} className="flex-1" />
                      <span className="w-10 text-right font-mono text-[11.5px] text-muted">{Math.round(progress)}%</span>
                    </div>
                    <p className="mt-1.5 truncate font-mono text-[11px] text-subtle">
                      {phase === 'scanning' ? (t.lang === 'es' ? 'Consultando carpetas del sistema…' : 'Querying system folders…') : (t.lang === 'es' ? 'Eliminando archivos seleccionados…' : 'Removing selected files…')}
                    </p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={t.lang === 'es' ? 'Espacio recuperado' : 'Space reclaimed'} description={t.lang === 'es' ? 'Ejecuciones reales registradas en este equipo' : 'Real runs recorded on this machine'} icon={<HardDrive className="h-4 w-4" />} action={<Badge tone="accent">{history.length > 0 ? `${history.reduce((sum, value) => sum + value, 0).toFixed(2)} GB` : (t.lang === 'es' ? 'Sin historial' : 'No history')}</Badge>} />
            <CardBody className="pt-0">
              {history.length > 0 ? <Bars data={history} color="var(--accent)" height={70} /> : <div className="flex h-[70px] items-center justify-center text-[12px] text-subtle">{t.lang === 'es' ? 'Todavía no hay ejecuciones reales.' : 'No real runs yet.'}</div>}
              <div className="mt-2 flex justify-between text-[10.5px] text-subtle">
                <span>{t.lang === 'es' ? 'Más antiguo' : 'Oldest'}</span>
                <span>{t.lang === 'es' ? 'Reciente' : 'Recent'}</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <SectionTitle className="mt-6" title={t.lang === 'es' ? 'Categorías' : 'Categories'} description={t.lang === 'es' ? 'Elegí qué eliminar' : 'Pick what to remove'} />
      <div className="grid grid-cols-4 gap-3">
        {categories.map((c) => {
          const on = isOn(c.id, c.defaultOn)
          return (
            <motion.div key={c.id} whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
              <Card
                interactive
                className={`h-full cursor-pointer ${on ? 'border-[color-mix(in_srgb,var(--accent)_35%,transparent)]' : ''}`}
                onClick={() => setToggle(c.id, !on, c.name)}
              >
                <div className="flex h-full flex-col p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-[9px]"
                      style={{ background: `color-mix(in srgb, ${c.color} 16%, transparent)`, color: c.color }}
                    >
                      <c.Icon className="h-4.5 w-4.5" />
                    </span>
                    <Checkbox checked={on} onChange={() => setToggle(c.id, !on, c.name)} label={c.name} />
                  </div>
                  <p className="text-[13px] font-semibold">{c.name}</p>
                  <p className="mt-0.5 flex-1 text-[11.5px] leading-relaxed text-muted">{c.detail}</p>
                  <Divider className="my-2.5" />
                  <div className="flex items-baseline justify-between">
                    <span className="text-[17px] font-semibold tabular-nums">{c.size.toFixed(2)}<span className="ml-1 text-[11px] font-normal text-muted">GB</span></span>
                    <Tooltip content={t.lang === 'es' ? `${c.files.toLocaleString()} archivos encontrados` : `${c.files.toLocaleString()} files matched`}>
                      <span className="cursor-help text-[11px] text-subtle">{c.files.toLocaleString()} {t.lang === 'es' ? 'archivos' : 'files'}</span>
                    </Tooltip>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <Card className="mt-4">
        <CardHeader
          title={t.lang === 'es' ? 'Limpieza profunda' : 'Deep clean'}
          description={t.lang === 'es' ? 'Pasadas opcionales que tardan más y profundizan más' : 'Optional passes that take longer and dig further'}
          icon={<Sparkles className="h-4 w-4" />}
          action={<Badge tone="warning">{t.lang === 'es' ? 'Tarda ~4 min' : 'Takes ~4 min'}</Badge>}
        />
        <CardBody className="grid grid-cols-3 gap-3 pt-0">
          {deepCleanRows.map((x) => (
            <div key={x.t} className="rounded-[8px] border border-line bg-[var(--sunken)] p-3">
              <p className="text-[12.5px] font-medium">{x.t}</p>
              <p className="mt-0.5 text-[11.5px] text-muted">{x.d}</p>
              <p className="mt-2 text-[14px] font-semibold tabular-nums">{x.v}</p>
            </div>
          ))}
        </CardBody>
        <CardFooter>
          <Notice tone="warning" title={t.lang === 'es' ? 'La limpieza profunda no se puede deshacer' : 'Deep clean cannot be undone'}>
            {t.lang === 'es' ? 'Usa herramientas oficiales de Windows y requiere confirmación independiente.' : 'Uses official Windows tools and requires separate confirmation.'}
          </Notice>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="subtle" disabled={!hasSystemApi() || deepRunning} onClick={() => runDeepClean('component_store', t.lang === 'es' ? 'Limpiar almacén de componentes' : 'Clean component store')}>{t.lang === 'es' ? 'Limpiar WinSxS' : 'Clean WinSxS'}</Button>
            <Button size="sm" variant="subtle" disabled={!hasSystemApi() || deepRunning} onClick={() => runDeepClean('upgrade_leftovers', t.lang === 'es' ? 'Eliminar restos de actualizaciones' : 'Remove upgrade leftovers')}>{t.lang === 'es' ? 'Restos de actualización' : 'Upgrade leftovers'}</Button>
            <Button size="sm" variant="secondary" loading={duplicateRunning} disabled={!hasSystemApi() || deepRunning} onClick={scanDuplicates}>{t.lang === 'es' ? 'Buscar duplicados' : 'Find duplicates'}</Button>
          </div>
          {duplicateResult ? <p className="mt-3 text-[11.5px] text-muted">{t.lang === 'es' ? `${duplicateResult.groups.length} grupos encontrados en ${duplicateResult.scannedFiles} archivos. No se elimina nada automáticamente.` : `${duplicateResult.groups.length} groups found across ${duplicateResult.scannedFiles} files. Nothing is deleted automatically.`}</p> : null}
        </CardFooter>
      </Card>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        icon={<Trash2 className="h-4 w-4" />}
        tone="warning"
        title={t.lang === 'es' ? `¿Eliminar ${total.toFixed(2)} GB en ${selected.length} categorías?` : `Delete ${total.toFixed(2)} GB across ${selected.length} categories?`}
        description={t.lang === 'es' ? 'Se crearía un punto de restauración antes de eliminar nada.' : 'A restore point would be created before anything is removed.'}
        footer={
          <>
            <Button variant="subtle" onClick={() => setConfirm(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirm(false)
                if (hasSystemApi()) {
                  const ids = selected.map((c) => c.id)
                  setPhase('cleaning')
                cleanCategories(ids)
                    .then((result) => {
                      setPhase('done')
                      recordCleanResult(result.freedGB)
                      refresh()
                      log('Cleaner run completed', `${result.freedGB.toFixed(2)} GB reclaimed across ${result.cleaned.length} categories`, 'success')
                      toast({ title: t.lang === 'es' ? 'Limpieza completa' : 'Clean complete', description: t.lang === 'es' ? `${result.freedGB.toFixed(2)} GB recuperados (${result.filesRemoved} archivos)` : `${result.freedGB.toFixed(2)} GB reclaimed (${result.filesRemoved} files)`, tone: 'success' })
                    })
                    .catch((error: unknown) => {
                      setPhase('ready')
                      toast({ title: t.lang === 'es' ? 'Falló la limpieza' : 'Clean failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
                    })
                  return
                }
                toast({ title: t.lang === 'es' ? 'Limpieza no disponible' : 'Cleaning unavailable', description: t.lang === 'es' ? 'Abrí la aplicación de escritorio para limpiar archivos reales.' : 'Open the desktop app to clean real files.', tone: 'info' })
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {t.lang === 'es' ? 'Limpiar ahora' : 'Clean now'}
            </Button>
          </>
        }
      >
        <div className="space-y-1.5">
          {selected.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-[6px] bg-[var(--sunken)] px-2.5 py-1.5 text-[12.5px]">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                {c.name}
              </span>
              <span className="font-medium tabular-nums">{c.size.toFixed(2)} GB</span>
            </div>
          ))}
        </div>
      </Dialog>
    </Page>
  )
}
