import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { type ActivityItem, type ActivityKind } from './mock'
import { SYSTEM_TWEAK_IDS } from './tweak-capabilities'

/* ---------------------------------------------------------------------------
 * Purely visual application state. Nothing here touches the operating system:
 * toggles flip booleans in memory and reset when the app closes. `prefs` is the
 * exception — it's persisted to localStorage (see PREFS_STORAGE_KEY below).
 * ------------------------------------------------------------------------- */

export type ThemeMode = 'system' | 'light' | 'dark'
export type Accent = 'blue' | 'violet' | 'teal' | 'magenta' | 'amber' | 'green'

export type Toast = {
  id: number
  title: string
  description?: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}

type Prefs = {
  theme: ThemeMode
  accent: Accent
  animations: boolean
  transparency: boolean
  scale: number
  language: string
  compact: boolean
  confirmRisky: boolean
  telemetryOptIn: boolean
  autoRestorePoint: boolean
  startWithWindows: boolean
  minimizeToTray: boolean
}

type State = {
  toggles: Record<string, boolean>
  systemToggles: Record<string, boolean>
  systemMeta: Record<string, { name: string; requiresRestart: boolean }>
  prefs: Prefs
  activity: ActivityItem[]
  unreadCount: number
}

type Action =
  | { type: 'toggle'; id: string; value: boolean }
  | { type: 'bulk'; ids: string[]; value: boolean }
  | { type: 'system-status'; statuses: XTweakStatus[] }
  | { type: 'pref'; key: keyof Prefs; value: Prefs[keyof Prefs] }
  | { type: 'activity'; item: ActivityItem }
  | { type: 'activity-replace'; items: ActivityItem[] }
  | { type: 'mark-read' }

const DEFAULT_PREFS: Prefs = {
  theme: 'dark',
  accent: 'blue',
  animations: true,
  transparency: true,
  scale: 1,
  language: 'English (United States)',
  compact: false,
  confirmRisky: true,
  telemetryOptIn: false,
  autoRestorePoint: true,
  startWithWindows: true,
  minimizeToTray: true,
}

/** Versioned so the schema can change later without breaking prefs saved by older builds. */
const PREFS_STORAGE_KEY = 'xtweaks:prefs:v1'

function loadPrefs(): Prefs {
  try {
    const raw = window.localStorage.getItem(PREFS_STORAGE_KEY)
    if (!raw) return DEFAULT_PREFS
    const saved = JSON.parse(raw) as Partial<Prefs>
    return { ...DEFAULT_PREFS, ...saved }
  } catch {
    return DEFAULT_PREFS
  }
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'toggle': {
      const toggles = { ...state.toggles, [action.id]: action.value }
      return { ...state, toggles }
    }
    case 'bulk': {
      const toggles = { ...state.toggles }
      for (const id of action.ids) toggles[id] = action.value
      return { ...state, toggles }
    }
    case 'system-status': {
      const systemToggles = { ...state.systemToggles }
      const systemMeta = { ...state.systemMeta }
      for (const status of action.statuses) {
        systemToggles[status.id] = status.applied
        systemMeta[status.id] = { name: status.name, requiresRestart: Boolean(status.requiresRestart) }
      }
      return { ...state, systemToggles, systemMeta }
    }
    case 'pref':
      return { ...state, prefs: { ...state.prefs, [action.key]: action.value } }
    case 'activity':
      return { ...state, activity: [action.item, ...state.activity].slice(0, 40), unreadCount: state.unreadCount + 1 }
    case 'activity-replace': {
      // Drop only the fabricated seed rows (id starts with 's') so any real-time entries logged
      // before the real history finished loading survive the merge instead of being wiped.
      const keep = state.activity.filter((a) => !a.id.startsWith('s'))
      const merged = [...keep, ...action.items]
        .filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i)
        .sort((a, b) => a.minutesAgo - b.minutesAgo)
        .slice(0, 40)
      return { ...state, activity: merged }
    }
    case 'mark-read':
      return { ...state, unreadCount: 0 }
    default:
      return state
  }
}

export type PendingRestartItem = { id: string; name: string }

type Ctx = {
  toggles: Record<string, boolean>
  prefs: Prefs
  activity: ActivityItem[]
  unreadCount: number
  markActivityRead: () => void
  pendingRestart: PendingRestartItem[]
  isOn: (id: string, fallback?: boolean) => boolean
  isSystemTweak: (id: string) => boolean
  setToggle: (id: string, value: boolean, label?: string) => Promise<void>
  setMany: (ids: string[], value: boolean, label?: string) => Promise<void>
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void
  log: (title: string, detail: string, kind?: ActivityKind) => void
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
  refreshTweakStatuses: () => Promise<void>
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    toggles: {},
    systemToggles: {},
    systemMeta: {},
    prefs: loadPrefs(),
    activity: [],
    unreadCount: 0,
  })
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(1)
  const lang = state.prefs.language.startsWith('Español') ? 'es' : 'en'

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = toastId.current++
      setToasts((prev) => [...prev.slice(-3), { ...t, id }])
      window.setTimeout(() => dismissToast(id), 4200)
    },
    [dismissToast],
  )



  const log = useCallback((title: string, detail: string, kind: ActivityKind = 'info') => {
    dispatch({
      type: 'activity',
      item: { id: `a${Math.round(performance.now())}`, title, detail, kind, minutesAgo: 0 },
    })
  }, [])

  const isSystemTweak = useCallback((id: string) => SYSTEM_TWEAK_IDS.has(id), [])

  const markActivityRead = useCallback(() => dispatch({ type: 'mark-read' }), [])

  /** Tweaks that are currently applied for real and need a restart to fully take effect —
   *  recomputed instantly whenever a tweak status changes, so it never goes stale like a
   *  manually-incremented counter would. */
  const pendingRestart = useMemo<PendingRestartItem[]>(
    () =>
      Object.entries(state.systemToggles)
        .filter(([id, applied]) => applied && state.systemMeta[id]?.requiresRestart)
        .map(([id]) => ({ id, name: state.systemMeta[id]?.name ?? id })),
    [state.systemToggles, state.systemMeta],
  )

  useEffect(() => {
    if (!window.xtweaks?.tweaks) return
    window.xtweaks.tweaks.list()
      .then((statuses) => dispatch({ type: 'system-status', statuses }))
      .catch((error: unknown) => toast({ title: lang === 'es' ? 'No se pudo comprobar el estado de los tweaks' : "Couldn't check tweak status", description: error instanceof Error ? error.message : String(error), tone: 'danger' }))
  }, [toast, lang])


  /* Replaces the seeded sample timeline with this machine's real tweak apply/revert history. */
  useEffect(() => {
    if (!window.xtweaks?.system?.history) return
    window.xtweaks.system.history(40)
      .then((entries) => {
        if (entries.length === 0) return
        const items: ActivityItem[] = entries.map((entry, index) => {
          const verb = entry.event === 'apply' ? (lang === 'es' ? 'aplicado' : 'applied') : (lang === 'es' ? 'revertido' : 'reverted')
          const minutesAgo = Math.max(0, Math.round((Date.now() - new Date(entry.timestamp).getTime()) / 60000))
          return {
            id: `h${index}-${entry.timestamp}`,
            title: `${entry.name} ${verb}`,
            detail: entry.error ?? (lang === 'es' ? 'Cambio real aplicado en este equipo.' : 'Real change applied on this machine.'),
            kind: entry.error ? 'danger' : entry.event === 'apply' ? 'success' : 'muted',
            minutesAgo,
          }
        })
        dispatch({ type: 'activity-replace', items })
      })
      .catch(() => {})
  }, [lang])

  const refreshTweakStatuses = useCallback(async () => {
    if (!window.xtweaks?.tweaks) return
    const statuses = await window.xtweaks.tweaks.list()
    dispatch({ type: 'system-status', statuses })
  }, [])

  const setToggle = useCallback(
    async (id: string, value: boolean, label?: string) => {
      if (!isSystemTweak(id)) {
        dispatch({ type: 'toggle', id, value })
        if (label) {
          const verb = lang === 'es' ? (value ? 'aplicado' : 'revertido') : (value ? 'applied' : 'reverted')
          log(`${label} ${verb}`, lang === 'es' ? 'Próximamente — este módulo todavía no está disponible.' : 'Coming soon — this module is not available yet.', value ? 'success' : 'muted')
        }
        return
      }
      if (!window.xtweaks?.tweaks) {
        toast({ title: lang === 'es' ? 'Se requiere la app de escritorio' : 'Desktop app required', description: lang === 'es' ? 'Los tweaks reales solo se pueden ejecutar desde Electron.' : 'Real tweaks can only run from the Electron app.', tone: 'warning' })
        return
      }
      try {
        const result = await window.xtweaks.tweaks.change(id, value ? 'apply' : 'revert')
        dispatch({ type: 'system-status', statuses: [result] })
        if (label) {
          const verb = lang === 'es' ? (value ? 'aplicado' : 'revertido') : (value ? 'applied' : 'reverted')
          log(`${label} ${verb}`, value ? (lang === 'es' ? 'Cambio aplicado y guardado.' : 'Change applied and saved.') : (lang === 'es' ? 'Estado anterior restaurado.' : 'Previous state restored.'), value ? 'success' : 'muted')
        }
      } catch (error) {
        toast({ title: lang === 'es' ? `No se pudo ${value ? 'aplicar' : 'revertir'} el tweak` : `Couldn't ${value ? 'apply' : 'revert'} the tweak`, description: error instanceof Error ? error.message : String(error), tone: 'danger' })
      }
    },
    [isSystemTweak, log, toast, lang],
  )

  const setMany = useCallback(
    async (ids: string[], value: boolean, label?: string) => {
      if (ids.length === 0) return
      await Promise.all(ids.map((id) => setToggle(id, value)))
      if (label) log(label, lang === 'es' ? `${ids.length} tweak${ids.length === 1 ? '' : 's'} aplicado${ids.length === 1 ? '' : 's'} por Vortex-Optimizer.` : `${ids.length} tweak${ids.length === 1 ? '' : 's'} applied by Vortex-Optimizer.`, 'info')
    },
    [log, setToggle, lang],
  )

  const setPref = useCallback(<K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    dispatch({ type: 'pref', key, value })
  }, [])

  const isOn = useCallback(
    (id: string, fallback = false) => isSystemTweak(id) ? (state.systemToggles[id] ?? false) : (state.toggles[id] ?? fallback),
    [isSystemTweak, state.systemToggles, state.toggles],
  )

  /* Theme, accent, scale, animation, transparency and density prefs are applied to the document root. */
  useEffect(() => {
    const root = document.documentElement
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const dark = state.prefs.theme === 'dark' || (state.prefs.theme === 'system' && prefersDark)
    root.classList.toggle('dark', dark)
    root.dataset.accent = state.prefs.accent
    root.style.setProperty('--ui-scale', String(state.prefs.scale * (state.prefs.compact ? 0.92 : 1)))
    root.classList.toggle('no-anim', !state.prefs.animations)
    root.classList.toggle('no-transparency', !state.prefs.transparency)
  }, [
    state.prefs.theme,
    state.prefs.accent,
    state.prefs.scale,
    state.prefs.animations,
    state.prefs.transparency,
    state.prefs.compact,
  ])

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(state.prefs))
    } catch {
      // Storage unavailable (e.g. private mode with quota disabled) — prefs just won't persist.
    }
  }, [state.prefs])

  const value = useMemo<Ctx>(
    () => ({
      toggles: state.toggles,
      prefs: state.prefs,
      activity: state.activity,
      unreadCount: state.unreadCount,
      markActivityRead,
      pendingRestart,
      isOn,
      isSystemTweak,
      setToggle,
      setMany,
      setPref,
      log,
      toasts,
      toast,
      dismissToast,
      refreshTweakStatuses,
    }),
    [state, isOn, isSystemTweak, setToggle, setMany, setPref, log, toasts, toast, dismissToast, refreshTweakStatuses, markActivityRead, pendingRestart],
  )

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

/** Drives the fake live telemetry used by the Dashboard and Monitor screens. */
export function useLiveSeries(length = 48, base = 40, spread = 22, speed = 1200) {
  const [data, setData] = useState<number[]>(() =>
    Array.from({ length }, (_, i) => base + Math.sin(i / 3) * spread * 0.5 + Math.random() * spread * 0.4),
  )
  useEffect(() => {
    const id = window.setInterval(() => {
      setData((prev) => {
        const last = prev[prev.length - 1] ?? base
        const drift = (Math.random() - 0.5) * spread * 0.55
        const next = Math.max(2, Math.min(99, last + drift + (base - last) * 0.16))
        return [...prev.slice(1), next]
      })
    }, speed)
    return () => window.clearInterval(id)
  }, [base, spread, speed])
  return data
}
