import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
            {label}
            {props.required && <span className="text-[var(--danger)] ml-1">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            'w-full border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary bg-surface-base',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:border-transparent',
            'disabled:bg-surface-sunken disabled:text-text-tertiary',
            error && 'border-[var(--danger)] focus-visible:ring-[var(--danger)]',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
