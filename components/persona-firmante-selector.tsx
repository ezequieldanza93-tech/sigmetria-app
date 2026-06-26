'use client'

import { useState, useEffect, useRef } from 'react'
import { useUsuariosEjecutores, useMiPersona } from '@/lib/queries/agenda'

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface PersonaFirmanteValue {
  id: string
  nombre: string
  apellido: string
  dni: string | null
}

interface PersonaFirmanteSelectorProps {
  /** UUID de la persona firmante seleccionada (controlado) */
  value?: string | null
  onChange: (persona: PersonaFirmanteValue | null) => void
  establecimientoId: string | undefined
  disabled?: boolean
  placeholder?: string
  /**
   * Si es `true`, el firmante queda FIJADO a la persona del usuario logueado:
   * se muestra estático su nombre (sin dropdown ni botón de limpiar) y se emite
   * ese valor por `onChange` al montar, para que el form igual lo envíe.
   * Default `false` (selector completo, comportamiento actual intacto).
   */
  readOnly?: boolean
}

// ── Componente ───────────────────────────────────────────────────────────────

/**
 * Selector de profesional FIRMANTE para los formularios de ejecución.
 *
 * - Lista SOLO usuarios ejecutores de la consultora del establecimiento
 *   (mismo conjunto que el selector de RESPONSABLE: rol colaborador+),
 *   reusando `useUsuariosEjecutores`.
 * - Por DEFECTO preselecciona la persona del usuario logueado si tiene
 *   `profiles.persona_id` y esa persona está entre los ejecutores. Si no,
 *   queda vacío para elegir manualmente.
 * - Emite el mismo contrato `{ id, nombre, apellido, dni }` que
 *   `PersonaRolSelector`, así el guardado de `firmante_persona_id` /
 *   `firmante` / DNI no cambia.
 */
export function PersonaFirmanteSelector({
  value,
  onChange,
  establecimientoId,
  disabled = false,
  placeholder = 'Buscar usuario ejecutor…',
  readOnly = false,
}: PersonaFirmanteSelectorProps) {
  const { data: ejecutores = [], isLoading } = useUsuariosEjecutores(establecimientoId)
  const { data: miPersonaId } = useMiPersona()

  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  // Se preseleccionó una vez al usuario logueado; evita reaplicar el default
  // si el usuario después limpia la elección a propósito.
  const defaultApplied = useRef(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = value ? ejecutores.find(p => p.id === value) ?? null : null

  // Sincronizar el texto del input con la selección controlada.
  useEffect(() => {
    if (selected) setSearch(`${selected.apellido}, ${selected.nombre}`)
    else if (!value) setSearch('')
  }, [selected, value])

  // Default: persona del usuario logueado, si está entre los ejecutores.
  useEffect(() => {
    if (defaultApplied.current) return
    if (value) { defaultApplied.current = true; return }
    if (isLoading || ejecutores.length === 0 || !miPersonaId) return

    const mia = ejecutores.find(p => p.id === miPersonaId)
    if (mia) {
      defaultApplied.current = true
      onChange({ id: mia.id, nombre: mia.nombre, apellido: mia.apellido, dni: mia.dni })
    }
  }, [isLoading, ejecutores, miPersonaId, value, onChange])

  // Re-hidratación de borrador: cuando el `value` viene pre-cargado (el padre tiene el
  // persona_id guardado pero NO el nombre/apellido/DNI), al resolver la persona en la
  // lista re-emitimos el contrato COMPLETO una sola vez por id. Sin esto, el DNI queda
  // vacío y la firma a mano no se registra al finalizar un borrador re-abierto.
  // En `readOnly` NO corre: ahí el firmante SIEMPRE es el usuario logueado (ver abajo),
  // no el que tenga guardado el borrador (que pudo planificarse para otra persona).
  const syncedValueId = useRef<string | null>(null)
  useEffect(() => {
    if (readOnly) return
    if (!value || !selected) return
    if (syncedValueId.current === selected.id) return
    syncedValueId.current = selected.id
    onChange({ id: selected.id, nombre: selected.nombre, apellido: selected.apellido, dni: selected.dni })
  }, [readOnly, value, selected, onChange])

  // readOnly: el firmante es SIEMPRE la persona del usuario logueado (quien ejecuta y
  // firma), aunque el borrador se haya planificado/empezado para OTRA persona. Pisa el
  // `value` guardado para no quedar bloqueado por la validación server-side
  // (firmante == usuario logueado). El "para quién estaba planificada" se preserva
  // aparte en registro_gestiones.responsable_id.
  const miFirmaForzadaId = useRef<string | null>(null)
  useEffect(() => {
    if (!readOnly || !miPersonaId) return
    const mia = ejecutores.find(p => p.id === miPersonaId)
    if (!mia) return
    if (miFirmaForzadaId.current === mia.id && value === mia.id) return
    miFirmaForzadaId.current = mia.id
    if (value !== mia.id) {
      onChange({ id: mia.id, nombre: mia.nombre, apellido: mia.apellido, dni: mia.dni })
    }
  }, [readOnly, miPersonaId, ejecutores, value, onChange])

  // Click-outside.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const filtered = search.trim() && !selected
    ? ejecutores.filter(p =>
        `${p.nombre} ${p.apellido}`.toLowerCase().includes(search.toLowerCase()) ||
        p.apellido.toLowerCase().includes(search.toLowerCase()) ||
        (p.dni?.includes(search) ?? false)
      )
    : ejecutores

  function selectPersona(p: { id: string; nombre: string; apellido: string; dni: string | null }) {
    defaultApplied.current = true
    setSearch(`${p.apellido}, ${p.nombre}`)
    setOpen(false)
    onChange({ id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni })
  }

  function clear() {
    defaultApplied.current = true
    setSearch('')
    setOpen(false)
    onChange(null)
  }

  const sinEjecutores = !isLoading && ejecutores.length === 0

  // Modo readOnly: firmante fijado al usuario logueado. La emisión del valor por
  // `onChange` la sigue haciendo el efecto de default de arriba (misma lógica:
  // busca la persona del logueado entre los ejecutores). Acá solo renderizamos
  // estático: el nombre ya seleccionado, sin dropdown ni botón de limpiar.
  if (readOnly) {
    const miPersona = miPersonaId ? ejecutores.find(p => p.id === miPersonaId) ?? null : null
    // Siempre mostramos al usuario logueado (es quien firma). Solo si no se puede
    // resolver su persona caemos al `selected` para no quedar en blanco.
    const mostrado = miPersona ?? selected
    return (
      <div className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-subtle text-text-primary">
        {isLoading ? (
          <span className="text-text-tertiary">Cargando…</span>
        ) : mostrado ? (
          <span>
            <span className="font-medium">{mostrado.apellido}</span>, {mostrado.nombre}
            {mostrado.dni && (
              <span className="text-xs text-text-tertiary ml-2">{mostrado.dni}</span>
            )}
          </span>
        ) : (
          <span className="text-amber-600 text-xs">
            Tu usuario no figura como ejecutor en esta consultora.
          </span>
        )}
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        value={search}
        disabled={disabled}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => { if (!disabled) setOpen(true) }}
        placeholder={selected ? `${selected.apellido}, ${selected.nombre}` : placeholder}
        className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base placeholder:text-text-tertiary disabled:opacity-60"
      />
      {selected && !disabled && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary text-sm"
        >
          ×
        </button>
      )}

      {sinEjecutores && (
        <p className="mt-1 text-xs text-amber-600">
          No hay usuarios con permiso para ejecutar gestiones en esta consultora.
        </p>
      )}

      {open && !disabled && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-surface-elevated border border-border-subtle rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {isLoading ? (
            <p className="px-3 py-2 text-sm text-text-tertiary">Cargando…</p>
          ) : filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-text-tertiary">
              {sinEjecutores
                ? 'No hay usuarios con permiso para ejecutar gestiones.'
                : 'Sin resultados'}
            </p>
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
                {p.dni && (
                  <span className="text-xs text-text-tertiary shrink-0 ml-2">{p.dni}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
