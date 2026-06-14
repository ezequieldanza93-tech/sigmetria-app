'use client'

import { Smartphone, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PreviewView } from '@/lib/contenido/types'

interface PreviewToggleProps {
  view: PreviewView
  onChange: (view: PreviewView) => void
}

/** Alterna la previsualización entre app móvil y web/escritorio. */
export function PreviewToggle({ view, onChange }: PreviewToggleProps) {
  return (
    <div className="inline-flex items-center rounded-lg border border-border-default bg-surface-base p-0.5">
      <button
        type="button"
        onClick={() => onChange('mobile')}
        aria-pressed={view === 'mobile'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          view === 'mobile'
            ? 'bg-brand-primary text-white'
            : 'text-text-tertiary hover:text-text-primary',
        )}
      >
        <Smartphone size={14} /> Móvil
      </button>
      <button
        type="button"
        onClick={() => onChange('web')}
        aria-pressed={view === 'web'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
          view === 'web'
            ? 'bg-brand-primary text-white'
            : 'text-text-tertiary hover:text-text-primary',
        )}
      >
        <Monitor size={14} /> Web
      </button>
    </div>
  )
}
