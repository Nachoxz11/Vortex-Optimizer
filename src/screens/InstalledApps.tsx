import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowUpCircle, Grid2x2, List, MoreHorizontal, Package, RefreshCw, Search, Trash2, Wrench,
} from 'lucide-react'
import { Page, StatTile } from '@/components/shell'
import { Card } from '@/components/ui/card'
import { Button, IconButton } from '@/components/ui/button'
import { Badge, Pill } from '@/components/ui/badge'
import { SearchInput } from '@/components/ui/input'
import { Segmented } from '@/components/ui/tabs'
import { DropdownMenu, Select } from '@/components/ui/menu'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState, KeyValue, SectionTitle, Stagger, StaggerItem } from '@/components/ui/primitives'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { hasSystemApi, repairApp, uninstallApp, useInstalledApps } from '@/lib/system'
import { cn } from '@/lib/utils'

const SOURCES = ['All', 'Win32', 'Store', 'Updatable'] as const

export default function InstalledApps() {
  const { toast, log } = useApp()
  const t = useT()
  const { apps: INSTALLED_APPS, real: realData, refresh } = useInstalledApps()
  const [q, setQ] = useState('')
  const [source, setSource] = useState<(typeof SOURCES)[number]>('All')
  const [sort, setSort] = useState('size')
  const [view, setView] = useState('grid')
  const [detail, setDetail] = useState<(typeof INSTALLED_APPS)[number] | null>(null)
  const [confirm, setConfirm] = useState<(typeof INSTALLED_APPS)[number] | null>(null)
  const [uninstalling, setUninstalling] = useState(false)

  const repair = async (a: (typeof INSTALLED_APPS)[number]) => {
    if (!hasSystemApi()) {
      toast({ title: t.lang === 'es' ? `Reparación de ${a.name} iniciada` : `${a.name} repair started`, description: t.lang === 'es' ? 'Simulado' : 'Simulated', tone: 'info' })
      return
    }
    try {
      await repairApp(a)
      log(t.lang === 'es' ? 'App reparada' : 'App repaired', a.name, 'success')
      toast({ title: t.lang === 'es' ? `${a.name} reparado` : `${a.name} repaired`, tone: 'success' })
    } catch (error) {
      toast({ title: t.lang === 'es' ? `No se pudo reparar ${a.name}` : `Couldn't repair ${a.name}`, description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    }
  }

  const updateNotSupported = (a: (typeof INSTALLED_APPS)[number]) => {
    toast({
      title: t.lang === 'es' ? `No se puede actualizar ${a.name}` : `Can't update ${a.name}`,
      description: t.lang === 'es' ? 'Windows no tiene un mecanismo genérico de actualización para apps de escritorio.' : "Windows has no generic update mechanism for desktop apps.",
      tone: 'warning',
    })
  }

  const confirmUninstall = async () => {
    const a = confirm
    if (!a || uninstalling) return
    setUninstalling(true)

    if (!hasSystemApi()) {
      window.setTimeout(() => {
        setUninstalling(false)
        setConfirm(null)
        toast({ title: t.lang === 'es' ? `${a.name} desinstalado` : `${a.name} uninstalled`, description: t.lang === 'es' ? 'Simulado — no se eliminó nada' : 'Simulated — nothing was removed', tone: 'warning' })
      }, 500)
      return
    }

    try {
      await uninstallApp(a)
      log(t.lang === 'es' ? 'App desinstalada' : 'App uninstalled', a.name, 'warning')
      toast({ title: t.lang === 'es' ? `${a.name} desinstalado` : `${a.name} uninstalled`, tone: 'success' })
      setConfirm(null)
      refresh()
    } catch (error) {
      toast({ title: t.lang === 'es' ? `No se pudo desinstalar ${a.name}` : `Couldn't uninstall ${a.name}`, description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setUninstalling(false)
    }
  }

  const SORTS = [
    { id: 'name', label: t.lang === 'es' ? 'Nombre (A–Z)' : 'Name (A–Z)' },
    { id: 'size', label: t.lang === 'es' ? 'Tamaño (mayor primero)' : 'Size (largest first)' },
    { id: 'date', label: t.lang === 'es' ? 'Instalado recientemente' : 'Recently installed' },
    { id: 'publisher', label: t('common.publisher') },
  ]

  const SOURCE_LABEL: Record<(typeof SOURCES)[number], string> = {
    All: t('common.all'),
    Win32: 'Win32',
    Store: 'Store',
    Updatable: t.lang === 'es' ? 'Actualizable' : 'Updatable',
  }

  const apps = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = INSTALLED_APPS.filter((a) => {
      if (source === 'Win32' && a.source !== 'Win32') return false
      if (source === 'Store' && a.source !== 'Store') return false
      if (source === 'Updatable' && !a.updatable) return false
      return !needle || a.name.toLowerCase().includes(needle) || a.publisher.toLowerCase().includes(needle)
    })
    return [...list].sort((a, b) => {
      if (sort === 'size') return b.size - a.size
      if (sort === 'date') return b.installed.localeCompare(a.installed)
      if (sort === 'publisher') return a.publisher.localeCompare(b.publisher)
      return a.name.localeCompare(b.name)
    })
  }, [q, source, sort, INSTALLED_APPS])

  const totalSize = INSTALLED_APPS.reduce((a, x) => a + x.size, 0)
  const updatable = INSTALLED_APPS.filter((a) => a.updatable)

  const actions = (a: (typeof INSTALLED_APPS)[number]) => (
    <>
      <Button size="sm" variant="secondary" onClick={() => repair(a)}>
        <Wrench className="h-3.5 w-3.5" />
        {t.lang === 'es' ? 'Reparar' : 'Repair'}
      </Button>
      <Button
        size="sm"
        variant={a.updatable ? 'primary' : 'subtle'}
        disabled={!a.updatable}
        onClick={() => updateNotSupported(a)}
      >
        <ArrowUpCircle className="h-3.5 w-3.5" />
        {t.lang === 'es' ? 'Actualizar' : 'Update'}
      </Button>
      <Button size="sm" variant="subtle" onClick={() => setConfirm(a)}>
        <Trash2 className="h-3.5 w-3.5" />
        {t.lang === 'es' ? 'Desinstalar' : 'Uninstall'}
      </Button>
    </>
  )

  return (
    <Page
      title={t('nav.apps.label')}
      description={t.lang === 'es' ? 'Inventario de software entre instaladores Win32 y la Microsoft Store' : 'Software inventory across Win32 installers and the Microsoft Store'}
      actions={
        <>
          <SearchInput value={q} onChange={setQ} placeholder={t.lang === 'es' ? 'Buscar apps y editores' : 'Search apps and publishers'} className="w-[260px]" />
          <Button variant="secondary" onClick={() => { refresh(); toast({ title: t.lang === 'es' ? 'Inventario actualizado' : 'Inventory refreshed', tone: 'info' }) }}>
            <RefreshCw className="h-3.5 w-3.5" />
            {t('common.refresh')}
          </Button>
          <Button
            variant="primary"
            disabled={updatable.length === 0}
            onClick={() => toast({ title: t.lang === 'es' ? 'No se puede actualizar por lotes' : "Can't batch update", description: t.lang === 'es' ? 'Windows no tiene un mecanismo genérico de actualización para apps de escritorio.' : 'Windows has no generic update mechanism for desktop apps.', tone: 'warning' })}
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            {t.lang === 'es' ? `Actualizar todo (${updatable.length})` : `Update all (${updatable.length})`}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-4 gap-3">
        <StatTile label={t.lang === 'es' ? 'Aplicaciones' : 'Applications'} value={INSTALLED_APPS.length} sub={t.lang === 'es' ? 'Detectadas en este dispositivo' : 'Detected on this device'} accent="var(--accent)" icon={<Package className="h-4 w-4" />} />
        <StatTile label={t.lang === 'es' ? 'Tamaño total' : 'Total size'} value={totalSize.toFixed(1)} unit="GB" sub={t.lang === 'es' ? 'En todas las rutas de instalación' : 'Across all install paths'} accent="var(--brand-a)" icon={<Package className="h-4 w-4" />} />
        <StatTile label={t.lang === 'es' ? 'Actualizaciones' : 'Updates'} value={updatable.length} sub={t.lang === 'es' ? 'Versiones más nuevas disponibles' : 'Newer versions available'} accent="var(--warning)" icon={<ArrowUpCircle className="h-4 w-4" />} />
        <StatTile label={t.lang === 'es' ? 'Apps de Store' : 'Store apps'} value={INSTALLED_APPS.filter((a) => a.source === 'Store').length} sub={t.lang === 'es' ? 'Aplicaciones empaquetadas' : 'Packaged applications'} accent="var(--success)" icon={<Package className="h-4 w-4" />} />
      </div>

      <SectionTitle
        className="mt-6"
        title={t.lang === 'es' ? 'Inventario' : 'Inventory'}
        description={t.lang === 'es' ? `${apps.length} de ${INSTALLED_APPS.length} mostradas` : `${apps.length} of ${INSTALLED_APPS.length} shown`}
        action={
          <div className="flex items-center gap-2">
            {SOURCES.map((s) => (
              <Pill key={s} active={source === s} onClick={() => setSource(s)}>
                {SOURCE_LABEL[s]}
              </Pill>
            ))}
            <Select value={sort} options={SORTS} onChange={setSort} width={200} className="w-[190px]" />
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { id: 'grid', label: '', icon: <Grid2x2 className="h-3.5 w-3.5" /> },
                { id: 'list', label: '', icon: <List className="h-3.5 w-3.5" /> },
              ]}
            />
          </div>
        }
      />

      {apps.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="h-5 w-5" />}
            title={t.lang === 'es' ? 'Ninguna aplicación coincide' : 'No applications match'}
            description={t.lang === 'es' ? 'Probá con otra palabra clave, o volvé el filtro de origen a Todos.' : 'Try another keyword, or switch the source filter back to All.'}
            action={<Button size="sm" variant="secondary" onClick={() => { setQ(''); setSource('All') }}>{t.lang === 'es' ? 'Limpiar filtros' : 'Clear filters'}</Button>}
          />
        </Card>
      ) : view === 'grid' ? (
        <Stagger className="grid grid-cols-4 gap-3">
          {apps.map((a) => (
            <StaggerItem key={a.id}>
              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }} className="h-full">
                <Card interactive className="h-full cursor-pointer" onClick={() => setDetail(a)}>
                  <div className="flex h-full flex-col p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-accent-soft text-[var(--accent)]">
                        <a.Icon className="h-5 w-5" />
                      </span>
                      <DropdownMenu
                        align="end"
                        items={[
                          { id: 'details', label: t('common.details') },
                          { id: 'repair', label: t.lang === 'es' ? 'Reparar' : 'Repair' },
                          { id: 'update', label: t.lang === 'es' ? 'Actualizar' : 'Update', disabled: !a.updatable },
                          { id: 'uninstall', label: t.lang === 'es' ? 'Desinstalar' : 'Uninstall', danger: true, separatorBefore: true },
                        ]}
                        onSelect={(id) => {
                          if (id === 'uninstall') setConfirm(a)
                          else if (id === 'details') setDetail(a)
                          else if (id === 'repair') repair(a)
                          else if (id === 'update') updateNotSupported(a)
                        }}
                        trigger={({ toggle }) => (
                          <IconButton label="More" size="iconSm" onClick={(e) => { e.stopPropagation(); toggle() }}>
                            <MoreHorizontal className="h-4 w-4" />
                          </IconButton>
                        )}
                      />
                    </div>
                    <p className="truncate text-[13px] font-semibold">{a.name}</p>
                    <p className="truncate text-[11.5px] text-muted">{a.publisher}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={a.source === 'Store' ? 'info' : 'neutral'}>{a.source}</Badge>
                      {a.updatable ? <Badge tone="warning">{t.lang === 'es' ? 'Actualizar' : 'Update'}</Badge> : null}
                    </div>
                    <div className="mt-auto flex items-end justify-between pt-3">
                      <span className="text-[11.5px] text-subtle">v{a.version}</span>
                      <span className="text-[13px] font-semibold tabular-nums">{a.size.toFixed(2)} GB</span>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_110px_100px_120px_260px] gap-3 border-b border-line bg-[var(--sunken)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-subtle">
            <span>{t('common.name')}</span>
            <span>{t('common.publisher')}</span>
            <span>{t('common.version')}</span>
            <span className="text-right">{t('common.size')}</span>
            <span>{t.lang === 'es' ? 'Instalado' : 'Installed'}</span>
            <span className="text-right">{t.lang === 'es' ? 'Acciones' : 'Actions'}</span>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {apps.map((a) => (
              <div
                key={a.id}
                className="grid grid-cols-[minmax(0,2.2fr)_minmax(0,1.4fr)_110px_100px_120px_260px] items-center gap-3 px-4 py-2.5 transition-colors duration-200 hover:bg-card-hover"
              >
                <button className="flex min-w-0 items-center gap-2.5 text-left" onClick={() => setDetail(a)}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-accent-soft text-[var(--accent)]">
                    <a.Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-medium">{a.name}</span>
                    <span className="block truncate text-[11px] text-subtle">{a.source}</span>
                  </span>
                </button>
                <span className="truncate text-[12.5px] text-muted">{a.publisher}</span>
                <span className={cn('font-mono text-[11.5px]', a.updatable ? 'text-[var(--warning)]' : 'text-muted')}>
                  {a.version}
                </span>
                <span className="text-right text-[12.5px] font-semibold tabular-nums">{a.size.toFixed(2)} GB</span>
                <span className="text-[12px] text-muted">{a.installed}</span>
                <span className="flex justify-end gap-1.5">{actions(a)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Dialog
        open={detail !== null}
        onClose={() => setDetail(null)}
        width={480}
        icon={detail ? <detail.Icon className="h-4 w-4" /> : null}
        title={detail?.name ?? ''}
        description={detail?.publisher}
        footer={detail ? <div className="flex gap-2">{actions(detail)}</div> : null}
      >
        {detail ? (
          <div>
            <KeyValue label={t('common.version')} value={detail.version} mono />
            <KeyValue label={t.lang === 'es' ? 'Tamaño en disco' : 'Size on disk'} value={`${detail.size.toFixed(2)} GB`} />
            <KeyValue label={t.lang === 'es' ? 'Instalado el' : 'Installed on'} value={detail.installed} />
            <KeyValue label={t.lang === 'es' ? 'Origen del paquete' : 'Package source'} value={detail.source} />
            <KeyValue label={t.lang === 'es' ? 'Ubicación de instalación' : 'Install location'} value={detail.installLocation || `C:\\Program Files\\${detail.name}`} mono />
            <KeyValue label={t.lang === 'es' ? 'Actualización disponible' : 'Update available'} value={detail.updatable ? (t.lang === 'es' ? 'Sí' : 'Yes') : (t.lang === 'es' ? 'No' : 'No')} />
            {realData ? (
              <div className="mt-3 rounded-[8px] border border-line bg-[var(--sunken)] p-3 text-[12px] leading-relaxed text-muted">
                {t.lang === 'es' ? 'Datos leídos del registro de desinstalación de Windows y los paquetes de Store instalados.' : 'Data read from the Windows uninstall registry and installed Store packages.'}
              </div>
            ) : (
              <div className="mt-3 rounded-[8px] border border-line bg-[var(--sunken)] p-3 text-[12px] leading-relaxed text-muted">
                {t.lang === 'es'
                  ? 'Próximamente: los detalles de aplicaciones requieren la aplicación de escritorio.'
                  : 'Coming soon: application details require the desktop app.'}
              </div>
            )}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        tone="danger"
        icon={<Trash2 className="h-4 w-4" />}
        title={t.lang === 'es' ? `¿Desinstalar ${confirm?.name}?` : `Uninstall ${confirm?.name}?`}
        description={
          hasSystemApi()
            ? (t.lang === 'es' ? 'Se ejecuta el desinstalador real de esta app — la acción es de verdad y no se puede deshacer.' : "This runs the app's real uninstaller — the action is real and cannot be undone.")
            : (t.lang === 'es' ? 'Próximamente: la aplicación web no modifica aplicaciones reales.' : 'Coming soon: the web app does not modify real applications.')
        }
        footer={
          <>
            <Button variant="subtle" onClick={() => setConfirm(null)} disabled={uninstalling}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={confirmUninstall} disabled={uninstalling}>
              {t.lang === 'es' ? 'Desinstalar' : 'Uninstall'}
            </Button>
          </>
        }
      >
        <p className="text-[12.5px] text-muted">
          {t.lang === 'es' ? (
            <>Los datos del usuario en <span className="font-mono">%APPDATA%</span> quedarían intactos.</>
          ) : (
            <>User data in <span className="font-mono">%APPDATA%</span> would be left in place.</>
          )}
        </p>
      </Dialog>
    </Page>
  )
}
