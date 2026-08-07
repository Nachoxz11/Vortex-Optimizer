import { useCallback, useEffect, useState } from 'react'
import { Package, type LucideIcon } from 'lucide-react'
import {
  type Impact,
} from './mock'

export type SystemInfo = {
  device: string
  user: string
  userProfile: string
  edition: string
  version: string
  build: string
  install: string
  cpu: string
  cpuDetail: string
  gpu: string
  gpuDetail: string
  ram: string
  ramDetail: string
  board: string
  disk: string
  uptime: string
  health: number
  ramUsedGB?: number
  ramTotalGB?: number
  storageFreeGB?: number
  storageTotalGB?: number
}

export type SystemMetrics = {
  cpu: number
  ram: number
  gpu: number
  disk: number
  net?: number
  ramUsedGB: number
  ramTotalGB: number
}

export type ProcessInfo = {
  name: string
  pid: number
  cpu: number
  ram: number
  disk: number
  net: number
  path?: string | null
}

export type StartupItemData = {
  id: string
  name: string
  publisher: string
  impact: Impact
  status: string
  delay: string
  type: string
  defaultOn: boolean
  command?: string
  hive?: 'HKCU' | 'HKLM'
  location?: 'Run' | 'StartupFolder'
  approvedName?: string
  Icon: LucideIcon
}

export type InstalledAppData = {
  id: string
  name: string
  publisher: string
  version: string
  size: number
  installed: string
  source: string
  updatable: boolean
  installLocation?: string
  uninstallString?: string | null
  quietUninstallString?: string | null
  isMsi?: boolean
  productCode?: string | null
  hive?: string | null
  registryKey?: string | null
  packageFullName?: string | null
  Icon: LucideIcon
}

export type DriveInfo = {
  letter: string
  label: string
  model: string
  total: number
  used: number
  type: string
}

export type NetworkAdapter = {
  name: string
  type: string
  status: string
  speed: string
  ip: string
  mac: string
  primary: boolean
}

export type NetworkMetrics = {
  latency: number
  download: number
  loss: number
  jitter: number
  dnsPrimary: string
  dnsSecondary: string
}

export type StorageFolder = {
  id: string
  name: string
  path: string
  size: number
}

export type LargeFile = {
  name: string
  size: number
  path: string
  days: number
}

export type CleanerCategory = {
  id: string
  name: string
  detail: string
  size: number
  files: number
  defaultOn: boolean
}

export type CleanerCleanResult = {
  cleaned: { id: string; freedGB: number; filesRemoved: number; errors: number }[]
  freedGB: number
  filesRemoved: number
}

export type SpeedTestProvider = 'cloudflare' | 'google'

export const SPEED_TEST_PROVIDERS: Array<{ id: SpeedTestProvider; label: string }> = [
  { id: 'cloudflare', label: 'Cloudflare' },
  { id: 'google', label: 'Google' },
]

export type SpeedTestResult = {
  provider: SpeedTestProvider
  downloadMbps: number
  uploadMbps: number | null
  uploadSupported: boolean
  latencyMs: number
  jitterMs: number
  error?: string | null
}

export type RestorePointData = {
  sequenceNumber: number
  description: string
  creationTime: string
  type: string
}

export function hasSystemApi() {
  return Boolean(window.xtweaks?.system)
}

/**
 * Generic shared loader: coalesces concurrent calls for the same key into a single in-flight
 * request and reuses the result for `ttlMs`, so mounting a hook right after `prefetchAll()` (or
 * after a sibling hook) reuses the prefetched data instead of re-hitting `powershell.exe`.
 */
function createLoader<Args extends unknown[], T>(
  fetcher: (...args: Args) => Promise<T>,
  ttlMs: number,
  keyFn: (...args: Args) => string = () => '_',
) {
  const cache = new Map<string, { data: T; at: number }>()
  const inFlight = new Map<string, Promise<T>>()
  return {
    load(force: boolean, ...args: Args): Promise<T> {
      const key = keyFn(...args)
      if (!force) {
        const entry = cache.get(key)
        if (entry && Date.now() - entry.at < ttlMs) return Promise.resolve(entry.data)
        const pending = inFlight.get(key)
        if (pending) return pending
      }
      const request = fetcher(...args)
        .then((data) => {
          cache.set(key, { data, at: Date.now() })
          return data
        })
        .finally(() => {
          inFlight.delete(key)
        })
      inFlight.set(key, request)
      return request
    },
  }
}

/**
 * Specs del equipo (SystemInfo) se persisten en `localStorage` con un TTL largo: son las que
 * Sidebar, Dashboard y Monitor piden al montar, y sin esto cada apertura de la app volvía a
 * disparar la consulta CIM completa aunque nada haya cambiado desde la última sesión.
 */
const SYSTEM_INFO_TTL_MS = 12 * 60 * 60 * 1000
const SYSTEM_INFO_STORAGE_KEY = 'xtweaks:systemInfo:v1'

function readPersistedSystemInfo(): { data: SystemInfo; at: number } | null {
  try {
    const raw = window.localStorage.getItem(SYSTEM_INFO_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { data?: SystemInfo; at?: number }
    if (!parsed.data || typeof parsed.at !== 'number') return null
    if (Date.now() - parsed.at >= SYSTEM_INFO_TTL_MS) return null
    return { data: parsed.data, at: parsed.at }
  } catch {
    return null
  }
}

function persistSystemInfo(data: SystemInfo, at: number) {
  try {
    window.localStorage.setItem(SYSTEM_INFO_STORAGE_KEY, JSON.stringify({ data, at }))
  } catch {
    // Storage unavailable (private mode, quota) — just refetches next time.
  }
}

let systemInfoCache: { data: SystemInfo; at: number } | null = readPersistedSystemInfo()
let systemInfoInFlight: Promise<SystemInfo> | null = null

export async function fetchSystemInfo(force = false): Promise<SystemInfo> {
  if (!force && systemInfoCache && Date.now() - systemInfoCache.at < SYSTEM_INFO_TTL_MS) {
    return systemInfoCache.data
  }
  if (!force && systemInfoInFlight) return systemInfoInFlight

  const request = window.xtweaks!.system!.info()
    .then((data) => {
      const at = Date.now()
      systemInfoCache = { data, at }
      persistSystemInfo(data, at)
      return data
    })
    .finally(() => {
      systemInfoInFlight = null
    })
  systemInfoInFlight = request
  return request
}

const processesLoader = createLoader(
  (limit: number) => window.xtweaks!.system!.processes(limit),
  4000,
  (limit) => `processes:${limit}`,
)
const startupLoader = createLoader(() => window.xtweaks!.system!.startup(), 4000)
const appsLoader = createLoader(() => window.xtweaks!.system!.apps(), 8000)
const drivesLoader = createLoader(() => window.xtweaks!.system!.drives(), 4000)
const networkAdaptersLoader = createLoader(() => window.xtweaks!.system!.networkAdapters(), 4000)
const storageBreakdownLoader = createLoader(
  (drive: string) => window.xtweaks!.system!.storageBreakdown(drive),
  5000,
  (drive) => drive,
)
const largeFilesLoader = createLoader(
  (drive: string, minSizeGB: number) => window.xtweaks!.system!.largeFiles(drive, minSizeGB, 15),
  5000,
  (drive, minSizeGB) => `${drive}:${minSizeGB}`,
)
const cleanerScanLoader = createLoader(() => window.xtweaks!.system!.cleanerScan(), 5000)
const restorePointsLoader = createLoader(() => window.xtweaks!.system!.restoreList(), 5000)

/**
 * Runs at app boot to warm every shared loader before screens mount, so navigating to Storage,
 * Cleaner, Startup, etc. right after launch reuses this data instead of waiting on a fresh
 * PowerShell round trip. The single PowerShell worker serializes every call anyway (see
 * `src-tauri/src/powershell.rs`), so firing these in stages — rather than all at once — keeps the
 * order predictable without needing extra concurrency control.
 */
export async function prefetchAll(): Promise<void> {
  if (!hasSystemApi()) return

  await Promise.allSettled([
    fetchSystemInfo(),
    processesLoader.load(false, 20),
    appsLoader.load(false),
    drivesLoader.load(false),
    networkAdaptersLoader.load(false),
    startupLoader.load(false),
  ])

  await Promise.allSettled([cleanerScanLoader.load(false), restorePointsLoader.load(false)])

  const drives = await drivesLoader.load(false).catch(() => [] as DriveInfo[])
  const primaryDrive = drives[0]?.letter
  if (primaryDrive) {
    await Promise.allSettled([
      storageBreakdownLoader.load(false, primaryDrive),
      largeFilesLoader.load(false, primaryDrive, 1),
    ])
  }
}

function withIcon<T extends { id: string; Icon?: LucideIcon }>(items: T[]): (T & { Icon: LucideIcon })[] {
  return items.map((item) => ({ ...item, Icon: item.Icon ?? Package }))
}

const EMPTY_SYSTEM_INFO: SystemInfo = {
  device: '—', user: '—', userProfile: '—', edition: '—', version: '—', build: '—', install: '—',
  cpu: '—', cpuDetail: '—', gpu: '—', gpuDetail: '—', ram: '—', ramDetail: '—', board: '—', disk: '—', uptime: '—', health: 0,
}

export function useSystemInfo() {
  const [info, setInfo] = useState<SystemInfo>(systemInfoCache?.data ?? EMPTY_SYSTEM_INFO)
  const [loading, setLoading] = useState(hasSystemApi() && !systemInfoCache)
  const [real, setReal] = useState(Boolean(systemInfoCache))

  const refresh = useCallback(async (force = false) => {
    if (!hasSystemApi()) {
      setInfo(EMPTY_SYSTEM_INFO)
      setReal(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await fetchSystemInfo(force)
      setInfo(data)
      setReal(true)
    } catch {
      // Keep whatever we had before (real data or the initial mock) — a failed refresh never
      // silently swaps in fixture data over a result that was already real.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { info, loading, real, refresh }
}

export function useSystemMetrics(length = 40, intervalMs = 5000, live = true) {
  const [current, setCurrent] = useState<SystemMetrics>({
    cpu: 0,
    ram: 0,
    gpu: 0,
    disk: 0,
    ramUsedGB: 0,
    ramTotalGB: 32,
  })
  const [series, setSeries] = useState<Record<string, number[]>>({
    cpu: Array(length).fill(0),
    ram: Array(length).fill(0),
    gpu: Array(length).fill(0),
    disk: Array(length).fill(0),
    net: Array(length).fill(0),
  })
  const [real, setReal] = useState(false)
  /** True only while waiting on the very first sample from a live bridge — the first
   *  `system_metrics` call costs ~1-2s per Get-Counter sample (CPU + disk, sampled in series)
   *  plus PowerShell startup, so callers can show a skeleton instead of a misleading "0%". */
  const [loading, setLoading] = useState(live && hasSystemApi())

  useEffect(() => {
    if (!live || !hasSystemApi()) {
      setReal(false)
      setLoading(false)
      return
    }

    let cancelled = false
    let polling = false

    const poll = async () => {
      if (polling) return
      polling = true
      try {
        const m = await window.xtweaks!.system!.metrics()
        if (cancelled) return
        setCurrent(m)
        setReal(true)
        setSeries((prev) => ({
          cpu: [...prev.cpu.slice(1), m.cpu],
          ram: [...prev.ram.slice(1), m.ram],
          gpu: [...prev.gpu.slice(1), m.gpu],
          disk: [...prev.disk.slice(1), m.disk],
          net: [...prev.net.slice(1), m.net ?? 0],
        }))
      } catch {
        if (!cancelled) setReal(false)
      } finally {
        polling = false
        if (!cancelled) setLoading(false)
      }
    }

    poll()
    const id = window.setInterval(poll, intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [live, intervalMs, length])

  const push = useCallback((key: keyof typeof series, value: number) => {
    setSeries((prev) => ({ ...prev, [key]: [...prev[key].slice(1), value] }))
  }, [])

  return { current, series, real, loading, push }
}

export function useProcesses(limit = 20, autoRefreshMs = 5000) {
  const [processes, setProcesses] = useState<ProcessInfo[]>([])
  const [loading, setLoading] = useState(hasSystemApi())
  const [real, setReal] = useState(false)

  const refresh = useCallback(async (force = false) => {
    if (!hasSystemApi()) {
      setProcesses([])
      setReal(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await processesLoader.load(force, limit)
      setProcesses(Array.isArray(data) ? data : [])
      setReal(true)
    } catch {
      // Keep the last real (or initial mock) processes instead of wiping them on a transient error.
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    refresh()
    if (!hasSystemApi() || autoRefreshMs <= 0) return
    const id = window.setInterval(refresh, autoRefreshMs)
    return () => window.clearInterval(id)
  }, [refresh, autoRefreshMs])

  return { processes, loading, real, refresh }
}

export function useStartupItems() {
  const [items, setItems] = useState<StartupItemData[]>([])
  const [loading, setLoading] = useState(hasSystemApi())
  const [real, setReal] = useState(false)

  const refresh = useCallback(async (force = false) => {
    if (!hasSystemApi()) {
      setItems([])
      setReal(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await startupLoader.load(force)
      const list: Omit<StartupItemData, 'Icon'>[] = Array.isArray(data) ? data : []
      setItems(withIcon(list))
      setReal(true)
    } catch {
      // Keep the last real (or initial mock) items instead of wiping them on a transient error.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { items, loading, real, refresh }
}

/** Toggles a startup entry for real via `StartupApproved`. No-op outside Tauri. */
export async function setStartupItemState(item: StartupItemData, enabled: boolean) {
  if (!hasSystemApi() || !item.hive || !item.location || !item.approvedName) return
  await window.xtweaks!.system!.startupSet(item.hive, item.location, item.approvedName, enabled)
}

export function useInstalledApps() {
  const [apps, setApps] = useState<InstalledAppData[]>([])
  const [loading, setLoading] = useState(hasSystemApi())
  const [real, setReal] = useState(false)

  const refresh = useCallback(async (force = false) => {
    if (!hasSystemApi()) {
      setApps([])
      setReal(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await appsLoader.load(force)
      const list: Omit<InstalledAppData, 'Icon'>[] = Array.isArray(data) ? data : []
      setApps(withIcon(list))
      setReal(true)
    } catch {
      // Keep the last real (or initial mock) apps instead of wiping them on a transient error.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { apps, loading, real, refresh }
}

export function useDrives() {
  const [drives, setDrives] = useState<DriveInfo[]>([])
  const [loading, setLoading] = useState(hasSystemApi())
  const [real, setReal] = useState(false)

  const refresh = useCallback(async (force = false) => {
    if (!hasSystemApi()) {
      setDrives([])
      setReal(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await drivesLoader.load(force)
      setDrives(Array.isArray(data) ? data : [])
      setReal(true)
    } catch {
      // Keep the last real (or initial mock) drives instead of wiping them on a transient error.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { drives, loading, real, refresh }
}

export function useNetworkAdapters() {
  const [adapters, setAdapters] = useState<NetworkAdapter[]>([])
  const [loading, setLoading] = useState(hasSystemApi())
  const [real, setReal] = useState(false)

  const refresh = useCallback(async (force = false) => {
    if (!hasSystemApi()) {
      setAdapters([])
      setReal(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await networkAdaptersLoader.load(force)
      setAdapters(Array.isArray(data) ? data : [])
      setReal(true)
    } catch {
      // Keep the last real adapters instead of wiping them on a transient error.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { adapters, loading, real, refresh }
}

export function useNetworkMetrics(intervalMs = 2000, live = true) {
  const [metrics, setMetrics] = useState<NetworkMetrics>({
    latency: 0,
    download: 0,
    loss: 0,
    jitter: 0,
    dnsPrimary: 'Automatic',
    dnsSecondary: '—',
  })
  const [series, setSeries] = useState({
    latency: Array(48).fill(0),
    download: Array(48).fill(0),
    loss: Array(48).fill(0),
    jitter: Array(48).fill(0),
  })
  const [real, setReal] = useState(false)

  useEffect(() => {
    if (!live || !hasSystemApi()) {
      setReal(false)
      return
    }
    let cancelled = false
    const poll = async () => {
      try {
        const m = await window.xtweaks!.system!.networkMetrics()
        if (cancelled) return
        setMetrics(m)
        setReal(true)
        setSeries((prev) => ({
          latency: [...prev.latency.slice(1), m.latency],
          download: [...prev.download.slice(1), m.download],
          loss: [...prev.loss.slice(1), m.loss],
          jitter: [...prev.jitter.slice(1), m.jitter],
        }))
      } catch {
        // Keep the last real series instead of dropping to an unreal state mid-poll.
      }
    }
    poll()
    const id = window.setInterval(poll, intervalMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [live, intervalMs])

  return { metrics, series, real }
}

/** Runs a real download/upload/latency benchmark against the chosen provider's public endpoints. */
export async function runSpeedTest(provider: SpeedTestProvider = 'cloudflare'): Promise<SpeedTestResult> {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.speedTest(provider)
}

export function useStorageBreakdown(driveLetter: string) {
  const [folders, setFolders] = useState<StorageFolder[]>([])
  const [loading, setLoading] = useState(hasSystemApi())
  const [real, setReal] = useState(false)

  const refresh = useCallback(async (force = false) => {
    if (!hasSystemApi()) {
      setFolders([])
      setReal(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await storageBreakdownLoader.load(force, driveLetter)
      setFolders(Array.isArray(data) ? data : [])
      setReal(true)
    } catch {
      // Keep the last real breakdown instead of wiping it on a transient error.
    } finally {
      setLoading(false)
    }
  }, [driveLetter])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { folders, loading, real, refresh }
}

export function useLargeFiles(driveLetter: string, minSizeGB = 1) {
  const [files, setFiles] = useState<LargeFile[]>([])
  const [loading, setLoading] = useState(hasSystemApi())
  const [real, setReal] = useState(false)

  const refresh = useCallback(async (force = false) => {
    if (!hasSystemApi()) {
      setFiles([])
      setReal(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await largeFilesLoader.load(force, driveLetter, minSizeGB)
      setFiles(Array.isArray(data) ? data : [])
      setReal(true)
    } catch {
      // Keep the last real files instead of wiping them on a transient error.
    } finally {
      setLoading(false)
    }
  }, [driveLetter, minSizeGB])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { files, loading, real, refresh }
}

export function useCleanerScan() {
  const [categories, setCategories] = useState<CleanerCategory[]>([])
  const [loading, setLoading] = useState(hasSystemApi())
  const [real, setReal] = useState(false)

  const refresh = useCallback(async (force = false) => {
    if (!hasSystemApi()) {
      setCategories([])
      setReal(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await cleanerScanLoader.load(force)
      setCategories(Array.isArray(data) ? data : [])
      setReal(true)
    } catch {
      // Keep the last real categories instead of wiping them on a transient error.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { categories, loading, real, refresh }
}

/** Deletes the given cleaner categories for real. Throws outside Tauri — callers should guard on `hasSystemApi()`. */
export async function cleanCategories(ids: string[]) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.cleanerClean(ids)
}

/** Runs one explicitly selected, irreversible Windows deep-clean operation. */
export async function deepClean(mode: 'component_store' | 'upgrade_leftovers') {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.deepClean(mode)
}

export type OptionalFeatureState = { featureName: string; state: string }

export async function optionalFeatures(): Promise<OptionalFeatureState[]> {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.optionalFeatures()
}

export async function changeOptionalFeature(id: string, enabled: boolean) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.optionalFeatureChange(id, enabled)
}

export async function msiDevices() {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.msiDevices()
}

/** Deletes a single file for real (permanent, not Recycle Bin). Throws outside Tauri — callers should guard on `hasSystemApi()`. */
export async function deleteFile(path: string) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.deleteFile(path)
}

/** Terminates a process by PID for real. Throws outside Tauri — callers should guard on `hasSystemApi()`. */
export async function killProcess(pid: number) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.killProcess(pid)
}

/** Opens Explorer with the target file or directory selected. Throws outside Tauri. */
export async function openFileLocation(path: string) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.openFileLocation(path)
}

export type ProcessPriority = 'realtime' | 'high' | 'above_normal' | 'normal' | 'below_normal' | 'idle'

/** Sets a process's scheduling priority via SetPriorityClass. Throws outside Tauri. */
export async function setProcessPriority(pid: number, priority: ProcessPriority) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.setProcessPriority(pid, priority)
}

/** Pins a process to the given logical cores (0-indexed) via SetProcessAffinityMask. Throws outside Tauri. */
export async function setProcessAffinity(pid: number, cores: number[]) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.setProcessAffinity(pid, cores)
}

/** Measures real UDP DNS ping against major public resolvers. Throws outside Tauri. */
export async function dnsBenchmark() {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.dnsBenchmark()
}

/** Removes a startup entry from Registry. Throws outside Tauri. */
export async function startupRemoveEntry(hive: string, location: string, name: string, command?: string) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.startupRemoveEntry(hive, location, name, command)
}

/** Uninstalls an app for real (MSI, Win32 uninstaller or Store package). Throws outside Tauri. */
export async function uninstallApp(app: InstalledAppData) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.uninstallApp(app)
}

/** Repairs an app for real — only supported for MSI installs. Throws outside Tauri. */
export async function repairApp(app: InstalledAppData) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.repairApp(app)
}

/** Writes the current tweak state to Documents\Vortex-Optimizer\ for real. Throws outside Tauri. */
export async function exportProfile() {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.exportProfile()
}

/** Replays an exported tweak profile for real (apply/revert per tweak). Throws outside Tauri. */
export async function importProfile(entries: { id: string; applied: boolean }[]) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.importProfile(entries)
}

/** Opens Windows' own native "Reset this PC" wizard — never performs a reset directly. Throws outside Tauri. */
export async function openResetWizard() {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.openResetWizard()
}

/** Clears DirectX/NVIDIA/AMD/Intel shader cache directories for real. Throws outside Tauri. */
export async function rebuildShaderCache() {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  return window.xtweaks!.system!.rebuildShaderCache()
}

export function useSteamGames() {
  const [games, setGames] = useState<SteamGame[]>([])
  const [loading, setLoading] = useState(hasSystemApi())
  const [real, setReal] = useState(false)

  const refresh = useCallback(async () => {
    if (!hasSystemApi()) {
      setGames([])
      setReal(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await window.xtweaks!.system!.steamGames()
      setGames(Array.isArray(data) ? data : [])
      setReal(true)
    } catch {
      // Keep the last real list instead of wiping it on a transient error.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { games, loading, real, refresh }
}

export function useRestorePoints() {
  const [points, setPoints] = useState<RestorePointData[]>([])
  const [loading, setLoading] = useState(hasSystemApi())
  const [real, setReal] = useState(false)

  const refresh = useCallback(async (force = false) => {
    if (!hasSystemApi()) {
      setPoints([])
      setReal(false)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const data = await restorePointsLoader.load(force)
      setPoints(Array.isArray(data) ? data : [])
      setReal(true)
    } catch {
      // Keep the last real points instead of wiping them on a transient error.
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { points, loading, real, refresh }
}

export async function createRestorePoint(description: string) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  await window.xtweaks!.system!.restoreCreate(description)
}

export async function applyRestorePoint(sequenceNumber: number) {
  if (!hasSystemApi()) throw new Error('Desktop app required')
  await window.xtweaks!.system!.restoreApply(sequenceNumber)
}

/** Rolling buffer for a single metric key — zero-filled until a real sample arrives. */
export function useMetricSeries(key: 'cpu' | 'ram' | 'gpu' | 'disk' | 'net', length = 56, live = true) {
  const { series } = useSystemMetrics(length, 1500, live)
  return series[key]
}
