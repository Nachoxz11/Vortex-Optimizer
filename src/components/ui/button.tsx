import { forwardRef, useCallback, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'

const button = cva(
  'relative inline-flex select-none items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-[4px] font-medium transition-[background,color,border,box-shadow,transform] duration-200 disabled:pointer-events-none disabled:opacity-45 active:scale-[0.985]',
  {
    variants: {
      variant: {
        primary:
          'bg-[var(--accent)] text-[var(--accent-fg)] border border-[color-mix(in_srgb,var(--accent)_70%,black)] shadow-[0_1px_2px_rgba(0,0,0,.25),inset_0_1px_0_rgba(255,255,255,.18)] hover:bg-[color-mix(in_srgb,var(--accent)_88%,white)]',
        secondary:
          'border border-line bg-card text-fg hover:bg-card-hover shadow-[0_1px_2px_rgba(0,0,0,.08)]',
        subtle: 'text-muted hover:bg-card hover:text-fg',
        ghost: 'text-fg/90 hover:bg-card',
        danger:
          'bg-[var(--danger)] text-white border border-[color-mix(in_srgb,var(--danger)_70%,black)] hover:brightness-110',
        outline: 'border border-line-strong bg-transparent text-fg hover:bg-card',
        success: 'bg-[var(--success)] text-[#04170e] border border-[color-mix(in_srgb,var(--success)_70%,black)] hover:brightness-110',
      },
      size: {
        sm: 'h-7 px-2.5 text-[12px]',
        md: 'h-8 px-3 text-[13px]',
        lg: 'h-10 px-4 text-[14px]',
        icon: 'h-8 w-8 p-0',
        iconSm: 'h-7 w-7 p-0',
        tile: 'h-auto w-full flex-col items-start gap-1 p-0 text-left',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

type Ripple = { id: number; x: number; y: number }

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  loading?: boolean
  children?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, loading, children, onPointerDown, ...props },
  ref,
) {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const seq = useRef(0)

  const handleDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const id = seq.current++
      setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }])
      window.setTimeout(() => setRipples((r) => r.filter((x) => x.id !== id)), 520)
      onPointerDown?.(e)
    },
    [onPointerDown],
  )

  return (
    <button
      ref={ref}
      className={cn(button({ variant, size }), className)}
      onPointerDown={handleDown}
      {...props}
    >
      <AnimatePresence>
        {ripples.map((r) => (
          <motion.span
            key={r.id}
            className="pointer-events-none absolute rounded-full bg-current/25"
            initial={{ width: 0, height: 0, opacity: 0.45, x: r.x, y: r.y }}
            animate={{ width: 240, height: 240, opacity: 0, x: r.x - 120, y: r.y - 120 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>
      {loading ? (
        <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current/25 border-t-current" />
      ) : null}
      {children}
    </button>
  )
})

export function IconButton({
  label,
  className,
  ...props
}: ButtonProps & { label: string }) {
  return (
    <Button aria-label={label} title={label} variant="subtle" size="icon" className={className} {...props} />
  )
}
