import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import { motion, type HTMLMotionProps } from 'framer-motion'
import { cn } from '@/lib/utils'

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { interactive?: boolean }>(
  function Card({ className, interactive, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          'card-surface rounded-[4px] transition-[background,border-color,box-shadow,transform] duration-200',
          interactive && 'hover:border-line-strong hover:bg-card-hover',
          className,
        )}
        {...props}
      />
    )
  },
)

export function MotionCard({ className, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      className={cn('card-surface rounded-[4px]', className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  description,
  icon,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start gap-3 px-4 pt-3.5 pb-3', className)}>
      {icon ? (
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-accent-soft text-[var(--accent)]">
          {icon}
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-[13.5px] font-semibold tracking-[-0.01em]">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-center gap-2 border-t border-line px-4 py-2.5', className)}
      {...props}
    />
  )
}
