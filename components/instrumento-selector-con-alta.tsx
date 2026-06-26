'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, Search, Plus, X } from 'lucide-react'
import { crearInstrumentoInline } from '@/lib/actions/instrumento'

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

  // Mini-form de alta inline.
  const [showCrear, setShowCrear] = useState(false)
  const [nuevoModelo, setNuevoModelo] = useState('')
  const [nuevaSerie, setNuevaSerie] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const crearFormRef = useRef<HTMLDivElement>(null)

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

  // Traer a la vista el mini-form al abrirlo (queda al fondo de un modal con scroll).
  useEffect(() => {
    if (showCrear) crearFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [showCrear])

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
    setNuevoModelo('')
    setNuevaSerie('')
    setError(null)
  }

  function handleCrearSubmit(e: React.FormEvent) {
    e.preventDefault()
    const modelo = nuevoModelo.trim()
    if (!modelo) { setError('El modelo es obligatorio'); return }
    setError(null)
    startTransition(async () => {
      const res = await crearInstrumentoInline({
        subcategoriaNombre,
        modelo,
        numeroSerie: nuevaSerie.trim() || null,
      })
      if (!res.success) { setError(res.error); return }
      onCreated(res.data)
      onChange(res.data.id)
      setShowCrear(false)
      setNuevoModelo('')
      setNuevaSerie('')
    })
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

      {/* Mini-form alta inline */}
      {showCrear && (
        <div ref={crearFormRef} className="mt-2 rounded-lg border border-sig-200 bg-sig-50/50 p-3 space-y-2">
          <p className="text-xs font-semibold text-sig-700 uppercase tracking-wide">Nuevo {instrumentoLabel}</p>
          <form onSubmit={handleCrearSubmit} className="space-y-2">
            <div>
              <label className="block text-xs text-text-secondary mb-0.5">
                Modelo <span className="text-red-500">*</span>
              </label>
              <input
                autoFocus
                value={nuevoModelo}
                onChange={e => setNuevoModelo(e.target.value)}
                placeholder="Ej: Testo 815, Fluke 1623…"
                className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-base"
              />
            </div>
            <div>
              <label className="block text-xs text-text-secondary mb-0.5">N° de serie</label>
              <input
                value={nuevaSerie}
                onChange={e => setNuevaSerie(e.target.value)}
                placeholder="Opcional · Ej: SN-12345"
                className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-base"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <p className="text-xs text-text-tertiary">
              Se agrega al catálogo de instrumentos (Mediciones HyS) y queda seleccionado. El certificado de calibración se carga después en Instrumentos.
            </p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => { setShowCrear(false); setNuevoModelo(''); setNuevaSerie(''); setError(null) }}
                className="px-3 py-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={pending}
                className="px-3 py-1 text-sm bg-sig-600 text-white rounded hover:bg-sig-700 disabled:opacity-60 transition-colors"
              >
                {pending ? 'Guardando…' : 'Crear y seleccionar'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
