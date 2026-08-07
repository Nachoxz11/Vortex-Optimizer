import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

type PremiumContextType = {
  isPremium: boolean
  loading: boolean
  modalOpen: boolean
  showUpgradeModal: () => void
  hideUpgradeModal: () => void
  refreshPremiumStatus: () => Promise<void>
}

const PremiumContext = createContext<PremiumContextType | undefined>(undefined)

export function PremiumProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [dbIsPremium, setDbIsPremium] = useState(false)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  
  const refreshPremiumStatus = useCallback(async () => {
    if (!user) {
      setDbIsPremium(false)
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_premium, premium_until')
        .eq('id', user.id)
        .single()

      if (error || !data) {
        setDbIsPremium(false)
      } else {
        const isStillValid =
          data.is_premium &&
          (!data.premium_until || new Date(data.premium_until) > new Date())
        setDbIsPremium(Boolean(isStillValid))
      }
    } catch {
      setDbIsPremium(false)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refreshPremiumStatus()
  }, [refreshPremiumStatus])

  const showUpgradeModal = useCallback(() => setModalOpen(true), [])
  const hideUpgradeModal = useCallback(() => setModalOpen(false), [])

  const isPremium = dbIsPremium

  const value = useMemo(
    () => ({
      isPremium,
      loading,
      modalOpen,
      showUpgradeModal,
      hideUpgradeModal,
      refreshPremiumStatus,
    }),
    [
      isPremium,
      loading,
      modalOpen,
      showUpgradeModal,
      hideUpgradeModal,
      refreshPremiumStatus,
    ]
  )

  return (
    <PremiumContext.Provider value={value}>
      {children}
    </PremiumContext.Provider>
  )
}

export function usePremium() {
  const context = useContext(PremiumContext)
  if (!context) {
    throw new Error('usePremium must be used within a PremiumProvider')
  }
  return context
}
