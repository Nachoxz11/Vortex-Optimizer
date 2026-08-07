/**
 * Puente entre el frontend y el backend Tauri.
 *
 * Instala `window.xtweaks` con la misma forma que exponía el preload de Electron, de modo que el
 * resto de la app (pantallas, `lib/system.ts`, `TitleBar`) no necesita saber sobre qué runtime
 * corre. Fuera de Tauri —por ejemplo con `npm run dev:web`— no instala el puente nativo; las
 * funciones que requieren Windows se muestran como no disponibles.
 */
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  CleanerCategory,
  DriveInfo,
  InstalledAppData,
  LargeFile,
  NetworkAdapter,
  NetworkMetrics,
  ProcessInfo,
  StartupItemData,
  StorageFolder,
  SystemInfo,
  SystemMetrics,
} from './system'

/** Tauri inyecta este objeto en la página antes de que corra el bundle. */
function isTauri() {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

export function installBridge() {
  if (!isTauri() || window.xtweaks) return

  window.xtweaks = {
    platform: 'win32',

    minimize: () => invoke<void>('window_minimize'),
    toggleMaximize: () => invoke<boolean>('window_toggle_maximize'),
    close: () => invoke<void>('window_close'),
    isMaximized: () => invoke<boolean>('window_is_maximized'),
    openUrl: (url) => invoke<void>('open_in_browser', { url }),
    paypalCreateOrder: (accessToken) => invoke<string>('paypal_create_order', { accessToken }),

    onWindowState: (cb) => {
      // `listen` resuelve async; guardamos la promesa para poder desuscribirnos al desmontar.
      const pending = listen<boolean>('window:state', (event) => cb(Boolean(event.payload)))
      return () => {
        pending.then((unlisten) => unlisten())
      }
    },

    auth: {
      startOAuthServer: () => invoke<void>('start_auth_server'),
      onOAuthSession: (cb) => {
        const pending = listen<string>('oauth-session', (event) => cb(event.payload))
        return () => {
          pending.then((unlisten) => unlisten())
        }
      },
    },

    tweaks: {
      list: () => invoke<XTweakStatus[]>('tweaks_list'),
      change: (id, action) =>
        invoke<XTweakStatus & { action: string }>('tweaks_change', { id, action }),
    },

    system: {
      info: () => invoke<SystemInfo>('system_info'),
      metrics: () => invoke<SystemMetrics>('system_metrics'),
      processes: (limit) => invoke<ProcessInfo[]>('system_processes', { limit }),
      startup: () => invoke<Omit<StartupItemData, 'Icon'>[]>('system_startup'),
      startupSet: (hive, location, approvedName, enabled) =>
        invoke<void>('system_startup_set', { hive, location, approvedName, enabled }),
      apps: () => invoke<Omit<InstalledAppData, 'Icon'>[]>('system_apps'),
      uninstallApp: (app) => invoke<{ ok: boolean }>('system_uninstall_app', { app }),
      repairApp: (app) => invoke<{ ok: boolean }>('system_repair_app', { app }),
      drives: () => invoke<DriveInfo[]>('system_drives'),
      networkAdapters: () => invoke<NetworkAdapter[]>('system_network_adapters'),
      networkMetrics: () => invoke<NetworkMetrics>('system_network_metrics'),
      setDnsServers: (adapter, primary, secondary) => invoke<{ adapter: string; primary: string; secondary?: string }>('system_set_dns_servers', { adapter, primary, secondary }),
      resetDnsServers: (adapter) => invoke<{ adapter: string; dhcp: boolean }>('system_reset_dns_servers', { adapter }),
      setNetworkSettings: (adapter, mtu, qosPercent) => invoke<{ adapter: string; mtu: number; qosPercent: number; restartNeeded: boolean }>('system_set_network_settings', { adapter, mtu, qosPercent }),
      speedTest: (provider) => invoke('system_speed_test', { provider }),
      ooklaSpeedTest: () => invoke<{ provider: string; downloadMbps: number; uploadMbps: number; latencyMs: number; server: { id?: number; name: string; location: string; sponsor: string } }>('system_ookla_speed_test'),
      steamGames: () => invoke<SteamGame[]>('system_steam_games'),
      storageBreakdown: (drive) => invoke<StorageFolder[]>('system_storage_breakdown', { drive }),
      largeFiles: (drive, minSizeGB, limit) =>
        invoke<LargeFile[]>('system_large_files', { drive, minSizeGb: minSizeGB, limit }),
      cleanerScan: () => invoke<CleanerCategory[]>('system_cleaner_scan'),
      history: (limit) => invoke<TweakHistoryEntry[]>('system_history', { limit }),
      cleanerClean: (ids) => invoke('system_cleaner_clean', { ids }),
      duplicateCandidates: (maxGroups) => invoke<{ groups: { sizeBytes: number; hash: string; files: string[] }[]; scannedFiles: number }>('system_duplicate_candidates', { maxGroups }),
      deepClean: (mode) => invoke('system_deep_clean', { mode }),
      optionalFeatures: () => invoke<{ featureName: string; state: string }[]>('system_optional_features'),
      optionalFeatureChange: (id, enabled) => invoke<{ featureName: string; enabled: boolean; restartNeeded: boolean }>('system_optional_feature_change', { id, enabled }),
      msiDevices: () => invoke('system_msi_devices'),
      deleteFile: (path) => invoke<{ ok: boolean; freedGB: number }>('system_delete_file', { path }),
      restoreList: () => invoke('system_restore_list'),
      restoreCreate: (description) => invoke<void>('system_restore_create', { description }),
      restoreApply: (sequenceNumber) => invoke<void>('system_restore_apply', { sequenceNumber }),
      exportProfile: () => invoke<{ path: string; count: number }>('system_export_profile'),
      importProfile: (entries) =>
        invoke<{ applied: number; skipped: number; failed: { id: string; error: string }[] }>('system_import_profile', { entries }),
      openResetWizard: () => invoke<void>('system_open_reset_wizard'),
      timerResolutionGet: () => invoke<{ minimumMs: number; maximumMs: number; currentMs: number; enabled: boolean }>('system_timer_resolution_get'),
      timerResolutionSet: (enabled) => invoke<{ minimumMs: number; currentMs: number; enabled: boolean }>('system_timer_resolution_set', { enabled }),
      startWithWindowsGet: () => invoke('system_start_with_windows_get'),
      startWithWindowsSet: (enabled) => invoke<void>('system_start_with_windows_set', { enabled }),
      killProcess: (pid) => invoke<{ ok: boolean; pid: number; name: string }>('system_kill_process', { pid }),
      openFileLocation: (path) => invoke<{ ok: boolean }>('system_open_file_location', { path }),
      setProcessPriority: (pid, priority) => invoke('system_set_process_priority', { pid, priority }),
      setProcessAffinity: (pid, cores) => invoke('system_set_process_affinity', { pid, cores }),
      dnsBenchmark: () => invoke<{ results: { name: string; server: string; latencyMs: number | null }[] }>('system_dns_benchmark'),
      startupRemoveEntry: (hive, location, name, command) =>
        invoke<{ ok: boolean }>('system_startup_remove_entry', { hive, location, name, command }),
      rebuildShaderCache: () => invoke<{ ok: boolean; filesRemoved: number; freedGB: number; errors: number }>('system_rebuild_shader_cache'),
      presentmonStart: (application) => invoke('system_presentmon_start', { application }),
      presentmonStop: () => invoke('system_presentmon_stop'),
      presentmonStats: () => invoke('system_presentmon_stats'),
    },

    updates: {
      check: () => invoke<UpdateCheckResult>('app_check_for_updates'),
    },

    actions: {
      run: (id) => invoke<QuickActionResult>('actions_run', { id }),
    },

    tools: {
      open: (fileName) => invoke<{ ok: boolean; path: string }>('tools_open', { fileName }),
    },
  }
}
