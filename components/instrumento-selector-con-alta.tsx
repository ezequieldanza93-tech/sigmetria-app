'use client'

import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, Search, Plus, X } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { InstrumentoCreateForm } from '@/components/instrumento-create-form'
import type { InstrumentoCreado } from '@/lib/actions/instrumento'

// ── Tipos ──────────────────────────────────────────────────────────────────────

/**
 * Shape mínimo que comparten todos los instrumentos de medición
 * (telurímetro, luxómetro, sonómetro, monitor de estrés térmico).
 */
export interface InstrumentoOpcion {
  id: string
  modelo: string
  numero_serie: string | null
  marca: string | null
  /** Sólo Ruido lo usa en su label. Opcional para el resto. */
  tipo?: string | null
}

interface InstrumentoSelectorConAltaProps {
  /** Lista de instrumentos del tipo correspondiente (la trae el modal). */
  instrumentos: InstrumentoOpcion[]
  /** instrumento_id seleccionado (controlado). '' = sin selección. */
  value: string
  /** Devuelve el id elegido (igual que el <select> nativo que reemplaza). */
  onChange: (id: string) => void
  /**
   * Nombre de la subcategoría del catálogo Mediciones HyS, tal cual lo usa el
   * modal para filtrar sus instrumentos: "Puesta a Tierra (PAT)", "Iluminación",
   * "Ruido", "Carga Térmica". Se usa para el alta inline.
   */
  subcategoriaNombre: string
  /**
   * Aviso al crear un instrumento: el modal lo agrega a su estado local de la
   * lista para que quede visible (y seleccionado vía onChange).
   */
  onCreated: (nuevo: InstrumentoOpcion) => void
  /** Etiqueta legible del tipo de equipo, para placeholders ("telurímetro"). */
  instrumentoLabel?: string
  disabled?: boolean
  /** Texto cuando la lista está vacía y aún no se abrió el alta. */
  emptyText?: string
}

// ── Componente ──────────────────────────────────────────────────────────────────

/**
 * Selector de instrumento con alta inline. Reemplaza el <select> nativo de los
 * modales de medición (PAT, iluminación, ruido, carga térmica).
 *
 * - Dropdown con buscador sobre la lista provista por el modal.
 * - Botón "Agregar instrumento" → mini-form inline (modelo + N° de serie) que
 *   llama crearInstrumentoInline, agrega el nuevo a la lista y lo selecciona.
 *
 * El valor expuesto vía onChange es SIEMPRE el id del instrumento — idéntico a
 * lo que el modal esperaba del <select> nativo, así el guardado no cambia.
 */
export function InstrumentoSelectorConAlta({
  instrumentos,
  value,
  onChange,
  subcategoriaNombre,
  onCreated,
  instrumentoLabel = 'instrumento',
  disabled = false,
  emptyText = 'Sin instrumentos cargados.',
}: InstrumentoSelectorConAltaProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Modal con el formulario COMPLETO de alta de instrumento (el mismo de
  // /dashboard/instrumentos): marca/modelo del catálogo + certificado.
  const [showCrear, setShowCrear] = useState(false)

  const seleccionado = instrumentos.find(i => i.id === value) ?? null

  // Cierre al click afuera.
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => { if (open) inputRef.current?.focus() }, [open])

  function labelOf(i: InstrumentoOpcion): string {
    const base = [i.marca, i.modelo].filter(Boolean).join(' ')
    const tipo = i.tipo ? ` · ${i.tipo}` : ''
    const serie = i.numero_serie ? ` · N° ${i.numero_serie}` : ''
    return `${base}${tipo}${serie}`
  }

  const normalized = query.trim().toLowerCase()
  const filtrados = normalized
    ? instrumentos.filter(i => labelOf(i).toLowerCase().includes(normalized))
    : instrumentos

  function select(i: InstrumentoOpcion) {
    setOpen(false)
    setQuery('')
    onChange(i.id)
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
  }

  function handleCrearClick() {
    setOpen(false)
    setQuery('')
    setShowCrear(true)
  }

  // El formulario completo creó un instrumento: lo agregamos a la lista del
  // selector y lo dejamos seleccionado, sin salir del modal de medición.
  function handleCreated(creado: InstrumentoCreado | null) {
    if (creado) {
      onCreated({
        id: creado.id,
        modelo: creado.modelo,
        numero_serie: creado.numero_serie,
        marca: creado.marca,
      })
      onChange(creado.id)
    }
    setShowCrear(false)
  }

  const triggerCls = cn(
    'w-full flex items-center gap-2 border border-border-default rounded-lg px-3 py-2 text-sm text-left bg-surface-base',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:border-transparent',
    'disabled:bg-surface-sunken disabled:text-text-tertiary disabled:cursor-not-allowed',
  )
  const dropdownCls = 'absolute top-full mt-1 left-0 right-0 z-50 bg-surface-base border border-border-default rounded-xl shadow-xl overflow-hidden'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className={triggerCls}
      >
        <span className={cn('flex-1 truncate', !seleccionado && 'text-text-tertiary')}>
          {seleccionado ? labelOf(seleccionado) : 'Seleccionar instrumento…'}
        </span>
        {seleccionado && !disabled && (
          <span
            role="button"
            tabIndex={-1}
            aria-label="Limpiar"
            onClick={clear}
            className="text-text-tertiary hover:text-text-primary shrink-0"
          >
            <X className="w-4 h-4" />
          </span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-text-tertiary shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className={dropdownCls}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
            <Search className="w-4 h-4 text-text-tertiary shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Buscar instrumento…"
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
          <ul role="listbox" className="max-h-52 overflow-y-auto py-1">
            {filtrados.length === 0 ? (
              <li className="px-3 py-3 text-xs text-text-tertiary text-center">
                {instrumentos.length === 0 ? emptyText : 'Sin resultados.'}
              </li>
            ) : (
              filtrados.map(i => (
                <li
                  key={i.id}
                  role="option"
                  aria-selected={i.id === value}
                  onClick={() => select(i)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-sunken text-text-primary',
                    i.id === value && 'bg-sig-50',
                  )}
                >
                  <span className="flex-1 truncate">{labelOf(i)}</span>
                  {i.id === value && <Check className="w-4 h-4 text-brand-primary shrink-0" />}
                </li>
              ))
            )}
          </ul>
          <div className="border-t border-border-subtle">
            <button
              type="button"
              onClick={handleCrearClick}
              className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-sig-600 hover:bg-sig-50 transition-colors font-medium"
            >
              <Plus className="w-4 h-4 shrink-0" />
              Agregar {instrumentoLabel} nuevo…
            </button>
          </div>
        </div>
      )}

      {/* Alta COMPLETA en Modal — el mismo formulario de /dashboard/instrumentos
          (modelo/marca del catálogo + certificado de calibración), con el tipo
          de medición fijado al de este selector. Al guardar, el nuevo instrumento
          se agrega a la lista y queda seleccionado. */}
      <Modal
        open={showCrear}
        onClose={() => setShowCrear(false)}
        title={`Nuevo ${instrumentoLabel}`}
        size="full"
      >
        <InstrumentoCreateForm
          lockedSubcategoriaNombre={subcategoriaNombre}
          onCreated={handleCreated}
        />
      </Modal>
    </div>
  )
}
