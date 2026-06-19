'use client'

import { useState, useEffect, useRef, useActionState } from 'react'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, Search, UserPlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { createPersonaDirectorio } from '@/lib/actions/persona-directorio'
import type { ActionResult } from '@/lib/types'
import type { PersonaDirectorioCreada } from '@/lib/actions/persona-directorio'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface PersonaSeleccionada {
  id: string
  nombre: string
  apellido: string
  dni: string | null
}

interface PersonaRow extends PersonaSeleccionada {
  cargo: string | null
}

interface PersonaSelectorConAltaProps {
  /** persona_id seleccionado (controlado). null = sin selección. */
  value: string | null
  onChange: (persona: PersonaSeleccionada | null) => void
  /** Scope opcional: si se provee, lista las personas vinculadas a ese establecimiento. */
  establecimientoId?: string
  /** Scope opcional: si se provee (y no hay establecimientoId), lista las personas de esa empresa. */
  empresaId?: string
  label?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  id?: string
  /**
   * Si se provee, renderiza un <input type="hidden" name={name}> con el persona_id
   * para que el selector participe del submit nativo de <form action>, igual que SearchableSelect.
   */
  name?: string
  /** Marca como EXTERNA a la persona creada inline (instructores/participantes externos). */
  esExterna?: boolean
  /** Texto cuando el filtro no devuelve resultados. */
  emptyText?: string
}

// ── Carga del directorio (fuera del componente para no fluctuar en deps) ──────

async function fetchPersonas(opts: {
  establecimientoId?: string
  empresaId?: string
}): Promise<PersonaRow[]> {
  const supabase = createClient()

  // Scope por establecimiento: personas vinculadas vía personas_establecimientos.
  if (opts.establecimientoId) {
    const { data } = await supabase
      .from('personas_establecimientos')
      .select('personas_directorio!persona_id(id, nombre, apellido, dni, cargo, is_active)')
      .eq('establecimiento_id', opts.establecimientoId)
    return ((data ?? []) as unknown as { personas_directorio: (PersonaRow & { is_active: boolean }) | null }[])
      .map(pe => pe.personas_directorio)
      .filter((p): p is PersonaRow & { is_active: boolean } => !!p && p.is_active)
      .map(p => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni, cargo: p.cargo }))
      .sort((a, b) => a.apellido.localeCompare(b.apellido))
  }

  // Scope por empresa: personas vinculadas a cualquier establecimiento de la empresa.
  if (opts.empresaId) {
    const { data: estabs } = await supabase
      .from('establecimientos')
      .select('id')
      .eq('empresa_id', opts.empresaId)
    const estabIds = (estabs ?? []).map(e => e.id as string)
    if (estabIds.length === 0) return []
    const { data } = await supabase
      .from('personas_establecimientos')
      .select('personas_directorio!persona_id(id, nombre, apellido, dni, cargo, is_active)')
      .in('establecimiento_id', estabIds)
    const dedup = new Map<string, PersonaRow>()
    for (const pe of (data ?? []) as unknown as { personas_directorio: (PersonaRow & { is_active: boolean }) | null }[]) {
      const p = pe.personas_directorio
      if (p && p.is_active && !dedup.has(p.id)) {
        dedup.set(p.id, { id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni, cargo: p.cargo })
      }
    }
    return [...dedup.values()].sort((a, b) => a.apellido.localeCompare(b.apellido))
  }

  // Sin scope: directorio global activo (mismo criterio que PersonaRolSelector).
  const { data } = await supabase
    .from('personas_directorio')
    .select('id, nombre, apellido, dni, cargo')
    .eq('is_active', true)
    .order('apellido')
  return (data ?? []) as unknown as PersonaRow[]
}

// ── Componente ───────────────────────────────────────────────────────────────

/**
 * SINGLE-select de personas del directorio con buscador + alta inline.
 *
 * - Reusa el look del SearchableSelect (trigger + dropdown con buscador).
 * - Lista personas del directorio (scope opcional por establecimiento/empresa).
 * - Botón "Agregar nueva persona" → mini-form que crea la persona en el
 *   directorio reusando la server action `createPersonaDirectorio`, y la deja
 *   seleccionada (sin recargar la página). Si `esExterna`, la marca como externa.
 * - Emite el contrato `{ id, nombre, apellido, dni }` (igual que PersonaRolSelector).
 */
export function PersonaSelectorConAlta({
  value,
  onChange,
  establecimientoId,
  empresaId,
  label,
  placeholder = 'Seleccionar persona…',
  required = false,
  disabled = false,
  id,
  name,
  esExterna = false,
  emptyText = 'Sin resultados.',
}: PersonaSelectorConAltaProps) {
  const [personas, setPersonas] = useState<PersonaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showCrear, setShowCrear] = useState(false)

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
  const listboxId = selectId ? `${selectId}-listbox` : undefined

  const selected = value ? personas.find(p => p.id === value) ?? null : null

  // Carga del directorio según scope.
  useEffect(() => {
    setLoading(true)
    fetchPersonas({ establecimientoId, empresaId }).then(rows => {
      setPersonas(rows)
      setLoading(false)
    })
  }, [establecimientoId, empresaId])

  // Cierra al click afuera.
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // Al abrir: foco al buscador.
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? personas.filter(
        p =>
          `${p.nombre} ${p.apellido}`.toLowerCase().includes(normalizedQuery) ||
          p.apellido.toLowerCase().includes(normalizedQuery) ||
          (p.dni?.includes(normalizedQuery) ?? false),
      )
    : personas

  function openMenu() {
    if (disabled) return
    setOpen(true)
  }

  function selectPersona(p: PersonaRow) {
    setOpen(false)
    setQuery('')
    onChange({ id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni })
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange(null)
    setQuery('')
  }

  function handleCrearClick() {
    setOpen(false)
    setQuery('')
    setShowCrear(true)
  }

  async function handleCrearSuccess(persona: PersonaDirectorioCreada) {
    // Refrescar y seleccionar la persona recién creada.
    const rows = await fetchPersonas({ establecimientoId, empresaId })
    // Si el scope no la incluye (alta global sin vínculo), la agregamos igual
    // para que quede visible y seleccionada en esta sesión.
    const exists = rows.some(r => r.id === persona.id)
    const base = exists ? rows : [{ ...persona, cargo: null }, ...rows]
    setPersonas([...base].sort((a, b) => a.apellido.localeCompare(b.apellido)))
    onChange({ id: persona.id, nombre: persona.nombre, apellido: persona.apellido, dni: persona.dni })
    setShowCrear(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-text-secondary">
          {label}
          {required && <span className="text-[var(--danger)] ml-1">*</span>}
        </label>
      )}

      <div ref={rootRef} className="relative">
        {/* Valor para el submit nativo del form. */}
        {name && <input type="hidden" name={name} value={value ?? ''} />}

        {/* Trigger con el valor elegido. */}
        <button
          type="button"
          id={selectId}
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? listboxId : undefined}
          aria-required={required || undefined}
          disabled={disabled}
          onClick={() => (open ? setOpen(false) : openMenu())}
          className={cn(
            'w-full flex items-center gap-2 border border-border-default rounded-lg px-3 py-2 text-sm text-left bg-surface-base',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:border-transparent',
            'disabled:bg-surface-sunken disabled:text-text-tertiary disabled:cursor-not-allowed',
          )}
        >
          <span className={cn('flex-1 truncate', !selected && 'text-text-tertiary')}>
            {selected ? `${selected.apellido}, ${selected.nombre}` : placeholder}
          </span>
          {selected && !disabled && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Limpiar selección"
              onClick={clear}
              className="text-text-tertiary hover:text-text-primary shrink-0"
            >
              <X className="w-4 h-4" />
            </span>
          )}
          <ChevronDown
            className={cn('w-4 h-4 text-text-tertiary shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>

        {open && (
          <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-surface-base border border-border-default rounded-xl shadow-xl overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
              <Search className="w-4 h-4 text-text-tertiary shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar por nombre o DNI…"
                aria-label="Buscar persona"
                className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              />
            </div>

            <ul id={listboxId} role="listbox" aria-label={label} className="max-h-60 overflow-y-auto py-1">
              {loading ? (
                <li className="px-3 py-3 text-xs text-text-tertiary text-center">Cargando…</li>
              ) : filtered.length === 0 ? (
                <li className="px-3 py-3 text-xs text-text-tertiary text-center">{emptyText}</li>
              ) : (
                filtered.map(p => {
                  const isSelected = p.id === value
                  return (
                    <li
                      key={p.id}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectPersona(p)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-sunken text-text-primary',
                        isSelected && 'bg-sig-50',
                      )}
                    >
                      <span className="flex-1 truncate">
                        <span className="font-medium">{p.apellido}</span>, {p.nombre}
                      </span>
                      <span className="text-xs text-text-tertiary shrink-0">
                        {p.cargo ?? ''}{p.dni ? `${p.cargo ? ' · ' : ''}${p.dni}` : ''}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-brand-primary shrink-0" />}
                    </li>
                  )
                })
              )}
            </ul>

            {/* Separador + acción crear */}
            <div className="border-t border-border-subtle">
              <button
                type="button"
                onClick={handleCrearClick}
                className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-sig-600 hover:bg-sig-50 transition-colors font-medium"
              >
                <UserPlus className="w-4 h-4 shrink-0" />
                Agregar nueva persona…
              </button>
            </div>
          </div>
        )}

        {/* Mini-form inline: alta de persona en el directorio */}
        {showCrear && (
          <CrearPersonaInline
            esExterna={esExterna}
            onSuccess={handleCrearSuccess}
            onCancel={() => setShowCrear(false)}
          />
        )}
      </div>
    </div>
  )
}

// ── Mini-form de alta inline ──────────────────────────────────────────────────

interface CrearPersonaInlineProps {
  esExterna: boolean
  onSuccess: (persona: PersonaDirectorioCreada) => void
  onCancel: () => void
}

const INITIAL_STATE: ActionResult<PersonaDirectorioCreada> | null = null

function CrearPersonaInline({ esExterna, onSuccess, onCancel }: CrearPersonaInlineProps) {
  const [state, action, pending] = useActionState(createPersonaDirectorio, INITIAL_STATE)

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => {
    if (state?.success && state.data) onSuccessRef.current(state.data)
  }, [state])

  // El form se monta al abrir "Agregar nueva persona": lo traemos a la vista para
  // que el botón "Crear y seleccionar" no quede tapado por el footer sticky del
  // modal ni debajo del fold.
  const formRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [])

  return (
    <div ref={formRef} className="mt-2 rounded-lg border border-sig-200 bg-sig-50/50 p-3 space-y-2">
      <p className="text-xs font-semibold text-sig-700 uppercase tracking-wide">
        {esExterna ? 'Nueva persona externa' : 'Nueva persona en el directorio'}
      </p>
      <form action={action} className="space-y-2">
        {/* Marca de externa para la action. */}
        <input type="hidden" name="es_externa" value={esExterna ? 'true' : 'false'} />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-text-secondary mb-0.5">
              Nombre <span className="text-red-500">*</span>
            </label>
            <input
              name="nombre"
              required
              className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-base"
              placeholder="Nombre"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-0.5">
              Apellido <span className="text-red-500">*</span>
            </label>
            <input
              name="apellido"
              required
              className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-base"
              placeholder="Apellido"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-text-secondary mb-0.5">DNI</label>
            <input
              name="dni"
              className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-base"
              placeholder="12345678"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-0.5">Cargo</label>
            <input
              name="cargo"
              className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-base"
              placeholder="Función / puesto"
            />
          </div>
        </div>
        {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
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
  )
}
