import { useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Accordion({
  title,
  description,
  icon,
  badge,
  defaultOpen = true,
  children,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  badge?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={cn('card-surface overflow-hidden rounded-[4px]', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-200 hover:bg-card-hover"
      >
        {icon ? (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-accent-soft text-[var(--accent)]">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-semibold tracking-[-0.01em]">{title}</span>
            {badge}
          </span>
          {description ? (
            <span className="mt-0.5 block truncate text-[12px] text-muted">{description}</span>
          ) : null}
        </span>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-muted transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="border-t border-line">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
