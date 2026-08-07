import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Crosshair, Gamepad2, Play, Rocket, Sliders, Swords, Timer, Trophy, Zap } from 'lucide-react'
import { Page, StatTile } from '@/components/shell'
import { Card, CardBody, CardHeader, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Segmented } from '@/components/ui/tabs'
import { Tooltip } from '@/components/ui/tooltip'
import { Slider } from '@/components/ui/input'
import { Divider, SectionTitle, Stagger, StaggerItem } from '@/components/ui/primitives'
import { Gauge as GaugeChart } from '@/components/charts'
import { GAMING_CARDS } from '@/lib/mock'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { hasSystemApi, rebuildShaderCache, useSteamGames } from '@/lib/system'

import { usePremium } from '@/lib/premium'
import { PremiumOverlay } from '@/components/PremiumBadge'

export default function Gaming() {
  const { isOn, setToggle, setMany, isSystemTweak, toast, log } = useApp()
  const { isPremium } = usePremium()
  const t = useT()
  const [rebuilding, setRebuilding] = useState(false)
  const [benchmarking, setBenchmarking] = useState(false)
  const [benchmarkResult, setBenchmarkResult] = useState<{ cpu: number; ram: number; gpu: number } | null>(null)
  const [capturingFrames, setCapturingFrames] = useState(false)
  const [frameStats, setFrameStats] = useState<{ running: boolean; samples: { timestampMs: number; frameTimeMs: number; fps: number; application: string }[]; averageFps?: number | null; averageFrameTimeMs?: number | null; p95FrameTimeMs?: number | null }>({ running: false, samples: [] })

  const runBenchmark = async () => {
    if (benchmarking) return
    if (!hasSystemApi()) {
      toast({ title: t.lang === 'es' ? 'Benchmark no disponible' : 'Benchmark unavailable', description: t.lang === 'es' ? 'Requiere la aplicación de escritorio.' : 'The desktop app is required.', tone: 'info' })
      return
    }
    setBenchmarking(true)
    try {
      const samples: { cpu: number; ram: number; gpu: number }[] = []
      for (let i = 0; i < 5; i += 1) {
        samples.push(await window.xtweaks!.system!.metrics())
        if (i < 4) await new Promise((resolve) => window.setTimeout(resolve, 500))
      }
      const average = (key: 'cpu' | 'ram' | 'gpu') => samples.reduce((sum, sample) => sum + sample[key], 0) / samples.length
      const result = { cpu: average('cpu'), ram: average('ram'), gpu: average('gpu') }
      setBenchmarkResult(result)
      log(t.lang === 'es' ? 'Diagnóstico de Gaming completado' : 'Gaming diagnostics completed', `CPU ${result.cpu.toFixed(1)}% · RAM ${result.ram.toFixed(1)}% · GPU ${result.gpu.toFixed(1)}%`, 'success')
      toast({ title: t.lang === 'es' ? 'Diagnóstico completado' : 'Diagnostics completed', description: t.lang === 'es' ? `Promedios: CPU ${result.cpu.toFixed(1)}% · GPU ${result.gpu.toFixed(1)}%` : `Averages: CPU ${result.cpu.toFixed(1)}% · GPU ${result.gpu.toFixed(1)}%`, tone: 'success' })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'Falló el diagnóstico' : 'Diagnostics failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setBenchmarking(false)
    }
  }

  useEffect(() => {
    if (!capturingFrames || !window.xtweaks?.system?.presentmonStats) return
    let cancelled = false
    const poll = async () => {
      try {
        const stats = await window.xtweaks!.system!.presentmonStats()
        if (!cancelled) setFrameStats(stats)
      } catch (error) {
        if (!cancelled) toast({ title: t.lang === 'es' ? 'Falló la captura de frame time' : 'Frame-time capture failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
      }
    }
    poll()
    const timer = window.setInterval(poll, 1000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [capturingFrames, t.lang])

  useEffect(() => () => { window.xtweaks?.system?.presentmonStop?.().catch(() => {}) }, [])

  const toggleFrameCapture = async () => {
    if (!hasSystemApi() || !window.xtweaks?.system?.presentmonStart) {
      toast({ title: t.lang === 'es' ? 'PresentMon no disponible' : 'PresentMon unavailable', description: t.lang === 'es' ? 'Esta función requiere la aplicación de escritorio empaquetada.' : 'This feature requires the packaged desktop app.', tone: 'info' })
      return
    }
    try {
      if (capturingFrames) {
        await window.xtweaks.system.presentmonStop()
        setCapturingFrames(false)
        setFrameStats((stats) => ({ ...stats, running: false }))
      } else {
        await window.xtweaks.system.presentmonStart()
        setCapturingFrames(true)
      }
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'No se pudo iniciar PresentMon' : 'Could not start PresentMon', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    }
  }

  const doRebuildShaderCache = async () => {
    if (rebuilding) return
    setRebuilding(true)

    if (!hasSystemApi()) {
      setRebuilding(false)
      toast({ title: t.lang === 'es' ? 'Caché de shaders no disponible' : 'Shader cache unavailable', description: t.lang === 'es' ? 'Abrí la aplicación de escritorio para ejecutar esta operación real.' : 'Open the desktop app to run this real operation.', tone: 'info' })
      return
    }

    try {
      const result = await rebuildShaderCache()
      log(t.lang === 'es' ? 'Caché de shaders vaciado' : 'Shader cache cleared', `${result.filesRemoved} archivos · ${result.freedGB.toFixed(2)} GB`, 'success')
      toast({
        title: t.lang === 'es' ? 'Caché de shaders reconstruido' : 'Shader cache rebuilt',
        description: t.lang === 'es' ? `${result.filesRemoved} archivos borrados · ${result.freedGB.toFixed(2)} GB liberados` : `${result.filesRemoved} files removed · ${result.freedGB.toFixed(2)} GB freed`,
        tone: 'success',
      })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'No se pudo vaciar la caché de shaders' : "Couldn't clear the shader cache", description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setRebuilding(false)
    }
  }
  const { games, loading: gamesLoading, real: realGames } = useSteamGames()
  const [profile, setProfile] = useState('competitive')
  const [fpsCap, setFpsCap] = useState(240)
  const [buffer, setBuffer] = useState(1)


  const PROFILES = [
    { id: 'balanced', label: t.te('Balanced') },
    { id: 'competitive', label: t.te('Competitive') },
    { id: 'quality', label: t.te('Quality') },
  ]

  const cards = useMemo(
    () => GAMING_CARDS.map((c) => ({
      ...c,
      name: t.tt('gaming', c.id, 'name', c.name),
      description: t.tt('gaming', c.id, 'description', c.description),
      badge: t.te(c.badge),
    })),
    [t.lang],
  )

  const active = GAMING_CARDS.filter((c) => isOn(c.id, c.defaultOn)).length
  const rows = [
    { label: t.lang === 'es' ? 'Tamaño del caché de shaders' : 'Shader cache size', value: t.lang === 'es' ? 'Se mide al limpiar' : 'Measured when cleared' },
    { label: t.lang === 'es' ? 'Presupuesto de VRAM' : 'VRAM budget', value: t.lang === 'es' ? 'No disponible' : 'Unavailable' },
    { label: t.lang === 'es' ? 'Compatibilidad anti-trampas' : 'Anti-cheat compatibility', value: t.lang === 'es' ? 'No verificada' : 'Not verified' },
  ]

  return (
    <Page
      title={t('nav.gaming.label')}
      description={t.lang === 'es'
        ? 'Perfiles y diagnósticos del sistema — FPS y frame time requieren una fuente compatible'
        : 'Profiles and system diagnostics — FPS and frame time require a compatible data source'}
      actions={
        <>
          <Segmented options={PROFILES} value={profile} onChange={setProfile} />
          <Button
            variant="primary"
            onClick={() => {
              const ids = GAMING_CARDS.map((c) => c.id)
              const realCount = window.xtweaks?.tweaks ? ids.filter(isSystemTweak).length : 0
              if (!window.xtweaks?.tweaks || realCount === 0) {
                toast({ title: t.lang === 'es' ? 'Perfil no disponible' : 'Profile unavailable', description: t.lang === 'es' ? 'Abrí la aplicación de escritorio para aplicar cambios reales.' : 'Open the desktop app to apply real changes.', tone: 'info' })
                return
              }
              setMany(ids, true, 'Gaming profile applied')
              toast({
                title: t.lang === 'es' ? 'Perfil competitivo aplicado' : 'Competitive profile applied',
                description: t.lang === 'es' ? `${realCount} módulos reales aplicados` : `${realCount} real modules applied`,
                tone: 'success',
              })
            }}
          >
            <Zap className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Impulsar ahora' : 'Boost now'}
          </Button>
        </>
      }
    >
      <div className="relative min-h-[500px]">
        {!isPremium && (
          <PremiumOverlay
            title="Gaming Optimizer Bloqueado"
            description="El perfil competitivo, optimizador de latencia y frame pacing requieren una suscripción Premium."
          />
        )}
        <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-5 overflow-hidden">
          <div className="relative">
            <div className="brand-gradient absolute inset-0 opacity-[0.12]" />
            <div className="relative flex items-center gap-5 p-5">
              <GaugeChart value={benchmarkResult ? Math.min(100, benchmarkResult.gpu) : 0} size={168} color="var(--accent)" label={benchmarkResult ? `${benchmarkResult.gpu.toFixed(0)}%` : '—'} caption={t.lang === 'es' ? 'GPU promedio' : 'Average GPU'} />
              <div className="min-w-0 flex-1 space-y-2.5">
                <div>
                  <p className="text-[11.5px] uppercase tracking-[0.06em] text-subtle">{t.lang === 'es' ? 'Perfil activo' : 'Active profile'}</p>
                  <p className="text-[17px] font-semibold capitalize tracking-[-0.02em]">{t.te(profile === 'balanced' ? 'Balanced' : profile === 'quality' ? 'Quality' : 'Competitive')}</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="success" dot>
                    {active}/8 {t.lang === 'es' ? 'módulos' : 'modules'}
                  </Badge>
                  <Badge tone="accent">{benchmarkResult ? `${benchmarkResult.cpu.toFixed(0)}% CPU` : (t.lang === 'es' ? 'Sin diagnóstico' : 'No diagnostics')}</Badge>
                </div>
                <Divider />
                <div className="grid grid-cols-2 gap-2 text-[12px]">
                  <div>
                    <p className="text-subtle">{t.lang === 'es' ? 'Tiempo de fotograma' : 'Frame time'}</p>
                    <p className="font-medium tabular-nums">{t.lang === 'es' ? 'No disponible' : 'Unavailable'}</p>
                  </div>
                  <div>
                    <p className="text-subtle">{t.lang === 'es' ? 'Cola de render' : 'Render queue'}</p>
                    <p className="font-medium tabular-nums">{t.lang === 'es' ? 'Configuración local' : 'Local setting'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <CardFooter>
            <Button size="sm" variant="secondary" className="flex-1" loading={benchmarking} onClick={runBenchmark}>
              <Play className="h-3.5 w-3.5" />
              {t.lang === 'es' ? 'Diagnóstico real' : 'Run diagnostics'}
            </Button>
            <Button size="sm" variant="subtle" onClick={toggleFrameCapture}>
              <Crosshair className="h-3.5 w-3.5" />
              {capturingFrames ? (t.lang === 'es' ? 'Detener captura' : 'Stop capture') : (t.lang === 'es' ? 'Capturar ETW' : 'Capture ETW')}
            </Button>
          </CardFooter>
        </Card>

        <div className="col-span-7 grid grid-cols-2 gap-3">
          <StatTile
            label={t.lang === 'es' ? 'Cuadros por segundo' : 'Frame rate'}
            value={frameStats.averageFps ? frameStats.averageFps.toFixed(1) : '—'}
            unit="FPS"
            sub={capturingFrames ? (t.lang === 'es' ? 'PresentMon/ETW activo' : 'PresentMon/ETW active') : (t.lang === 'es' ? 'Iniciá una captura ETW' : 'Start an ETW capture')}
            accent="var(--accent)"
            icon={<Gamepad2 className="h-4 w-4" />}
          />
          {benchmarkResult ? (
            <Card className="col-span-2">
              <CardBody className="grid grid-cols-3 gap-3 p-4">
                <div><p className="text-[11px] text-subtle">CPU promedio</p><p className="text-[16px] font-semibold tabular-nums">{benchmarkResult.cpu.toFixed(1)}%</p></div>
                <div><p className="text-[11px] text-subtle">RAM promedio</p><p className="text-[16px] font-semibold tabular-nums">{benchmarkResult.ram.toFixed(1)}%</p></div>
                <div><p className="text-[11px] text-subtle">GPU promedio</p><p className="text-[16px] font-semibold tabular-nums">{benchmarkResult.gpu.toFixed(1)}%</p></div>
              </CardBody>
            </Card>
          ) : null}
          <StatTile
            label={t.lang === 'es' ? 'Latencia de entrada' : 'Input latency'}
            value="—"
            unit="ms"
            sub={t.lang === 'es' ? 'No se estima sin un juego activo' : 'Not estimated without an active game'}
            accent="var(--brand-b)"
            icon={<Timer className="h-4 w-4" />}
          />
          <Card className="col-span-2">
            <CardHeader
              title={t.lang === 'es' ? 'Distribución del tiempo de fotograma' : 'Frame time distribution'}
              description={frameStats.samples.length > 0 ? `${frameStats.samples.length} ${t.lang === 'es' ? 'muestras ETW' : 'ETW samples'}` : (t.lang === 'es' ? 'Sin muestras reales' : 'No real samples')}
              icon={<Sliders className="h-4 w-4" />}
              action={<Badge tone={frameStats.samples.length > 0 ? 'accent' : 'neutral'}>{frameStats.samples.length > 0 ? (t.lang === 'es' ? 'En vivo' : 'Live') : (t.lang === 'es' ? 'Sin datos' : 'No data')}</Badge>}
            />
            <CardBody className="pt-0">
              <div className="flex h-16 items-center justify-center text-[12px] text-subtle">
                {frameStats.samples.length > 0
                  ? `${t.lang === 'es' ? 'Promedio' : 'Average'} ${frameStats.averageFrameTimeMs?.toFixed(2) ?? '—'} ms · p95 ${frameStats.p95FrameTimeMs?.toFixed(2) ?? '—'} ms`
                  : (t.lang === 'es' ? 'Iniciá la captura y ejecutá un juego para registrar frame time.' : 'Start capture and run a game to record frame time.')}
              </div>
              <div className="mt-2 flex justify-between text-[10.5px] text-subtle">
                <span>3 ms</span>
                <span>8 ms</span>
                <span>16 ms</span>
                <span>33 ms</span>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <SectionTitle
        className="mt-6"
        title={t.lang === 'es' ? 'Módulos de juego' : 'Gaming modules'}
        description={t.lang === 'es' ? `${active} de ${GAMING_CARDS.length} activados` : `${active} of ${GAMING_CARDS.length} enabled`}
        action={
          <Button size="sm" variant="subtle" onClick={() => setMany(GAMING_CARDS.map((c) => c.id), false, 'Gaming modules reset')}>
            {t.lang === 'es' ? 'Restablecer módulos' : 'Reset modules'}
          </Button>
        }
      />
      <Stagger className="grid grid-cols-4 gap-3">
        {cards.map((c) => {
          const on = isOn(c.id, c.defaultOn)
          return (
            <StaggerItem key={c.id}>
              <motion.div whileHover={{ y: -2 }} transition={{ duration: 0.18 }}>
                <Card interactive className="h-full">
                  <div className="flex h-full flex-col p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <span
                        className={`flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors duration-200 ${
                          on ? 'bg-accent-soft text-[var(--accent)]' : 'bg-[var(--sunken)] text-muted'
                        }`}
                      >
                        <c.Icon className="h-5 w-5" />
                      </span>
                      <Switch checked={on} onChange={(v) => setToggle(c.id, v, c.name)} label={c.name} />
                    </div>
                    <p className="text-[13.5px] font-semibold tracking-[-0.01em]">{c.name}</p>
                    <p className="mt-1 flex-1 text-[12px] leading-relaxed text-muted">{c.description}</p>
                    <div className="mt-3 flex items-center justify-between">
                      <Badge tone={on ? 'accent' : 'neutral'}>{c.badge}</Badge>
                      <Tooltip content={t.lang === 'es' ? 'El efecto depende del hardware y del juego; no se estima sin mediciones.' : 'The effect depends on hardware and game; it is not estimated without measurements.'}>
                        <span className="cursor-help text-[11.5px] font-medium text-subtle">{t.lang === 'es' ? 'Sin estimación' : 'No estimate'}</span>
                      </Tooltip>
                    </div>
                  </div>
                </Card>
              </motion.div>
            </StaggerItem>
          )
        })}
      </Stagger>

      <div className="mt-6 grid grid-cols-12 gap-3">
        <Card className="col-span-7">
          <CardHeader
            title={t.lang === 'es' ? 'Juegos detectados' : 'Detected games'}
            description={realGames
              ? (t.lang === 'es' ? 'Biblioteca de Steam instalada en este equipo' : 'Steam library installed on this machine')
              : (t.lang === 'es' ? 'Se requiere la app de escritorio para detectar juegos' : 'Desktop app required to detect games')}
            icon={<Trophy className="h-4 w-4" />}
            action={<Badge tone="neutral">{games.length} {t.lang === 'es' ? 'juegos' : 'titles'}</Badge>}
          />
          <div className="divide-y divide-[var(--border)]">
            {gamesLoading ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-muted">{t.lang === 'es' ? 'Buscando en Steam…' : 'Scanning Steam…'}</p>
            ) : games.length === 0 ? (
              <p className="px-4 py-6 text-center text-[12.5px] text-muted">
                {realGames
                  ? (t.lang === 'es' ? 'No se encontró Steam instalado en este equipo.' : 'Steam was not found installed on this machine.')
                  : (t.lang === 'es' ? 'Abrí la app de escritorio para ver tu biblioteca de Steam.' : 'Open the desktop app to see your Steam library.')}
              </p>
            ) : (
              games.map((g) => (
                <div key={g.appId} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-card-hover">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-[var(--sunken)] text-muted">
                    <Gamepad2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium">{g.name}</p>
                    <p className="text-[11.5px] text-muted">Steam · {g.appId}</p>
                  </div>
                  <span className="w-16 text-right text-[12.5px] font-semibold tabular-nums">{g.sizeGB} GB</span>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="col-span-5">
          <CardHeader title={t.lang === 'es' ? 'Ritmo de fotogramas' : 'Frame pacing'} description={t.lang === 'es' ? 'Límites y búfer para el perfil activo' : 'Caps and buffering for the active profile'} icon={<Swords className="h-4 w-4" />} />
          <CardBody className="space-y-4 pt-0">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                <span className="font-medium">{t.lang === 'es' ? 'Límite de fotogramas' : 'Frame rate cap'}</span>
                <span className="text-muted">{t.lang === 'es' ? 'Tasa de refresco 240 Hz' : 'Refresh rate 240 Hz'}</span>
              </div>
              <Slider value={fpsCap} min={60} max={360} step={10} onChange={setFpsCap} format={(v) => `${v}`} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                <span className="font-medium">{t.lang === 'es' ? 'Fotogramas prerrenderizados' : 'Pre-rendered frames'}</span>
                <span className="text-muted">{t.lang === 'es' ? 'Menos es más ágil' : 'Lower is snappier'}</span>
              </div>
              <Slider value={buffer} min={1} max={4} step={1} onChange={setBuffer} format={(v) => `${v}`} />
            </div>
            <Divider />
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.label} className="flex items-center justify-between text-[12.5px]">
                  <span className="text-muted">{r.label}</span>
                  <span className="font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          </CardBody>
          <CardFooter>
            <Button size="sm" variant="secondary" className="flex-1" disabled={rebuilding} onClick={doRebuildShaderCache}>
              <Rocket className="h-3.5 w-3.5" />
              {t.lang === 'es' ? 'Reconstruir caché de shaders' : 'Rebuild shader cache'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
    </Page>
  )
}
