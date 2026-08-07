import { useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 260,
  className,
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const ref = useRef<HTMLSpanElement>(null)
  const timer = useRef<number>(0)

  const show = () => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      // The wrapper uses `display: contents`, so measure the real child instead.
      const el = (ref.current?.firstElementChild as HTMLElement | null) ?? ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      if (r.width === 0 && r.height === 0) return
      const map = {
        top: { x: r.left + r.width / 2, y: r.top - 8 },
        bottom: { x: r.left + r.width / 2, y: r.bottom + 8 },
        left: { x: r.left - 8, y: r.top + r.height / 2 },
        right: { x: r.right + 8, y: r.top + r.height / 2 },
      }
      setPos(map[side])
    }, delay)
  }

  const hide = () => {
    window.clearTimeout(timer.current)
    setPos(null)
  }

  const transform =
    side === 'top'
      ? 'translate(-50%, -100%)'
      : side === 'bottom'
        ? 'translate(-50%, 0)'
        : side === 'left'
          ? 'translate(-100%, -50%)'
          : 'translate(0, -50%)'

  return (
    <>
      <span
        ref={ref}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="contents"
      >
        {children}
      </span>
      {createPortal(
        <AnimatePresence>
          {pos && content ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.14, ease: [0.16, 1, 0.3, 1] }}
              style={{ left: pos.x, top: pos.y, transform }}
              className={cn(
                'acrylic pointer-events-none fixed z-[999] max-w-[280px] rounded-[6px] border border-line px-2.5 py-1.5 text-[12px] leading-snug text-fg shadow-[var(--shadow-pop)]',
                className,
              )}
            >
              {content}
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      )}
    </>
  )
}
