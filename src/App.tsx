import { lazy, Suspense, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppProvider } from './lib/store'
import { AuthProvider, useAuth } from './lib/auth'
import { PremiumProvider } from './lib/premium'
import { PremiumModal } from './screens/PremiumModal'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { CommandPalette } from './components/CommandPalette'
import { Toaster } from './components/ui/toaster'
import { Splash } from './components/Splash'
import { AuthScreen } from './screens/AuthScreen'
import { ResetPasswordScreen } from './screens/ResetPasswordScreen'
import { fetchSystemInfo } from './lib/system'
import type { ScreenId } from './nav'

/** Lazy so each screen is its own chunk — only Dashboard's code loads on first paint. */
const Dashboard = lazy(() => import('./screens/Dashboard'))
const Performance = lazy(() => import('./screens/Performance'))
const Gaming = lazy(() => import('./screens/Gaming'))
const Cleaner = lazy(() => import('./screens/Cleaner'))
const Privacy = lazy(() => import('./screens/Privacy'))
const Startup = lazy(() => import('./screens/Startup'))
const Optimize = lazy(() => import('./screens/Optimize'))
const Network = lazy(() => import('./screens/Network'))
const Storage = lazy(() => import('./screens/Storage'))
const WindowsScreen = lazy(() => import('./screens/WindowsScreen'))
const Advanced = lazy(() => import('./screens/Advanced'))
const InstalledApps = lazy(() => import('./screens/InstalledApps'))
const Features = lazy(() => import('./screens/Features'))
const Restore = lazy(() => import('./screens/Restore'))
const Settings = lazy(() => import('./screens/Settings'))

const SCREENS: Record<ScreenId, React.LazyExoticComponent<(p: { onNavigate: (id: ScreenId) => void }) => React.ReactElement>> = {
  dashboard: Dashboard,
  performance: Performance,
  gaming: Gaming,
  cleaner: Cleaner,
  privacy: Privacy,
  startup: Startup,
  optimize: Optimize,
  network: Network,
  storage: Storage,
  windows: WindowsScreen,
  advanced: Advanced,
  apps: InstalledApps,
  features: Features,
  restore: Restore,
  settings: Settings,
}

function Shell() {
  const [screen, setScreen] = useState<ScreenId>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [palette, setPalette] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPalette((p) => !p)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const Screen = SCREENS[screen]

  return (
    <div className="flex h-full flex-col overflow-hidden bg-scrim">
      <TitleBar onOpenCommand={() => setPalette(true)} />
      <div className="relative flex min-h-0 flex-1">
        <Sidebar
          current={screen}
          onNavigate={setScreen}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
        />
        <main className="relative min-w-0 flex-1 overflow-hidden">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-[var(--accent)] opacity-[0.07] blur-[80px]" />
          <div className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-[var(--brand-a)] opacity-[0.06] blur-[90px]" />
          <motion.div
            key={screen}
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-full"
          >
            <Suspense fallback={null}>
              <Screen onNavigate={setScreen} />
            </Suspense>
          </motion.div>
        </main>
      </div>
      <CommandPalette open={palette} onClose={() => setPalette(false)} onNavigate={setScreen} />
      <Toaster />
    </div>
  )
}

export type BootStep = 'system' | 'tweaks' | 'timeout' | 'error' | 'done'

/** Waits for the first real read of system state so screens don't flash empty/mock data in before it. */
function useBoot(enabled = true) {
  const [ready, setReady] = useState(!enabled)
  const [step, setStep] = useState<BootStep>('system')

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    const finish = (finalStep: BootStep = 'done') => {
      if (cancelled) return
      setStep(finalStep)
      setReady(true)
    }

    if (!window.xtweaks?.system) {
      // No Tauri bridge (e.g. `npm run dev:web`) — nothing real to wait for.
      finish()
      return
    }

    setStep('system')
    const timeout = window.setTimeout(() => setStep((s) => (s === 'done' ? s : 'timeout')), 3000)
    const hardStop = window.setTimeout(() => finish('timeout'), 6000)

    fetchSystemInfo()
      .then(() => {
        if (!cancelled) setStep('tweaks')
      })
      .catch(() => {
        if (!cancelled) setStep('error')
      })
      .finally(() =>
        window.xtweaks!.tweaks
          .list()
          .then(() => finish())
          .catch(() => finish('error')),
      )

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      window.clearTimeout(hardStop)
    }
  }, [])

  return { ready, step }
}

function AppContent() {
  const { ready, step } = useBoot(true)
  const { user, loading, recoveryMode } = useAuth()

  if (!ready || loading) {
    return <Splash step={step} />
  }

  if (!user) {
    return <AuthScreen />
  }

  if (recoveryMode) {
    return <ResetPasswordScreen />
  }

  return <Shell key="shell" />
}

export default function App() {
  useEffect(() => {
    const blockBrowserShortcuts = (event: KeyboardEvent) => {
      const isDevToolsShortcut =
        event.key === 'F12' ||
        (event.ctrlKey && event.shiftKey && ['I', 'J', 'C'].includes(event.key.toUpperCase()))

      if (isDevToolsShortcut) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    const blockContextMenu = (event: MouseEvent) => event.preventDefault()

    window.addEventListener('keydown', blockBrowserShortcuts, true)
    window.addEventListener('contextmenu', blockContextMenu)

    return () => {
      window.removeEventListener('keydown', blockBrowserShortcuts, true)
      window.removeEventListener('contextmenu', blockContextMenu)
    }
  }, [])

  return (
    <AppProvider>
      <AuthProvider>
        <PremiumProvider>
          <AnimatePresence mode="wait">
            <AppContent />
          </AnimatePresence>
          <PremiumModal />
        </PremiumProvider>
      </AuthProvider>
    </AppProvider>
  )
}
