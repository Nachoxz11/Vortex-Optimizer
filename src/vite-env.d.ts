/// <reference types="vite/client" />

declare global {
  type XTweakStatus = {
    id: string
    name: string
    category: string
    risk: string
    description: string
    applied: boolean
    requiresRestart?: boolean
    error?: string
  }

  type SteamGame = {
    appId: string
    name: string
    sizeGB: number
  }

  type TweakHistoryEntry = {
    timestamp: string
    event: 'apply' | 'revert'
    id: string
    name: string
    applied: boolean | null
    error: string | null
  }

  type UpdateCheckResult = {
    available: boolean
    current_version: string
    latest_version?: string | null
    notes?: string | null
    downloaded: boolean
    message: string
    installer_path?: string | null
  }

  interface Window {
    xtweaks?: {
      platform: string
      minimize: () => Promise<void>
      toggleMaximize: () => Promise<boolean>
      close: () => Promise<void>
      isMaximized: () => Promise<boolean>
      openUrl: (url: string) => Promise<void>
      paypalCreateOrder: (accessToken: string) => Promise<string>
      onWindowState: (cb: (maximized: boolean) => void) => () => void
      auth: {
        startOAuthServer: () => Promise<void>
        onOAuthSession: (cb: (hash: string) => void) => () => void
      }
      tweaks: {
        list: () => Promise<XTweakStatus[]>
        change: (id: string, action: 'apply' | 'revert') => Promise<XTweakStatus & { action: string }>
      }
      system?: {
        info: () => Promise<import('./lib/system').SystemInfo>
        metrics: () => Promise<import('./lib/system').SystemMetrics>
        processes: (limit?: number) => Promise<import('./lib/system').ProcessInfo[]>
        startup: () => Promise<Omit<import('./lib/system').StartupItemData, 'Icon'>[]>
        startupSet: (hive: string, location: string, approvedName: string, enabled: boolean) => Promise<void>
        apps: () => Promise<Omit<import('./lib/system').InstalledAppData, 'Icon'>[]>
        uninstallApp: (app: import('./lib/system').InstalledAppData) => Promise<{ ok: boolean }>
        repairApp: (app: import('./lib/system').InstalledAppData) => Promise<{ ok: boolean }>
        drives: () => Promise<import('./lib/system').DriveInfo[]>
        networkAdapters: () => Promise<import('./lib/system').NetworkAdapter[]>
        networkMetrics: () => Promise<import('./lib/system').NetworkMetrics>
        setDnsServers: (adapter: string, primary: string, secondary?: string) => Promise<{ adapter: string; primary: string; secondary?: string }>
        resetDnsServers: (adapter: string) => Promise<{ adapter: string; dhcp: boolean }>
        setNetworkSettings: (adapter: string, mtu: number, qosPercent: number) => Promise<{ adapter: string; mtu: number; qosPercent: number; restartNeeded: boolean }>
        speedTest: (provider?: import('./lib/system').SpeedTestProvider) => Promise<import('./lib/system').SpeedTestResult>
        ooklaSpeedTest: () => Promise<{ provider: string; downloadMbps: number; uploadMbps: number; latencyMs: number; server: { id?: number; name: string; location: string; sponsor: string } }>
        steamGames: () => Promise<SteamGame[]>
        storageBreakdown: (drive?: string) => Promise<import('./lib/system').StorageFolder[]>
        largeFiles: (drive?: string, minSizeGB?: number, limit?: number) => Promise<import('./lib/system').LargeFile[]>
        cleanerScan: () => Promise<import('./lib/system').CleanerCategory[]>
        history: (limit?: number) => Promise<TweakHistoryEntry[]>
        cleanerClean: (ids: string[]) => Promise<import('./lib/system').CleanerCleanResult>
        duplicateCandidates: (maxGroups?: number) => Promise<{ groups: { sizeBytes: number; hash: string; files: string[] }[]; scannedFiles: number }>
        deepClean: (mode: 'component_store' | 'upgrade_leftovers') => Promise<Record<string, unknown>>
        optionalFeatures: () => Promise<{ featureName: string; state: string }[]>
        optionalFeatureChange: (id: string, enabled: boolean) => Promise<{ featureName: string; enabled: boolean; restartNeeded: boolean }>
        msiDevices: () => Promise<{ devices: Array<{ name?: string; instanceId: string; status: string; msiSupported: number | null; registryPath: string }> }>
        deleteFile: (path: string) => Promise<{ ok: boolean; freedGB: number }>
        restoreList: () => Promise<import('./lib/system').RestorePointData[]>
        restoreCreate: (description: string) => Promise<void>
        restoreApply: (sequenceNumber: number) => Promise<void>
        exportProfile: () => Promise<{ path: string; count: number }>
        importProfile: (entries: { id: string; applied: boolean }[]) => Promise<{ applied: number; skipped: number; failed: { id: string; error: string }[] }>
        openResetWizard: () => Promise<void>
        timerResolutionGet: () => Promise<{ minimumMs: number; maximumMs: number; currentMs: number; enabled: boolean }>
        timerResolutionSet: (enabled: boolean) => Promise<{ minimumMs: number; currentMs: number; enabled: boolean }>
        startWithWindowsGet: () => Promise<{ enabled: boolean }>
        startWithWindowsSet: (enabled: boolean) => Promise<void>
        killProcess: (pid: number) => Promise<{ ok: boolean; pid: number; name: string }>
        openFileLocation: (path: string) => Promise<{ ok: boolean }>
        setProcessPriority: (pid: number, priority: string) => Promise<{ ok: boolean; pid: number; priority: string }>
        setProcessAffinity: (pid: number, cores: number[]) => Promise<{ ok: boolean; pid: number; cores: number[] }>
        dnsBenchmark: () => Promise<{ results: { name: string; server: string; latencyMs: number | null }[] }>
        startupRemoveEntry: (hive: string, location: string, name: string, command?: string) => Promise<{ ok: boolean }>
        rebuildShaderCache: () => Promise<{ ok: boolean; filesRemoved: number; freedGB: number; errors: number }>
        presentmonStart: (application?: string) => Promise<{ running: boolean }>
        presentmonStop: () => Promise<{ running: boolean }>
        presentmonStats: () => Promise<{ running: boolean; application?: string | null; samples: { timestampMs: number; frameTimeMs: number; fps: number; application: string }[]; averageFps?: number | null; averageFrameTimeMs?: number | null; p95FrameTimeMs?: number | null }>
      }
      updates?: {
        check: () => Promise<UpdateCheckResult>
      }
      actions?: {
        run: (id: string) => Promise<QuickActionResult>
      }
      tools?: {
        open: (fileName: string) => Promise<{ ok: boolean; path: string }>
      }
    }
  }

  type QuickActionResult = {
    ok: boolean
    message: string
    detail: string
    stats?: Record<string, unknown>
  }
}

export {}

declare module '*.css'
