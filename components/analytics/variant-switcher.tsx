'use client'
import { cn } from '@/lib/utils'

interface VariantSwitcherProps {
  current: 1 | 2 | 3
  onChange: (v: 1 | 2 | 3) => void
  labels?: [string, string, string]
}

const DEFAULT_LABELS: [string, string, string] = ['Vista 1', 'Vista 2', 'Vista 3']

export function VariantSwitcher({ current, onChange, labels = DEFAULT_LABELS }: VariantSwitcherProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border-subtle bg-surface-sunken p-0.5 gap-0.5">
      {([1, 2, 3] as const).map((v, i) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={cn(
            'px-3.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-150 font-heading',
            current === v
              ? 'bg-surface-elevated shadow-[var(--shadow-sm)] text-text-primary border border-border-subtle'
              : 'text-text-tertiary hover:text-text-secondary',
          )}
        >
          {labels[i]}
        </button>
      ))}
    </div>
  )
}
