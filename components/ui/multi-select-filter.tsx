'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

/** Separación entre el borde inferior del trigger y el panel. */
const GAP = 6
/** Margen mínimo respecto a los bordes del viewport al hacer clamp. */
const VIEWPORT_MARGIN = 8

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
  const allCheckboxRef = useRef<HTMLInputElement>(null)
  const panelId = useId()

  /**
   * Calcula la posición del panel ANCLADO AL BORDE INFERIOR del trigger.
   * - Por defecto abre hacia abajo: `top = triggerRect.bottom + GAP`.
   * - Solo hace FLIP hacia arriba si no entra abajo y hay más espacio arriba.
   * - `left` se clampa al viewport para que el panel no se salga de pantalla.
   */
  const recalc = useCallback(() => {
    const trigger = triggerRef.current
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Ancho real del panel (mínimo 220). Si todavía no se montó, estimamos con el trigger.
    const panelWidth = Math.max(dropdownRef.current?.offsetWidth ?? 0, rect.width, 220)
    // Alto real del panel una vez montado (acotado por el max-h-80 del CSS = 320px).
    const panelHeight = dropdownRef.current?.offsetHeight ?? 0

    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top
    // Flip hacia arriba SOLO si no hay lugar abajo para el panel y arriba hay más.
    const flipUp =
      panelHeight > 0 &&
      spaceBelow < panelHeight + GAP &&
      spaceAbove > spaceBelow

    const top = flipUp ? rect.top - panelHeight - GAP : rect.bottom + GAP

    // Clamp horizontal: arranca alineado al borde izquierdo del trigger.
    let left = rect.left
    const maxLeft = vw - panelWidth - VIEWPORT_MARGIN
    if (left > maxLeft) left = maxLeft
    if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN

    setPos({ top, left, width: rect.width })
  }, [])

  const total = options.length
  const selectedCount = options.reduce((acc, o) => acc + (selected.has(o.value) ? 1 : 0), 0)
  const allSelected = total > 0 && selectedCount === total
  const noneSelected = selectedCount === 0
  const partial = !allSelected && !noneSelected

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
    // Recalcular si la página hace scroll (capture: alcanza scroll de cualquier
    // contenedor) o cambia el tamaño del viewport, así el panel sigue al trigger.
    document.addEventListener('mousedown', handlePointer)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('scroll', recalc, true)
    window.addEventListener('resize', recalc)
    return () => {
      document.removeEventListener('mousedown', handlePointer)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('scroll', recalc, true)
      window.removeEventListener('resize', recalc)
    }
  }, [open, recalc])

  // Tras montar el panel ya conocemos su alto real → reposicionar para decidir
  // el flip y el clamp con medidas exactas (evita el "salto" inicial).
  useLayoutEffect(() => {
    if (open) recalc()
  }, [open, recalc, total])

  // El estado "indeterminate" del checkbox "Todos" solo se setea por DOM.
  useEffect(() => {
    if (allCheckboxRef.current) allCheckboxRef.current.indeterminate = partial
  }, [partial, open])

  function handleToggleOpen() {
    if (!open) {
      // Posición inicial (hacia abajo). useLayoutEffect la refina con el alto real.
      recalc()
    }
    setOpen((v) => !v)
  }

  function toggleOne(value: string) {
    const next = new Set(selected)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    onChange(next)
  }

  function toggleAll() {
    // Si están todas tildadas → deselecciona todas. Sino → selecciona todas.
    if (allSelected) onChange(new Set())
    else onChange(new Set(options.map((o) => o.value)))
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
              {/* Fila "Todos" */}
              <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-xs font-semibold text-text-primary hover:bg-surface-sunken transition-colors">
                <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
                  <input
                    ref={allCheckboxRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-border-default checked:border-brand-primary checked:bg-brand-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                  />
                  {allSelected && (
                    <Check className="pointer-events-none absolute h-3 w-3 text-white" aria-hidden="true" />
                  )}
                  {partial && (
                    <Minus className="pointer-events-none absolute h-3 w-3 text-brand-primary" aria-hidden="true" />
                  )}
                </span>
                Todos
              </label>

              <div className="my-1 border-t border-border-subtle" role="separator" />

              {/* Opciones */}
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
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
