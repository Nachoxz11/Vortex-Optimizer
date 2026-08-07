import { useId, useMemo } from 'react'
import { motion } from 'framer-motion'
import { cn, smoothPath } from '@/lib/utils'

/* All charts are hand-drawn SVG fed by fabricated series. */

export function Sparkline({
  data,
  color = 'var(--accent)',
  height = 56,
  width = 220,
  fill = true,
  strokeWidth = 1.75,
  max = 100,
  grid = false,
  className,
}: {
  data: number[]
  color?: string
  height?: number
  width?: number
  fill?: boolean
  strokeWidth?: number
  max?: number
  grid?: boolean
  className?: string
}) {
  const id = useId().replace(/:/g, '')
  const pts = useMemo(
    () =>
      data.map((v, i) => ({
        x: (i / Math.max(1, data.length - 1)) * width,
        y: height - (Math.min(v, max) / max) * (height - 4) - 2,
      })),
    [data, width, height, max],
  )
  const d = smoothPath(pts)
  const area = `${d} L ${width} ${height} L 0 ${height} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('w-full', className)}
      style={{ height }}
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.34" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {grid
        ? [0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1="0"
              x2={width}
              y1={height * f}
              y2={height * f}
              stroke="var(--grid-line)"
              strokeWidth="1"
            />
          ))
        : null}
      {fill ? <path d={area} fill={`url(#g${id})`} /> : null}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {pts.length ? (
        <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.6" fill={color}>
          <animate attributeName="r" values="2.6;4.2;2.6" dur="2s" repeatCount="indefinite" />
        </circle>
      ) : null}
    </svg>
  )
}

export function Donut({
  segments,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue,
  onHover,
}: {
  segments: Array<{ id: string; value: number; color: string; label: string }>
  size?: number
  thickness?: number
  centerLabel?: string
  centerValue?: string
  onHover?: (id: string | null) => void
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  let offset = 0

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={thickness} />
        {segments.map((s) => {
          const len = (s.value / total) * c
          const el = (
            <motion.circle
              key={s.id}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeLinecap="butt"
              strokeDasharray={`${len} ${c - len}`}
              initial={{ strokeDashoffset: -offset, opacity: 0 }}
              animate={{ strokeDashoffset: -offset, opacity: 1 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="origin-center cursor-pointer transition-[filter,transform] duration-200 hover:brightness-125"
              onMouseEnter={() => onHover?.(s.id)}
              onMouseLeave={() => onHover?.(null)}
            />
          )
          offset += len
          return el
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[22px] font-semibold tracking-[-0.02em]">{centerValue}</span>
        <span className="text-[11.5px] text-muted">{centerLabel}</span>
      </div>
    </div>
  )
}

export function Bars({
  data,
  color = 'var(--accent)',
  height = 90,
  max,
  labels,
  className,
}: {
  data: number[]
  color?: string
  height?: number
  max?: number
  labels?: string[]
  className?: string
}) {
  const peak = max ?? Math.max(...data, 1)
  return (
    <div className={cn('flex items-end gap-[3px]', className)} style={{ height }}>
      {data.map((v, i) => (
        <div key={i} className="group relative flex flex-1 flex-col justify-end" style={{ height }}>
          <motion.div
            className="w-full rounded-t-[3px] transition-[filter] duration-200 group-hover:brightness-125"
            style={{ background: color }}
            initial={{ height: 0 }}
            animate={{ height: `${(v / peak) * 100}%` }}
            transition={{ duration: 0.5, delay: i * 0.015, ease: [0.16, 1, 0.3, 1] }}
          />
          {labels?.[i] ? (
            <span className="mt-1 block text-center text-[9.5px] text-subtle">{labels[i]}</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function Ring({
  value,
  size = 78,
  thickness = 7,
  color = 'var(--accent)',
  label,
  sub,
}: {
  value: number
  size?: number
  thickness?: number
  color?: string
  label?: string
  sub?: string
}) {
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={thickness} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c - (Math.min(100, value) / 100) * c }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[15px] font-semibold tracking-[-0.02em]">{label ?? `${Math.round(value)}%`}</span>
        {sub ? <span className="mt-0.5 text-[9.5px] text-subtle">{sub}</span> : null}
      </div>
    </div>
  )
}

export function Gauge({
  value,
  size = 150,
  color = 'var(--accent)',
  label,
  caption,
}: {
  value: number
  size?: number
  color?: string
  label?: string
  caption?: string
}) {
  const r = size / 2 - 12
  const circ = Math.PI * r
  return (
    <div className="relative" style={{ width: size, height: size * 0.62 }}>
      <svg width={size} height={size * 0.62} viewBox={`0 0 ${size} ${size * 0.62}`}>
        <path
          d={`M 12 ${size * 0.56} A ${r} ${r} 0 0 1 ${size - 12} ${size * 0.56}`}
          fill="none"
          stroke="var(--sunken)"
          strokeWidth="11"
          strokeLinecap="round"
        />
        <motion.path
          d={`M 12 ${size * 0.56} A ${r} ${r} 0 0 1 ${size - 12} ${size * 0.56}`}
          fill="none"
          stroke={color}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (Math.min(100, value) / 100) * circ }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="text-[26px] font-semibold leading-none tracking-[-0.03em]">{label ?? Math.round(value)}</span>
        {caption ? <span className="mt-1 text-[11.5px] text-muted">{caption}</span> : null}
      </div>
    </div>
  )
}

export function Legend({
  items,
  className,
}: {
  items: Array<{ id: string; label: string; color: string; value?: string }>
  className?: string
}) {
  return (
    <ul className={cn('space-y-1.5', className)}>
      {items.map((i) => (
        <li key={i.id} className="flex items-center gap-2 text-[12.5px]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: i.color }} />
          <span className="min-w-0 flex-1 truncate text-muted">{i.label}</span>
          {i.value ? <span className="shrink-0 font-medium">{i.value}</span> : null}
        </li>
      ))}
    </ul>
  )
}
