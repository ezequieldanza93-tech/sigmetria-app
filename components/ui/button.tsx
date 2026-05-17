import { cn } from '@/lib/utils'
import { ButtonHTMLAttributes, forwardRef } from 'react'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
}

const variantClasses = {
  primary: 'bg-sig-500 hover:bg-sig-700 text-white disabled:opacity-50',
  secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50',
  destructive: 'bg-red-600 hover:bg-red-500 text-white disabled:opacity-50',
  ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 disabled:opacity-50',
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
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-sig-500 focus:ring-offset-1',
          variantClasses[variant],
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
