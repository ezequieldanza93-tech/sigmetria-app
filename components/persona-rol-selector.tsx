'use client'

import { useState, useEffect, useRef, useActionState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createPersonaDirectorio } from '@/lib/actions/persona-directorio'
import type { ActionResult } from '@/lib/types'

// ── Tipos ────────────────────────────────────────────────────────────────────

interface Persona {
  id: string
  nombre: string
  apellido: string
  email: string | null
  dni: string | null
  personas_tipos?: { nombre: string } | null
}

export interface PersonaRolSelectorValue {
  id: string
  nombre: string
  apellido: string
  dni: string | null
}

interface PersonaRolSelectorProps {
  /** UUID de la persona seleccionada (controlado) */
  value?: string | null
  onChange: (persona: PersonaRolSelectorValue | null) => void
  disabled?: boolean
  placeholder?: string
}

// ── Helper de carga (fuera del componente para no fluctuar en deps) ──────────

async function fetchPersonasDirectorio(): Promise<Persona[]> {
  const supabase = createClient()
  const { data: pd } = await supabase
    .from('personas_directorio')
    .select('id, nombre, apellido, email, dni, personas_tipos(nombre)')
    .eq('is_active', true)
    .order('apellido')
  return (pd ?? []) as unknown as Persona[]
}

// ── Componente ───────────────────────────────────────────────────────────────

export function PersonaRolSelector({
  value,
  onChange,
  disabled = false,
  placeholder = 'Buscar persona…',
}: PersonaRolSelectorProps) {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Persona | null>(null)
  const [showCrear, setShowCrear] = useState(false)
  const [loadingPersonas, setLoadingPersonas] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setLoadingPersonas(true)
    fetchPersonasDirectorio().then(raw => {
      setPersonas(raw)
      setLoadingPersonas(false)
      if (value) {
        const found = raw.find(p => p.id === value)
        if (found) {
          setSelected(found)
          setSearch(`${found.apellido}, ${found.nombre}`)
        }
      }
    })
  }, [value])

  // ── Click-outside ─────────────────────────────────────────────────────────

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  // ── Filtro ────────────────────────────────────────────────────────────────

  const filtered = search.trim()
    ? personas.filter(p =>
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(search.toLowerCase()) ||
        p.apellido.toLowerCase().includes(search.toLowerCase()) ||
        p.dni?.includes(search)
      )
    : personas

  // ── Selección / limpieza ──────────────────────────────────────────────────

  function selectPersona(p: Persona) {
    setSelected(p)
    setSearch(`${p.apellido}, ${p.nombre}`)
    setOpen(false)
    onChange({ id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni })
  }

  function clear() {
    setSelected(null)
    setSearch('')
    setOpen(false)
    onChange(null)
  }

  // ── Crear nueva persona ───────────────────────────────────────────────────

  function handleCrearClick() {
    setOpen(false)
    setShowCrear(true)
  }

  async function handleCrearSuccess(id: string) {
    // Refrescar directorio y seleccionar la persona recién creada
    const raw = await fetchPersonasDirectorio()
    setPersonas(raw)
    const nueva = raw.find(p => p.id === id)
    if (nueva) selectPersona(nueva)
    setShowCrear(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div ref={ref} className="relative">
      {/* Input de búsqueda */}
      <input
        type="text"
        value={search}
        disabled={disabled}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => { if (!disabled) setOpen(true) }}
        placeholder={selected ? `${selected.apellido}, ${selected.nombre}` : placeholder}
        className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base placeholder:text-text-tertiary disabled:opacity-60"
      />
      {/* Botón limpiar */}
      {selected && !disabled && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary text-sm"
        >
          ×
        </button>
      )}

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface-elevated border border-border-subtle rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {loadingPersonas ? (
            <p className="px-3 py-2 text-sm text-text-tertiary">Cargando…</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-text-tertiary">Sin resultados</p>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => selectPersona(p)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-sunken transition-colors flex items-center justify-between ${
                  selected?.id === p.id ? 'bg-sig-50 text-sig-700' : 'text-text-primary'
                }`}
              >
                <span>
                  <span className="font-medium">{p.apellido}</span>, {p.nombre}
                </span>
                <span className="text-xs text-text-tertiary shrink-0 ml-2">
                  {p.personas_tipos?.nombre ?? ''}{p.dni ? ` · ${p.dni}` : ''}
                </span>
              </button>
            ))
          )}
          {/* Separador + acción crear */}
          <div className="border-t border-border-subtle">
            <button
              type="button"
              onClick={handleCrearClick}
              className="w-full text-left px-3 py-2 text-sm text-sig-600 hover:bg-sig-50 transition-colors font-medium"
            >
              + Crear nueva persona…
            </button>
          </div>
        </div>
      )}

      {/* Mini-form inline: crear nueva persona */}
      {showCrear && (
        <CrearPersonaForm
          onSuccess={handleCrearSuccess}
          onCancel={() => setShowCrear(false)}
        />
      )}
    </div>
  )
}

// ── Mini-form crear persona ───────────────────────────────────────────────────

interface CrearPersonaFormProps {
  onSuccess: (id: string) => void
  onCancel: () => void
}

const INITIAL_STATE: ActionResult<{ id: string }> | null = null

function CrearPersonaForm({ onSuccess, onCancel }: CrearPersonaFormProps) {
  const [state, action, pending] = useActionState(createPersonaDirectorio, INITIAL_STATE)

  useEffect(() => {
    if (state?.success && state.data?.id) {
      onSuccess(state.data.id)
    }
  }, [state, onSuccess])

  return (
    <div className="mt-2 rounded-lg border border-sig-200 bg-sig-50/50 p-3 space-y-2">
      <p className="text-xs font-semibold text-sig-700 uppercase tracking-wide">Nueva persona en el directorio</p>
      <form action={action} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-text-secondary mb-0.5">Nombre <span className="text-red-500">*</span></label>
            <input
              name="nombre"
              required
              className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-base"
              placeholder="Nombre"
            />
          </div>
          <div>
            <label className="block text-xs text-text-secondary mb-0.5">Apellido <span className="text-red-500">*</span></label>
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
            <label className="block text-xs text-text-secondary mb-0.5">Teléfono</label>
            <input
              name="telefono"
              className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-base"
              placeholder="11 1234-5678"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-text-secondary mb-0.5">Email</label>
          <input
            name="email"
            type="email"
            className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-base"
            placeholder="nombre@empresa.com"
          />
        </div>
        {state && !state.success && (
          <p className="text-xs text-red-600">{state.error}</p>
        )}
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
