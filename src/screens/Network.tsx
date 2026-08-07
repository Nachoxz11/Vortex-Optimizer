import { useMemo, useState, useEffect } from 'react'
import { Activity, Cable, Gauge, Globe, Radio, Router, Signal, Wifi, Zap } from 'lucide-react'
import { Page, StatTile, TweakRow } from '@/components/shell'
import { Card, CardBody, CardFooter, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/menu'
import { Slider, TextField } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Divider, KeyValue, SectionTitle } from '@/components/ui/primitives'
import { Sparkline } from '@/components/charts'
import { DNS_PRESETS, NETWORK_ADAPTERS, NETWORK_TWEAKS } from '@/lib/mock'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { dnsBenchmark, hasSystemApi, useNetworkAdapters, useNetworkMetrics } from '@/lib/system'
import { cn } from '@/lib/utils'

export default function Network() {
  const { toast, isOn, log } = useApp()
  const t = useT()
  const { adapters: liveAdapters, real: realAdapters } = useNetworkAdapters()
  const { metrics, series, real: realMetrics } = useNetworkMetrics(2000, true)
  const [dns, setDns] = useState('auto')
  const [mtu, setMtu] = useState(1500)
  const [qos, setQos] = useState(0)
  const [ooklaRunning, setOoklaRunning] = useState(false)
  const [ooklaResult, setOoklaResult] = useState<{ downloadMbps: number; uploadMbps: number; latencyMs: number; server: { name: string; location: string; sponsor: string } } | null>(null)

  const runOoklaSpeedTest = async () => {
    if (!window.xtweaks?.system || ooklaRunning) return
    setOoklaRunning(true)
    try {
      const result = await window.xtweaks.system.ooklaSpeedTest()
      setOoklaResult(result)
      log('Ookla Speedtest complete', `${result.downloadMbps.toFixed(1)} Mb/s down · ${result.uploadMbps.toFixed(1)} Mb/s up · ${result.latencyMs.toFixed(1)} ms`, 'success')
      toast({ title: t.lang === 'es' ? 'Speedtest de Ookla completado' : 'Ookla Speedtest complete', description: `${result.downloadMbps.toFixed(1)} Mb/s ↓ · ${result.uploadMbps.toFixed(1)} Mb/s ↑ · ${result.server.name}`, tone: 'success' })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'No se pudo ejecutar Ookla Speedtest' : 'Could not run Ookla Speedtest', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    } finally {
      setOoklaRunning(false)
    }
  }

  const dnsPresets = useMemo(
    () => DNS_PRESETS.map((d) => ({ ...d, name: t.tt('dns', d.id, 'name', d.name) })),
    [t.lang],
  )
  const tweaks = useMemo(
    () => NETWORK_TWEAKS.map((tw) => ({
      ...tw,
      name: t.tt('network', tw.id, 'name', tw.name),
      description: t.tt('network', tw.id, 'description', tw.description),
    })),
    [t.lang],
  )

  const adapters = realAdapters && liveAdapters.length > 0 ? liveAdapters : NETWORK_ADAPTERS
  const [adapter, setAdapter] = useState(adapters[0]?.name ?? '')

  useEffect(() => {
    if (!adapters.find((a) => a.name === adapter) && adapters[0]) {
      setAdapter(adapters[0].name)
    }
  }, [adapters, adapter])
  const latency = series.latency
  const down = series.download
  const loss = series.loss
  const jitter = series.jitter

  const preset = dnsPresets.find((d) => d.id === dns) ?? dnsPresets[0]
  const applied = NETWORK_TWEAKS.filter((tw) => isOn(tw.id, tw.defaultOn)).length
  const live = realAdapters || realMetrics

  const applyNetworkProfile = async () => {
    if (!window.xtweaks?.system) {
      toast({ title: t.lang === 'es' ? 'Perfil simulado' : 'Simulated profile', description: t.lang === 'es' ? 'Requiere la aplicación de escritorio.' : 'The desktop app is required.', tone: 'info' })
      return
    }
    if (!window.confirm(t.lang === 'es' ? `Se aplicarán DNS, MTU ${mtu} y QoS ${qos}% al adaptador ${adapter}. La conexión puede interrumpirse brevemente. ¿Continuar?` : `DNS, MTU ${mtu} and QoS ${qos}% will be applied to ${adapter}. The connection may briefly drop. Continue?`)) return
    try {
      if (dns === 'auto') {
        await window.xtweaks.system.resetDnsServers(adapter)
      } else {
        await window.xtweaks.system.setDnsServers(adapter, preset.primary, preset.secondary === '—' ? undefined : preset.secondary)
      }
      const settings = await window.xtweaks.system.setNetworkSettings(adapter, mtu, qos)
      log(t.lang === 'es' ? 'Perfil de red aplicado' : 'Network profile applied', `${adapter} · DNS ${dns} · MTU ${settings.mtu} · QoS ${settings.qosPercent}%`, 'success')
      toast({ title: t.lang === 'es' ? 'Perfil de red aplicado' : 'Network profile applied', description: t.lang === 'es' ? `DNS, MTU y QoS configurados${settings.restartNeeded ? ' · reinicio recomendado' : ''}` : `DNS, MTU and QoS configured${settings.restartNeeded ? ' · restart recommended' : ''}`, tone: settings.restartNeeded ? 'warning' : 'success' })
    } catch (error) {
      toast({ title: t.lang === 'es' ? 'No se pudo aplicar el DNS' : 'Could not apply DNS', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
    }
  }

  const flushDns = async () => {
    if (!window.xtweaks?.actions) {
      toast({ title: t.lang === 'es' ? 'Caché DNS vaciada' : 'DNS cache flushed', description: t.lang === 'es' ? 'Simulado · 0 entradas eliminadas' : 'Simulated · 0 entries removed', tone: 'info' })
      return
    }
    try {
      const result = await window.xtweaks.actions.run('dns')
      toast({ title: result.message, description: result.detail, tone: 'success' })
    } catch (error) {
      toast({
        title: 'No se pudo vaciar la caché DNS',
        description: error instanceof Error ? error.message : String(error),
        tone: 'danger',
      })
    }
  }

  return (
    <Page
      title={t('nav.network.label')}
      description={live ? 'Adaptadores, DNS y métricas en vivo desde este PC' : (t.lang === 'es' ? 'DNS, pila TCP, QoS y adaptadores — datos simulados en modo web' : 'DNS, TCP stack, QoS and adapters — simulated data in web mode')}
      actions={
        <>
          <Button variant="secondary" onClick={flushDns}>
            <Globe className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Vaciar DNS' : 'Flush DNS'}
          </Button>
          <Button variant="primary" onClick={applyNetworkProfile} disabled={!adapter}>
            <Zap className="h-3.5 w-3.5" />
            {t.lang === 'es' ? 'Aplicar perfil DNS' : 'Apply DNS profile'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-4 gap-3">
        <StatTile label={t.lang === 'es' ? 'Latencia' : 'Latency'} value={metrics.latency.toFixed(1)} unit="ms" sub={t.lang === 'es' ? 'Ida y vuelta al gateway' : 'Gateway round trip'} accent="var(--accent)" icon={<Activity className="h-4 w-4" />}>
          <Sparkline data={latency} color="var(--accent)" height={36} max={45} />
        </StatTile>
        <StatTile label={t.lang === 'es' ? 'Descarga' : 'Download'} value={Math.round(metrics.download)} unit="Mb/s" sub={t.lang === 'es' ? 'Promedio móvil' : 'Rolling average'} accent="var(--brand-b)" icon={<Signal className="h-4 w-4" />}>
          <Sparkline data={down} color="var(--brand-b)" height={36} max={600} />
        </StatTile>
        <StatTile label={t.lang === 'es' ? 'Pérdida de paquetes' : 'Packet loss'} value={metrics.loss.toFixed(2)} unit="%" sub={t.lang === 'es' ? '4 muestras de ping' : '4 ping samples'} accent="var(--warning)" icon={<Radio className="h-4 w-4" />}>
          <Sparkline data={loss} color="var(--warning)" height={36} max={4} />
        </StatTile>
        <StatTile label="Jitter" value={metrics.jitter.toFixed(1)} unit="ms" sub={t.lang === 'es' ? 'Variación entre muestras de ping' : 'Spread across ping samples'} accent="var(--success)" icon={<Gauge className="h-4 w-4" />}>
          <Sparkline data={jitter} color="var(--success)" height={36} max={12} />
        </StatTile>
      </div>

      <div className="mt-4 grid grid-cols-12 gap-3">
        <Card className="col-span-5">
          <CardHeader title={t.lang === 'es' ? 'Resolvedor DNS' : 'DNS resolver'} description={t.lang === 'es' ? 'Elegí un proveedor o mantené DHCP' : 'Pick a provider or keep DHCP'} icon={<Globe className="h-4 w-4" />} action={<Badge tone="accent">{realMetrics ? `${metrics.latency} ms` : `${preset.latency} ms`}</Badge>} />
          <CardBody className="pt-0">
            <Select value={dns} options={dnsPresets.map((d) => ({ id: d.id, label: d.name }))} onChange={setDns} className="w-full" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <TextField label={t.lang === 'es' ? 'Preferido' : 'Preferred'} value={realMetrics ? metrics.dnsPrimary : preset.primary} readOnly />
              <TextField label={t.lang === 'es' ? 'Alternativo' : 'Alternate'} value={realMetrics ? metrics.dnsSecondary : preset.secondary} readOnly />
            </div>
            <Divider className="my-3" />
            <div className="space-y-1.5">
              {dnsPresets.map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDns(d.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[6px] px-2 py-1.5 text-left transition-colors duration-200',
                    dns === d.id ? 'bg-accent-soft' : 'hover:bg-card-hover',
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-[12.5px]">{d.name}</span>
                  <span className="w-24"><Progress value={100 - d.latency * 3} height={4} color={d.latency < 12 ? 'var(--success)' : 'var(--warning)'} /></span>
                  <span className="w-12 text-right font-mono text-[11.5px] text-muted">{d.latency} ms</span>
                </button>
              ))}
            </div>
          </CardBody>
          <CardFooter>
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={async () => {
                if (!hasSystemApi()) {
                  toast({ title: t.lang === 'es' ? 'Benchmark de resolvedores simulado' : 'Resolver benchmark simulated', tone: 'info' })
                  return
                }
                toast({ title: t.lang === 'es' ? 'Midiendo latencia UDP real...' : 'Probing real UDP latency...', tone: 'info' })
                try {
                  const res = await dnsBenchmark()
                  const fastest = res.results.filter(r => r.latencyMs !== null).sort((a, b) => (a.latencyMs ?? 999) - (b.latencyMs ?? 999))[0]
                  const summary = res.results.map(r => `${r.name}: ${r.latencyMs ?? 'timeout'} ms`).join(' · ')
                  log('DNS Benchmark complete', summary, 'success')
                  toast({
                    title: t.lang === 'es' ? `Resolvedor más rápido: ${fastest?.name ?? 'Cloudflare'}` : `Fastest resolver: ${fastest?.name ?? 'Cloudflare'}`,
                    description: summary,
                    tone: 'success',
                  })
                } catch (error) {
                  toast({ title: 'Error benchmarking DNS', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
                }
              }}
            >
              {t.lang === 'es' ? 'Comparar resolvedores' : 'Benchmark resolvers'}
            </Button>
          </CardFooter>
        </Card>

        <Card className="col-span-4">
          <CardHeader title={t.lang === 'es' ? 'MTU y QoS' : 'MTU and QoS'} description={t.lang === 'es' ? 'Descubrimiento de ruta y reserva de ancho de banda' : 'Path discovery and bandwidth reserve'} icon={<Router className="h-4 w-4" />} />
          <CardBody className="space-y-4 pt-0">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                <span className="font-medium">{t.lang === 'es' ? 'Tamaño de MTU' : 'MTU size'}</span>
                <span className="text-muted">{t.lang === 'es' ? 'Óptimo 1472' : 'Optimal 1472'}</span>
              </div>
              <Slider value={mtu} min={1300} max={9000} step={2} onChange={setMtu} />
            </div>
            <div>
              <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                <span className="font-medium">{t.lang === 'es' ? 'Ancho de banda reservado QoS' : 'QoS reserved bandwidth'}</span>
                <span className="text-muted">{t.lang === 'es' ? 'Predeterminado 20%' : 'Default 20%'}</span>
              </div>
              <Slider value={qos} min={0} max={80} step={5} onChange={setQos} format={(v) => `${v}%`} />
            </div>
            <Divider />
            <KeyValue label={t.lang === 'es' ? 'Proveedor de congestión' : 'Congestion provider'} value="CUBIC" />
            <KeyValue label={t.lang === 'es' ? 'Ventana de recepción' : 'Receive window'} value={t.lang === 'es' ? 'Autoajustada' : 'Auto-tuned'} />
            <KeyValue label={t.lang === 'es' ? 'Descarga de tareas' : 'Offload'} value="Checksum + LSO" />
            <KeyValue label={t.lang === 'es' ? 'Moderación de interrupciones' : 'Interrupt moderation'} value={t.lang === 'es' ? 'Adaptativa' : 'Adaptive'} />
          </CardBody>
        </Card>

        <Card className="col-span-3">
          <CardHeader title={t.lang === 'es' ? 'Adaptadores' : 'Adapters'} description={t.lang === 'es' ? 'Físicos y virtuales' : 'Physical and virtual'} icon={<Cable className="h-4 w-4" />} />
          <CardBody className="space-y-2 pt-0">
            {adapters.map((a) => (
              <button
                key={a.name}
                onClick={() => setAdapter(a.name)}
                className={cn(
                  'w-full rounded-[8px] border p-2.5 text-left transition-all duration-200',
                  adapter === a.name
                    ? 'border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-accent-soft'
                    : 'border-line bg-[var(--sunken)] hover:bg-card-hover',
                )}
              >
                <div className="flex items-center gap-2">
                  <Wifi className="h-3.5 w-3.5 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{a.name}</span>
                  <Badge tone={a.status === 'Connected' ? 'success' : 'neutral'}>{t.te(a.status)}</Badge>
                </div>
                <div className="mt-1.5 grid grid-cols-2 gap-1 text-[11px] text-muted">
                  <span>{a.speed}</span>
                  <span className="text-right font-mono">{a.ip}</span>
                  <span className="col-span-2 truncate font-mono text-[10.5px] text-subtle">{a.mac}</span>
                </div>
              </button>
            ))}
          </CardBody>
        </Card>
      </div>

      <SectionTitle className="mt-6" title={t.lang === 'es' ? 'Test de velocidad de Internet' : 'Internet speed test'} description={t.lang === 'es' ? 'Medición nativa con los servidores oficiales de Ookla' : 'Native measurement using official Ookla servers'} />
      <Card>
        <CardBody className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[14px] font-semibold">Ookla Speedtest CLI</p>
              <p className="mt-1 text-[12px] text-muted">{t.lang === 'es' ? 'Selecciona automáticamente el servidor Ookla más cercano. No se abre ninguna página web.' : 'Automatically selects the nearest Ookla server. No web page is opened.'}</p>
            </div>
            <Button variant="primary" loading={ooklaRunning} disabled={!hasSystemApi()} onClick={runOoklaSpeedTest}>
              <Gauge className="h-3.5 w-3.5" />
              {t.lang === 'es' ? 'Ejecutar Speedtest' : 'Run Speedtest'}
            </Button>
          </div>
          {ooklaResult ? (
            <div className="mt-4 grid grid-cols-4 gap-3">
              {[
                [t.lang === 'es' ? 'Descarga' : 'Download', `${ooklaResult.downloadMbps.toFixed(1)} Mb/s`],
                [t.lang === 'es' ? 'Subida' : 'Upload', `${ooklaResult.uploadMbps.toFixed(1)} Mb/s`],
                ['Ping', `${ooklaResult.latencyMs.toFixed(1)} ms`],
                [t.lang === 'es' ? 'Servidor' : 'Server', `${ooklaResult.server.name} · ${ooklaResult.server.location}`],
              ].map(([label, value]) => <div key={label} className="rounded-[8px] border border-line bg-[var(--sunken)] p-3"><p className="text-[11px] text-subtle">{label}</p><p className="mt-1 truncate text-[13px] font-semibold">{value}</p></div>)}
            </div>
          ) : null}
          {!hasSystemApi() ? <p className="mt-3 text-[12px] text-warning">{t.lang === 'es' ? 'Disponible únicamente en la aplicación de escritorio.' : 'Available only in the desktop application.'}</p> : null}
        </CardBody>
      </Card>

      <SectionTitle className="mt-6" title={t.lang === 'es' ? 'Tweaks de TCP/IP' : 'TCP/IP tweaks'} description={t.lang === 'es' ? `${applied} de ${NETWORK_TWEAKS.length} aplicados` : `${applied} of ${NETWORK_TWEAKS.length} applied`} />
      <Card className="rounded-[4px]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {tweaks.map((tw) => (
            <TweakRow
              key={tw.id}
              id={tw.id}
              name={tw.name}
              description={tw.description}
              defaultOn={tw.defaultOn}
              icon={<tw.Icon className="h-4 w-4" />}
              compact
            />
          ))}
        </div>
      </Card>
    </Page>
  )
}
