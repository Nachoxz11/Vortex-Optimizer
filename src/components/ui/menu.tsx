import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MenuItem = {
  id: string
  label: string
  icon?: ReactNode
  shortcut?: string
  danger?: boolean
  separatorBefore?: boolean
  disabled?: boolean
}

function MenuSurface({
  x,
  y,
  width,
  items,
  onPick,
  selectedId,
  opensUpward = false,
}: {
  x: number
  y: number
  width?: number
  items: MenuItem[]
  onPick: (id: string) => void
  selectedId?: string
  opensUpward?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: opensUpward ? 4 : -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: opensUpward ? 3 : -3, scale: 0.985 }}
      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
      style={{ left: x, top: y, width: width ?? 200, minWidth: 180 }}
      className="acrylic fixed z-[950] overflow-hidden rounded-[4px] border border-line-strong p-1 shadow-[var(--shadow-pop)]"
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((it) => (
        <div key={it.id}>
          {it.separatorBefore ? <div className="my-1 h-px bg-[var(--border)]" /> : null}
          <button
            type="button"
            disabled={it.disabled}
            onClick={() => onPick(it.id)}
            className={cn(
              'flex h-8 w-full items-center gap-2.5 rounded-[4px] px-2 text-left text-[13px] transition-colors duration-150 disabled:opacity-40',
              it.danger ? 'text-[var(--danger)] hover:bg-danger-soft' : 'hover:bg-card-hover',
            )}
          >
            <span className="flex h-4 w-4 shrink-0 items-center justify-center text-muted">
              {selectedId === it.id ? <Check className="h-3.5 w-3.5 text-[var(--accent)]" /> : it.icon}
            </span>
            <span className="flex-1 truncate">{it.label}</span>
            {it.shortcut ? (
              <span className="font-mono text-[11px] text-subtle">{it.shortcut}</span>
            ) : null}
          </button>
        </div>
      ))}
    </motion.div>
  )
}

export function DropdownMenu({
  trigger,
  items,
  onSelect,
  selectedId,
  align = 'start',
  width,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode
  items: MenuItem[]
  onSelect: (id: string) => void
  selectedId?: string
  align?: 'start' | 'end'
  width?: number
}) {
  const [pos, setPos] = useState<{ x: number; y: number; w: number; opensUpward: boolean } | null>(null)
  const holder = useRef<HTMLDivElement>(null)

  const toggle = () => {
    if (pos) return setPos(null)
    const el = holder.current?.firstElementChild as HTMLElement | undefined
    if (!el) return
    const r = el.getBoundingClientRect()
    const menuWidth = width ?? Math.max(r.width, 180)
    const estimatedHeight = items.length * 36 + 16

    const opensUpward = r.bottom + estimatedHeight > window.innerHeight - 12

    let left = align === 'end' ? r.right - menuWidth : r.left
    left = Math.max(12, Math.min(left, window.innerWidth - menuWidth - 12))

    let top = opensUpward ? r.top - estimatedHeight - 6 : r.bottom + 6
    top = Math.max(12, Math.min(top, window.innerHeight - estimatedHeight - 12))

    setPos({ x: left, y: top, w: menuWidth, opensUpward })
  }

  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    window.addEventListener('click', close)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('resize', close)
    }
  }, [pos])

  return (
    <>
      <div ref={holder} className="contents" onClick={(e) => e.stopPropagation()}>
        {trigger({ open: Boolean(pos), toggle })}
      </div>
      {createPortal(
        <AnimatePresence>
          {pos ? (
            <MenuSurface
              x={pos.x}
              y={pos.y}
              width={pos.w}
              items={items}
              selectedId={selectedId}
              opensUpward={pos.opensUpward}
              onPick={(id) => {
                setPos(null)
                onSelect(id)
              }}
            />
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}

export function Select({
  value,
  options,
  onChange,
  className,
  width,
}: {
  value: string
  options: Array<{ id: string; label: string }>
  onChange: (id: string) => void
  className?: string
  width?: number
}) {
  const current = options.find((o) => o.id === value)
  return (
    <DropdownMenu
      items={options.map((o) => ({ id: o.id, label: o.label }))}
      selectedId={value}
      onSelect={onChange}
      width={width}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className={cn(
            'flex h-8 items-center justify-between gap-2 rounded-[4px] border border-line bg-card px-2.5 text-[13px] transition-colors duration-200 hover:bg-card-hover',
            open && 'border-[color-mix(in_srgb,var(--accent)_50%,transparent)]',
            className,
          )}
        >
          <span className="truncate">{current?.label ?? value}</span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      )}
    />
  )
}

/** Right-click surface used by list rows across the app. */
export function ContextMenu({
  items,
  onSelect,
  children,
  className,
}: {
  items: MenuItem[]
  onSelect: (id: string) => void
  children: ReactNode
  className?: string
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!pos) return
    const close = () => setPos(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
    }
  }, [pos])

  return (
    <>
      <div
        className={className}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setPos({ x: e.clientX, y: e.clientY })
        }}
      >
        {children}
      </div>
      {createPortal(
        <AnimatePresence>
          {pos ? (
            <MenuSurface
              x={Math.min(pos.x, window.innerWidth - 230)}
              y={Math.min(pos.y, window.innerHeight - items.length * 34 - 24)}
              items={items}
              onPick={(id) => {
                setPos(null)
                onSelect(id)
              }}
            />
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
