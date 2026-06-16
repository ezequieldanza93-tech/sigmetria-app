'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, Plus, Search, Users, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface PersonaMultiSelectValue {
  /** persona_id de cada persona del directorio seleccionada. */
  personaIds: string[]
  /** Nombres sueltos cargados como texto libre (terceros no presentes en el directorio). */
  sueltos: string[]
}

interface PersonaRow {
  id: string
  nombre: string
  apellido: string
  dni: string | null
}

interface PersonaMultiSelectConSueltosProps {
  value: PersonaMultiSelectValue
  onChange: (value: PersonaMultiSelectValue) => void
  /** Scope opcional: lista las personas vinculadas a ese establecimiento. */
  establecimientoId?: string
  /** Scope opcional: lista las personas de esa empresa (si no hay establecimientoId). */
  empresaId?: string
  label?: string
  placeholder?: string
  disabled?: boolean
  /** Texto cuando el filtro no devuelve resultados. */
  emptyText?: string
}

// ── Carga del directorio (fuera del componente para no fluctuar en deps) ──────

async function fetchPersonas(opts: {
  establecimientoId?: string
  empresaId?: string
}): Promise<PersonaRow[]> {
  const supabase = createClient()

  if (opts.establecimientoId) {
    const { data } = await supabase
      .from('personas_establecimientos')
      .select('personas_directorio!persona_id(id, nombre, apellido, dni, is_active)')
      .eq('establecimiento_id', opts.establecimientoId)
    return ((data ?? []) as unknown as { personas_directorio: (PersonaRow & { is_active: boolean }) | null }[])
      .map(pe => pe.personas_directorio)
      .filter((p): p is PersonaRow & { is_active: boolean } => !!p && p.is_active)
      .map(p => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni }))
      .sort((a, b) => a.apellido.localeCompare(b.apellido))
  }

  if (opts.empresaId) {
    const { data: estabs } = await supabase
      .from('establecimientos')
      .select('id')
      .eq('empresa_id', opts.empresaId)
    const estabIds = (estabs ?? []).map(e => e.id as string)
    if (estabIds.length === 0) return []
    const { data } = await supabase
      .from('personas_establecimientos')
      .select('personas_directorio!persona_id(id, nombre, apellido, dni, is_active)')
      .in('establecimiento_id', estabIds)
    const dedup = new Map<string, PersonaRow>()
    for (const pe of (data ?? []) as unknown as { personas_directorio: (PersonaRow & { is_active: boolean }) | null }[]) {
      const p = pe.personas_directorio
      if (p && p.is_active && !dedup.has(p.id)) {
        dedup.set(p.id, { id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni })
      }
    }
    return [...dedup.values()].sort((a, b) => a.apellido.localeCompare(b.apellido))
  }

  const { data } = await supabase
    .from('personas_directorio')
    .select('id, nombre, apellido, dni')
    .eq('is_active', true)
    .order('apellido')
  return (data ?? []) as unknown as PersonaRow[]
}

// ── Componente ───────────────────────────────────────────────────────────────

/**
 * MULTI-select de personas del directorio (chips/checkboxes) + nombres SUELTOS
 * como texto libre (terceros no cargados en el directorio).
 *
 * - Pensado para involucrados/testigos de incidentes y denuncias: la mayoría
 *   sale del directorio (FK), pero se admite cargar nombres sueltos de terceros
 *   que no están (ni se quieren cargar) en el directorio.
 * - Reusa el look del SearchableSelect (trigger + dropdown con buscador).
 * - Value: { personaIds: string[], sueltos: string[] }.
 */
export function PersonaMultiSelectConSueltos({
  value,
  onChange,
  establecimientoId,
  empresaId,
  label,
  placeholder = 'Agregar personas…',
  disabled = false,
  emptyText = 'Sin resultados.',
}: PersonaMultiSelectConSueltosProps) {
  const [personas, setPersonas] = useState<PersonaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sueltoInput, setSueltoInput] = useState('')

  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

  const selectedSet = new Set(value.personaIds)
  const selectedPersonas = personas.filter(p => selectedSet.has(p.id))
  // persona_ids seleccionados que no figuran en el directorio cargado (otro scope/baja):
  // se conservan en el value pero no se muestran como chip etiquetado (no rompen nada).

  function togglePersona(id: string) {
    if (disabled) return
    const next = selectedSet.has(id)
      ? value.personaIds.filter(pid => pid !== id)
      : [...value.personaIds, id]
    onChange({ personaIds: next, sueltos: value.sueltos })
  }

  function removePersona(id: string) {
    if (disabled) return
    onChange({ personaIds: value.personaIds.filter(pid => pid !== id), sueltos: value.sueltos })
  }

  function addSuelto() {
    if (disabled) return
    const nombre = sueltoInput.trim()
    if (!nombre) return
    // Evitar duplicados exactos (case-insensitive).
    const exists = value.sueltos.some(s => s.toLowerCase() === nombre.toLowerCase())
    if (!exists) onChange({ personaIds: value.personaIds, sueltos: [...value.sueltos, nombre] })
    setSueltoInput('')
  }

  function removeSuelto(nombre: string) {
    if (disabled) return
    onChange({ personaIds: value.personaIds, sueltos: value.sueltos.filter(s => s !== nombre) })
  }

  function handleSueltoKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addSuelto()
    }
  }

  const totalSeleccionados = value.personaIds.length + value.sueltos.length

  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-sm font-medium text-text-secondary">{label}</span>}

      {/* Chips seleccionados (directorio + sueltos) */}
      {(selectedPersonas.length > 0 || value.sueltos.length > 0) && (
        <div className="flex flex-wrap gap-1.5">
          {selectedPersonas.map(p => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 rounded-full bg-sig-50 text-sig-700 text-xs font-medium px-2.5 py-1 border border-sig-200"
            >
              {p.apellido}, {p.nombre}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removePersona(p.id)}
                  aria-label={`Quitar ${p.apellido}, ${p.nombre}`}
                  className="text-sig-500 hover:text-sig-700"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
          {value.sueltos.map(s => (
            <span
              key={`suelto-${s}`}
              className="inline-flex items-center gap-1 rounded-full bg-surface-elevated text-text-secondary text-xs font-medium px-2.5 py-1 border border-border-subtle"
            >
              <span className="italic">{s}</span>
              <span className="text-text-tertiary">(suelto)</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeSuelto(s)}
                  aria-label={`Quitar ${s}`}
                  className="text-text-tertiary hover:text-text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      <div ref={rootRef} className="relative">
        {/* Trigger */}
        <button
          type="button"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className={cn(
            'w-full flex items-center gap-2 border border-border-default rounded-lg px-3 py-2 text-sm text-left bg-surface-base',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:border-transparent',
            'disabled:bg-surface-sunken disabled:text-text-tertiary disabled:cursor-not-allowed',
          )}
        >
          <Users className="w-4 h-4 text-text-tertiary shrink-0" />
          <span className={cn('flex-1 truncate', totalSeleccionados === 0 && 'text-text-tertiary')}>
            {totalSeleccionados === 0 ? placeholder : `${totalSeleccionados} seleccionada${totalSeleccionados === 1 ? '' : 's'}`}
          </span>
          <ChevronDown
            className={cn('w-4 h-4 text-text-tertiary shrink-0 transition-transform', open && 'rotate-180')}
          />
        </button>

        {open && (
          <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-surface-base border border-border-default rounded-xl shadow-xl overflow-hidden">
            {/* Buscador del directorio */}
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

            {/* Lista con checkboxes */}
            <ul role="listbox" aria-label={label} aria-multiselectable className="max-h-52 overflow-y-auto py-1">
              {loading ? (
                <li className="px-3 py-3 text-xs text-text-tertiary text-center">Cargando…</li>
              ) : filtered.length === 0 ? (
                <li className="px-3 py-3 text-xs text-text-tertiary text-center">{emptyText}</li>
              ) : (
                filtered.map(p => {
                  const isChecked = selectedSet.has(p.id)
                  return (
                    <li
                      key={p.id}
                      role="option"
                      aria-selected={isChecked}
                      onClick={() => togglePersona(p.id)}
                      className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-sunken text-text-primary"
                    >
                      <span
                        className={cn(
                          'w-4 h-4 rounded border flex items-center justify-center shrink-0',
                          isChecked ? 'bg-sig-600 border-sig-600' : 'border-border-default bg-surface-base',
                        )}
                      >
                        {isChecked && <Check className="w-3 h-3 text-white" />}
                      </span>
                      <span className="flex-1 truncate">
                        <span className="font-medium">{p.apellido}</span>, {p.nombre}
                      </span>
                      {p.dni && <span className="text-xs text-text-tertiary shrink-0">{p.dni}</span>}
                    </li>
                  )
                })
              )}
            </ul>

            {/* Agregar nombre suelto */}
            <div className="border-t border-border-subtle p-2">
              <p className="text-[11px] text-text-tertiary mb-1 px-1">
                ¿No está en el directorio? Agregalo como nombre suelto:
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={sueltoInput}
                  onChange={e => setSueltoInput(e.target.value)}
                  onKeyDown={handleSueltoKeyDown}
                  placeholder="Nombre y apellido…"
                  aria-label="Agregar nombre suelto"
                  className="flex-1 border border-border-default rounded px-2 py-1 text-sm bg-surface-base placeholder:text-text-tertiary focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
                />
                <button
                  type="button"
                  onClick={addSuelto}
                  disabled={!sueltoInput.trim()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-sm bg-sig-600 text-white rounded hover:bg-sig-700 disabled:opacity-50 transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Agregar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
