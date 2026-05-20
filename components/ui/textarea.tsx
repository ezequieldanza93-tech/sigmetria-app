import { cn } from '@/lib/utils'
import { TextareaHTMLAttributes, forwardRef } from 'react'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, id, ...props }, ref) => {
    const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="text-sm font-medium text-text-secondary">
            {label}
            {props.required && <span className="text-[var(--danger)] ml-1">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          className={cn(
            'w-full border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary resize-none bg-surface-base',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:border-transparent',
            'disabled:bg-surface-sunken disabled:text-text-tertiary',
            error && 'border-[var(--danger)] focus-visible:ring-[var(--danger)]',
            className,
          )}
          rows={props.rows ?? 3}
          {...props}
        />
        {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      </div>
    )
  },
)

Textarea.displayName = 'Textarea'
