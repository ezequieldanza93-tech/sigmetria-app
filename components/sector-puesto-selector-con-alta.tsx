'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, Search, Plus, X, Layers, Briefcase } from 'lucide-react'
import { crearSectorEstablecimiento } from '@/lib/actions/sector'
import { crearPuestoEstablecimiento } from '@/lib/actions/puesto'
import { createClient } from '@/lib/supabase/client'

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface SectorConPuestos {
  id: string
  nombre: string
  puestos: Array<{ id: string; nombre: string }>
}

export interface SectorPuestoSeleccionado {
  sectorId: string
  sectorNombre: string
  puestoId: string
  puestoNombre: string
}

interface SectorPuestoSelectorConAltaProps {
  /** ID del establecimiento al que pertenecen los sectores/puestos. */
  establecimientoId: string
  /** sector_id seleccionado (controlado). '' = sin selección. */
  sectorId: string
  /** puesto_id seleccionado (controlado). '' = sin selección. */
  puestoId: string
  /** Callback al cambiar sector o puesto. Recibe el par completo con nombres. */
  onChange: (seleccion: { sectorId: string; sectorNombre: string; puestoId: string; puestoNombre: string }) => void
  disabled?: boolean
  /** Si se proveen, renderizan <input type="hidden"> para submit nativo del form. */
  nameSector?: string
  namePuesto?: string
}

// ── Carga de sectores/puestos (fuera del componente para estabilidad) ─────────

async function fetchSectoresYPuestos(establecimientoId: string): Promise<SectorConPuestos[]> {
  const supabase = createClient()
  const { data } = await supabase
    .from('establecimientos_sectores')
    .select('id, nombre, puestos_de_trabajo ( id, nombre, is_active )')
    .eq('establecimiento_id', establecimientoId)
    .eq('is_active', true)
    .order('nombre', { ascending: true })

  return (data ?? []).map(s => {
    const puestosRaw = (s.puestos_de_trabajo as Array<{ id: string; nombre: string; is_active: boolean }> | null) ?? []
    return {
      id: s.id as string,
      nombre: s.nombre as string,
      puestos: puestosRaw
        .filter(p => p.is_active)
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    }
  })
}

// ── Componente principal ──────────────────────────────────────────────────────

/**
 * Selector de sector + puesto con alta inline.
 *
 * - Lista los sectores del establecimiento (activos).
 * - Al elegir sector, filtra sus puestos.
 * - Botón "Crear sector" → mini-form inline que persiste y selecciona al toque.
 * - Botón "Crear puesto" → mini-form inline dentro del sector elegido.
 * - Imita el patrón visual de PersonaSelectorConAlta + SearchableSelect.
 */
export function SectorPuestoSelectorConAlta({
  establecimientoId,
  sectorId,
  puestoId,
  onChange,
  disabled = false,
  nameSector,
  namePuesto,
}: SectorPuestoSelectorConAltaProps) {
  const [sectores, setSectores] = useState<SectorConPuestos[]>([])
  const [loading, setLoading] = useState(false)

  // Estado del dropdown de sector.
  const [sectorOpen, setSectorOpen] = useState(false)
  const [sectorQuery, setSectorQuery] = useState('')
  const sectorRootRef = useRef<HTMLDivElement>(null)
  const sectorInputRef = useRef<HTMLInputElement>(null)

  // Estado del dropdown de puesto.
  const [puestoOpen, setPuestoOpen] = useState(false)
  const [puestoQuery, setPuestoQuery] = useState('')
  const puestoRootRef = useRef<HTMLDivElement>(null)
  const puestoInputRef = useRef<HTMLInputElement>(null)

  // Formulario de alta inline de sector.
  const [showCrearSector, setShowCrearSector] = useState(false)
  const [nuevoSectorNombre, setNuevoSectorNombre] = useState('')
  const [sectorError, setSectorError] = useState<string | null>(null)
  const [sectorPending, startSectorTransition] = useTransition()

  // Formulario de alta inline de puesto.
  const [showCrearPuesto, setShowCrearPuesto] = useState(false)
  const [nuevoPuestoNombre, setNuevoPuestoNombre] = useState('')
  const [puestoError, setPuestoError] = useState<string | null>(null)
  const [puestoPending, startPuestoTransition] = useTransition()

  // Refs a los mini-forms de alta para traerlos a la vista al abrirlos: si el
  // selector está al fondo de un modal con scroll + footer sticky, el botón
  // "Crear y seleccionar" queda tapado o debajo del fold si no scrolleamos.
  const crearSectorFormRef = useRef<HTMLDivElement>(null)
  const crearPuestoFormRef = useRef<HTMLDivElement>(null)

  const sectorSeleccionado = sectores.find(s => s.id === sectorId) ?? null
  const puestoSeleccionado = sectorSeleccionado?.puestos.find(p => p.id === puestoId) ?? null

  // Carga inicial.
  useEffect(() => {
    if (!establecimientoId) return
    setLoading(true)
    fetchSectoresYPuestos(establecimientoId).then(rows => {
      setSectores(rows)
      setLoading(false)
    })
  }, [establecimientoId])

  // Cierre al click afuera — sector.
  useEffect(() => {
    if (!sectorOpen) return
    function handler(e: MouseEvent) {
      if (sectorRootRef.current && !sectorRootRef.current.contains(e.target as Node)) {
        setSectorOpen(false)
        setSectorQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sectorOpen])

  // Cierre al click afuera — puesto.
  useEffect(() => {
    if (!puestoOpen) return
    function handler(e: MouseEvent) {
      if (puestoRootRef.current && !puestoRootRef.current.contains(e.target as Node)) {
        setPuestoOpen(false)
        setPuestoQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [puestoOpen])

  // Foco al input de búsqueda al abrir.
  useEffect(() => { if (sectorOpen) sectorInputRef.current?.focus() }, [sectorOpen])
  useEffect(() => { if (puestoOpen) puestoInputRef.current?.focus() }, [puestoOpen])

  // Al abrir un mini-form de alta, lo centramos en el scroll container para que
  // el botón "Crear y seleccionar" no quede tapado por el footer sticky del modal.
  useEffect(() => {
    if (showCrearSector) crearSectorFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [showCrearSector])
  useEffect(() => {
    if (showCrearPuesto) crearPuestoFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [showCrearPuesto])

  // Opciones filtradas.
  const sectorNormalized = sectorQuery.trim().toLowerCase()
  const sectoresFiltrados = sectorNormalized
    ? sectores.filter(s => s.nombre.toLowerCase().includes(sectorNormalized))
    : sectores

  const puestoNormalized = puestoQuery.trim().toLowerCase()
  const puestosFiltrados = sectorSeleccionado
    ? puestoNormalized
      ? sectorSeleccionado.puestos.filter(p => p.nombre.toLowerCase().includes(puestoNormalized))
      : sectorSeleccionado.puestos
    : []

  // ── Handlers sector ───────────────────────────────────────────────────

  function selectSector(s: SectorConPuestos) {
    setSectorOpen(false)
    setSectorQuery('')
    onChange({ sectorId: s.id, sectorNombre: s.nombre, puestoId: '', puestoNombre: '' })
  }

  function clearSector(e: React.MouseEvent) {
    e.stopPropagation()
    onChange({ sectorId: '', sectorNombre: '', puestoId: '', puestoNombre: '' })
  }

  function handleCrearSectorClick() {
    setSectorOpen(false)
    setSectorQuery('')
    setShowCrearSector(true)
    setNuevoSectorNombre('')
    setSectorError(null)
  }

  function handleCrearSectorSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nombre = nuevoSectorNombre.trim()
    if (!nombre) { setSectorError('El nombre es obligatorio'); return }
    setSectorError(null)
    startSectorTransition(async () => {
      const result = await crearSectorEstablecimiento(establecimientoId, nombre)
      if (!result.success) { setSectorError(result.error); return }
      // Agrega el nuevo sector al estado local (sin puestos por ahora).
      const nuevo: SectorConPuestos = { id: result.data.id, nombre: result.data.nombre, puestos: [] }
      setSectores(prev => [...prev, nuevo].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      onChange({ sectorId: result.data.id, sectorNombre: result.data.nombre, puestoId: '', puestoNombre: '' })
      setShowCrearSector(false)
      setNuevoSectorNombre('')
    })
  }

  // ── Handlers puesto ───────────────────────────────────────────────────

  function selectPuesto(p: { id: string; nombre: string }) {
    setPuestoOpen(false)
    setPuestoQuery('')
    onChange({
      sectorId,
      sectorNombre: sectorSeleccionado?.nombre ?? '',
      puestoId: p.id,
      puestoNombre: p.nombre,
    })
  }

  function clearPuesto(e: React.MouseEvent) {
    e.stopPropagation()
    onChange({ sectorId, sectorNombre: sectorSeleccionado?.nombre ?? '', puestoId: '', puestoNombre: '' })
  }

  function handleCrearPuestoClick() {
    setPuestoOpen(false)
    setPuestoQuery('')
    setShowCrearPuesto(true)
    setNuevoPuestoNombre('')
    setPuestoError(null)
  }

  function handleCrearPuestoSubmit(e: React.FormEvent) {
    e.preventDefault()
    const nombre = nuevoPuestoNombre.trim()
    if (!nombre) { setPuestoError('El nombre es obligatorio'); return }
    if (!sectorId) { setPuestoError('Elegí un sector primero'); return }
    setPuestoError(null)
    startPuestoTransition(async () => {
      const result = await crearPuestoEstablecimiento(establecimientoId, sectorId, nombre)
      if (!result.success) { setPuestoError(result.error); return }
      // Agrega el nuevo puesto al sector en el estado local.
      setSectores(prev => prev.map(s => {
        if (s.id !== sectorId) return s
        const puestosActualizados = [...s.puestos, { id: result.data.id, nombre: result.data.nombre }]
          .sort((a, b) => a.nombre.localeCompare(b.nombre))
        return { ...s, puestos: puestosActualizados }
      }))
      onChange({
        sectorId,
        sectorNombre: sectorSeleccionado?.nombre ?? '',
        puestoId: result.data.id,
        puestoNombre: result.data.nombre,
      })
      setShowCrearPuesto(false)
      setNuevoPuestoNombre('')
    })
  }

  const triggerCls = cn(
    'w-full flex items-center gap-2 border border-border-default rounded-lg px-3 py-2 text-sm text-left bg-surface-base',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:border-transparent',
    'disabled:bg-surface-sunken disabled:text-text-tertiary disabled:cursor-not-allowed',
  )
  const dropdownCls = 'absolute top-full mt-1 left-0 right-0 z-50 bg-surface-base border border-border-default rounded-xl shadow-xl overflow-hidden'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* ── Selector de SECTOR ─────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-sig-500" /> Sector
        </label>
        <div ref={sectorRootRef} className="relative">
          {nameSector && <input type="hidden" name={nameSector} value={sectorId} />}

          <button
            type="button"
            role="combobox"
            aria-expanded={sectorOpen}
            aria-controls="sector-listbox"
            aria-haspopup="listbox"
            disabled={disabled}
            onClick={() => (sectorOpen ? setSectorOpen(false) : setSectorOpen(true))}
            className={triggerCls}
          >
            <span className={cn('flex-1 truncate', !sectorSeleccionado && 'text-text-tertiary')}>
              {sectorSeleccionado ? sectorSeleccionado.nombre : 'Seleccionar sector…'}
            </span>
            {sectorSeleccionado && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Limpiar sector"
                onClick={clearSector}
                className="text-text-tertiary hover:text-text-primary shrink-0"
              >
                <X className="w-4 h-4" />
              </span>
            )}
            <ChevronDown className={cn('w-4 h-4 text-text-tertiary shrink-0 transition-transform', sectorOpen && 'rotate-180')} />
          </button>

          {sectorOpen && (
            <div className={dropdownCls}>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
                <Search className="w-4 h-4 text-text-tertiary shrink-0" />
                <input
                  ref={sectorInputRef}
                  type="text"
                  value={sectorQuery}
                  onChange={e => setSectorQuery(e.target.value)}
                  placeholder="Buscar sector…"
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
              </div>
              <ul id="sector-listbox" role="listbox" className="max-h-52 overflow-y-auto py-1">
                {loading ? (
                  <li className="px-3 py-3 text-xs text-text-tertiary text-center">Cargando…</li>
                ) : sectoresFiltrados.length === 0 ? (
                  <li className="px-3 py-3 text-xs text-text-tertiary text-center">Sin resultados.</li>
                ) : (
                  sectoresFiltrados.map(s => (
                    <li
                      key={s.id}
                      role="option"
                      aria-selected={s.id === sectorId}
                      onClick={() => selectSector(s)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-sunken text-text-primary',
                        s.id === sectorId && 'bg-sig-50',
                      )}
                    >
                      <span className="flex-1 truncate">{s.nombre}</span>
                      <span className="text-xs text-text-tertiary shrink-0">{s.puestos.length} puestos</span>
                      {s.id === sectorId && <Check className="w-4 h-4 text-brand-primary shrink-0" />}
                    </li>
                  ))
                )}
              </ul>
              <div className="border-t border-border-subtle">
                <button
                  type="button"
                  onClick={handleCrearSectorClick}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-sig-600 hover:bg-sig-50 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Crear sector nuevo…
                </button>
              </div>
            </div>
          )}

          {/* Mini-form alta de sector */}
          {showCrearSector && (
            <div ref={crearSectorFormRef} className="mt-2 rounded-lg border border-sig-200 bg-sig-50/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-sig-700 uppercase tracking-wide">Nuevo sector</p>
              <form onSubmit={handleCrearSectorSubmit} className="space-y-2">
                <div>
                  <label className="block text-xs text-text-secondary mb-0.5">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    autoFocus
                    value={nuevoSectorNombre}
                    onChange={e => setNuevoSectorNombre(e.target.value)}
                    placeholder="Ej: Depósito, Planta baja…"
                    className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-base"
                  />
                </div>
                {sectorError && <p className="text-xs text-red-600">{sectorError}</p>}
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowCrearSector(false); setNuevoSectorNombre(''); setSectorError(null) }}
                    className="px-3 py-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={sectorPending}
                    className="px-3 py-1 text-sm bg-sig-600 text-white rounded hover:bg-sig-700 disabled:opacity-60 transition-colors"
                  >
                    {sectorPending ? 'Guardando…' : 'Crear y seleccionar'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* ── Selector de PUESTO ─────────────────────────────────────── */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-text-secondary flex items-center gap-1.5">
          <Briefcase className="w-3.5 h-3.5 text-sig-500" /> Puesto / sección
        </label>
        <div ref={puestoRootRef} className="relative">
          {namePuesto && <input type="hidden" name={namePuesto} value={puestoId} />}

          <button
            type="button"
            role="combobox"
            aria-expanded={puestoOpen}
            aria-controls="puesto-listbox"
            aria-haspopup="listbox"
            disabled={disabled || !sectorSeleccionado}
            onClick={() => (puestoOpen ? setPuestoOpen(false) : setPuestoOpen(true))}
            className={triggerCls}
          >
            <span className={cn('flex-1 truncate', !puestoSeleccionado && 'text-text-tertiary')}>
              {puestoSeleccionado
                ? puestoSeleccionado.nombre
                : sectorSeleccionado
                  ? 'Seleccionar puesto…'
                  : 'Elegí un sector primero'}
            </span>
            {puestoSeleccionado && !disabled && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Limpiar puesto"
                onClick={clearPuesto}
                className="text-text-tertiary hover:text-text-primary shrink-0"
              >
                <X className="w-4 h-4" />
              </span>
            )}
            <ChevronDown className={cn('w-4 h-4 text-text-tertiary shrink-0 transition-transform', puestoOpen && 'rotate-180')} />
          </button>

          {puestoOpen && sectorSeleccionado && (
            <div className={dropdownCls}>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
                <Search className="w-4 h-4 text-text-tertiary shrink-0" />
                <input
                  ref={puestoInputRef}
                  type="text"
                  value={puestoQuery}
                  onChange={e => setPuestoQuery(e.target.value)}
                  placeholder="Buscar puesto…"
                  className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
                />
              </div>
              <ul id="puesto-listbox" role="listbox" className="max-h-52 overflow-y-auto py-1">
                {puestosFiltrados.length === 0 ? (
                  <li className="px-3 py-3 text-xs text-text-tertiary text-center">Sin puestos. Creá uno.</li>
                ) : (
                  puestosFiltrados.map(p => (
                    <li
                      key={p.id}
                      role="option"
                      aria-selected={p.id === puestoId}
                      onClick={() => selectPuesto(p)}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-surface-sunken text-text-primary',
                        p.id === puestoId && 'bg-sig-50',
                      )}
                    >
                      <span className="flex-1 truncate">{p.nombre}</span>
                      {p.id === puestoId && <Check className="w-4 h-4 text-brand-primary shrink-0" />}
                    </li>
                  ))
                )}
              </ul>
              <div className="border-t border-border-subtle">
                <button
                  type="button"
                  onClick={handleCrearPuestoClick}
                  className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-sig-600 hover:bg-sig-50 transition-colors font-medium"
                >
                  <Plus className="w-4 h-4 shrink-0" />
                  Crear puesto nuevo…
                </button>
              </div>
            </div>
          )}

          {/* Mini-form alta de puesto */}
          {showCrearPuesto && (
            <div ref={crearPuestoFormRef} className="mt-2 rounded-lg border border-sig-200 bg-sig-50/50 p-3 space-y-2">
              <p className="text-xs font-semibold text-sig-700 uppercase tracking-wide">
                Nuevo puesto en <span className="text-sig-600">{sectorSeleccionado?.nombre}</span>
              </p>
              <form onSubmit={handleCrearPuestoSubmit} className="space-y-2">
                <div>
                  <label className="block text-xs text-text-secondary mb-0.5">
                    Nombre <span className="text-red-500">*</span>
                  </label>
                  <input
                    autoFocus
                    value={nuevoPuestoNombre}
                    onChange={e => setNuevoPuestoNombre(e.target.value)}
                    placeholder="Ej: Operador de prensa, Cajero…"
                    className="w-full border border-border-default rounded px-2 py-1 text-sm bg-surface-base"
                  />
                </div>
                {puestoError && <p className="text-xs text-red-600">{puestoError}</p>}
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowCrearPuesto(false); setNuevoPuestoNombre(''); setPuestoError(null) }}
                    className="px-3 py-1 text-sm text-text-secondary hover:text-text-primary transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={puestoPending}
                    className="px-3 py-1 text-sm bg-sig-600 text-white rounded hover:bg-sig-700 disabled:opacity-60 transition-colors"
                  >
                    {puestoPending ? 'Guardando…' : 'Crear y seleccionar'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
