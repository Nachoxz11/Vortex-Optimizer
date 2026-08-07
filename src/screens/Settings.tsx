import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  BadgeCheck, Check, Cloud, Globe, Info, Languages, MessageCircle, Monitor, MoonStar, Palette, RefreshCw,
  ScrollText, Sun, Wand2,
} from 'lucide-react'
import { Page } from '@/components/shell'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Select } from '@/components/ui/menu'
import { Segmented } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/input'
import { Dialog } from '@/components/ui/dialog'
import { Divider, KeyValue, SectionTitle } from '@/components/ui/primitives'
import { Progress } from '@/components/ui/progress'
import { CHANGELOG, LANGUAGES } from '@/lib/mock'
import packageJson from '../../package.json'
import { useApp, type Accent, type ThemeMode } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import logo from '@/assets/vortex-logo.png'

const DISCORD_INVITE_URL = 'https://discord.gg/urCpqx4MAW'

const ACCENTS: Array<{ id: Accent; label: string; color: string }> = [
  { id: 'blue', label: 'Signal blue', color: '#4f97ff' },
  { id: 'violet', label: 'Nebula violet', color: '#8b5cf6' },
  { id: 'teal', label: 'Aurora teal', color: '#14b8a6' },
  { id: 'magenta', label: 'Pulse magenta', color: '#e0479e' },
  { id: 'amber', label: 'Ember amber', color: '#f59e0b' },
  { id: 'green', label: 'Circuit green', color: '#22c07a' },
]

export default function Settings() {
  const { prefs, setPref, toast } = useApp()
  const t = useT()
  const [about, setAbout] = useState(false)
  const [license, setLicense] = useState(false)
  const [checking, setChecking] = useState(false)
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'success' | 'failure'>('idle')
  const [updateMessage, setUpdateMessage] = useState<string | null>(null)
  const [lastUpdateCheck, setLastUpdateCheck] = useState<string>('—')
  const [remoteChangelog, setRemoteChangelog] = useState<Array<{ version: string; date: string; notes: string[] }> | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('https://api.github.com/repos/Nachoxz11/Vortex-Optimizer/releases?per_page=6', {
      headers: { Accept: 'application/vnd.github+json' },
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() as Promise<Array<{ tag_name?: string; name?: string; body?: string; published_at?: string }>> : Promise.reject(new Error(`GitHub releases: ${response.status}`)))
      .then((releases) => {
        const parsed = releases
          .map((release) => {
            const version = (release.tag_name ?? release.name ?? '').replace(/^v/i, '').trim()
            const notes = (release.body ?? release.name ?? '').split(/\r?\n/).map((line) => line.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean).slice(0, 8)
            return { version, date: release.published_at ? new Date(release.published_at).toLocaleDateString(t.lang === 'es' ? 'es-AR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—', notes }
          })
          .filter((release) => release.version && release.notes.length > 0)
        if (parsed.length > 0) setRemoteChangelog(parsed)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [t.lang])

  const THEMES: Array<{ id: ThemeMode; label: string; icon: React.ReactNode }> = [
    { id: 'light', label: t.lang === 'es' ? 'Claro' : 'Light', icon: <Sun className="h-3.5 w-3.5" /> },
    { id: 'dark', label: t.lang === 'es' ? 'Oscuro' : 'Dark', icon: <MoonStar className="h-3.5 w-3.5" /> },
    { id: 'system', label: t.lang === 'es' ? 'Sistema' : 'System', icon: <Monitor className="h-3.5 w-3.5" /> },
  ]

  // The registry Run key is the source of truth for "start with Windows" — read it once so the
  // switch reflects reality instead of whatever was last clicked.
  useEffect(() => {
    if (!window.xtweaks?.system) return
    window.xtweaks.system
      .startWithWindowsGet()
      .then((s) => setPref('startWithWindows', s.enabled))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setStartWithWindows = async (value: boolean) => {
    if (!window.xtweaks?.system) {
      setPref('startWithWindows', value)
      return
    }
    try {
      await window.xtweaks.system.startWithWindowsSet(value)
      setPref('startWithWindows', value)
      toast({ title: value ? (t.lang === 'es' ? 'Vortex-Optimizer se iniciará al iniciar sesión' : 'Vortex-Optimizer will launch at sign-in') : (t.lang === 'es' ? 'Eliminado de las apps de inicio de sesión' : 'Removed from sign-in apps'), tone: 'success' })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'No se pudo actualizar el inicio en sesión' : "Couldn't update sign-in launch", description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    }
  }

  const checkForUpdates = async () => {
    if (!window.xtweaks?.updates) {
      toast({ title: t.lang === 'es' ? 'Actualización no disponible en esta vista web' : 'Updates are not available in this web view', tone: 'info' })
      return
    }

    setChecking(true)
    setUpdateStatus('checking')
    setUpdateMessage(null)

    try {
      const result = await window.xtweaks.updates.check()
      setLastUpdateCheck(new Date().toLocaleString(t.lang === 'es' ? 'es-AR' : 'en-US'))
      setUpdateStatus('success')
      setUpdateMessage(result.message)

      toast({
        title: result.available ? (t.lang === 'es' ? 'Actualización iniciada' : 'Update started') : (t.lang === 'es' ? 'Estás al día' : 'You are up to date'),
        description: result.available ? (result.latest_version ? `${result.latest_version}` : result.message) : result.message,
        tone: result.available ? 'success' : 'info',
      })
    } catch (error) {
      setUpdateStatus('failure')
      setUpdateMessage(error instanceof Error ? error.message : String(error))
      toast({ title: t.lang === 'es' ? 'No se pudo comprobar la actualización' : 'Could not check for updates', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setChecking(false)
    }
  }

  const openDiscord = async () => {
    if (window.xtweaks?.openUrl) {
      try {
        await window.xtweaks.openUrl(DISCORD_INVITE_URL)
        return
      } catch (error) {
        toast({ title: t.lang === 'es' ? 'No se pudo abrir el enlace' : "Couldn't open the link", description: error instanceof Error ? error.message : String(error), tone: 'danger' })
        return
      }
    }
    window.open(DISCORD_INVITE_URL, '_blank', 'noopener,noreferrer')
  }

  const toggles: Array<{ key: keyof typeof prefs; label: string; detail: string; onChange?: (v: boolean) => void }> = [
    { key: 'animations', label: t.lang === 'es' ? 'Animaciones de la interfaz' : 'Interface animations', detail: t.lang === 'es' ? 'Transiciones, resortes y efectos de ondulación' : 'Transitions, springs and ripple feedback' },
    { key: 'transparency', label: t.lang === 'es' ? 'Efectos de transparencia' : 'Transparency effects', detail: t.lang === 'es' ? 'Capas Mica y acrílico detrás de las superficies' : 'Mica and acrylic layering behind surfaces' },
    { key: 'compact', label: t.lang === 'es' ? 'Densidad compacta' : 'Compact density', detail: t.lang === 'es' ? 'Filas más ajustadas y menor espaciado' : 'Tighter rows and smaller paddings' },
    { key: 'confirmRisky', label: t.lang === 'es' ? 'Confirmar acciones riesgosas' : 'Confirm risky actions', detail: t.lang === 'es' ? 'Mostrar siempre un cuadro de diálogo antes de tweaks avanzados' : 'Always show a dialog before advanced tweaks' },
    { key: 'autoRestorePoint', label: t.lang === 'es' ? 'Punto de restauración automático' : 'Automatic restore point', detail: t.lang === 'es' ? 'Crea un punto de control real antes de aplicar lotes' : 'Create a real checkpoint before applying batches' },
    { key: 'startWithWindows', label: t.lang === 'es' ? 'Iniciar con Windows' : 'Start with Windows', detail: t.lang === 'es' ? 'Agrega Vortex-Optimizer a tus apps de inicio de sesión (clave HKCU Run)' : 'Adds Vortex-Optimizer to your sign-in apps (HKCU Run key)', onChange: setStartWithWindows },
    { key: 'minimizeToTray', label: t.lang === 'es' ? 'Minimizar a la bandeja' : 'Minimize to tray', detail: t.lang === 'es' ? 'Seguir ejecutándose en el área de notificaciones' : 'Keep running in the notification area' },
    { key: 'telemetryOptIn', label: t.lang === 'es' ? 'Compartir datos de uso anónimos' : 'Share anonymous usage data', detail: t.lang === 'es' ? 'Vortex-Optimizer no tiene canal de telemetría — este interruptor no hace nada' : 'Vortex-Optimizer has no telemetry pipeline — this switch does nothing' },
  ]

  const changelog = useMemo(
    () => remoteChangelog ?? CHANGELOG.map((c) => ({
      version: c.version,
      date: t.tt('changelog', c.version, 'date', c.date),
      notes: c.notes.map((n, i) => t.tt('changelog', c.version, `note${i}`, n)),
    })),
    [remoteChangelog, t.lang],
  )

  return (
    <Page
      title={t('nav.settings.label')}
      description={t.lang === 'es' ? 'Apariencia, idioma, actualizaciones e información sobre este build' : 'Appearance, language, updates and information about this build'}
      actions={
        <>
          <Button variant="secondary" onClick={openDiscord}>
            <MessageCircle className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Unirse a Discord' : 'Join Discord'}
          </Button>
          <Button variant="secondary" onClick={() => setLicense(true)}>
            <ScrollText className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Licencia' : 'License'}
          </Button>
          <Button variant="primary" onClick={() => setAbout(true)}>
            <Info className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Acerca de Vortex-Optimizer' : 'About Vortex-Optimizer'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-7">
          <CardHeader title={t.lang === 'es' ? 'Apariencia' : 'Appearance'} description={t.lang === 'es' ? 'Tema, color de acento y densidad de diseño' : 'Theme, accent colour and layout density'} icon={<Palette className="h-4 w-4" />} />
          <CardBody className="pt-0">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[12.5px] font-medium">{t.lang === 'es' ? 'Tema' : 'Theme'}</p>
                <p className="text-[11.5px] text-muted">{t.lang === 'es' ? 'Se aplica de inmediato en todas las pantallas' : 'Applies immediately across every screen'}</p>
              </div>
              <Segmented
                options={THEMES.map((th) => ({ id: th.id, label: th.label, icon: th.icon }))}
                value={prefs.theme}
                onChange={(id) => setPref('theme', id as ThemeMode)}
              />
            </div>
            <Divider className="my-3" />
            <p className="text-[12.5px] font-medium">{t.lang === 'es' ? 'Color de acento' : 'Accent colour'}</p>
            <div className="mt-2 grid grid-cols-6 gap-2">
              {ACCENTS.map((a) => (
                <motion.button
                  key={a.id}
                  whileHover={{ y: -2 }}
                  transition={{ duration: 0.16 }}
                  onClick={() => setPref('accent', a.id)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-[8px] border p-2 transition-colors duration-200',
                    prefs.accent === a.id ? 'border-[color-mix(in_srgb,var(--accent)_55%,transparent)] bg-accent-soft' : 'border-line bg-[var(--sunken)] hover:bg-card-hover',
                  )}
                >
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-full shadow-[0_1px_4px_rgba(0,0,0,.3)]"
                    style={{ background: a.color }}
                  >
                    {prefs.accent === a.id ? <Check className="h-3.5 w-3.5 text-white" /> : null}
                  </span>
                  <span className="truncate text-[10.5px] text-muted">{a.label.split(' ')[1]}</span>
                </motion.button>
              ))}
            </div>
            <Divider className="my-3" />
            <div className="flex items-center justify-between gap-6">
              <div className="min-w-0">
                <p className="text-[12.5px] font-medium">{t.lang === 'es' ? 'Escala de la interfaz' : 'Interface scale'}</p>
                <p className="text-[11.5px] text-muted">{t.lang === 'es' ? 'Escala la tipografía y el espaciado en toda la app' : 'Scales typography and spacing across the app'}</p>
              </div>
              <Slider
                className="w-[240px]"
                value={prefs.scale}
                min={0.85}
                max={1.25}
                step={0.05}
                onChange={(v) => setPref('scale', v)}
                format={(v) => `${Math.round(v * 100)}%`}
              />
            </div>
          </CardBody>
          <CardFooter>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                setPref('theme', 'dark')
                setPref('accent', 'blue')
                setPref('scale', 1)
                toast({ title: t.lang === 'es' ? 'Apariencia restablecida' : 'Appearance reset', tone: 'info' })
              }}
            >
              {t.lang === 'es' ? 'Restablecer apariencia' : 'Reset appearance'}
            </Button>
          </CardFooter>
        </Card>

        <div className="col-span-5 space-y-3">

          <Card>
            <CardHeader title={t.lang === 'es' ? 'Idioma y región' : 'Language and region'} description={t.lang === 'es' ? 'Idioma de la interfaz de Vortex-Optimizer' : 'Interface language for Vortex-Optimizer'} icon={<Languages className="h-4 w-4" />} />
            <CardBody className="pt-0">
              <Select
                value={prefs.language}
                options={LANGUAGES.map((l) => ({ id: l, label: l }))}
                onChange={(id) => setPref('language', id)}
                className="w-full"
              />
              <Divider className="my-3" />
              <KeyValue label={t.lang === 'es' ? 'Formato de región' : 'Region format'} value={t.lang === 'es' ? 'Argentina' : 'United States'} />
              <KeyValue label={t.lang === 'es' ? 'Primer día de la semana' : 'First day of week'} value={t.lang === 'es' ? 'Lunes' : 'Monday'} />
              <KeyValue label={t.lang === 'es' ? 'Unidades' : 'Units'} value={t.lang === 'es' ? 'Métrico' : 'Metric'} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title={t.lang === 'es' ? 'Actualizaciones' : 'Updates'}
              description={t.lang === 'es' ? 'Información de canal y versión' : 'Channel and version information'}
              icon={<RefreshCw className="h-4 w-4" />}
              action={<Badge tone="neutral" dot>{t.lang === 'es' ? 'Sin canal de actualización' : 'No update channel'}</Badge>}
            />
            <CardBody className="pt-0">
              <KeyValue label={t.lang === 'es' ? 'Versión instalada' : 'Installed version'} value={`${packageJson.version} (build 1)`} mono />
              <KeyValue label={t.lang === 'es' ? 'Canal' : 'Channel'} value={t.lang === 'es' ? 'Solo builds manuales' : 'Manual builds only'} />
              <KeyValue label={t.lang === 'es' ? 'Última verificación' : 'Last check'} value={lastUpdateCheck} />
              {updateMessage ? (
                <p className={cn('mt-2 rounded-[10px] border px-3 py-2 text-[12px]', updateStatus === 'failure' ? 'border-danger text-danger' : 'border-success text-success')}>
                  {updateMessage}
                </p>
              ) : null}
              {checking ? <Progress value={40} indeterminate height={4} className="mt-2" /> : null}
            </CardBody>
            <CardFooter>
              <Button
                size="sm"
                variant="secondary"
                className="flex-1"
                loading={checking}
                onClick={checkForUpdates}
              >
                <Cloud className="h-3.5 w-3.5" />
                {t.lang === 'es' ? 'Buscar actualizaciones' : 'Check for updates'}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <SectionTitle className="mt-6" title={t.lang === 'es' ? 'Comportamiento' : 'Behaviour'} description={t.lang === 'es' ? 'Cómo actúa Vortex-Optimizer mientras se ejecuta' : 'How Vortex-Optimizer acts while it runs'} />
      <Card className="overflow-hidden">
        <div className="divide-y divide-[var(--border)]">
          {toggles.map((tg) => (
            <div key={String(tg.key)} className="flex items-center gap-4 px-4 py-3 transition-colors duration-200 hover:bg-card-hover">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{tg.label}</p>
                <p className="mt-0.5 text-[12px] text-muted">{tg.detail}</p>
              </div>
              <Switch
                checked={Boolean(prefs[tg.key])}
                onChange={(v) => (tg.onChange ? tg.onChange(v) : setPref(tg.key as 'animations', v))}
                label={tg.label}
              />
            </div>
          ))}
        </div>
      </Card>

      <SectionTitle className="mt-6" title={t.lang === 'es' ? 'Novedades' : "What's new"} description={remoteChangelog ? (t.lang === 'es' ? 'Releases publicadas en GitHub' : 'Releases published on GitHub') : (t.lang === 'es' ? 'Últimos cambios disponibles' : 'Latest available changes')} />
      <div className="grid grid-cols-3 gap-3">
        {changelog.map((c) => (
          <Card key={c.version}>
            <CardHeader title={t.lang === 'es' ? `Versión ${c.version}` : `Version ${c.version}`} description={c.date} icon={<Wand2 className="h-4 w-4" />} />
            <CardBody className="pt-0">
              <ul className="space-y-1.5">
                {c.notes.map((n) => (
                  <li key={n} className="flex gap-2 text-[12px] leading-relaxed text-muted">
                    <Check className="mt-0.5 h-3 w-3 shrink-0 text-[var(--success)]" />
                    {n}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ))}
      </div>

      <Dialog
        open={about}
        onClose={() => setAbout(false)}
        width={470}
        icon={<BadgeCheck className="h-4 w-4" />}
        title={`Vortex-Optimizer ${packageJson.version}`}
        description={t.lang === 'es' ? 'Una interfaz de optimización inspirada en Fluent para Windows 11' : 'A Fluent-inspired optimization interface for Windows 11'}
        footer={<Button variant="primary" onClick={() => setAbout(false)}>{t('common.close')}</Button>}
      >
        <div className="mb-3 flex items-center gap-3 rounded-[10px] border border-line bg-[var(--sunken)] p-3">
          <img src={logo} alt="Vortex Optimizer" className="h-11 w-11 rounded-[12px] object-cover" />
          <div>
            <p className="text-[13.5px] font-semibold">Vortex-Optimizer</p>
            <p className="text-[12px] text-muted">{t.lang === 'es' ? 'App nativa de optimización para Windows 11' : 'Native Windows 11 optimization app'}</p>
          </div>
        </div>
        <KeyValue label={t('common.version')} value={`${packageJson.version} (build 1)`} mono />
        <div className="mt-3 flex items-start gap-2 rounded-[8px] border border-[color-mix(in_srgb,var(--info)_28%,transparent)] bg-info-soft p-2.5 text-[12px] leading-relaxed text-[var(--info)]">
          <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t.lang === 'es'
            ? 'La mayoría de los tweaks y lecturas del sistema en este build son reales — tocan el registro, servicios, powercfg y Restaurar sistema en este equipo. Un puñado de pantallas (los 3 interruptores específicos de hardware de Avanzado, Limpieza profunda, restablecimiento de fábrica) están Próximamente.'
            : "Most tweaks and system readings in this build are real — they touch the registry, services, powercfg and System Restore on this machine. A handful of screens (Advanced's 3 hardware-specific switches, Deep clean, factory reset) are coming soon."}
        </div>
      </Dialog>

      <Dialog
        open={license}
        onClose={() => setLicense(false)}
        width={520}
        icon={<ScrollText className="h-4 w-4" />}
        title={t.lang === 'es' ? 'Licencia' : 'License'}
        description={t.lang === 'es' ? 'MIT — prototipo de interfaz' : 'MIT — interface prototype'}
        footer={<Button variant="primary" onClick={() => setLicense(false)}>{t('common.close')}</Button>}
      >
        <div className="space-y-2.5 text-[12.5px] leading-relaxed text-muted">
          <p>
            {t.lang === 'es'
              ? 'Por la presente se otorga permiso, sin cargo, a cualquier persona que obtenga una copia de este software y los archivos de documentación asociados, para operar en el software sin restricción.'
              : 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files, to deal in the software without restriction.'}
          </p>
          <p>
            {t.lang === 'es'
              ? 'El software se proporciona "tal cual", sin garantía de ningún tipo, expresa o implícita, incluyendo entre otras las garantías de comercialización e idoneidad para un propósito particular.'
              : 'The software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability and fitness for a particular purpose.'}
          </p>
          <p className="text-[12px] text-subtle">
            {t.lang === 'es'
              ? 'Vortex-Optimizer no está afiliado a Microsoft. Windows y Windows 11 son marcas registradas de Microsoft Corporation.'
              : 'Vortex-Optimizer is not affiliated with Microsoft. Windows and Windows 11 are trademarks of Microsoft Corporation.'}
          </p>
        </div>
      </Dialog>
    </Page>
  )
}
