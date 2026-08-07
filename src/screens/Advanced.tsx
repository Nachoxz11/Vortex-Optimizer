import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertOctagon, KeyRound, Lock, ShieldAlert, Skull, TriangleAlert, Unlock } from 'lucide-react'
import { Notice, Page } from '@/components/shell'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch, Checkbox } from '@/components/ui/switch'
import { Dialog } from '@/components/ui/dialog'
import { Tooltip } from '@/components/ui/tooltip'
import { Divider, RiskChip, SectionTitle } from '@/components/ui/primitives'
import { ADVANCED_TWEAKS } from '@/lib/mock'
import { useApp } from '@/lib/store'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { usePremium } from '@/lib/premium'
import { PremiumOverlay } from '@/components/PremiumBadge'
import { hasSystemApi, msiDevices } from '@/lib/system'

export default function Advanced() {
  const { isOn, setToggle, setMany, toast, prefs } = useApp()
  const { isPremium } = usePremium()
  const t = useT()
  const [unlocked, setUnlocked] = useState(false)
  const [ack, setAck] = useState(false)
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [msiProbe, setMsiProbe] = useState<{ compatible: number; total: number } | null>(null)

  const tweaks = useMemo(
    () => ADVANCED_TWEAKS.map((tw) => ({
      ...tw,
      name: t.tt('advanced', tw.id, 'name', tw.name),
      description: t.tt('advanced', tw.id, 'description', tw.description),
      warning: t.tt('advanced', tw.id, 'warning', tw.warning),
    })),
    [t.lang],
  )
  const pending = tweaks.find((tw) => tw.id === pendingId) ?? null

  const active = ADVANCED_TWEAKS.filter((tw) => isOn(tw.id, false)).length

  const failureModes = [
    { t: t.lang === 'es' ? 'Fallo de arranque' : 'Boot failure', d: t.lang === 'es' ? 'Los tweaks de kernel y drivers pueden impedir que Windows arranque.' : 'Kernel and driver tweaks can prevent Windows starting.', tone: 'danger' as const },
    { t: t.lang === 'es' ? 'Exposición de seguridad' : 'Security exposure', d: t.lang === 'es' ? 'Deshabilitar mitigaciones vuelve a abrir vulnerabilidades documentadas.' : 'Disabling mitigations re-opens documented vulnerabilities.', tone: 'warning' as const },
    { t: t.lang === 'es' ? 'Bloqueos de anti-trampas' : 'Anti-cheat blocks', d: t.lang === 'es' ? 'Varios juegos en línea se niegan a abrir sin VBS.' : 'Several online games refuse to launch without VBS.', tone: 'info' as const },
  ]

  return (
    <Page
      title={t('nav.advanced.label')}
      description={t.lang === 'es' ? 'Cambios de alto riesgo para usuarios experimentados — la mayoría de los interruptores aplican cambios reales al sistema' : 'High-risk changes for experienced users — most switches apply real system changes'}
      actions={
        <>
          <Badge tone="danger" dot>
            {t.lang === 'es' ? 'Zona de peligro' : 'Danger zone'}
          </Badge>
          <Button
            variant={unlocked ? 'danger' : 'secondary'}
            onClick={() => {
              setUnlocked((u) => !u)
              toast({
                title: unlocked ? (t.lang === 'es' ? 'Zona avanzada bloqueada' : 'Advanced zone locked') : (t.lang === 'es' ? 'Zona avanzada desbloqueada' : 'Advanced zone unlocked'),
                description: unlocked ? (t.lang === 'es' ? 'Los interruptores vuelven a ser de solo lectura' : 'Switches are read-only again') : (t.lang === 'es' ? 'Los interruptores conectados cambian Windows de verdad — el resto está Próximamente' : 'Wired switches change Windows for real — the rest is coming soon'),
                tone: unlocked ? 'info' : 'warning',
              })
            }}
          >
            {unlocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            {unlocked ? (t.lang === 'es' ? 'Bloquear de nuevo' : 'Lock again') : (t.lang === 'es' ? 'Desbloquear interruptores' : 'Unlock switches')}
          </Button>
        </>
      }
      banner={
        <Notice tone="danger" title={t.lang === 'es' ? 'Precaución — Cambios a nivel de Kernel' : 'Caution — Kernel level changes'}>
          {t.lang === 'es' ? 'Estas opciones alteran políticas de seguridad avanzadas. Asegúrate de tener un punto de restauración.' : 'These options alter advanced security policies. Make sure you have a restore point.'}
        </Notice>
      }
    >
      <div className="relative min-h-[500px]">
        {!isPremium && (
          <PremiumOverlay
            title="Zona de Peligro Bloqueada"
            description="Todos los tweaks avanzados y cambios de kernel requieren una suscripción Premium activa."
          />
        )}
        <div className="grid grid-cols-12 gap-3">
        <Card className="col-span-4 border-[color-mix(in_srgb,var(--danger)_28%,transparent)]">
          <CardHeader
            title={t.lang === 'es' ? 'Estado de acceso' : 'Access state'}
            description={unlocked ? (t.lang === 'es' ? 'Los interruptores son interactivos' : 'Switches are interactive') : (t.lang === 'es' ? 'Los interruptores están bloqueados' : 'Switches are locked')}
            icon={<KeyRound className="h-4 w-4" />}
            action={<Badge tone={unlocked ? 'danger' : 'neutral'}>{unlocked ? (t.lang === 'es' ? 'Desbloqueado' : 'Unlocked') : (t.lang === 'es' ? 'Bloqueado' : 'Locked')}</Badge>}
          />
          <CardBody className="pt-0">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-[var(--sunken)] p-2.5">
              <Checkbox checked={ack} onChange={setAck} label={t.lang === 'es' ? 'Reconozco el riesgo' : 'Acknowledge risk'} />
              <span className="text-[12px] leading-relaxed text-muted">
                {t.lang === 'es'
                  ? 'Entiendo que estos cambios no tienen soporte y que puede requerirse un medio de recuperación.'
                  : 'I understand these changes are unsupported and that recovery media may be required.'}
              </span>
            </label>
            <Divider className="my-3" />
            <div className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted">{t.lang === 'es' ? 'Tweaks avanzados activos' : 'Active advanced tweaks'}</span>
              <span className="font-semibold tabular-nums">{active}</span>
            </div>
            <Button
              variant="danger"
              size="sm"
              className="mt-3 w-full"
              disabled={!ack}
              onClick={() => {
                setUnlocked(true)
                toast({ title: t.lang === 'es' ? 'Modo experto activado' : 'Expert mode enabled', description: t.lang === 'es' ? 'Los interruptores de abajo ahora son interactivos' : 'Switches below are now interactive', tone: 'warning' })
              }}
            >
              <Skull className="h-3.5 w-3.5" />
              {t.lang === 'es' ? 'Activar modo experto' : 'Enable expert mode'}
            </Button>
          </CardBody>
        </Card>

        <Card className="col-span-8">
          <CardHeader title={t.lang === 'es' ? 'Qué podría salir mal' : 'What could go wrong'} description={t.lang === 'es' ? 'Modos de falla que introducen estos tweaks' : 'Failure modes these tweaks introduce'} icon={<AlertOctagon className="h-4 w-4" />} />
          <CardBody className="grid grid-cols-3 gap-3 pt-0">
            {failureModes.map((x) => (
              <div key={x.t} className="rounded-[8px] border border-line bg-[var(--sunken)] p-3">
                <Badge tone={x.tone}>{x.t}</Badge>
                <p className="mt-2 text-[12px] leading-relaxed text-muted">{x.d}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <SectionTitle
        className="mt-6"
        title={t.lang === 'es' ? 'Tweaks avanzados' : 'Advanced tweaks'}
        description={t.lang === 'es' ? `${ADVANCED_TWEAKS.length} entradas · cada una requiere confirmación` : `${ADVANCED_TWEAKS.length} entries · every one requires confirmation`}
        action={
          <Button
            size="sm"
            variant="subtle"
            onClick={() => setMany(ADVANCED_TWEAKS.map((tw) => tw.id), false, 'Advanced tweaks reverted')}
          >
            {t.lang === 'es' ? 'Revertir todo' : 'Revert everything'}
          </Button>
        }
      />

      <div className={cn('grid grid-cols-3 gap-3 transition-opacity duration-300', !unlocked && 'opacity-55')}>
        {tweaks.map((tw) => {
          const on = isOn(tw.id, false)
          const temporalOnly = tw.id === 'a.timer'
          return (
            <motion.div key={tw.id} whileHover={unlocked ? { y: -2 } : undefined} transition={{ duration: 0.18 }}>
              <Card
                className={cn(
                  'h-full',
                  on
                    ? 'border-[color-mix(in_srgb,var(--danger)_45%,transparent)] bg-danger-soft'
                    : 'hover:border-[color-mix(in_srgb,var(--danger)_25%,transparent)]',
                )}
              >
                <div className="flex h-full flex-col p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-[9px]',
                        on ? 'bg-[var(--danger)] text-white' : 'bg-danger-soft text-[var(--danger)]',
                      )}
                    >
                      <tw.Icon className="h-4 w-4" />
                    </span>
                    <Tooltip content={unlocked ? tw.warning : (t.lang === 'es' ? 'Desbloqueá la zona para interactuar' : 'Unlock the zone to interact')}>
                      <span>
                        <Switch
                          checked={on}
                          disabled={!unlocked || temporalOnly}
                          onChange={(v) => (v && prefs.confirmRisky ? setPendingId(tw.id) : setToggle(tw.id, v, tw.name))}
                          label={tw.name}
                        />
                      </span>
                    </Tooltip>
                  </div>
                  <p className="text-[13px] font-semibold">{tw.name}</p>
                  <p className="mt-1 flex-1 text-[12px] leading-relaxed text-muted">{temporalOnly ? (t.lang === 'es' ? 'No se ofrece como toggle persistente: Windows gestiona la resolución del temporizador por proceso.' : 'Not offered as a persistent toggle: Windows manages timer resolution per process.') : tw.description}</p>
                  <Divider className="my-2.5" />
                  {tw.id === 'a.msi' ? (
                    <Button
                      size="sm"
                      variant="subtle"
                      className="mb-2 w-full"
                      disabled={!hasSystemApi()}
                      onClick={async (event) => {
                        event.stopPropagation()
                        try {
                          const result = await msiDevices()
                          const devices = result.devices ?? []
                          setMsiProbe({ compatible: devices.filter((d) => d.msiSupported === 1).length, total: devices.length })
                          toast({ title: t.lang === 'es' ? 'Compatibilidad MSI comprobada' : 'MSI compatibility checked', description: t.lang === 'es' ? `${devices.filter((d) => d.msiSupported === 1).length} compatibles de ${devices.length} dispositivos PCI` : `${devices.filter((d) => d.msiSupported === 1).length} compatible out of ${devices.length} PCI devices`, tone: 'info' })
                        } catch (error) {
                          toast({ title: t.lang === 'es' ? 'No se pudo consultar MSI' : 'MSI probe failed', description: error instanceof Error ? error.message : String(error), tone: 'danger' })
                        }
                      }}
                    >
                      {msiProbe ? `${msiProbe.compatible}/${msiProbe.total} ${t.lang === 'es' ? 'compatibles' : 'compatible'}` : (t.lang === 'es' ? 'Comprobar compatibilidad' : 'Check compatibility')}
                    </Button>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <RiskChip risk={tw.risk} />
                    <span className="flex items-center gap-1 text-[11px] text-[var(--danger)]">
                      <ShieldAlert className="h-3 w-3" />
                      {temporalOnly ? (t.lang === 'es' ? 'Solo diagnóstico' : 'Diagnostic only') : on ? (t.lang === 'es' ? 'Activo' : 'Active') : (t.lang === 'es' ? 'Inactivo' : 'Inactive')}
                    </span>
                  </div>
                </div>
              </Card>
            </motion.div>
          )
        })}
      </div>

      <Dialog
        open={pending !== null}
        onClose={() => setPendingId(null)}
        tone="danger"
        icon={<TriangleAlert className="h-4 w-4" />}
        title={t.lang === 'es' ? `¿Activar "${pending?.name}"?` : `Enable “${pending?.name}”?`}
        description={pending?.warning}
        footer={
          <>
            <Button variant="subtle" onClick={() => setPendingId(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (pending) {
                  setToggle(pending.id, true, pending.name)
                }
                setPendingId(null)
              }}
            >
              {t.lang === 'es' ? 'Acepto el riesgo' : 'I accept the risk'}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-[12.5px] text-muted">
          <p>{pending?.description}</p>
          <div className="rounded-[8px] border border-[color-mix(in_srgb,var(--danger)_30%,transparent)] bg-danger-soft p-2.5 text-[var(--danger)]">
            {t.lang === 'es'
              ? 'La recuperación puede requerir un USB de instalación de Windows si este interruptor está conectado al sistema y algo sale mal.'
              : 'Recovery may require a Windows installation USB if this switch is wired to the system and something goes wrong.'}
          </div>
        </div>
      </Dialog>
    </div>
    </Page>
  )
}
