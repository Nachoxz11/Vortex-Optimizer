import { useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Archive, CheckCircle2, Download, FileUp, History, RotateCcw, Save, ShieldAlert, Trash2, Upload,
} from 'lucide-react'
import { Notice, Page, StatTile } from '@/components/shell'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch, Checkbox } from '@/components/ui/switch'
import { Dialog } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { TextField } from '@/components/ui/input'
import { ContextMenu } from '@/components/ui/menu'
import { Divider, KeyValue, SectionTitle } from '@/components/ui/primitives'
import { BACKUP_SLOTS, RESTORE_POINTS } from '@/lib/mock'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { applyRestorePoint, createRestorePoint, exportProfile, hasSystemApi, importProfile, openResetWizard, useRestorePoints } from '@/lib/system'
import { cn } from '@/lib/utils'

export default function Restore() {
  const { isOn, setToggle, toast, log } = useApp()
  const t = useT()
  const importInputRef = useRef<HTMLInputElement>(null)
  const [resetting, setResetting] = useState(false)

  const doExportProfile = async () => {
    if (!hasSystemApi()) {
      toast({ title: t.lang === 'es' ? 'Perfil exportado' : 'Profile exported', description: 'xtweaks-profile.json · simulado', tone: 'info' })
      return
    }
    try {
      const result = await exportProfile()
      log(t.lang === 'es' ? 'Perfil exportado' : 'Profile exported', result.path, 'success')
      toast({ title: t.lang === 'es' ? 'Perfil exportado' : 'Profile exported', description: t.lang === 'es' ? `${result.count} tweaks · ${result.path}` : `${result.count} tweaks · ${result.path}`, tone: 'success' })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'No se pudo exportar el perfil' : "Couldn't export the profile", description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    }
  }

  const doImportProfile = async (file: File) => {
    if (!hasSystemApi()) {
      toast({ title: t.lang === 'es' ? 'Copia importada' : 'Backup imported', description: t.lang === 'es' ? 'Simulado' : 'Simulated', tone: 'info' })
      return
    }
    try {
      const text = await file.text()
      const parsed = JSON.parse(text) as { tweaks?: { id: string; applied: boolean }[] }
      const entries = Array.isArray(parsed.tweaks) ? parsed.tweaks : []
      if (entries.length === 0) throw new Error(t.lang === 'es' ? 'El archivo no tiene un formato de perfil de Vortex-Optimizer válido.' : "The file isn't a valid Vortex-Optimizer profile.")
      const result = await importProfile(entries)
      log(t.lang === 'es' ? 'Perfil importado' : 'Profile imported', t.lang === 'es' ? `${result.applied} tweaks reaplicados, ${result.skipped} ya coincidían, ${result.failed.length} fallaron` : `${result.applied} tweaks reapplied, ${result.skipped} already matched, ${result.failed.length} failed`, result.failed.length > 0 ? 'warning' : 'success')
      toast({
        title: t.lang === 'es' ? 'Perfil importado' : 'Profile imported',
        description: t.lang === 'es' ? `${result.applied} reaplicados · ${result.failed.length} fallidos` : `${result.applied} reapplied · ${result.failed.length} failed`,
        tone: result.failed.length > 0 ? 'warning' : 'success',
      })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'No se pudo importar el perfil' : "Couldn't import the profile", description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    }
  }

  const doOpenResetWizard = async () => {
    if (resetting) return
    setResetting(true)
    if (!hasSystemApi()) {
      window.setTimeout(() => {
        setResetting(false)
        toast({ title: t.lang === 'es' ? 'Restablecimiento de fábrica simulado' : 'Factory reset simulated', description: t.lang === 'es' ? 'No se tocó ningún dato' : 'No data was touched', tone: 'danger' })
      }, 500)
      return
    }
    try {
      await openResetWizard()
      log(t.lang === 'es' ? 'Asistente de restablecimiento abierto' : 'Reset wizard opened', t.lang === 'es' ? 'Vortex-Optimizer no ejecuta el reseteo — lo hace el propio Windows.' : "Vortex-Optimizer doesn't run the reset — Windows itself does.", 'warning')
      toast({ title: t.lang === 'es' ? 'Asistente de Windows abierto' : 'Windows wizard opened', description: t.lang === 'es' ? 'Continuá desde la app Configuración — ahí se confirma y ejecuta el reseteo real.' : 'Continue from the Settings app — that’s where the real reset is confirmed and run.', tone: 'warning' })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'No se pudo abrir el asistente' : "Couldn't open the wizard", description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setResetting(false)
    }
  }
  const { points: livePoints, real: realData, loading: pointsLoading, refresh: refreshPoints } = useRestorePoints()

  const rawPoints = realData
    ? livePoints.map((p) => ({
        id: String(p.sequenceNumber),
        name: p.description,
        date: new Date(p.creationTime).toLocaleString(),
        size: '—',
        type: p.type,
        drive: 'C:',
      }))
    : RESTORE_POINTS

  const points = useMemo(
    () => rawPoints.map((p) => ({ ...p, name: t.tt('restorePoints', p.id, 'name', p.name) })),
    [rawPoints, t.lang],
  )

  const backupSlots = useMemo(
    () => BACKUP_SLOTS.map((b) => ({
      ...b,
      name: t.tt('backupSlots', b.id, 'name', b.name),
      detail: t.tt('backupSlots', b.id, 'detail', b.detail),
    })),
    [t.lang],
  )

  const [selected, setSelected] = useState(points[0]?.id)
  const [name, setName] = useState('Vortex-Optimizer — manual checkpoint')
  const [creating, setCreating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [confirmRestore, setConfirmRestore] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetAck, setResetAck] = useState(false)

  const checkpointOptions = [
    { id: 'r.auto', label: t.lang === 'es' ? 'Crear un punto antes de cada lote' : 'Create a point before every batch', on: true },
    { id: 'r.weekly', label: t.lang === 'es' ? 'Punto de control automático semanal' : 'Weekly automatic checkpoint', on: true },
    { id: 'r.registry', label: t.lang === 'es' ? 'Incluir una instantánea del registro' : 'Include a registry snapshot', on: true },
  ]

  const create = () => {
    if (hasSystemApi()) {
      setCreating(true)
      createRestorePoint(name)
        .then(async () => {
          await refreshPoints()
          log('Restore point created', `“${name}” created via Checkpoint-Computer`, 'success')
          toast({ title: t.lang === 'es' ? 'Punto de restauración creado' : 'Restore point created', description: name, tone: 'success' })
        })
        .catch((error: unknown) => {
          toast({ title: t.lang === 'es' ? 'No se pudo crear el punto de restauración' : "Couldn't create restore point", description: error instanceof Error ? error.message : String(error), tone: 'danger' })
        })
        .finally(() => setCreating(false))
      return
    }
    setCreating(true)
    setProgress(0)
    const started = performance.now()
    const tick = () => {
      const p = Math.min(100, ((performance.now() - started) / 1800) * 100)
      setProgress(p)
      if (p < 100) requestAnimationFrame(tick)
      else {
        setCreating(false)
        log('Restore point created', `“${name}” · simulated checkpoint`, 'success')
        toast({ title: t.lang === 'es' ? 'Punto de restauración creado' : 'Restore point created', description: t.lang === 'es' ? 'Simulado — no se escribió nada' : 'Simulated — nothing was written', tone: 'success' })
      }
    }
    requestAnimationFrame(tick)
  }

  const restore = () => {
    if (!hasSystemApi()) {
      toast({ title: t.lang === 'es' ? 'Restauración simulada' : 'Restore simulated', description: t.lang === 'es' ? 'El sistema se reiniciaría en este punto' : 'The system would reboot at this point', tone: 'warning' })
      return
    }
    const sequenceNumber = Number(point.id)
    applyRestorePoint(sequenceNumber)
      .then(() => toast({ title: t.lang === 'es' ? 'Restauración iniciada' : 'Restore started', description: t.lang === 'es' ? 'Windows se reiniciará para aplicarla' : 'Windows will restart to apply it', tone: 'warning' }))
      .catch((error: unknown) => {
        toast({ title: t.lang === 'es' ? 'No se pudo iniciar la restauración' : "Couldn't start the restore", description: error instanceof Error ? error.message : String(error), tone: 'danger' })
      })
  }

  const point = points.find((p) => p.id === selected) ?? points[0] ?? RESTORE_POINTS[0]

  return (
    <Page
      title={t('nav.restore.label')}
      description={realData ? (t.lang === 'es' ? 'Puntos de control reales de Restaurar sistema en este dispositivo' : 'Real System Restore checkpoints on this device') : (t.lang === 'es' ? 'Puntos de control, copias de configuración y opciones de reseteo — cada acción acá es simulada' : 'Checkpoints, configuration backups and reset options — every action here is simulated')}
      actions={
        <>
          <Button variant="secondary" onClick={doExportProfile}>
            <Download className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Exportar perfil' : 'Export profile'}
          </Button>
          <Button variant="primary" loading={creating || pointsLoading} onClick={create}>
            <Save className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Crear punto de restauración' : 'Create restore point'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-4 gap-3">
        <StatTile label={t.lang === 'es' ? 'Puntos de restauración' : 'Restore points'} value={points.length} sub={t.lang === 'es' ? 'Disponibles en el disco C:' : 'Available on drive C:'} accent="var(--accent)" icon={<History className="h-4 w-4" />} />
        <StatTile label={t.lang === 'es' ? 'Espacio usado' : 'Space used'} value="14.2" unit="GB" sub={t.lang === 'es' ? 'Almacenamiento de copias sombra' : 'Shadow copy storage'} accent="var(--brand-a)" icon={<Archive className="h-4 w-4" />} />
        <StatTile label={t.lang === 'es' ? 'Protección' : 'Protection'} value={realData ? (t.lang === 'es' ? 'En vivo' : 'Live') : (t.lang === 'es' ? 'Activada' : 'On')} sub={t.lang === 'es' ? 'Puntos de control automáticos activados' : 'Automatic checkpoints enabled'} accent="var(--success)" icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatTile label={t.lang === 'es' ? 'Última copia' : 'Last backup'} value={t('common.today')} sub={t.lang === 'es' ? '14:12 · manual' : '14:12 · manual'} accent="var(--warning)" icon={<Save className="h-4 w-4" />} />
      </div>

      <div className="mt-4 grid grid-cols-12 gap-3">
        <Card className="col-span-7">
          <CardHeader
            title={t.lang === 'es' ? 'Puntos de restauración' : 'Restore points'}
            description={t.lang === 'es' ? 'Elegí un punto de control para inspeccionarlo' : 'Pick a checkpoint to inspect it'}
            icon={<History className="h-4 w-4" />}
            action={<Badge tone="neutral">{t.lang === 'es' ? 'Disco C:' : 'Drive C:'}</Badge>}
          />
          <div className="divide-y divide-[var(--border)]">
            {points.map((p) => (
              <ContextMenu
                key={p.id}
                items={[
                  { id: 'restore', label: t.lang === 'es' ? 'Restaurar a este punto' : 'Restore to this point' },
                  { id: 'scan', label: t.lang === 'es' ? 'Buscar programas afectados' : 'Scan for affected programs' },
                  { id: 'delete', label: t.lang === 'es' ? 'Eliminar punto' : 'Delete point', danger: true, separatorBefore: true },
                ]}
                onSelect={(id) => (id === 'restore' ? setConfirmRestore(true) : toast({ title: `${id} · ${p.name}`, tone: 'info' }))}
              >
                <button
                  onClick={() => setSelected(p.id)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200',
                    selected === p.id ? 'bg-accent-soft' : 'hover:bg-card-hover',
                  )}
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]',
                      selected === p.id ? 'bg-[var(--accent)] text-[var(--accent-fg)]' : 'bg-[var(--sunken)] text-muted',
                    )}
                  >
                    <RotateCcw className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{p.name}</span>
                    <span className="block text-[11.5px] text-muted">{p.date}</span>
                  </span>
                  <Badge tone={p.type === 'Manual' ? 'accent' : p.type === 'Update' ? 'info' : 'neutral'}>{t.te(p.type)}</Badge>
                  <span className="w-16 text-right text-[12.5px] tabular-nums text-muted">{p.size}</span>
                </button>
              </ContextMenu>
            ))}
          </div>
          <CardFooter>
            <span className="text-[12px] text-muted">
              {t.lang === 'es' ? 'Seleccionado' : 'Selected'}: <strong className="text-fg">{point.name}</strong>
            </span>
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setConfirmRestore(true)}>
              <RotateCcw className="h-3.5 w-3.5" />
              {t.lang === 'es' ? 'Restaurar seleccionado' : 'Restore selected'}
            </Button>
          </CardFooter>
        </Card>

        <div className="col-span-5 space-y-3">
          <Card>
            <CardHeader title={t.lang === 'es' ? 'Nuevo punto de control' : 'New checkpoint'} description={t.lang === 'es' ? 'Ponele un nombre antes de crearlo' : 'Name it before creating'} icon={<Save className="h-4 w-4" />} />
            <CardBody className="pt-0">
              <TextField label={t.lang === 'es' ? 'Nombre del punto de control' : 'Checkpoint name'} value={name} onChange={(e) => setName(e.target.value)} />
              <div className="mt-3 space-y-2">
                {checkpointOptions.map((o) => (
                  <div key={o.id} className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-muted">{o.label}</span>
                    <Switch checked={isOn(o.id, o.on)} onChange={(v) => setToggle(o.id, v, o.label)} size="sm" label={o.label} />
                  </div>
                ))}
              </div>
              {creating ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3">
                  <Progress value={progress} height={5} />
                  <p className="mt-1.5 text-[11.5px] text-subtle">{t.lang === 'es' ? `Creando copia sombra… ${Math.round(progress)}%` : `Creating shadow copy… ${Math.round(progress)}%`}</p>
                </motion.div>
              ) : null}
            </CardBody>
            <CardFooter>
              <Button size="sm" variant="primary" className="flex-1" loading={creating} onClick={create}>
                {t.lang === 'es' ? 'Crear ahora' : 'Create now'}
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader title={t.lang === 'es' ? 'Copias de configuración' : 'Configuration backups'} description={t.lang === 'es' ? 'Vortex-Optimizer guarda sus propias instantáneas' : 'Vortex-Optimizer keeps its own snapshots'} icon={<Archive className="h-4 w-4" />} />
            <CardBody className="space-y-2 pt-0">
              {backupSlots.map((b) => (
                <div key={b.id} className="flex items-center gap-3 rounded-[8px] border border-line bg-[var(--sunken)] p-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-card text-muted">
                    <b.Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium">{b.name}</span>
                    <span className="block truncate text-[11px] text-subtle">{b.detail} · {b.date}</span>
                  </span>
                  <span className="text-[11.5px] tabular-nums text-muted">{b.size}</span>
                </div>
              ))}
            </CardBody>
            <CardFooter>
              <Button size="sm" variant="secondary" className="flex-1" onClick={doExportProfile}>
                <Upload className="h-3.5 w-3.5" />
                {t.lang === 'es' ? 'Exportar' : 'Export'}
              </Button>
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => importInputRef.current?.click()}>
                <FileUp className="h-3.5 w-3.5" />
                {t.lang === 'es' ? 'Importar' : 'Import'}
              </Button>
              <input
                ref={importInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ''
                  if (file) doImportProfile(file)
                }}
              />
            </CardFooter>
          </Card>
        </div>
      </div>

      <SectionTitle className="mt-6" title={t.lang === 'es' ? 'Zona de peligro' : 'Danger zone'} description={t.lang === 'es' ? 'Operaciones irreversibles' : 'Irreversible operations'} />
      <Card className="border-[color-mix(in_srgb,var(--danger)_28%,transparent)]">
        <CardBody className="p-4">
          <Notice
            tone="danger"
            title={t.lang === 'es' ? 'Restablecimiento de fábrica' : 'Factory reset'}
            icon={<ShieldAlert className="h-4 w-4" />}
            action={
              <Button variant="danger" size="sm" onClick={() => setConfirmReset(true)}>
                <Trash2 className="h-3.5 w-3.5" />
                {t.lang === 'es' ? 'Restablecer esta PC' : 'Reset this PC'}
              </Button>
            }
          >
            {t.lang === 'es'
              ? 'Elimina todas las aplicaciones y devuelve Windows a su estado de fábrica. Vortex-Optimizer nunca ejecuta el reseteo directamente — el botón abre el asistente nativo "Restablecer esta PC" de Windows, donde vos confirmás y controlás cada paso.'
              : "Removes every application and returns Windows to its out-of-box state. Vortex-Optimizer never runs the reset directly — the button opens Windows' own \"Reset this PC\" wizard, where you confirm and control every step."}
          </Notice>
          <Divider className="my-3" />
          <div className="grid grid-cols-3 gap-3">
            <KeyValue label={t.lang === 'es' ? 'Imagen de recuperación' : 'Recovery image'} value={t.lang === 'es' ? 'Presente (4.1 GB)' : 'Present (4.1 GB)'} />
            <KeyValue label={t.lang === 'es' ? 'Conservar mis archivos' : 'Keep my files'} value={t.lang === 'es' ? 'Compatible' : 'Supported'} />
            <KeyValue label={t.lang === 'es' ? 'Descarga en la nube' : 'Cloud download'} value={t.lang === 'es' ? 'Disponible' : 'Available'} />
          </div>
        </CardBody>
      </Card>

      <Dialog
        open={confirmRestore}
        onClose={() => setConfirmRestore(false)}
        tone="warning"
        icon={<RotateCcw className="h-4 w-4" />}
        title={t.lang === 'es' ? `¿Restaurar a "${point.name}"?` : `Restore to “${point.name}”?`}
        description={t.lang === 'es' ? `Creado ${point.date} · ${point.size}` : `Created ${point.date} · ${point.size}`}
        footer={
          <>
            <Button variant="subtle" onClick={() => setConfirmRestore(false)}>{t('common.cancel')}</Button>
            <Button
              variant="primary"
              onClick={() => {
                setConfirmRestore(false)
                restore()
              }}
            >
              {t.lang === 'es' ? 'Restaurar y reiniciar' : 'Restore and restart'}
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] leading-relaxed text-muted">
          {t.lang === 'es'
            ? 'Los programas y drivers instalados después de este punto de control se eliminarían. Los archivos personales nunca se ven afectados por Restaurar sistema.'
            : 'Programs and drivers installed after this checkpoint would be removed. Personal files are never affected by System Restore.'}
        </p>
      </Dialog>

      <Dialog
        open={confirmReset}
        onClose={() => { setConfirmReset(false); setResetAck(false) }}
        tone="danger"
        icon={<ShieldAlert className="h-4 w-4" />}
        title={t.lang === 'es' ? '¿Restablecer esta PC al estado de fábrica?' : 'Reset this PC to factory state?'}
        description={t.lang === 'es' ? 'Esta es la acción más destructiva en Vortex-Optimizer.' : 'This is the most destructive action in Vortex-Optimizer.'}
        footer={
          <>
            <Button variant="subtle" onClick={() => { setConfirmReset(false); setResetAck(false) }}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              disabled={!resetAck || resetting}
              onClick={() => {
                setConfirmReset(false)
                setResetAck(false)
                doOpenResetWizard()
              }}
            >
              {t.lang === 'es' ? 'Restablecer PC' : 'Reset PC'}
            </Button>
          </>
        }
      >
        <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-[var(--sunken)] p-3">
          <Checkbox checked={resetAck} onChange={setResetAck} label={t.lang === 'es' ? 'Confirmar restablecimiento de fábrica' : 'Confirm factory reset'} />
          <span className="text-[12.5px] leading-relaxed text-muted">
            {t.lang === 'es'
              ? 'Entiendo que en un build real se borraría cada aplicación instalada y configuración.'
              : 'I understand every installed application and setting would be erased in a real build.'}
          </span>
        </label>
      </Dialog>
    </Page>
  )
}
