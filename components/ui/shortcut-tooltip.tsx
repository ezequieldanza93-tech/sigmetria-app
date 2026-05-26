'use client'

import { type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { SHORTCUT_ACTION_MAP, type ShortcutAction } from '@/lib/constants/shortcuts'

interface ShortcutTooltipProps {
  action: ShortcutAction
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}

function KbdKey({ k }: { k: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-mono font-semibold rounded border border-border-default bg-surface-sunken text-text-secondary shadow-[0_1px_0_var(--border-default)]">
      {k}
    </kbd>
  )
}

/**
 * Wraps any element with a keyboard shortcut tooltip.
 * The tooltip only appears on desktop (≥1024px) on hover.
 * Children are always rendered regardless of screen size.
 */
export function ShortcutTooltip({
  action,
  children,
  side = 'bottom',
  className,
}: ShortcutTooltipProps) {
  const def = SHORTCUT_ACTION_MAP[action]
  if (!def) return <>{children}</>

  return (
    <div className={cn('relative inline-flex group/stip', className)}>
      {children}

      {/* Tooltip: desktop only, delayed fade-in */}
      <div
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute z-[200] w-max max-w-[220px]',
          // Hidden on small screens, shown with CSS hover on lg+
          'hidden lg:block',
          'opacity-0 group-hover/stip:opacity-100',
          'transition-opacity duration-150 delay-[600ms]',
          // Position variants
          side === 'bottom' && 'top-full left-1/2 -translate-x-1/2 pt-2',
          side === 'top' && 'bottom-full left-1/2 -translate-x-1/2 pb-2',
          side === 'left' && 'right-full top-1/2 -translate-y-1/2 pr-2',
          side === 'right' && 'left-full top-1/2 -translate-y-1/2 pl-2',
        )}
      >
        <div className="flex flex-col items-center gap-1 bg-surface-elevated border border-border-subtle rounded-lg px-2.5 py-1.5 shadow-lg text-center">
          <span className="text-[11px] font-medium text-text-primary leading-tight">{def.label}</span>
          <div className="flex items-center gap-0.5">
            {def.keysDisplay.map((k, i) => (
              <span key={i} className="flex items-center gap-0.5">
                {i > 0 && <span className="text-text-tertiary text-[9px] mx-0.5">+</span>}
                <KbdKey k={k} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
