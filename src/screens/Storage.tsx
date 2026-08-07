import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { FileSearch, HardDrive, PieChart, ScanLine, Sparkles, Trash2 } from 'lucide-react'
import { Page } from '@/components/shell'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress, SegmentedBar } from '@/components/ui/progress'
import { Tooltip } from '@/components/ui/tooltip'
import { ContextMenu } from '@/components/ui/menu'
import { Dialog } from '@/components/ui/dialog'
import { Divider, KeyValue, SectionTitle } from '@/components/ui/primitives'
import { Donut, Legend } from '@/components/charts'
import { STORAGE_BREAKDOWN } from '@/lib/mock'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { deleteFile, hasSystemApi, useDrives, useLargeFiles, useStorageBreakdown, type LargeFile } from '@/lib/system'
import { cn, formatBytes } from '@/lib/utils'
import type { ScreenId } from '@/nav'

const BREAKDOWN_META = Object.fromEntries(STORAGE_BREAKDOWN.map((s) => [s.id, s]))

export default function Storage({ onNavigate }: { onNavigate: (id: ScreenId) => void }) {
  const { toast, log } = useApp()
  const t = useT()
  const [deleteTarget, setDeleteTarget] = useState<LargeFile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const { drives: DRIVES, real: realDrives, refresh: refreshDrives } = useDrives()
  const [drive, setDrive] = useState(DRIVES[0]?.letter ?? 'C:')
  const { folders: liveFolders, real: realBreakdown, loading: scanningBreakdown, refresh: refreshBreakdown } = useStorageBreakdown(drive)
  const { files: liveFiles, real: realFiles, loading: scanningFiles, refresh: refreshFiles } = useLargeFiles(drive, 1)
  const [hover, setHover] = useState<string | null>(null)

  useEffect(() => {
    if (!DRIVES.find((d) => d.letter === drive) && DRIVES[0]) setDrive(DRIVES[0].letter)
  }, [DRIVES, drive])

  const rawBreakdown = realBreakdown
    ? liveFolders.map((f) => {
        const meta = BREAKDOWN_META[f.id]
        return { ...f, color: meta?.color ?? 'var(--accent)', Icon: meta?.Icon ?? HardDrive }
      })
    : []
  const breakdown = useMemo(
    () => rawBreakdown.map((s) => ({ ...s, name: t.tt('storageBreakdown', s.id, 'name', s.name) })),
    [rawBreakdown, t.lang],
  )
  const largeFiles = realFiles ? liveFiles : []
  const realData = realDrives || realBreakdown || realFiles
  const scanning = scanningBreakdown || scanningFiles

  const refresh = () => {
    refreshDrives()
    refreshBreakdown()
    refreshFiles()
    toast({ title: t.lang === 'es' ? 'Datos de disco actualizados' : 'Drive data refreshed', tone: 'info' })
  }

  const confirmDelete = async () => {
    const file = deleteTarget
    if (!file || deleting) return
    setDeleting(true)

    if (!hasSystemApi()) {
      setDeleting(false)
      toast({ title: t.lang === 'es' ? 'Eliminación no disponible' : 'Deletion unavailable', description: t.lang === 'es' ? 'Abrí la aplicación de escritorio para eliminar archivos reales.' : 'Open the desktop app to delete real files.', tone: 'info' })
      return
    }

    try {
      const fullPath = `${file.path}\\${file.name}`
      const result = await deleteFile(fullPath)
      log(t.lang === 'es' ? 'Archivo eliminado' : 'File deleted', fullPath, 'warning')
      toast({
        title: t.lang === 'es' ? `${file.name} eliminado` : `${file.name} deleted`,
        description: t.lang === 'es' ? `${result.freedGB.toFixed(2)} GB recuperados` : `${result.freedGB.toFixed(2)} GB reclaimed`,
        tone: 'success',
      })
      refreshFiles()
    } catch (error) {
      toast({ title: t.lang === 'es' ? `No se pudo eliminar ${file.name}` : `Couldn't delete ${file.name}`, description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const current = DRIVES.find((d) => d.letter === drive) ?? DRIVES[0]
  if (!current) {
    return (
      <Page title={t('nav.storage.label')} description={t.lang === 'es' ? 'No hay datos reales de unidades disponibles.' : 'No real drive data is available.'}>
        <Card><CardBody className="p-6 text-center text-[12.5px] text-muted">{t.lang === 'es' ? 'Abrí la aplicación de escritorio y ejecutá un análisis.' : 'Open the desktop app and run a scan.'}</CardBody></Card>
      </Page>
    )
  }
  const usedPct = Math.round((current.used / current.total) * 100)
  const totalBreakdown = breakdown.reduce((a, s) => a + s.size, 0)

  return (
    <Page
      title={t('nav.storage.label')}
      description={realData ? (scanning ? 'Analizando carpetas y archivos grandes…' : 'Uso de discos, carpetas y archivos grandes desde este PC') : (t.lang === 'es' ? 'Abrí la aplicación de escritorio para analizar el disco real' : 'Open the desktop app to analyze the real disk')}
      actions={
        <>
          <Button variant="secondary" disabled={scanning} onClick={refresh}>
            <ScanLine className="h-3.5 w-3.5" />
            {scanning ? (t.lang === 'es' ? 'Analizando…' : 'Analysing…') : (t.lang === 'es' ? 'Analizar disco' : 'Analyse drive')}
          </Button>
          <Button variant="primary" onClick={() => onNavigate('cleaner')}>
            <Sparkles className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Abrir Limpiador' : 'Open Cleaner'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        {DRIVES.map((d) => {
          const pct = Math.round((d.used / d.total) * 100)
          const active = d.letter === drive
          return (
            <motion.button
              key={d.letter}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.18 }}
              onClick={() => setDrive(d.letter)}
              className={cn(
                'card-surface rounded-[10px] p-4 text-left transition-colors duration-200',
                active ? 'border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-card-hover' : 'hover:bg-card-hover',
              )}
            >
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-[10px] text-[13px] font-semibold',
                    active ? 'bg-accent-soft text-[var(--accent)]' : 'bg-[var(--sunken)] text-muted',
                  )}
                >
                  {d.letter}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] font-semibold">
                    {t.te(d.label)}
                    <Badge tone={d.type === 'HDD' ? 'neutral' : 'accent'}>{d.type}</Badge>
                  </p>
                  <p className="truncate text-[11.5px] text-muted">{d.model}</p>
                </div>
              </div>
              <div className="mt-3">
                <Progress
                  value={pct}
                  height={8}
                  color={pct > 85 ? 'var(--danger)' : pct > 70 ? 'var(--warning)' : 'var(--accent)'}
                />
                <div className="mt-1.5 flex items-center justify-between text-[11.5px]">
                  <span className="text-muted">{t.lang === 'es' ? `${formatBytes(d.used)} usado` : `${formatBytes(d.used)} used`}</span>
                  <span className="font-medium">{t.lang === 'es' ? `${formatBytes(d.total - d.used)} libre` : `${formatBytes(d.total - d.used)} free`}</span>
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-12 gap-3">
        <Card className="col-span-5">
          <CardHeader
            title={t.lang === 'es' ? `Desglose del disco ${current.letter}` : `Drive ${current.letter} breakdown`}
            description={t.lang === 'es' ? `${usedPct}% usado · ${formatBytes(current.total - current.used)} libre` : `${usedPct}% used · ${formatBytes(current.total - current.used)} free`}
            icon={<PieChart className="h-4 w-4" />}
          />
          <CardBody className="pt-0">
            <div className="flex items-center gap-5">
              <Donut
                segments={breakdown.map((s) => ({ id: s.id, value: s.size, color: s.color, label: s.name }))}
                size={176}
                thickness={21}
                centerValue={`${usedPct}%`}
                centerLabel={t.lang === 'es' ? 'de capacidad' : 'of capacity'}
                onHover={setHover}
              />
              <Legend
                className="min-w-0 flex-1"
                items={breakdown.map((s) => ({
                  id: s.id,
                  label: s.name,
                  color: s.color,
                  value: totalBreakdown > 0 ? `${Math.round((s.size / totalBreakdown) * 100)}%` : '—',
                }))}
              />
            </div>
            <Divider className="my-3" />
            <p className="mb-2 truncate text-[12px] text-muted">
              {hover
                ? `${breakdown.find((s) => s.id === hover)?.name} · ${breakdown.find((s) => s.id === hover)?.path}`
                : (t.lang === 'es' ? 'Pasá el mouse sobre un segmento para ver su ruta' : 'Hover a segment to see its path')}
            </p>
            <KeyValue label={t.lang === 'es' ? 'Modelo' : 'Model'} value={current.model} />
            <KeyValue label="Bus" value={current.type === 'HDD' ? 'SATA III · 7200 rpm' : 'PCIe 4.0 ×4 · NVMe'} />
            <KeyValue label={t.lang === 'es' ? 'Capacidad' : 'Capacity'} value={formatBytes(current.total)} />
            <KeyValue label={t.lang === 'es' ? 'Espacio libre' : 'Free space'} value={formatBytes(current.total - current.used)} />
            <KeyValue label={t.lang === 'es' ? 'Sistema de archivos' : 'File system'} value="NTFS · 4 KB clusters" />
            <KeyValue label={t.lang === 'es' ? 'Salud' : 'Health'} value={t.lang === 'es' ? 'Bien · 2% de desgaste' : 'Good · 2% wear'} />
          </CardBody>
        </Card>

        <Card className="col-span-7">
          <CardHeader
            title={t.lang === 'es' ? 'Carpetas' : 'Folders'}
            description={t.lang === 'es' ? 'Ordenadas por tamaño en el disco seleccionado' : 'Sorted by size on the selected drive'}
            icon={<HardDrive className="h-4 w-4" />}
            action={<Badge tone="neutral">{breakdown.length} {t.lang === 'es' ? 'ubicaciones' : 'locations'}</Badge>}
          />
          <CardBody className="pt-0">
            <SegmentedBar
              segments={breakdown.map((s) => ({ id: s.id, value: s.size, color: s.color, label: s.name }))}
              height={18}
              className="mb-3"
            />
            <div className="divide-y divide-[var(--border)]">
              {breakdown.map((s) => (
                <ContextMenu
                  key={s.id}
                  items={[
                    { id: 'open', label: t.lang === 'es' ? 'Abrir en el Explorador' : 'Open in Explorer' },
                    { id: 'analyse', label: t.lang === 'es' ? 'Analizar contenido' : 'Analyse contents' },
                    { id: 'clean', label: t.lang === 'es' ? 'Enviar al Limpiador' : 'Send to Cleaner', separatorBefore: true },
                  ]}
                  onSelect={(id) => (id === 'clean' ? onNavigate('cleaner') : toast({ title: `${id} · ${s.name}`, tone: 'info' }))}
                >
                  <div className="flex items-center gap-3 py-2 transition-colors duration-200 hover:bg-card-hover">
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]"
                      style={{ background: `color-mix(in srgb, ${s.color} 16%, transparent)`, color: s.color }}
                    >
                      <s.Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium">{s.name}</p>
                      <p className="truncate font-mono text-[10.5px] text-subtle">{s.path}</p>
                    </div>
                    <span className="w-28">
                      <Progress value={(s.size / totalBreakdown) * 100} height={4} color={s.color} />
                    </span>
                    <span className="w-20 text-right text-[12.5px] font-semibold tabular-nums">{s.size} GB</span>
                  </div>
                </ContextMenu>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      <SectionTitle className="mt-6" title={t.lang === 'es' ? 'Archivos más grandes' : 'Largest files'} description={realFiles ? 'Archivos mayores a 1 GB encontrados en el disco' : (t.lang === 'es' ? 'Archivos mayores a 5 GB encontrados en el último escaneo' : 'Files above 5 GB found during the last scan')} />
      <Card className="overflow-hidden">
        <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_100px_110px_120px] gap-3 border-b border-line bg-[var(--sunken)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">
          <span>{t.lang === 'es' ? 'Archivo' : 'File'}</span>
          <span>{t.lang === 'es' ? 'Ubicación' : 'Location'}</span>
          <span className="text-right">{t('common.size')}</span>
          <span className="text-right">{t.lang === 'es' ? 'Último uso' : 'Last used'}</span>
          <span className="text-right">{t.lang === 'es' ? 'Acción' : 'Action'}</span>
        </div>
        <div className="divide-y divide-[var(--border)]">
          {largeFiles.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12.5px] text-muted">
              {scanningFiles ? 'Buscando archivos grandes…' : 'No se encontraron archivos mayores al umbral en este disco.'}
            </div>
          ) : largeFiles.map((f) => (
            <div
              key={f.name}
              className="grid grid-cols-[minmax(0,2fr)_minmax(0,2fr)_100px_110px_120px] items-center gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-card-hover"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileSearch className="h-3.5 w-3.5 shrink-0 text-subtle" />
                <span className="truncate font-mono text-[12px]">{f.name}</span>
              </span>
              <Tooltip content={f.path}>
                <span className="truncate text-[12px] text-muted">{f.path}</span>
              </Tooltip>
              <span className="text-right text-[12.5px] font-semibold tabular-nums">{f.size} GB</span>
              <span className="text-right text-[12px] text-muted">{t.lang === 'es' ? `hace ${f.days} d` : `${f.days} d ago`}</span>
              <span className="flex justify-end">
                <Button size="sm" variant="subtle" onClick={() => setDeleteTarget(f)}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t('common.delete')}
                </Button>
              </span>
            </div>
          ))}
        </div>
        <CardFooter>
          <span className="text-[12px] text-muted">
            {t.lang === 'es' ? (
              <>Storage Sense recuperaría un estimado de <strong className="text-fg">31.4 GB</strong> por mes.</>
            ) : (
              <>Storage Sense would reclaim an estimated <strong className="text-fg">31.4 GB</strong> per month.</>
            )}
          </span>
          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => toast({ title: t.lang === 'es' ? 'Storage Sense configurado' : 'Storage Sense configured', tone: 'success' })}>
            {t.lang === 'es' ? 'Configurar Storage Sense' : 'Configure Storage Sense'}
          </Button>
        </CardFooter>
      </Card>

      <Dialog
        open={deleteTarget !== null}
        onClose={() => { if (!deleting) setDeleteTarget(null) }}
        icon={<Trash2 className="h-4 w-4" />}
        tone="danger"
        title={t.lang === 'es' ? `¿Eliminar ${deleteTarget?.name}?` : `Delete ${deleteTarget?.name}?`}
        description={
          hasSystemApi()
            ? (t.lang === 'es' ? 'Se borra de verdad y de forma permanente — no va a la Papelera de reciclaje.' : "This deletes the file for real and permanently — it doesn't go to the Recycle Bin.")
            : (t.lang === 'es' ? 'Vista previa web — no se toca ningún archivo real.' : "Web preview — no real file is touched.")
        }
        footer={
          <>
            <Button variant="subtle" onClick={() => setDeleteTarget(null)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting}>
              <Trash2 className="h-3.5 w-3.5" />
              {t('common.delete')}
            </Button>
          </>
        }
      >
        {deleteTarget ? (
          <div className="space-y-1.5 text-[12.5px]">
            <div className="flex items-center justify-between rounded-[6px] bg-[var(--sunken)] px-2.5 py-1.5">
              <span className="truncate text-muted">{deleteTarget.path}\{deleteTarget.name}</span>
              <span className="font-medium tabular-nums">{deleteTarget.size} GB</span>
            </div>
          </div>
        ) : null}
      </Dialog>
    </Page>
  )
}
