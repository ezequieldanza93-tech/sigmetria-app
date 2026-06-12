import { cn } from '@/lib/utils'
import { InputHTMLAttributes, forwardRef } from 'react'
import { Check, X } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  /** true = campo válido → tilde verde. Se ignora si hay error. */
  valid?: boolean
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, valid, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    const showCheck = valid && !error
    const showIcon = !!error || showCheck
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-text-secondary">
            {label}
            {props.required && <span className="text-[var(--danger)] ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            className={cn(
              'w-full border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary bg-surface-base',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:border-transparent',
              'disabled:bg-surface-sunken disabled:text-text-tertiary',
              showIcon && 'pr-9',
              error && 'border-[var(--danger)] focus-visible:ring-[var(--danger)]',
              showCheck && 'border-green-500',
              className,
            )}
            {...props}
          />
          {error ? (
            <X className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--danger)]" aria-hidden="true" />
          ) : showCheck ? (
            <Check className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-green-600" aria-hidden="true" />
          ) : null}
        </div>
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>
    )
  },
)

Input.displayName = 'Input'
