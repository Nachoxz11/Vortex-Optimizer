import {
  Activity, AppWindow, Archive, BadgeCheck, Bell, Bluetooth, Boxes, Brush, Bug, Camera,
  Clipboard, Cloud, Container, Cpu, Database, Download, Eye, FileArchive, FileText, Files,
  Fingerprint, Flame, Folder, Gamepad2, Gauge, Globe, HardDrive, History, Image, Info,
  Keyboard, Layers, LayoutGrid, Lock, MapPin, MemoryStick, Mic,
  Monitor as MonitorIcon, MousePointer2, Music, Network, Package, PenTool, Radio, RefreshCw,
  Rocket, Router, Search, Server, Settings2, Share2, Shield, ShieldAlert, Signal, Sparkles,
  Speaker, Terminal, Timer, Trash2, Tv, Usb, User, Video, Wrench, Zap, type LucideIcon,
} from 'lucide-react'

/* ---------------------------------------------------------------------------
 * Every value in this file is fabricated sample data used to dress the UI.
 * No system information is read and no measurement is real.
 * ------------------------------------------------------------------------- */

export type ActivityKind = 'success' | 'warning' | 'danger' | 'info' | 'muted'
export type ActivityItem = {
  id: string
  title: string
  detail: string
  kind: ActivityKind
  minutesAgo: number
}

export type Impact = 'Low' | 'Medium' | 'High'
export type Risk = 'Safe' | 'Moderate' | 'Advanced'

export type Tweak = {
  id: string
  name: string
  description: string
  tooltip: string
  group: string
  impact: Impact
  risk: Risk
  defaultOn?: boolean
  requiresRestart?: boolean
  Icon: LucideIcon
}

/* -- System summary --------------------------------------------------------- */
export const SYSTEM = {
  device: 'AURORA-DESK',
  user: 'dario',
  userProfile: 'C:\\Users\\dario',
  edition: 'Windows 11 Pro',
  version: '24H2',
  build: '26100.3624',
  install: 'March 12, 2026',
  cpu: 'AMD Ryzen 7 7800X3D',
  cpuDetail: '8C / 16T · 4.2 GHz base · 5.0 GHz boost',
  gpu: 'NVIDIA GeForce RTX 4070 Ti',
  gpuDetail: '12 GB GDDR6X · Driver 566.14',
  ram: '32 GB DDR5',
  ramDetail: '2 × 16 GB · 6000 MT/s · CL30',
  board: 'ASUS TUF B650-PLUS',
  disk: 'Samsung 990 PRO 2 TB',
  uptime: '3 d 07 h 42 m',
  health: 86,
}

export const HEALTH_FACTORS = [
  { label: 'Startup load', score: 72, note: '14 apps run at sign-in' },
  { label: 'Storage headroom', score: 63, note: '740 GB free of 2 TB' },
  { label: 'Privacy posture', score: 91, note: '22 of 28 switches hardened' },
  { label: 'Update status', score: 96, note: 'Up to date · checked today' },
  { label: 'Background services', score: 78, note: '9 optional services active' },
]

export const ACTIVITY_SEED: ActivityItem[] = [
  { id: 's1', title: 'Temporary files cleared', detail: '4.82 GB reclaimed across 12 locations', kind: 'success', minutesAgo: 6 },
  { id: 's2', title: 'Game Mode profile applied', detail: 'Latency profile switched to Competitive', kind: 'info', minutesAgo: 34 },
  { id: 's3', title: 'Restore point created', detail: 'Vortex-Optimizer — before privacy batch', kind: 'success', minutesAgo: 51 },
  { id: 's4', title: 'Telemetry services disabled', detail: '6 scheduled tasks turned off', kind: 'success', minutesAgo: 96 },
  { id: 's5', title: 'Storage scan finished', detail: '38 214 files inspected in 41 s', kind: 'muted', minutesAgo: 180 },
  { id: 's6', title: 'Network adapter tuned', detail: 'Nagle disabled · RSS enabled', kind: 'info', minutesAgo: 320 },
  { id: 's7', title: 'Pending reboot detected', detail: '3 tweaks apply after restart', kind: 'warning', minutesAgo: 400 },
]

/* -- Quick actions ---------------------------------------------------------- */
export const QUICK_ACTIONS = [
  { id: 'optimize', label: 'Optimize', hint: 'Apply the recommended profile', Icon: Rocket, tone: 'accent' },
  { id: 'repair', label: 'Repair', hint: 'Run integrity checks', Icon: Wrench, tone: 'info' },
  { id: 'game', label: 'Game Mode', hint: 'Free resources for play', Icon: Gamepad2, tone: 'violet' },
  { id: 'explorer', label: 'Restart Explorer', hint: 'Reload the shell', Icon: RefreshCw, tone: 'teal' },
  { id: 'dns', label: 'Flush DNS', hint: 'Reset the resolver cache', Icon: Globe, tone: 'info' },
  { id: 'temp', label: 'Clear Temp', hint: 'Remove scratch files', Icon: Trash2, tone: 'amber' },
  { id: 'ultimate', label: 'Ultimate Performance', hint: 'Unlock the hidden plan', Icon: Zap, tone: 'amber' },
  { id: 'scan', label: 'Scan', hint: 'Full system inspection', Icon: Search, tone: 'success' },
] as const

/* -- Performance ------------------------------------------------------------ */
export const PERFORMANCE_TWEAKS: Tweak[] = [
  { id: 'p.telemetry', name: 'Disable Telemetry', description: 'Stops the diagnostic data pipeline and its collector tasks.', tooltip: 'Turns off DiagTrack and selected Windows telemetry tasks.', group: 'System services', impact: 'High', risk: 'Moderate', requiresRestart: true, Icon: Radio },
  { id: 'p.sysmain', name: 'Disable SysMain', description: 'Ends the prefetch service that pre-loads apps into memory.', tooltip: 'Useful on NVMe drives where prefetch adds little.', group: 'System services', impact: 'Medium', risk: 'Moderate', requiresRestart: true, Icon: Layers },
  { id: 'p.search', name: 'Windows Search indexing', description: 'Stops background indexing of drives and mailboxes.', tooltip: 'Search still works, results simply arrive slower.', group: 'System services', impact: 'Medium', risk: 'Moderate', requiresRestart: true, Icon: Search },
  { id: 'p.printspool', name: 'Print Spooler', description: 'Disables the spooler when no printer is attached.', tooltip: 'Leave enabled if you print or use PDF printers.', group: 'System services', impact: 'Low', risk: 'Moderate', requiresRestart: true, Icon: FileText },
  { id: 'p.fax', name: 'Fax service', description: 'Removes the legacy fax stack from the boot chain.', tooltip: 'Almost never needed on a modern desktop.', group: 'System services', impact: 'Low', risk: 'Safe', requiresRestart: true, Icon: Server },
  { id: 'p.remote', name: 'Remote Registry', description: 'Blocks registry access from other machines.', tooltip: 'Recommended on home networks.', group: 'System services', impact: 'Low', risk: 'Safe', requiresRestart: true, Icon: Lock },
  { id: 'p.wsearchweb', name: 'Web results in Search', description: 'Keeps the Start menu search local.', tooltip: 'Removes Bing suggestions from the Start menu.', group: 'Shell', impact: 'Medium', risk: 'Safe', defaultOn: false, Icon: Globe },
  { id: 'p.animations', name: 'Reduce shell animations', description: 'Trims window and menu motion for a snappier feel.', tooltip: 'Visual only — no performance guarantee.', group: 'Shell', impact: 'Medium', risk: 'Safe', requiresRestart: true, Icon: Sparkles },
  { id: 'p.transparency', name: 'Disable transparency effects', description: 'Turns off acrylic in the taskbar and Start.', tooltip: 'Helps on integrated graphics.', group: 'Shell', impact: 'Low', risk: 'Safe', Icon: Layers },
  { id: 'p.thumbnails', name: 'Thumbnail cache limit', description: 'Caps the shell thumbnail database size.', tooltip: 'Keeps Explorer responsive in huge folders.', group: 'Shell', impact: 'Low', risk: 'Safe', Icon: Image },
  { id: 'p.menushow', name: 'Menu show delay: 0 ms', description: 'Removes the delay before cascading menus open.', tooltip: 'Classic responsiveness tweak.', group: 'Shell', impact: 'Low', risk: 'Safe', defaultOn: false, Icon: Timer },
  { id: 'p.hibernate', name: 'Disable hibernation', description: 'Frees the hiberfil.sys reserve on the system drive.', tooltip: 'Reclaims roughly the size of installed RAM.', group: 'Power', impact: 'High', risk: 'Moderate', requiresRestart: true, Icon: Archive },
  { id: 'p.faststartup', name: 'Fast Startup', description: 'Controls the hybrid shutdown behaviour.', tooltip: 'Disable it if dual booting.', group: 'Power', impact: 'Medium', risk: 'Moderate', requiresRestart: true, Icon: Zap },
  { id: 'p.usbsuspend', name: 'USB selective suspend', description: 'Stops Windows parking idle USB devices.', tooltip: 'Fixes stuttering mice and audio interfaces.', group: 'Power', impact: 'Medium', risk: 'Safe', defaultOn: false, Icon: Usb },
  { id: 'p.pciexpress', name: 'PCIe link state power', description: 'Locks PCIe links at maximum performance.', tooltip: 'Slightly higher idle draw.', group: 'Power', impact: 'Medium', risk: 'Moderate', Icon: Cpu },
  { id: 'p.corepark', name: 'Disable core parking', description: 'Keeps every physical core available at all times.', tooltip: 'Reduces scheduler latency spikes.', group: 'Power', impact: 'High', risk: 'Moderate', requiresRestart: true, Icon: Cpu },
  { id: 'p.throttling', name: 'Power throttling', description: 'Stops background apps being clocked down.', tooltip: 'Laptops will lose some battery life.', group: 'Power', impact: 'Medium', risk: 'Moderate', Icon: Gauge },
  { id: 'p.timer', name: 'High precision event timer', description: 'Adjusts the platform clock source.', tooltip: 'Advanced — revert if the system stutters.', group: 'Kernel', impact: 'High', risk: 'Advanced', requiresRestart: true, Icon: Timer },
  { id: 'p.mitigations', name: 'Relax CPU mitigations', description: 'Loosens speculative execution guards.', tooltip: 'Trades hardening for throughput. Advanced.', group: 'Kernel', impact: 'High', risk: 'Advanced', requiresRestart: true, Icon: ShieldAlert },
  { id: 'p.prio', name: 'Foreground priority boost', description: 'Gives the focused window a larger quantum.', tooltip: 'Improves perceived responsiveness.', group: 'Kernel', impact: 'Medium', risk: 'Safe', requiresRestart: true, Icon: AppWindow },
  { id: 'p.paging', name: 'Clear page file at shutdown', description: 'Wipes virtual memory when powering down.', tooltip: 'Slower shutdowns, cleaner memory.', group: 'Kernel', impact: 'Low', risk: 'Moderate', requiresRestart: true, Icon: MemoryStick },
  { id: 'p.largesys', name: 'Large system cache', description: 'Biases the memory manager toward file caching.', tooltip: 'Only helps servers and heavy file work.', group: 'Kernel', impact: 'Medium', risk: 'Advanced', Icon: Database },
  { id: 'p.ndu', name: 'Network Data Usage driver', description: 'Removes the per-app bandwidth meter driver.', tooltip: 'Frees a small amount of non-paged pool.', group: 'Kernel', impact: 'Low', risk: 'Moderate', Icon: Network },
  { id: 'p.superfetchgame', name: 'Game DVR background capture', description: 'Stops the rolling capture buffer.', tooltip: 'Frees GPU encode headroom.', group: 'Background', impact: 'High', risk: 'Safe', defaultOn: false, requiresRestart: true, Icon: Video },
  { id: 'p.bgapps', name: 'Background apps', description: 'Prevents store apps from running while closed.', tooltip: 'Notifications from those apps stop too.', group: 'Background', impact: 'High', risk: 'Moderate', Icon: Boxes },
  { id: 'p.onedrive', name: 'OneDrive auto-start', description: 'Keeps the sync client out of sign-in.', tooltip: 'Files stay in place; sync is manual.', group: 'Background', impact: 'Medium', risk: 'Safe', Icon: Cloud },
  { id: 'p.edgepreload', name: 'Edge preloading', description: 'Stops the browser warming itself at boot.', tooltip: 'Edge simply opens a moment slower.', group: 'Background', impact: 'Medium', risk: 'Safe', defaultOn: false, Icon: Globe },
  { id: 'p.tips', name: 'Tips, tricks and suggestions', description: 'Silences the suggestion engine everywhere.', tooltip: 'Removes Start and lock-screen promos.', group: 'Background', impact: 'Low', risk: 'Safe', Icon: Info },
  { id: 'p.autoupdatestore', name: 'Store app auto-update', description: 'Puts store updates under manual control.', tooltip: 'Remember to update periodically.', group: 'Background', impact: 'Medium', risk: 'Moderate', Icon: Package },
  { id: 'p.deliveryopt', name: 'Delivery Optimization', description: 'Stops peer-to-peer sharing of update data.', tooltip: 'Saves upstream bandwidth.', group: 'Background', impact: 'Medium', risk: 'Safe', defaultOn: false, Icon: Share2 },
  { id: 'p.defenderscan', name: 'Idle Defender scans', description: 'Limits scheduled scans to manual runs.', tooltip: 'Real-time protection is untouched.', group: 'Background', impact: 'Medium', risk: 'Moderate', Icon: Shield },
  { id: 'p.errorreport', name: 'Windows Error Reporting', description: 'Stops crash dumps being uploaded.', tooltip: 'Local dumps are still written.', group: 'Background', impact: 'Low', risk: 'Safe', defaultOn: false, Icon: Bug },
  { id: 'p.trim', name: 'Aggressive SSD TRIM', description: 'Schedules TRIM more often than default.', tooltip: 'Keeps sustained write speed high.', group: 'Storage', impact: 'Medium', risk: 'Safe', Icon: HardDrive },
  { id: 'p.lastaccess', name: 'Last-access timestamps', description: 'Stops NTFS writing an access time per read.', tooltip: 'Small but free I/O saving.', group: 'Storage', impact: 'Low', risk: 'Safe', defaultOn: false, Icon: FileArchive },
  { id: 'p.8dot3', name: 'Legacy 8.3 filenames', description: 'Disables short-name generation on new volumes.', tooltip: 'Very old software may need it.', group: 'Storage', impact: 'Low', risk: 'Advanced', Icon: Files },
  { id: 'p.restore', name: 'System Restore checkpoints', description: 'Controls automatic checkpoint creation.', tooltip: 'Vortex-Optimizer recommends leaving this on.', group: 'Storage', impact: 'Medium', risk: 'Moderate', Icon: History },
  { id: 'p.compact', name: 'CompactOS compression', description: 'Compresses system binaries on disk.', tooltip: 'Trades a little CPU for several GB.', group: 'Storage', impact: 'Medium', risk: 'Moderate', Icon: FileArchive },
  { id: 'p.reserved', name: 'Reserved storage', description: 'Releases the space held back for updates.', tooltip: 'Updates may need a temporary download later.', group: 'Storage', impact: 'High', risk: 'Moderate', requiresRestart: true, Icon: Database },
  { id: 'p.mouseaccel', name: 'Disable mouse acceleration', description: 'Removes "Enhance pointer precision" for a flat 1:1 curve.', tooltip: 'Popular for gaming and precision work.', group: 'Shell', impact: 'Low', risk: 'Safe', Icon: MousePointer2 },
  { id: 'p.stickykeys', name: 'Disable Sticky Keys prompt', description: 'Stops the popup triggered by pressing Shift five times.', tooltip: 'Purely a shell annoyance fix.', group: 'Shell', impact: 'Low', risk: 'Safe', Icon: Keyboard },
  { id: 'p.longpaths', name: 'Enable long path support', description: 'Lifts the 260-character path limit for apps that opt in.', tooltip: 'Helps Git, Node.js and deep build trees.', group: 'Storage', impact: 'Low', risk: 'Safe', Icon: Files },
  { id: 'p.gpuschedule', name: 'Hardware-accelerated GPU scheduling', description: 'Lets the GPU manage its own memory queue instead of the CPU.', tooltip: 'Can cause issues on some older GPU drivers.', group: 'Kernel', impact: 'Medium', risk: 'Moderate', requiresRestart: true, Icon: Gauge },
  { id: 'p.storagesense', name: 'Disable Storage Sense automatic cleanup', description: 'Stops Storage Sense from automatically freeing up space on a schedule.', tooltip: 'You can still run cleanup manually from the Cleaner screen.', group: 'Storage', impact: 'Medium', risk: 'Safe', requiresRestart: true, Icon: Trash2 },
]

/* -- Gaming ----------------------------------------------------------------- */
/** Only tweaks with a real registry-backed implementation (see SYSTEM_TWEAK_IDS) — no mockup cards. */
export const GAMING_CARDS = [
  { id: 'g.mode', name: 'Game Mode', description: 'Prioritises the foreground game and pauses background work.', badge: 'Recommended', Icon: Gamepad2, defaultOn: false },
  { id: 'g.hags', name: 'GPU Scheduling', description: 'Hardware-accelerated scheduling moves queue management to the GPU.', badge: 'Restart', Icon: Cpu, defaultOn: false },
  { id: 'g.mouse', name: 'Mouse Optimization', description: 'Removes pointer acceleration and applies a raw 1:1 curve.', badge: 'Precision', Icon: MousePointer2, defaultOn: false },
  { id: 'g.priority', name: 'Task Priority Boost', description: 'Raises the GPU and CPU scheduling priority Windows grants to foreground games.', badge: 'Recommended', Icon: Rocket, defaultOn: false },
]

export const GAME_LIBRARY = [
  { name: 'Nebula Drift', profile: 'Competitive', fps: 244, res: '2560×1440', hours: 128, Icon: Rocket },
  { name: 'Ironhold Siege', profile: 'Balanced', fps: 165, res: '3840×2160', hours: 74, Icon: Shield },
  { name: 'Velocity Circuit', profile: 'Quality', fps: 118, res: '3840×2160', hours: 39, Icon: Gauge },
  { name: 'Hollow Signal', profile: 'Competitive', fps: 301, res: '1920×1080', hours: 212, Icon: Signal },
  { name: 'Sable Harbour', profile: 'Balanced', fps: 142, res: '2560×1440', hours: 18, Icon: Boxes },
]

/* -- Cleaner ---------------------------------------------------------------- */
export const CLEANER_CATEGORIES = [
  { id: 'c.temp', name: 'Temporary files', detail: 'User and system scratch folders', size: 4.82, files: 18422, color: 'var(--accent)', Icon: Trash2, defaultOn: false },
  { id: 'c.logs', name: 'Logs and dumps', detail: 'CBS, DISM, crash and setup logs', size: 1.34, files: 2140, color: 'var(--brand-a)', Icon: FileText, defaultOn: false },
  { id: 'c.cache', name: 'Application cache', detail: 'Browsers, launchers and Electron apps', size: 6.27, files: 51280, color: 'var(--brand-b)', Icon: Database, defaultOn: false },
  { id: 'c.update', name: 'Windows Update cache', detail: 'Downloaded packages already installed', size: 3.91, files: 640, color: 'var(--info)', Icon: Download, defaultOn: false },
  { id: 'c.bin', name: 'Recycle Bin', detail: 'Items deleted more than 7 days ago', size: 2.16, files: 318, color: 'var(--warning)', Icon: Trash2, defaultOn: false },
  { id: 'c.thumbs', name: 'Thumbnails', detail: 'Explorer preview database', size: 0.74, files: 9812, color: 'var(--success)', Icon: Image, defaultOn: false },
  { id: 'c.delivery', name: 'Delivery Optimization', detail: 'Peer-shared update fragments', size: 1.58, files: 96, color: 'var(--danger)', Icon: Share2, defaultOn: false },
  { id: 'c.prefetch', name: 'Prefetch data', detail: 'Application launch traces', size: 0.42, files: 1206, color: 'var(--accent-hi)', Icon: Timer, defaultOn: false },
]

/* -- Privacy ---------------------------------------------------------------- */
export type PrivacyGroup = { id: string; title: string; description: string; Icon: LucideIcon; items: Tweak[] }

const pv = (
  id: string, name: string, description: string, tooltip: string, group: string,
  impact: Impact, risk: Risk, Icon: LucideIcon, defaultOn = false,
): Tweak => ({ id, name, description, tooltip, group, impact, risk, Icon, defaultOn })

export const PRIVACY_GROUPS: PrivacyGroup[] = [
  {
    id: 'windows', title: 'Windows', description: 'Platform-wide identifiers and diagnostics', Icon: Settings2,
    items: [
      pv('pr.diag', 'Diagnostic data', 'Reduce the collection level to the required minimum.', 'Sets the diagnostic level to Security in this preview.', 'Windows', 'High', 'Safe', Radio, true),
      pv('pr.tailored', 'Tailored experiences', 'Stop personalising tips from diagnostic data.', 'Removes personalised prompts across the shell.', 'Windows', 'Medium', 'Safe', Sparkles, true),
      pv('pr.inking', 'Inking and typing data', 'Keep handwriting and typing samples local.', 'Custom dictionaries stay on the device.', 'Windows', 'Medium', 'Safe', PenTool, true),
      pv('pr.advertising', 'Advertising ID', 'Reset and disable the cross-app advertising identifier.', 'Apps get a null identifier instead.', 'Windows', 'High', 'Safe', BadgeCheck, true),
      pv('pr.activity', 'Activity history', 'Stop recording and uploading the timeline.', 'Local history is cleared as well.', 'Windows', 'Medium', 'Safe', History, true),
      pv('pr.feedback', 'Feedback frequency', 'Never ask for feedback about Windows.', 'Silences the Feedback Hub prompts.', 'Windows', 'Low', 'Safe', Bell, true),
      pv('pr.speech', 'Online speech recognition', 'Use local recognition only.', 'Voice typing falls back to the offline model.', 'Windows', 'Medium', 'Safe', Mic, true),
    ],
  },
  {
    id: 'apps', title: 'Apps', description: 'What installed applications may reach', Icon: Boxes,
    items: [
      pv('pr.appdiag', 'App diagnostics', 'Block apps from reading other processes.', 'Blocks the diagnostic capability for store apps.', 'Apps', 'Medium', 'Safe', Bug, true),
      pv('pr.notif', 'Notification access', 'Stop apps reading your notification stream.', 'Some companion apps stop syncing.', 'Apps', 'Medium', 'Moderate', Bell, true),
      pv('pr.account', 'Account information', 'Hide your name, picture and account details.', 'Store apps see an anonymous profile.', 'Apps', 'Medium', 'Safe', User, true),
      pv('pr.contacts', 'Contacts', 'Deny access to the People store.', 'Mail and Teams may ask again.', 'Apps', 'Medium', 'Moderate', User, false),
      pv('pr.docs', 'Documents and pictures', 'Restrict broad file-system libraries.', 'Apps must use the file picker instead.', 'Apps', 'High', 'Moderate', Folder, false),
      pv('pr.background', 'Background access', 'Prevent apps running while closed.', 'Mirrors the performance switch of the same name.', 'Apps', 'High', 'Safe', Boxes, true),
    ],
  },
  {
    id: 'microsoft', title: 'Microsoft', description: 'First-party service integration', Icon: Cloud,
    items: [
      pv('pr.cortana', 'Cortana and voice assistant', 'Remove the assistant from search and hotkeys.', 'The search box becomes local-only.', 'Microsoft', 'Medium', 'Safe', Mic, true),
      pv('pr.cloudsearch', 'Cloud content search', 'Stop querying OneDrive and work accounts.', 'Search stays on this device.', 'Microsoft', 'Medium', 'Safe', Cloud, true),
      pv('pr.edge', 'Disable Edge sidebar', 'Turn off the optional Edge sidebar through policy.', 'Edge stays installed and usable.', 'Microsoft', 'Low', 'Safe', Globe, true),
      pv('pr.copilot', 'Disable Copilot', 'Disable Windows Copilot through a reversible policy.', 'Copilot is disabled but not uninstalled.', 'Microsoft', 'High', 'Moderate', Sparkles, true),
      pv('pr.onedrivesync', 'OneDrive personal sync', 'Detach the personal cloud folder.', 'Business accounts are unaffected.', 'Microsoft', 'Medium', 'Moderate', Cloud, false),
      pv('pr.store', 'Store personalisation', 'Disable personalized Windows content recommendations.', 'The Store still works normally.', 'Microsoft', 'Low', 'Safe', Package, true),
      pv('pr.widgets', 'Disable Widgets feed service', 'Block the Widgets news and interests feed entirely, not just the taskbar icon.', 'Removes the feed content, not only its shortcut.', 'Microsoft', 'Low', 'Safe', LayoutGrid, false),
    ],
  },
  {
    id: 'telemetry', title: 'Telemetry', description: 'Collectors, tasks and upload endpoints', Icon: Radio,
    items: [
      pv('pr.diagtrack', 'Connected User Experiences', 'Disable the primary telemetry service.', 'Also stops its scheduled maintenance tasks.', 'Telemetry', 'High', 'Moderate', Radio, true),
      pv('pr.ceip', 'Customer Experience program', 'Leave the improvement program.', 'Removes four scheduled tasks.', 'Telemetry', 'Medium', 'Safe', Activity, true),
      pv('pr.dmclient', 'DMClient tasks', 'Stop the device-management uploaders.', 'Enterprise devices should keep this on.', 'Telemetry', 'Medium', 'Advanced', Server, true),
      pv('pr.compat', 'Application compatibility telemetry', 'Stop the appraiser inventory.', 'Upgrade readiness reports stop.', 'Telemetry', 'Medium', 'Moderate', Container, true),
      pv('pr.wer', 'Error report upload', 'Keep crash dumps on the device.', 'Local troubleshooting still works.', 'Telemetry', 'Low', 'Safe', Bug, true),
    ],
  },
  {
    id: 'sensors', title: 'Sensors and devices', description: 'Hardware capability gates', Icon: Camera,
    items: [
      pv('pr.location', 'Location service', 'Disable positioning for the whole device.', 'Weather and Maps will ask you to type a city.', 'Sensors', 'High', 'Moderate', MapPin, true),
      pv('pr.locationhist', 'Location history', 'Clear and stop the local position log.', 'Only affects the simulated log.', 'Sensors', 'Medium', 'Safe', MapPin, true),
      pv('pr.mic', 'Microphone access', 'Gate microphone use behind an explicit prompt.', 'Desktop apps are listed separately.', 'Sensors', 'High', 'Moderate', Mic, false),
      pv('pr.camera', 'Camera access', 'Gate camera use behind an explicit prompt.', 'Windows Hello keeps working.', 'Sensors', 'High', 'Moderate', Camera, false),
      pv('pr.clipboard', 'Clipboard history and sync', 'Keep the clipboard local and transient.', 'Win+V history is emptied.', 'Sensors', 'Medium', 'Safe', Clipboard, true),
      pv('pr.bluetooth', 'Bluetooth device discovery', 'Stop advertising this PC to nearby devices.', 'Paired devices still connect.', 'Sensors', 'Low', 'Safe', Bluetooth, true),
      pv('pr.radios', 'Radio control by apps', 'Stop apps toggling Wi-Fi and Bluetooth.', 'You keep manual control.', 'Sensors', 'Low', 'Safe', Signal, true),
      pv('pr.biometrics', 'Biometric data sharing', 'Keep Hello templates strictly on-device.', 'Templates never leave the TPM.', 'Sensors', 'High', 'Safe', Fingerprint, true),
    ],
  },
]

/* -- Startup ---------------------------------------------------------------- */
export const STARTUP_ITEMS = [
  { id: 'st1', name: 'Steam Client Bootstrapper', publisher: 'Valve Corporation', impact: 'High' as Impact, status: 'Enabled', delay: '4.2 s', type: 'Registry', defaultOn: false, Icon: Gamepad2 },
  { id: 'st2', name: 'NVIDIA App Container', publisher: 'NVIDIA Corporation', impact: 'Medium' as Impact, status: 'Enabled', delay: '1.8 s', type: 'Service', defaultOn: false, Icon: Cpu },
  { id: 'st3', name: 'Microsoft OneDrive', publisher: 'Microsoft Corporation', impact: 'High' as Impact, status: 'Enabled', delay: '3.6 s', type: 'Registry', defaultOn: false, Icon: Cloud },
  { id: 'st4', name: 'Discord', publisher: 'Discord Inc.', impact: 'High' as Impact, status: 'Enabled', delay: '5.1 s', type: 'Startup folder', defaultOn: false, Icon: Speaker },
  { id: 'st5', name: 'Spotify', publisher: 'Spotify AB', impact: 'Medium' as Impact, status: 'Disabled', delay: '2.4 s', type: 'Registry', defaultOn: false, Icon: Music },
  { id: 'st6', name: 'Adobe Creative Cloud', publisher: 'Adobe Inc.', impact: 'High' as Impact, status: 'Enabled', delay: '6.8 s', type: 'Service', defaultOn: false, Icon: Brush },
  { id: 'st7', name: 'Logi Options+', publisher: 'Logitech', impact: 'Low' as Impact, status: 'Enabled', delay: '0.9 s', type: 'Registry', defaultOn: false, Icon: MousePointer2 },
  { id: 'st8', name: 'Windows Security notification', publisher: 'Microsoft Corporation', impact: 'Low' as Impact, status: 'Enabled', delay: '0.4 s', type: 'Registry', defaultOn: false, Icon: Shield },
  { id: 'st9', name: 'Epic Games Launcher', publisher: 'Epic Games, Inc.', impact: 'Medium' as Impact, status: 'Disabled', delay: '3.1 s', type: 'Registry', defaultOn: false, Icon: Gamepad2 },
  { id: 'st10', name: 'Docker Desktop', publisher: 'Docker Inc.', impact: 'High' as Impact, status: 'Enabled', delay: '7.4 s', type: 'Startup folder', defaultOn: false, Icon: Container },
  { id: 'st11', name: 'Realtek Audio Console', publisher: 'Realtek Semiconductor', impact: 'Low' as Impact, status: 'Enabled', delay: '0.7 s', type: 'Task', defaultOn: false, Icon: Speaker },
  { id: 'st12', name: 'ASUS Armoury Crate', publisher: 'ASUSTeK Computer', impact: 'High' as Impact, status: 'Enabled', delay: '5.9 s', type: 'Service', defaultOn: false, Icon: Flame },
  { id: 'st13', name: 'Elgato Stream Deck', publisher: 'Corsair', impact: 'Medium' as Impact, status: 'Disabled', delay: '2.2 s', type: 'Registry', defaultOn: false, Icon: Keyboard },
  { id: 'st14', name: 'Microsoft Teams (work)', publisher: 'Microsoft Corporation', impact: 'High' as Impact, status: 'Enabled', delay: '4.7 s', type: 'Registry', defaultOn: false, Icon: Share2 },
]

/* -- Network ---------------------------------------------------------------- */
export const DNS_PRESETS = [
  { id: 'auto', name: 'Automatic (DHCP)', primary: '192.168.1.1', secondary: '—', latency: 18 },
  { id: 'cf', name: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1', latency: 9 },
  { id: 'google', name: 'Google Public DNS', primary: '8.8.8.8', secondary: '8.8.4.4', latency: 12 },
  { id: 'quad9', name: 'Quad9 (filtered)', primary: '9.9.9.9', secondary: '149.112.112.112', latency: 14 },
  { id: 'adguard', name: 'AdGuard DNS', primary: '94.140.14.14', secondary: '94.140.15.15', latency: 21 },
]

export const NETWORK_TWEAKS = [
  { id: 'n.nagle', name: 'Disable Nagle algorithm', description: 'Sends small packets immediately instead of coalescing them.', Icon: Zap, defaultOn: false },
  { id: 'n.autotune', name: 'TCP window auto-tuning', description: 'Lets Windows scale the receive window dynamically.', Icon: Activity, defaultOn: false },
  { id: 'n.rss', name: 'Receive Side Scaling', description: 'Spreads NIC interrupts across multiple cores.', Icon: Cpu, defaultOn: false },
  { id: 'n.ecn', name: 'Explicit Congestion Notification', description: 'Signals congestion without dropping packets.', Icon: Signal, defaultOn: false },
  { id: 'n.qos', name: 'QoS packet scheduler reserve', description: 'Releases the bandwidth Windows holds back.', Icon: Router, defaultOn: false },
  { id: 'n.ipv6', name: 'Disable IPv6 stack', description: 'Disables IPv6 on all adapters and tunnel interfaces, falling back to IPv4-only routing.', Icon: Globe, defaultOn: false, requiresRestart: true },
  { id: 'n.netbios', name: 'NetBIOS over TCP/IP', description: 'Legacy name resolution, safe to retire.', Icon: Server, defaultOn: false },
  { id: 'n.llmnr', name: 'LLMNR and mDNS', description: 'Local name broadcasts used by discovery tools.', Icon: Search, defaultOn: false },
  { id: 'n.throttle', name: 'Multimedia network throttling', description: 'Removes the 10 packet/ms media cap.', Icon: Music, defaultOn: false, requiresRestart: true },
  { id: 'n.dnscache', name: 'Aggressive DNS caching', description: 'Extends the resolver TTL floor.', Icon: Database, defaultOn: false },
]

export const NETWORK_ADAPTERS = [
  { name: 'Intel I225-V 2.5 GbE', type: 'Ethernet', status: 'Connected', speed: '2.5 Gbps', ip: '192.168.1.42', mac: 'A8:5E:45:2C:91:07', primary: true },
  { name: 'Intel Wi-Fi 6E AX211', type: 'Wireless', status: 'Standby', speed: '1.2 Gbps', ip: '—', mac: '3C:21:9C:04:B8:1E', primary: false },
  { name: 'Hyper-V Virtual Switch', type: 'Virtual', status: 'Idle', speed: '10 Gbps', ip: '172.24.16.1', mac: '00:15:5D:38:20:04', primary: false },
]

/* -- Storage ---------------------------------------------------------------- */
export const DRIVES = [
  { letter: 'C:', label: 'System', model: 'Samsung 990 PRO 2 TB', total: 1863, used: 1123, type: 'NVMe' },
  { letter: 'D:', label: 'Games', model: 'WD Black SN850X 4 TB', total: 3726, used: 2410, type: 'NVMe' },
  { letter: 'E:', label: 'Archive', model: 'Seagate IronWolf 8 TB', total: 7452, used: 2988, type: 'HDD' },
]

export const STORAGE_BREAKDOWN = [
  { id: 'games', name: 'Games', size: 612, color: 'var(--accent)', Icon: Gamepad2, path: 'D:\\SteamLibrary' },
  { id: 'apps', name: 'Apps and programs', size: 214, color: 'var(--brand-a)', Icon: Package, path: 'C:\\Program Files' },
  { id: 'system', name: 'System and reserved', size: 98, color: 'var(--brand-b)', Icon: Settings2, path: 'C:\\Windows' },
  { id: 'downloads', name: 'Downloads', size: 76, color: 'var(--info)', Icon: Download, path: 'C:\\Users\\dario\\Downloads' },
  { id: 'documents', name: 'Documents', size: 42, color: 'var(--success)', Icon: FileText, path: 'C:\\Users\\dario\\Documents' },
  { id: 'media', name: 'Pictures and video', size: 38, color: 'var(--warning)', Icon: Image, path: 'C:\\Users\\dario\\Pictures' },
  { id: 'desktop', name: 'Desktop', size: 21, color: 'var(--danger)', Icon: MonitorIcon, path: 'C:\\Users\\dario\\Desktop' },
  { id: 'temp', name: 'Temporary', size: 22, color: 'var(--accent-hi)', Icon: Trash2, path: 'C:\\Windows\\Temp' },
]

export const LARGE_FILES = [
  { name: 'nebula_drift_pak0.vpk', size: 84.2, path: 'D:\\SteamLibrary\\common\\NebulaDrift', days: 12 },
  { name: 'backup_2026-05-02.vhdx', size: 62.8, path: 'E:\\Backups', days: 90 },
  { name: 'render_master_4k.mov', size: 41.5, path: 'C:\\Users\\dario\\Videos', days: 34 },
  { name: 'win11_24h2_x64.iso', size: 6.4, path: 'C:\\Users\\dario\\Downloads', days: 148 },
  { name: 'unreal_ddc_cache.bin', size: 18.9, path: 'C:\\Users\\dario\\AppData\\Local', days: 5 },
]

/* -- Windows shell ---------------------------------------------------------- */
export const WINDOWS_SECTIONS = [
  {
    id: 'taskbar', title: 'Taskbar', Icon: LayoutGrid,
    items: [
      { id: 'w.tb.align', name: 'Left-align the taskbar', description: 'Move icons back to the classic corner position.', defaultOn: false },
      { id: 'w.tb.size', name: 'Compact taskbar height', description: 'Use the smaller icon layout.', defaultOn: false },
      { id: 'w.tb.chat', name: 'Hide Chat button', description: 'Remove the Teams entry point.', defaultOn: false },
      { id: 'w.tb.taskview', name: 'Hide Task View button', description: 'Keep Win+Tab, drop the icon.', defaultOn: false },
      { id: 'w.tb.combine', name: 'Never combine buttons', description: 'Show a labelled button per window.', defaultOn: false, requiresRestart: true },
      { id: 'w.tb.seconds', name: 'Seconds in the clock', description: 'Display a full HH:MM:SS clock.', defaultOn: false, requiresRestart: true },
      { id: 'w.tb.endtask', name: 'End Task from taskbar', description: 'Right-click a taskbar app to end it, like Task Manager.', defaultOn: false },
    ],
  },
  {
    id: 'explorer', title: 'File Explorer', Icon: Folder,
    items: [
      { id: 'w.ex.ext', name: 'Show file extensions', description: 'Always reveal the full file name.', defaultOn: false },
      { id: 'w.ex.hidden', name: 'Show hidden items', description: 'Include hidden files and folders.', defaultOn: false },
      { id: 'w.ex.thispc', name: 'Open to This PC', description: 'Skip Home and land on the drive list.', defaultOn: false },
      { id: 'w.ex.compact', name: 'Compact view', description: 'Tighter row spacing in list views.', defaultOn: false, requiresRestart: true },
      { id: 'w.ex.gallery', name: 'Hide Gallery', description: 'Remove the Gallery node from the sidebar.', defaultOn: false },
      { id: 'w.ex.homeads', name: 'Hide Home recommendations', description: 'Drop the suggested-files panel.', defaultOn: false, requiresRestart: true },
      { id: 'w.ex.fullpath', name: 'Full path in title bar', description: 'Shows the complete folder path while browsing.', defaultOn: false },
      { id: 'w.ex.desktopicons', name: 'Classic desktop icons', description: 'This PC, Recycle Bin, Control Panel and Network on the desktop.', defaultOn: false },
    ],
  },
  {
    id: 'context', title: 'Context menu', Icon: MousePointer2,
    items: [
      { id: 'w.cx.classic', name: 'Classic context menu', description: 'Restore the full right-click menu.', defaultOn: false, requiresRestart: true },
      { id: 'w.cx.share', name: 'Hide Share entry', description: 'Remove the Windows share sheet.', defaultOn: false },
      { id: 'w.cx.copilot', name: 'Hide Ask Copilot', description: 'Remove the assistant shortcut.', defaultOn: false },
      { id: 'w.cx.terminal', name: 'Open in Terminal', description: 'Keep the developer shortcut visible.', defaultOn: false },
    ],
  },
  {
    id: 'search', title: 'Search, Widgets and Copilot', Icon: Search,
    items: [
      { id: 'w.sr.box', name: 'Search box style: icon only', description: 'Shrink search to a single button.', defaultOn: false },
      { id: 'w.sr.highlight', name: 'Disable search highlights', description: 'Remove daily illustrations inside search.', defaultOn: false, requiresRestart: true },
      { id: 'w.wd.widgets', name: 'Widgets board', description: 'The news and weather flyout.', defaultOn: false },
      { id: 'w.wd.feed', name: 'Widgets news feed', description: 'Content recommendations inside widgets.', defaultOn: false },
      { id: 'w.cp.copilot', name: 'Hide Copilot button', description: 'Remove the assistant entry point from the taskbar.', defaultOn: false, requiresRestart: true },
      { id: 'w.cp.key', name: 'Copilot key remap', description: 'Send the dedicated key elsewhere.', defaultOn: false },
    ],
  },
  {
    id: 'system', title: 'Notifications, Snap and Lock screen', Icon: Bell,
    items: [
      { id: 'w.nt.center', name: 'Notification centre badges', description: 'Show unread counts on the clock.', defaultOn: false },
      { id: 'w.nt.suggest', name: 'Suggested notifications', description: 'Tips delivered as toasts.', defaultOn: false },
      { id: 'w.sn.layouts', name: 'Snap layouts on hover', description: 'Show the grid over maximise.', defaultOn: false },
      { id: 'w.sn.assist', name: 'Snap assist suggestions', description: 'Offer windows to fill the gap.', defaultOn: false },
      { id: 'w.ls.spotlight', name: 'Disable lock screen Spotlight', description: 'Stop rotating imagery and facts.', defaultOn: false, requiresRestart: true },
      { id: 'w.ls.tips', name: 'Disable lock screen tips and ads', description: 'Remove promotional content before sign-in.', defaultOn: false, requiresRestart: true },
      { id: 'w.sys.numlock', name: 'NumLock on at startup', description: 'Turns NumLock on automatically at every sign-in.', defaultOn: false },
      { id: 'w.ex.battery', name: 'Battery percentage in tray', description: 'Shows the exact percentage next to the tray icon.', defaultOn: false },
      { id: 'w.ex.scrollbars', name: 'Always show scrollbars', description: 'Keep scrollbars visible instead of only while scrolling.', defaultOn: false },
    ],
  },
]

/* -- Advanced --------------------------------------------------------------- */
export const ADVANCED_TWEAKS = [
  { id: 'a.uac', name: 'Lower UAC prompt level', description: 'Fewer elevation prompts for signed binaries.', risk: 'Advanced' as Risk, warning: 'Weakens a core defence boundary.', Icon: ShieldAlert },
  { id: 'a.defender', name: 'Suspend real-time protection', description: 'Pauses live scanning until the next restart.', risk: 'Advanced' as Risk, warning: 'Leaves the device unprotected.', Icon: Shield },
  { id: 'a.smartscreen', name: 'Disable SmartScreen', description: 'Stops reputation checks for downloads.', risk: 'Advanced' as Risk, warning: 'Unknown binaries will run silently.', Icon: Eye },
  { id: 'a.vbs', name: 'Virtualization-based security', description: 'Turns off VBS, HVCI and memory integrity.', risk: 'Advanced' as Risk, warning: 'Required by some anti-cheat systems.', Icon: Lock },
  { id: 'a.spectre', name: 'Disable Spectre/Meltdown patches', description: 'Removes microcode mitigations from the kernel.', risk: 'Advanced' as Risk, warning: 'Known CPU vulnerabilities become exploitable.', Icon: Cpu },
  { id: 'a.pagefile', name: 'Manual page file (0 MB)', description: 'Removes virtual memory entirely.', risk: 'Advanced' as Risk, warning: 'Memory-heavy apps will crash.', Icon: MemoryStick },
  { id: 'a.wu', name: 'Block Windows Update service', description: 'Stops all updates including security fixes.', risk: 'Advanced' as Risk, warning: 'The device stops receiving patches.', Icon: Download },
  { id: 'a.tpm', name: 'Bypass TPM requirement checks', description: 'Removes the setup compatibility gate.', risk: 'Advanced' as Risk, warning: 'Unsupported configurations may not boot.', Icon: Fingerprint },
  { id: 'a.msi', name: 'Force MSI mode on GPU', description: 'Message-signalled interrupts for the display adapter.', risk: 'Advanced' as Risk, warning: 'Can produce a black screen on reboot.', Icon: MonitorIcon },
  { id: 'a.timer', name: 'Force 0.5 ms timer resolution', description: 'Pins the global scheduler tick.', risk: 'Advanced' as Risk, warning: 'Raises idle power draw significantly.', Icon: Timer },
  { id: 'a.wsl', name: 'Nested virtualization', description: 'Exposes VT-x to guest hypervisors.', risk: 'Moderate' as Risk, warning: 'Reduces host scheduling headroom.', Icon: Container },
  { id: 'a.debug', name: 'Kernel debug mode', description: 'Enables the boot debugger transport.', risk: 'Advanced' as Risk, warning: 'Boot times increase noticeably.', Icon: Terminal },
]

export const PROCESSES = [
  { name: 'Nebula Drift.exe', pid: 8412, cpu: 24.6, ram: 6134, disk: 2.4, net: 18.2 },
  { name: 'chrome.exe', pid: 2210, cpu: 8.1, ram: 2480, disk: 0.6, net: 4.1 },
  { name: 'Code.exe', pid: 6644, cpu: 5.4, ram: 1820, disk: 1.1, net: 0.3 },
  { name: 'Discord.exe', pid: 3908, cpu: 3.2, ram: 940, disk: 0.2, net: 1.8 },
  { name: 'dwm.exe', pid: 1440, cpu: 2.7, ram: 612, disk: 0.1, net: 0 },
  { name: 'explorer.exe', pid: 5120, cpu: 1.4, ram: 388, disk: 0.3, net: 0 },
  { name: 'MsMpEng.exe', pid: 3012, cpu: 1.1, ram: 274, disk: 1.8, net: 0 },
  { name: 'SearchHost.exe', pid: 7220, cpu: 0.8, ram: 196, disk: 0.4, net: 0.1 },
]

/* -- Installed apps --------------------------------------------------------- */
export const INSTALLED_APPS = [
  { id: 'app1', name: 'Visual Studio Code', publisher: 'Microsoft', version: '1.104.2', size: 0.62, installed: '2026-02-14', source: 'Win32', updatable: true, Icon: Terminal },
  { id: 'app2', name: 'Steam', publisher: 'Valve', version: '2026.07.1', size: 1.84, installed: '2025-11-02', source: 'Win32', updatable: false, Icon: Gamepad2 },
  { id: 'app3', name: 'Adobe Photoshop', publisher: 'Adobe', version: '27.1.0', size: 4.21, installed: '2026-04-08', source: 'Win32', updatable: true, Icon: Brush },
  { id: 'app4', name: 'Docker Desktop', publisher: 'Docker', version: '4.42.0', size: 2.96, installed: '2026-01-19', source: 'Win32', updatable: false, Icon: Container },
  { id: 'app5', name: 'Spotify', publisher: 'Spotify AB', version: '1.2.68', size: 0.34, installed: '2025-09-27', source: 'Store', updatable: true, Icon: Music },
  { id: 'app6', name: 'Discord', publisher: 'Discord Inc.', version: '1.0.9188', size: 0.51, installed: '2025-08-11', source: 'Win32', updatable: false, Icon: Speaker },
  { id: 'app7', name: 'Blender', publisher: 'Blender Foundation', version: '5.1.2', size: 1.12, installed: '2026-03-30', source: 'Win32', updatable: false, Icon: Boxes },
  { id: 'app8', name: 'Windows Terminal', publisher: 'Microsoft', version: '1.24.1', size: 0.18, installed: '2026-02-01', source: 'Store', updatable: true, Icon: Terminal },
  { id: 'app9', name: 'OBS Studio', publisher: 'OBS Project', version: '32.0.1', size: 0.74, installed: '2026-05-22', source: 'Win32', updatable: false, Icon: Video },
  { id: 'app10', name: 'Notion', publisher: 'Notion Labs', version: '4.8.0', size: 0.42, installed: '2026-06-09', source: 'Store', updatable: false, Icon: FileText },
  { id: 'app11', name: 'NVIDIA App', publisher: 'NVIDIA', version: '11.0.4', size: 0.88, installed: '2026-06-28', source: 'Win32', updatable: true, Icon: Cpu },
  { id: 'app12', name: 'Figma', publisher: 'Figma Inc.', version: '125.4.1', size: 0.39, installed: '2026-01-05', source: 'Win32', updatable: false, Icon: PenTool },
  { id: 'app13', name: 'Epic Games Launcher', publisher: 'Epic Games', version: '17.2.1', size: 1.06, installed: '2025-12-16', source: 'Win32', updatable: false, Icon: Gamepad2 },
  { id: 'app14', name: 'Microsoft Teams', publisher: 'Microsoft', version: '26.1.0', size: 0.68, installed: '2026-03-11', source: 'Store', updatable: true, Icon: Share2 },
  { id: 'app15', name: '7-Zip', publisher: 'Igor Pavlov', version: '25.01', size: 0.02, installed: '2025-07-04', source: 'Win32', updatable: false, Icon: FileArchive },
  { id: 'app16', name: 'Xbox', publisher: 'Microsoft', version: '2607.1001', size: 0.29, installed: '2025-06-30', source: 'Store', updatable: false, Icon: Tv },
]

/* -- Windows features ------------------------------------------------------- */
export const FEATURES = [
  { id: 'f.wsl', name: 'Windows Subsystem for Linux', description: 'Run Linux distributions natively alongside Windows.', size: '1.2 GB', category: 'Developer', defaultOn: false, restart: true, Icon: Terminal },
  { id: 'f.hyperv', name: 'Hyper-V', description: 'Type-1 hypervisor with virtual switch management.', size: '2.4 GB', category: 'Virtualization', defaultOn: false, restart: true, Icon: Server },
  { id: 'f.sandbox', name: 'Windows Sandbox', description: 'Disposable desktop that resets on close.', size: '0.9 GB', category: 'Virtualization', defaultOn: false, restart: true, Icon: Container },
  { id: 'f.vmp', name: 'Virtual Machine Platform', description: 'Core virtualization support used by WSL 2.', size: '0.3 GB', category: 'Virtualization', defaultOn: false, restart: true, Icon: Boxes },
  { id: 'f.net35', name: '.NET Framework 3.5', description: 'Legacy runtime including 2.0 and 3.0.', size: '0.4 GB', category: 'Runtime', defaultOn: false, restart: false, Icon: Package },
  { id: 'f.net48', name: '.NET Framework 4.8 Advanced', description: 'ASP.NET and WCF activation components.', size: '0.2 GB', category: 'Runtime', defaultOn: false, restart: false, Icon: Package },
  { id: 'f.smb1', name: 'SMB 1.0/CIFS File Sharing', description: 'Deprecated protocol kept for old NAS devices.', size: '0.1 GB', category: 'Networking', defaultOn: false, restart: true, Icon: Network },
  { id: 'f.smbdirect', name: 'SMB Direct', description: 'RDMA acceleration for file server traffic.', size: '0.1 GB', category: 'Networking', defaultOn: false, restart: false, Icon: Network },
  { id: 'f.telnet', name: 'Telnet Client', description: 'Plain-text terminal client for legacy devices.', size: '0.01 GB', category: 'Legacy', defaultOn: false, restart: false, Icon: Terminal },
  { id: 'f.tftp', name: 'TFTP Client', description: 'Trivial file transfer for network appliances.', size: '0.01 GB', category: 'Legacy', defaultOn: false, restart: false, Icon: Download },
  { id: 'f.powershell2', name: 'Windows PowerShell 2.0 Engine', description: 'Superseded engine kept for compatibility.', size: '0.05 GB', category: 'Legacy', defaultOn: false, restart: false, Icon: Terminal },
  { id: 'f.directplay', name: 'Legacy Components (DirectPlay)', description: 'Networking layer used by pre-2008 games.', size: '0.02 GB', category: 'Legacy', defaultOn: false, restart: false, Icon: Gamepad2 },
  { id: 'f.iis', name: 'Internet Information Services', description: 'Windows web server with management console.', size: '0.8 GB', category: 'Developer', defaultOn: false, restart: true, Icon: Server },
  { id: 'f.wcf', name: 'Windows Communication Foundation', description: 'HTTP and TCP activation for service hosts.', size: '0.2 GB', category: 'Developer', defaultOn: false, restart: false, Icon: Share2 },
  { id: 'f.printvirt', name: 'Print and Document Services', description: 'Internet printing and scan management.', size: '0.1 GB', category: 'Networking', defaultOn: false, restart: false, Icon: FileText },
  { id: 'f.mediafeat', name: 'Media Features', description: 'Windows Media Player and codecs.', size: '0.2 GB', category: 'Runtime', defaultOn: false, restart: false, Icon: Video },
]

/* -- Restore ---------------------------------------------------------------- */
export const RESTORE_POINTS = [
  { id: 'rp1', name: 'Vortex-Optimizer — before privacy batch', date: 'Today, 14:12', size: '2.4 GB', type: 'Manual', drive: 'C:' },
  { id: 'rp2', name: 'Automatic checkpoint', date: 'Yesterday, 03:00', size: '1.9 GB', type: 'Scheduled', drive: 'C:' },
  { id: 'rp3', name: 'Before NVIDIA driver 566.14', date: 'Jul 28, 19:44', size: '3.1 GB', type: 'Install', drive: 'C:' },
  { id: 'rp4', name: 'Vortex-Optimizer — gaming profile', date: 'Jul 24, 11:07', size: '2.2 GB', type: 'Manual', drive: 'C:' },
  { id: 'rp5', name: 'Cumulative update KB5062761', date: 'Jul 19, 05:31', size: '4.6 GB', type: 'Update', drive: 'C:' },
]

export const BACKUP_SLOTS = [
  { id: 'b1', name: 'Registry snapshot', detail: 'HKLM + HKCU hives', size: '412 MB', date: 'Today, 14:12', Icon: Database },
  { id: 'b2', name: 'Service configuration', detail: '218 services with start type', size: '86 KB', date: 'Today, 14:12', Icon: Server },
  { id: 'b3', name: 'Startup entries', detail: '14 items across 3 sources', size: '12 KB', date: 'Yesterday, 09:20', Icon: Rocket },
  { id: 'b4', name: 'Network profile', detail: 'TCP, DNS and adapter settings', size: '34 KB', date: 'Jul 26, 18:02', Icon: Network },
]

/* -- Settings --------------------------------------------------------------- */
export const LANGUAGES = [
  'English (United States)', 'English (United Kingdom)', 'Español (España)',
  'Español (Latinoamérica)', 'Français', 'Deutsch', 'Português (Brasil)',
  'Italiano', '日本語', '中文 (简体)',
]

export const CHANGELOG = [
  { version: '1.0.1', date: 'August 2026', notes: ['Correcciones y mejoras de estabilidad', 'Actualizaciones y release automatizados'] },
  { version: '1.0.0', date: 'August 2026', notes: ['Lanzamiento inicial'] },
]
