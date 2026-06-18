'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface MultiSelectOption {
  value: string
  label: string
}

interface Props {
  /** Etiqueta visible en el trigger (ej. "Tipo", "Ámbito"). */
  label: string
  /** Opciones disponibles. */
  options: MultiSelectOption[]
  /**
   * Conjunto de `value`s tildados. Por convención el padre lo inicializa
   * con TODOS los values (= se ve todo, sin filtrar).
   */
  selected: Set<string>
  /** Devuelve el nuevo conjunto de seleccionados. */
  onChange: (next: Set<string>) => void
  /** Texto cuando no hay opciones. */
  emptyLabel?: string
  className?: string
}

/**
 * Filtro genérico multi-select con fila "Todos".
 *
 * - El padre inicializa `selected` con todos los values → estado por defecto "todo visible".
 * - Fila "Todos" arriba: tildada si están TODAS; parcial (indeterminate) si algunas;
 *   click alterna entre seleccionar todas / deseleccionar todas.
 * - Cada opción es un checkbox independiente (multi-select).
 *
 * Reutilizable en toda la app. Estética minimalista con tokens del design system.
 */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  emptyLabel = 'Sin opciones',
  className,
}: Props) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  const total = options.length
  const selectedCount = options.reduce((acc, o) => acc + (selected.has(o.value) ? 1 : 0), 0)
  const allSelected = total > 0 && selectedCount === total

  // Resumen en el trigger: "Todos" si todas tildadas, sino "N/M".
  const summary = allSelected || total === 0 ? 'Todos' : `${selectedCount}/${total}`

  useEffect(() => {
    if (!open) return
    function handlePointer(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current && !triggerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  function handleToggleOpen() {
    if (!open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setOpen((v) => !v)
  }

  function toggleOne(value: string) {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(next)
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap',
          !allSelected && total > 0
            ? 'border-brand-primary/40 bg-brand-primary/5 text-text-primary'
            : 'border-border-default bg-surface-base text-text-secondary hover:bg-surface-elevated',
          className,
        )}
      >
        <span>{label}</span>
        <span className="text-[10px] font-semibold text-text-tertiary">{summary}</span>
        <ChevronDown
          className={cn('h-3 w-3 text-text-tertiary transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && pos && createPortal(
        <div
          ref={dropdownRef}
          id={panelId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={label}
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            minWidth: Math.max(pos.width, 220),
            zIndex: 9999,
          }}
          className="max-h-80 overflow-y-auto rounded-xl border border-border-default bg-surface-elevated shadow-xl py-1"
        >
          {total === 0 ? (
            <div className="px-3 py-2 text-xs italic text-text-tertiary">{emptyLabel}</div>
          ) : (
            <>
              {/* Opciones individuales */}
              {options.map((opt) => {
                const isOn = selected.has(opt.value)
                return (
                  <label
                    key={opt.value}
                    role="option"
                    aria-selected={isOn}
                    className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs text-text-primary hover:bg-surface-sunken transition-colors"
                  >
                    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
                      <input
                        type="checkbox"
                        checked={isOn}
                        onChange={() => toggleOne(opt.value)}
                        className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-border-default checked:border-brand-primary checked:bg-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                      />
                      {isOn && (
                        <Check className="pointer-events-none absolute h-3 w-3 text-white" aria-hidden="true" />
                      )}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </label>
                )
              })}

              <div className="my-1 border-t border-border-subtle" role="separator" />

              {/* Acciones rápidas: Todos / Ninguno (para no destildar 1 por 1) */}
              <div className="flex items-center gap-1.5 px-3 py-1.5">
                <button
                  type="button"
                  onClick={() => onChange(new Set(options.map((o) => o.value)))}
                  className="flex-1 rounded-md border border-border-default px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-sunken transition-colors"
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => onChange(new Set())}
                  className="flex-1 rounded-md border border-border-default px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-sunken transition-colors"
                >
                  Ninguno
                </button>
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
