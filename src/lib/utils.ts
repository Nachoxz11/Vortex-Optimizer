import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Deterministic pseudo-random in [0,1) — keeps fake charts stable across renders. */
export function seeded(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

export function formatBytes(gb: number) {
  if (gb >= 1024) return `${(gb / 1024).toFixed(2)} TB`
  if (gb < 1) return `${Math.round(gb * 1024)} MB`
  return `${gb.toFixed(1)} GB`
}

export function relTime(minutesAgo: number, lang: 'en' | 'es' = 'en') {
  if (lang === 'es') {
    if (minutesAgo < 1) return 'recién'
    if (minutesAgo < 60) return `hace ${Math.round(minutesAgo)} min`
    const h = Math.round(minutesAgo / 60)
    if (h < 24) return `hace ${h} h`
    return `hace ${Math.round(h / 24)} d`
  }
  if (minutesAgo < 1) return 'just now'
  if (minutesAgo < 60) return `${Math.round(minutesAgo)} min ago`
  const h = Math.round(minutesAgo / 60)
  if (h < 24) return `${h} h ago`
  return `${Math.round(h / 24)} d ago`
}

/** Builds a smooth SVG path (Catmull-Rom → bezier) from a series of points. */
export function smoothPath(points: Array<{ x: number; y: number }>, tension = 0.35) {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2
    const c1x = p1.x + ((p2.x - p0.x) / 6) * tension * 2
    const c1y = p1.y + ((p2.y - p0.y) / 6) * tension * 2
    const c2x = p2.x - ((p3.x - p1.x) / 6) * tension * 2
    const c2y = p2.y - ((p3.y - p1.y) / 6) * tension * 2
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`
  }
  return d
}
