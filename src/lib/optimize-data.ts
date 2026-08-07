import {
  Cpu, HardDrive, ShieldAlert, type LucideIcon,
} from 'lucide-react'

/**
 * Catalogue for the "Optimization Center" module (sections → cards, no nested subtabs).
 * Only tweaks with a real backend implementation are listed here — no mockup cards that
 * quietly do nothing (see SYSTEM_TWEAK_IDS / custom.rs for what backs each id).
 */
export type OptimizeRisk = 'Safe' | 'Moderate' | 'Advanced'

export type OptimizeItem = {
  id: string
  name: { en: string; es: string }
  description: { en: string; es: string }
  /** What the tweak actually touches — shown as a small technical line under the description. */
  technical: { en: string; es: string }
  risk: OptimizeRisk
  reversible: boolean
  Icon: LucideIcon
  /** Cards that run a one-shot action instead of toggling a switch. */
  action?: 'ultimate' | 'shaderCache' | 'nvidiaInspector'
}

export type OptimizeSection = {
  id: string
  label: { en: string; es: string }
  Icon: LucideIcon
  items: OptimizeItem[]
}

export const OPTIMIZE_SECTIONS: OptimizeSection[] = [
  {
    id: 'cpu-gpu',
    label: { en: 'CPU & GPU', es: 'CPU y GPU' },
    Icon: Cpu,
    items: [
      {
        id: 'opt.cpu.ultimate',
        name: { en: 'Ultimate Performance power plan', es: 'Plan de energía Máximo Rendimiento' },
        description: {
          en: 'Unlocks and activates the hidden Windows power plan with no idle throttling.',
          es: 'Desbloquea y activa el plan de energía oculto de Windows sin regulación en reposo.',
        },
        technical: { en: 'Command · powercfg -duplicatescheme (Ultimate Performance)', es: 'Comando · powercfg -duplicatescheme (Máximo Rendimiento)' },
        risk: 'Safe',
        reversible: true,
        Icon: Cpu,
        action: 'ultimate',
      },
      {
        id: 'p.corepark',
        name: { en: 'Core Parking', es: 'Core Parking' },
        description: {
          en: 'Keeps every CPU core awake instead of letting Windows park idle ones — helps on desktop CPUs, costs a bit more idle power.',
          es: 'Mantiene todos los núcleos activos en vez de dejar que Windows aparque los inactivos — ayuda en CPUs de escritorio, cuesta algo más de consumo en reposo.',
        },
        technical: { en: 'Command · powercfg (CPMIN/CPMAX = 100%)', es: 'Comando · powercfg (CPMIN/CPMAX = 100%)' },
        risk: 'Moderate',
        reversible: true,
        Icon: Cpu,
      },
      {
        id: 'p.prio',
        name: { en: 'Foreground priority boost', es: 'Prioridad para la app en primer plano' },
        description: {
          en: 'Tells Windows to favor the app you have focused over background processes.',
          es: 'Le dice a Windows que priorice la app que tenés en foco por sobre los procesos en segundo plano.',
        },
        technical: { en: 'Registry · HKLM…\\PriorityControl\\Win32PrioritySeparation', es: 'Registro · HKLM…\\PriorityControl\\Win32PrioritySeparation' },
        risk: 'Safe',
        reversible: true,
        Icon: Cpu,
      },
      {
        id: 'p.timer',
        name: { en: 'High Precision Event Timer (HPET)', es: 'Temporizador de alta precisión (HPET)' },
        description: {
          en: 'Forces Windows to use the platform clock. Can reduce timing jitter on some boards, adds overhead on others — test both ways.',
          es: 'Fuerza a Windows a usar el reloj de la placa. Puede reducir jitter de temporización en algunas placas y sumar overhead en otras — probá los dos modos.',
        },
        technical: { en: 'Command · bcdedit /set useplatformclock true', es: 'Comando · bcdedit /set useplatformclock true' },
        risk: 'Moderate',
        reversible: true,
        Icon: Cpu,
      },
      {
        id: 'p.gpuschedule',
        name: { en: 'GPU Hardware Scheduling', es: 'Planificación de GPU por hardware' },
        description: {
          en: 'Lets the GPU manage its own memory queue instead of the CPU. Can cause issues on older drivers.',
          es: 'Deja que la GPU maneje su propia cola de memoria en vez del CPU. Puede dar problemas en drivers viejos.',
        },
        technical: { en: 'Registry · HKLM…\\GraphicsDrivers\\HwSchMode', es: 'Registro · HKLM…\\GraphicsDrivers\\HwSchMode' },
        risk: 'Moderate',
        reversible: true,
        Icon: Cpu,
      },
      {
        id: 'opt.gpu.nvidiaInspector',
        name: { en: 'Open NVIDIA Profile Inspector', es: 'Abrir NVIDIA Profile Inspector' },
        description: {
          en: 'Launches the community tool that exposes hidden driver settings (Low Latency Mode, shader cache, DLSS override) beyond the NVIDIA Control Panel. Vortex-Optimizer does not write the driver profile for you — it only opens the tool.',
          es: 'Abre la herramienta de la comunidad que expone ajustes ocultos del driver (Low Latency Mode, caché de shaders, override de DLSS) más allá del Panel de Control de NVIDIA. Vortex-Optimizer no escribe el perfil del driver por vos — solo abre la herramienta.',
        },
        technical: { en: 'Launches tools/nvidiaProfileInspector.exe', es: 'Abre tools/nvidiaProfileInspector.exe' },
        risk: 'Safe',
        reversible: true,
        Icon: Cpu,
        action: 'nvidiaInspector',
      },
      {
        id: 'opt.gpu.rebuildShaders',
        name: { en: 'Rebuild shader cache', es: 'Reconstruir caché de shaders' },
        description: {
          en: 'Clears the DirectX/Vulkan shader cache so it rebuilds clean — can fix stutter after a driver update. Frees disk space too.',
          es: 'Vacía la caché de shaders de DirectX/Vulkan para que se reconstruya limpia — puede arreglar stutter después de actualizar el driver. También libera espacio en disco.',
        },
        technical: { en: 'Deletes %LOCALAPPDATA%\\NVIDIA\\DXCache and related folders', es: 'Borra %LOCALAPPDATA%\\NVIDIA\\DXCache y carpetas relacionadas' },
        risk: 'Safe',
        reversible: false,
        Icon: Cpu,
        action: 'shaderCache',
      },
    ],
  },
  {
    id: 'ram-disk',
    label: { en: 'RAM & Disk', es: 'RAM y Disco' },
    Icon: HardDrive,
    items: [
      {
        id: 'p.largesys',
        name: { en: 'Large system cache', es: 'Caché de sistema grande' },
        description: {
          en: 'Biases the memory manager toward file-system caching over program working sets.',
          es: 'Inclina al administrador de memoria hacia el caché del sistema de archivos por sobre los programas.',
        },
        technical: { en: 'Registry · HKLM…\\Memory Management\\LargeSystemCache', es: 'Registro · HKLM…\\Memory Management\\LargeSystemCache' },
        risk: 'Advanced',
        reversible: true,
        Icon: HardDrive,
      },
      {
        id: 'p.sysmain',
        name: { en: 'SysMain (Superfetch)', es: 'SysMain (Superfetch)' },
        description: {
          en: 'Preloads frequently-used apps into RAM. Useful on HDDs, mostly irrelevant on NVMe SSDs.',
          es: 'Precarga en RAM las apps que más usás. Útil en discos HDD, casi irrelevante en SSD NVMe.',
        },
        technical: { en: 'Service · SysMain', es: 'Servicio · SysMain' },
        risk: 'Moderate',
        reversible: true,
        Icon: HardDrive,
      },
      {
        id: 'p.trim',
        name: { en: 'SSD TRIM', es: 'TRIM de SSD' },
        description: {
          en: 'Makes sure TRIM (delete notify) is enabled so your SSD stays fast over time. Never defragment an SSD — that shortens its lifespan for no benefit.',
          es: 'Asegura que TRIM (delete notify) esté activo para que el SSD se mantenga rápido con el tiempo. Nunca desfragmentes un SSD — le acorta la vida útil sin ningún beneficio.',
        },
        technical: { en: 'Command · fsutil behavior set DisableDeleteNotify 0', es: 'Comando · fsutil behavior set DisableDeleteNotify 0' },
        risk: 'Safe',
        reversible: true,
        Icon: HardDrive,
      },
      {
        id: 'p.search',
        name: { en: 'Windows Search indexing', es: 'Indexación de Windows Search' },
        description: {
          en: 'Stops indexing drives you rarely search. Start, Explorer and Outlook search become slower.',
          es: 'Detiene la indexación de discos que casi no buscás. La búsqueda de Inicio, Explorador y Outlook se vuelve más lenta.',
        },
        technical: { en: 'Service · WSearch', es: 'Servicio · WSearch' },
        risk: 'Moderate',
        reversible: true,
        Icon: HardDrive,
      },
      {
        id: 'p.onedrive',
        name: { en: 'OneDrive auto-start', es: 'Inicio automático de OneDrive' },
        description: {
          en: 'Removes OneDrive from sign-in apps so it stops launching and syncing automatically in the background.',
          es: 'Saca a OneDrive de las apps de inicio de sesión para que deje de arrancar y sincronizar solo en segundo plano.',
        },
        technical: { en: 'Registry · HKCU…\\Run\\OneDrive', es: 'Registro · HKCU…\\Run\\OneDrive' },
        risk: 'Safe',
        reversible: true,
        Icon: HardDrive,
      },
    ],
  },
  {
    id: 'system-network',
    label: { en: 'System & Network', es: 'Sistema y Red' },
    Icon: ShieldAlert,
    items: [
      {
        id: 'p.telemetry',
        name: { en: 'Disable telemetry', es: 'Desactivar telemetría' },
        description: {
          en: 'Stops DiagTrack and the scheduled tasks that collect and upload diagnostic data.',
          es: 'Detiene DiagTrack y las tareas programadas que recolectan y suben datos de diagnóstico.',
        },
        technical: { en: 'Service · DiagTrack + scheduled tasks', es: 'Servicio · DiagTrack + tareas programadas' },
        risk: 'Moderate',
        reversible: true,
        Icon: ShieldAlert,
      },
      {
        id: 'p.animations',
        name: { en: 'Reduce shell animations', es: 'Reducir animaciones del sistema' },
        description: {
          en: 'Turns off window minimize/maximize animations for a snappier feel.',
          es: 'Apaga las animaciones de minimizar/maximizar ventanas para que se sienta más ágil.',
        },
        technical: { en: 'Registry · HKCU…\\Desktop\\WindowMetrics\\MinAnimate', es: 'Registro · HKCU…\\Desktop\\WindowMetrics\\MinAnimate' },
        risk: 'Safe',
        reversible: true,
        Icon: ShieldAlert,
      },
      {
        id: 'w.cx.copilot',
        name: { en: 'Hide Copilot entry points', es: 'Ocultar accesos a Copilot' },
        description: {
          en: 'Turns off Windows Copilot shortcuts, including the right-click menu entry.',
          es: 'Desactiva los accesos a Windows Copilot, incluido el del menú contextual.',
        },
        technical: { en: 'Registry · HKLM…\\Policies\\WindowsCopilot', es: 'Registro · HKLM…\\Policies\\WindowsCopilot' },
        risk: 'Safe',
        reversible: true,
        Icon: ShieldAlert,
      },
      {
        id: 'pr.edge',
        name: { en: 'Disable Edge sidebar', es: 'Desactivar barra lateral de Edge' },
        description: {
          en: 'Disables the Edge sidebar via policy without removing the browser.',
          es: 'Desactiva la barra lateral de Edge por política, sin desinstalar el navegador.',
        },
        technical: { en: 'Registry · HKLM…\\Policies\\Microsoft\\Edge', es: 'Registro · HKLM…\\Policies\\Microsoft\\Edge' },
        risk: 'Safe',
        reversible: true,
        Icon: ShieldAlert,
      },
      {
        id: 'n.nagle',
        name: { en: "Disable Nagle's algorithm", es: 'Desactivar algoritmo de Nagle' },
        description: {
          en: 'Sends small packets immediately instead of bundling them — lower latency, more small packets on the wire.',
          es: 'Envía paquetes chicos de inmediato en vez de agruparlos — menor latencia, más paquetes chicos en la red.',
        },
        technical: { en: 'Registry · Tcpip\\Parameters\\Interfaces\\{adapter}\\TcpAckFrequency', es: 'Registro · Tcpip\\Parameters\\Interfaces\\{adaptador}\\TcpAckFrequency' },
        risk: 'Moderate',
        reversible: true,
        Icon: ShieldAlert,
      },
    ],
  },
]
