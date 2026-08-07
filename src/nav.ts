import {
  Activity, AppWindow, Boxes, Gamepad2, HardDrive, History, LayoutGrid,
  Package, Rocket, Settings2, Shield, ShieldAlert, SlidersHorizontal, Timer, Trash2, Wifi, type LucideIcon,
} from 'lucide-react'

export type ScreenId =
  | 'dashboard' | 'performance' | 'gaming' | 'cleaner' | 'privacy' | 'startup'
  | 'network' | 'storage' | 'windows' | 'advanced' | 'apps'
  | 'features' | 'restore' | 'settings' | 'optimize'

export type NavItem = {
  id: ScreenId
  label: string
  Icon: LucideIcon
  group: 'main' | 'system' | 'bottom'
  badge?: string
  danger?: boolean
  description: string
}

export const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutGrid, group: 'main', description: 'System overview and quick actions' },
  { id: 'performance', label: 'Performance', Icon: Rocket, group: 'main', badge: '38', description: 'Services, kernel and background tuning' },
  { id: 'gaming', label: 'Gaming', Icon: Gamepad2, group: 'main', description: 'Latency, frame pacing and game profiles' },
  { id: 'cleaner', label: 'Cleaner', Icon: Trash2, group: 'main', badge: '21 GB', description: 'Reclaim space from caches and logs' },
  { id: 'privacy', label: 'Privacy', Icon: Shield, group: 'main', description: 'Telemetry, sensors and app permissions' },
  { id: 'startup', label: 'Startup', Icon: Timer, group: 'main', description: 'Everything that runs at sign-in' },
  { id: 'optimize', label: 'Optimization Center', Icon: SlidersHorizontal, group: 'main', description: 'CPU, GPU, RAM, disk, system and network — organized by area' },

  { id: 'network', label: 'Network', Icon: Wifi, group: 'system', description: 'DNS, TCP stack and adapters' },
  { id: 'storage', label: 'Storage', Icon: HardDrive, group: 'system', description: 'Drives, folders and large files' },
  { id: 'windows', label: 'Windows', Icon: AppWindow, group: 'system', description: 'Shell, taskbar and Explorer behaviour' },
  { id: 'advanced', label: 'Advanced', Icon: ShieldAlert, group: 'system', danger: true, description: 'High-risk changes for experts' },

  { id: 'apps', label: 'Installed Apps', Icon: Package, group: 'bottom', badge: '16', description: 'Manage installed software' },
  { id: 'features', label: 'Features', Icon: Boxes, group: 'bottom', description: 'Optional Windows components' },
  { id: 'restore', label: 'Restore', Icon: History, group: 'bottom', description: 'Restore points, backup and reset' },
  { id: 'settings', label: 'Settings', Icon: Settings2, group: 'bottom', description: 'Appearance, language and updates' },
]

export const GROUP_LABEL: Record<NavItem['group'], string> = {
  main: 'Optimize',
  system: 'System',
  bottom: 'Manage',
}

export const ACTIVITY_ICON = Activity
