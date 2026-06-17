'use client'

/**
 * CantidadTrabajadoresInput
 *
 * Campo reutilizable para "N° de trabajadores" en protocolos de HyS.
 * Ofrece dos modos:
 *
 * - "Contar": consulta las personas asignadas al puesto (puestos_personas) o
 *   al establecimiento (personas_establecimientos) según los props disponibles.
 *   Muestra el listado y permite agregar personas faltantes con alta inline.
 *   El valor resultante es la cantidad contada.
 *
 * - "Manual": input numérico libre.
 *
 * LIMITACIÓN: el conteo por `sectorId` requiere un JOIN indirecto
 * (puestos_personas → puestos_de_trabajo.sector_id). No existe una tabla
 * personas_sectores. Si se pasa sectorId sin puestoId, el conteo cae al nivel
 * de establecimiento y se muestra un aviso.
 *
 * Props:
 *   - establecimientoId (requerido): scope mínimo siempre necesario.
 *   - puestoId (opcional): filtra por puesto vía puestos_personas.
 *   - sectorId (opcional, sin efecto en conteo si no hay puestoId — ver limitación).
 *   - value: número actual controlado.
 *   - onChange: callback con el número final.
 */

import { useState, useEffect, useActionState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createPersonaDirectorio } from '@/lib/actions/persona-directorio'
import { vincularPersonaAlEstablecimiento } from '@/lib/actions/vincular-persona'
import type { PersonaDirectorioCreada } from '@/lib/actions/persona-directorio'
import type { ActionResult } from '@/lib/types'
import { Check, Hash, Info, Loader2, UserPlus, Users, X } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface PersonaListada {
  id: string
  nombre: string
  apellido: string
  dni: string | null
  cargo: string | null
}

export interface CantidadTrabajadoresInputProps {
  establecimientoId: string
  puestoId?: string
  /** sectorId sin puestoId = solo documental; no filtra el conteo (ver limitación arriba). */
  sectorId?: string
  value: string
  onChange: (valor: string) => void
  label?: string
}

// ── Fetch de personas según scope ─────────────────────────────────────────────

async function fetchPersonasPorScope(opts: {
  establecimientoId: string
  puestoId?: string
}): Promise<PersonaListada[]> {
  const supabase = createClient()

  if (opts.puestoId) {
    const { data } = await supabase
      .from('puestos_personas')
      .select('personas_directorio!persona_id(id, nombre, apellido, dni, cargo, is_active)')
      .eq('puesto_id', opts.puestoId)
      .is('fecha_baja', null)

    return ((data ?? []) as unknown as {
      personas_directorio: (PersonaListada & { is_active: boolean }) | null
    }[])
      .map(row => row.personas_directorio)
      .filter((p): p is PersonaListada & { is_active: boolean } => !!p && p.is_active)
      .map(p => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni, cargo: p.cargo }))
      .sort((a, b) => a.apellido.localeCompare(b.apellido))
  }

  // Fallback: nivel establecimiento
  const { data } = await supabase
    .from('personas_establecimientos')
    .select('personas_directorio!persona_id(id, nombre, apellido, dni, cargo, is_active)')
    .eq('establecimiento_id', opts.establecimientoId)

  return ((data ?? []) as unknown as {
    personas_directorio: (PersonaListada & { is_active: boolean }) | null
  }[])
    .map(row => row.personas_directorio)
    .filter((p): p is PersonaListada & { is_active: boolean } => !!p && p.is_active)
    .map(p => ({ id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni, cargo: p.cargo }))
    .sort((a, b) => a.apellido.localeCompare(b.apellido))
}

// ── Componente principal ───────────────────────────────────────────────────────

export function CantidadTrabajadoresInput({
  establecimientoId,
  puestoId,
  sectorId,
  value,
  onChange,
  label = 'N° de trabajadores',
}: CantidadTrabajadoresInputProps) {
  const [modo, setModo] = useState<'contar' | 'manual'>('manual')
  const [personas, setPersonas] = useState<PersonaListada[]>([])
  const [loading, setLoading] = useState(false)
  const [showAgregar, setShowAgregar] = useState(false)

  // Aviso de limitación: sectorId sin puestoId no filtra el conteo.
  const mostrarAvisoSector = !!sectorId && !puestoId

  // Carga personas cuando modo = 'contar' y hay establecimientoId.
  useEffect(() => {
    if (modo !== 'contar') return
    setLoading(true)
    fetchPersonasPorScope({ establecimientoId, puestoId }).then(rows => {
      setPersonas(rows)
      onChange(String(rows.length))
      setLoading(false)
    })
  // onChange es estable por definición del caller; puestoId y establecimientoId
  // cambian con la selección del sector/puesto.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, establecimientoId, puestoId])

  function handleModo(nuevo: 'contar' | 'manual') {
    setModo(nuevo)
    if (nuevo === 'manual') setShowAgregar(false)
    // Si vuelve a manual, mantenemos el último valor numérico.
  }

  async function handleAltaSuccess(persona: PersonaDirectorioCreada) {
    // Vincular la persona recién creada al establecimiento (y al puesto si aplica).
    await vincularPersonaAlEstablecimiento(persona.id, establecimientoId, puestoId)
    // Refrescar lista.
    const rows = await fetchPersonasPorScope({ establecimientoId, puestoId })
    setPersonas(rows)
    onChange(String(rows.length))
    setShowAgregar(false)
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-medium text-text-secondary block">{label}</label>

      {/* Toggle de modo */}
      <div className="flex rounded-lg border border-border-default overflow-hidden">
        <button
          type="button"
          onClick={() => handleModo('contar')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
            modo === 'contar'
              ? 'bg-sig-600 text-white'
              : 'bg-surface-base text-text-secondary hover:bg-surface-sunken'
          )}
        >
          <Users size={12} />
          Contar cargados
        </button>
        <button
          type="button"
          onClick={() => handleModo('manual')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-border-default',
            modo === 'manual'
              ? 'bg-sig-600 text-white'
              : 'bg-surface-base text-text-secondary hover:bg-surface-sunken'
          )}
        >
          <Hash size={12} />
          Manual
        </button>
      </div>

      {/* ── Modo: Contar ── */}
      {modo === 'contar' && (
        <div className="rounded-lg border border-border-default bg-surface-base overflow-hidden">
          {/* Encabezado con conteo */}
          <div className="flex items-center justify-between px-3 py-2 bg-sig-50 border-b border-border-default">
            <div className="flex items-center gap-1.5">
              {loading ? (
                <Loader2 size={12} className="text-sig-600 animate-spin" />
              ) : (
                <Users size={12} className="text-sig-600" />
              )}
              <span className="text-xs font-semibold text-sig-700">
                {loading ? 'Cargando…' : `${personas.length} trabajador${personas.length !== 1 ? 'es' : ''}`}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowAgregar(v => !v)}
              className="flex items-center gap-1 text-xs text-sig-600 hover:text-sig-800 font-medium"
            >
              <UserPlus size={12} />
              Agregar trabajador
            </button>
          </div>

          {/* Aviso de limitación sectorId sin puestoId */}
          {mostrarAvisoSector && (
            <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border-b border-amber-200">
              <Info size={12} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">
                El conteo muestra todos los trabajadores del establecimiento. Para filtrar
                por sector, primero seleccioná un puesto de trabajo dentro del sector.
              </p>
            </div>
          )}

          {/* Lista de personas */}
          {!loading && (
            <ul className="max-h-40 overflow-y-auto divide-y divide-border-default">
              {personas.length === 0 ? (
                <li className="px-3 py-3 text-xs text-text-tertiary text-center">
                  {puestoId
                    ? 'No hay trabajadores asignados a este puesto.'
                    : 'No hay trabajadores cargados para este establecimiento.'}
                </li>
              ) : (
                personas.map(p => (
                  <li key={p.id} className="flex items-center gap-2 px-3 py-2">
                    <Check size={10} className="text-green-500 shrink-0" />
                    <span className="flex-1 text-xs text-text-primary">
                      <span className="font-medium">{p.apellido}</span>, {p.nombre}
                    </span>
                    {(p.cargo || p.dni) && (
                      <span className="text-xs text-text-tertiary shrink-0">
                        {p.cargo ?? ''}{p.cargo && p.dni ? ' · ' : ''}{p.dni ?? ''}
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}

          {/* Alta inline */}
          {showAgregar && (
            <div className="border-t border-border-default">
              <AltaTrabajadorInline
                onSuccess={handleAltaSuccess}
                onCancel={() => setShowAgregar(false)}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Modo: Manual ── */}
      {modo === 'manual' && (
        <input
          type="number"
          min={1}
          className="w-full rounded-lg border border-border-default px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-400"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Ej: 5"
        />
      )}
    </div>
  )
}

// ── Alta inline de trabajador ──────────────────────────────────────────────────

interface AltaTrabajadorInlineProps {
  onSuccess: (persona: PersonaDirectorioCreada) => void
  onCancel: () => void
}

const INITIAL_STATE: ActionResult<PersonaDirectorioCreada> | null = null

function AltaTrabajadorInline({ onSuccess, onCancel }: AltaTrabajadorInlineProps) {
  const [state, action, pending] = useActionState(createPersonaDirectorio, INITIAL_STATE)

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess

  useEffect(() => {
    if (state?.success && state.data) onSuccessRef.current(state.data)
  }, [state])

  return (
    <div className="p-3 bg-sig-50/50 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-sig-700 uppercase tracking-wide">
          Agregar trabajador al directorio
        </p>
        <button
          type="button"
          onClick={onCancel}
          className="text-text-tertiary hover:text-text-primary"
        >
          <X size={12} />
        </button>
      </div>
      <form action={action} className="space-y-2">
        <input type="hidden" name="es_externa" value="false" />
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
            className="flex items-center gap-1.5 px-3 py-1 text-sm bg-sig-600 text-white rounded hover:bg-sig-700 disabled:opacity-60 transition-colors"
          >
            {pending ? <Loader2 size={12} className="animate-spin" /> : <UserPlus size={12} />}
            {pending ? 'Guardando…' : 'Crear y agregar'}
          </button>
        </div>
      </form>
    </div>
  )
}
