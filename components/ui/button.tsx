import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variantClasses = {
  primary:
    'bg-brand-primary hover:bg-brand-hover text-white disabled:opacity-50 hover:-translate-y-px hover:shadow-md active:translate-y-0',
  secondary:
    'bg-surface-base border border-border-default text-text-primary hover:bg-surface-elevated disabled:opacity-50',
  destructive: 'bg-[var(--danger)] hover:opacity-90 text-white disabled:opacity-50',
  ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated disabled:opacity-50',
}

const sizeClasses = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base',
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      >
        {children}
      </button>
    )
  },
)

Button.displayName = 'Button'
