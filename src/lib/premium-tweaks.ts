/**
 * premium-tweaks.ts
 * Single source of truth for which tweaks and screens require a Premium subscription.
 * The UI reads from here — never hardcode premium gates inline.
 */

/** Performance tweaks locked behind Premium. These are kernel/power-level tweaks
 *  with the highest impact that justify the upgrade. */
export const PREMIUM_TWEAK_IDS = new Set([
  // Kernel group
  'p.timer',         // High precision event timer
  'p.mitigations',   // Relax CPU mitigations
  'p.largesys',      // Large system cache
  'p.paging',        // Clear page file at shutdown
  'p.gpuschedule',   // Hardware-accelerated GPU scheduling
  // Power group
  'p.corepark',      // Disable core parking
  'p.pciexpress',    // PCIe link state power
  'p.throttling',    // Power throttling
  // Storage group
  'p.8dot3',         // Legacy 8.3 filenames (Advanced risk)
  'p.reserved',      // Reserved storage (High impact)
  // Background group
  'p.superfetchgame', // Game DVR background capture
  's.dohtls',         // DNS over HTTPS
])

/** Full screens locked for free users. Navigation clicks open the upgrade modal. */
export const PREMIUM_SCREENS = new Set([
  'gaming',
  'advanced',
  'optimize',
] as const)

/** Whether a given tweak ID is premium-gated. */
export function isPremiumTweak(id: string): boolean {
  return PREMIUM_TWEAK_IDS.has(id)
}

/** Whether a given screen requires premium. */
export function isPremiumScreen(id: string): boolean {
  return PREMIUM_SCREENS.has(id as never)
}
