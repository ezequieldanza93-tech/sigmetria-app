'use client'

import { useState, useTransition, useEffect, useActionState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { SectorForm } from '@/components/forms/sector-form'
import { SiniestroForm } from '@/components/forms/siniestro-form'
import { InspeccionForm } from '@/components/forms/inspeccion-form'
import { RiesgoForm } from '@/components/forms/riesgo-form'
import { DocumentoForm } from '@/components/forms/documento-form'
import { updateSectorTrabajadores, createSectorCustom, deleteSector } from '@/lib/actions/sector'
import { createPuesto, deletePuesto } from '@/lib/actions/puesto'
import { removeTrabajadorFromPuesto, assignTrabajadorToPuesto } from '@/lib/actions/trabajador'
import { createSiniestro } from '@/lib/actions/siniestro'
import { createInspeccion } from '@/lib/actions/inspeccion'
import { createRiesgo, resolverRiesgo } from '@/lib/actions/riesgo'
import { createDocumento } from '@/lib/actions/documento'
import { addEppToPuesto, removeEppFromPuesto } from '@/lib/actions/epp-por-puesto'
import { createAsistencia } from '@/lib/actions/asistencia'
import { createPersona } from '@/lib/actions/persona'
import { addOrganizacionToEstablecimiento } from '@/lib/actions/organizacion'
import { addGestionToEstablecimiento } from '@/lib/actions/gestion-establecimiento'
import { createRegistroGestion, ejecutarGestion } from '@/lib/actions/registro-gestion'
import { createObservacionGestion, cerrarObservacion } from '@/lib/actions/observacion-gestion'
import { createClient } from '@/lib/supabase/client'
import { TrabajadorModal } from '@/components/trabajador-modal'
import { formatDate } from '@/lib/utils'
import { RIESGO_NIVEL_LABELS, DOCUMENTO_TIPO_LABELS } from '@/lib/constants'
import { RIESGO_NIVEL_COLORS, SINIESTRO_ESTADO_COLORS, INSPECCION_ESTADO_COLORS } from '@/lib/types'
import { SINIESTRO_TIPO_LABELS, SINIESTRO_ESTADO_LABELS, INSPECCION_ESTADO_LABELS } from '@/lib/constants'
import type {
  SectorEstablecimiento,
  PuestoDeTrabajo,
  TrabajadorPuesto,
  Siniestro,
  Inspeccion,
  Riesgo,
  Documento,
  DocumentType,
  DirectorioPersona,
  Organizacion,
  EppPorPuesto,
  Producto,
  AsistenciaDiaria,
  ActionResult,
  RiesgoNivel,
  SiniestroEstado,
  InspeccionEstado,
  GestionEstablecimiento,
  Gestion,
  RegistroGestion,
  ObservacionGestion,
  EstadoGestion,
} from '@/lib/types'
import { calcularEstadoGestion } from '@/lib/types'

type Tab = 'sectores' | 'stakeholders' | 'siniestros' | 'inspecciones' | 'documentos' | 'asistencia' | 'legajo'

interface EstablecimientoTabsProps {
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  canDelete: boolean
  sectores: SectorEstablecimiento[]
  siniestros: Siniestro[]
  inspecciones: Inspeccion[]
  documentos: Documento[]
  documentTypes: DocumentType[]
  defaultTab?: Tab
}

// ---- Buscador de trabajadores sin sector asignado ----
function TrabajadorSearchPicker({
  establecimientoId,
  puestoId,
  empresaId,
  onAssigned,
  onCancel,
}: {
  establecimientoId: string
  puestoId: string
  empresaId: string
  onAssigned: () => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [available, setAvailable] = useState<{ id: string; nombre: string; apellido: string; dni: string | null }[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    const supabase = createClient()
    async function load() {
      const { data: sectors } = await supabase
        .from('sectores_establecimiento')
        .select('id')
        .eq('establecimiento_id', establecimientoId)

      const sectorIds = sectors?.map(s => s.id) ?? []
      const assignedIds = new Set<string>()

      if (sectorIds.length > 0) {
        const { data: puestos } = await supabase
          .from('puestos_de_trabajo')
          .select('id')
          .in('sector_id', sectorIds)

        const puestoIds = puestos?.map(p => p.id) ?? []
        if (puestoIds.length > 0) {
          const { data: eps } = await supabase
            .from('empleado_puesto')
            .select('persona_id')
            .in('puesto_id', puestoIds)
          eps?.forEach(ep => assignedIds.add(ep.persona_id))
        }
      }

      const { data: links } = await supabase
        .from('persona_establecimiento')
        .select('persona_id')
        .eq('establecimiento_id', establecimientoId)

      const availableIds = (links?.map(l => l.persona_id) ?? []).filter(id => !assignedIds.has(id))

      if (availableIds.length === 0) {
        setAvailable([])
        return
      }

      const { data: persons } = await supabase
        .from('directorio_personas')
        .select('id, nombre, apellido, dni')
        .in('id', availableIds)
        .eq('is_active', true)
        .order('apellido')

      setAvailable((persons as { id: string; nombre: string; apellido: string; dni: string | null }[]) ?? [])
    }
    load()
  }, [establecimientoId])

  const filtered = (available ?? []).filter(p => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      p.apellido?.toLowerCase().includes(q) ||
      p.nombre?.toLowerCase().includes(q) ||
      p.dni?.includes(q)
    )
  })

  function assign(personaId: string) {
    setError(null)
    startTransition(async () => {
      const result = await assignTrabajadorToPuesto(puestoId, personaId, establecimientoId, empresaId)
      if (result.success) {
        onAssigned()
      } else {
        setError(result.error ?? 'Error al asignar trabajador')
      }
    })
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 mt-2 space-y-2">
      <input
        type="search"
        placeholder="Buscar por apellido, nombre o DNI…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        autoFocus
        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sig-400"
      />
      {available === null ? (
        <p className="text-xs text-gray-400 py-2 text-center">Cargando trabajadores…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-gray-400 py-2 text-center">
          {query ? 'Sin resultados para esa búsqueda.' : 'No hay trabajadores sin sector asignado.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 max-h-48 overflow-y-auto rounded border border-gray-200 bg-white">
          {filtered.map(p => (
            <li key={p.id}>
              <button
                type="button"
                disabled={isPending}
                onClick={() => assign(p.id)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-sig-50 transition-colors disabled:opacity-50"
              >
                <span className="font-medium text-gray-800">{p.apellido}, {p.nombre}</span>
                {p.dni && <span className="text-gray-400 text-xs ml-2">DNI {p.dni}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  )
}

// ---- Puesto form inline ----
function PuestoInlineForm({
  action,
  onSuccess,
  onCancel,
}: {
  action: (prev: ActionResult<null> | null, fd: FormData) => Promise<ActionResult<null>>
  onSuccess: () => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState(action, null)
  useEffect(() => { if (state?.success) onSuccess() }, [state])
  return (
    <form action={formAction} className="mt-2 space-y-2 bg-gray-50 rounded-lg p-3">
      <div className="flex gap-2">
        <input
          name="nombre"
          placeholder="Nombre del puesto *"
          required
          className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm"
        />
        <select
          name="tipo"
          required
          className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white"
        >
          <option value="">Tipo *</option>
          <option value="operativo">Operativo</option>
          <option value="administrativo">Administrativo</option>
        </select>
      </div>
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" type="submit" disabled={pending}>{pending ? '…' : 'Agregar'}</Button>
      </div>
    </form>
  )
}

// ---- EPP inline form ----
function EppInlineForm({
  action,
  onSuccess,
  onCancel,
}: {
  action: (prev: ActionResult<null> | null, fd: FormData) => Promise<ActionResult<null>>
  onSuccess: () => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const [productos, setProductos] = useState<Producto[] | null>(null)

  useEffect(() => { if (state?.success) onSuccess() }, [state])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('productos')
      .select('id, nombre, tamano, unidad_id, unidades(simbolo), categoria_productos(nombre)')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setProductos((data as unknown as Producto[]) ?? []))
  }, [])

  return (
    <form action={formAction} className="bg-sig-50 rounded-lg p-3 mt-2 space-y-2">
      <p className="text-xs font-semibold text-sig-700 mb-1">Agregar EPP</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-600 block mb-1">Producto *</label>
          <select name="producto_id" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
            <option value="">Seleccioná…</option>
            {productos === null ? (
              <option disabled>Cargando…</option>
            ) : (
              productos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.tamano ? ` ${p.tamano}${p.unidades?.simbolo ?? ''}` : ''}
                </option>
              ))
            )}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-600 block mb-1">Vida útil (hs)</label>
          <input name="horas_vida_util" type="number" min="0" step="0.5" placeholder="Opcional" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" type="submit" disabled={pending}>{pending ? '…' : 'Agregar'}</Button>
      </div>
    </form>
  )
}

// ---- Puesto row (expandable → personas + EPP) ----
function PuestoRow({
  puesto,
  establecimientoId,
  empresaId,
  canWrite,
  canDelete,
  onDeleted,
}: {
  puesto: PuestoDeTrabajo
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  canDelete: boolean
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [personas, setPersonas] = useState<TrabajadorPuesto[] | null>(null)
  const [epp, setEpp] = useState<EppPorPuesto[] | null>(null)
  const [showAddPersona, setShowAddPersona] = useState(false)
  const [showAddEpp, setShowAddEpp] = useState(false)
  const [selectedEp, setSelectedEp] = useState<TrabajadorPuesto | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    if (personas === null) {
      supabase
        .from('empleado_puesto')
        .select('id, persona_id, fecha_desde, directorio_personas(id, nombre, apellido, dni, fecha_ingreso, legajo, telefono, email, tipo_id, tipo_personas(nombre))')
        .eq('puesto_id', puesto.id)
        .then(({ data }) => setPersonas((data as unknown as TrabajadorPuesto[]) ?? []))
    }
    if (epp === null) {
      supabase
        .from('epp_por_puesto')
        .select('id, puesto_id, producto_id, horas_vida_util, productos(id, nombre, tamano, unidad_id, unidades(simbolo), categoria_productos(nombre))')
        .eq('puesto_id', puesto.id)
        .then(({ data }) => setEpp((data as unknown as EppPorPuesto[]) ?? []))
    }
  }, [open, personas, epp, puesto.id])

  function handleRemovePersona(epId: string) {
    startTransition(async () => {
      await removeTrabajadorFromPuesto(epId, establecimientoId, empresaId)
      setPersonas(prev => prev?.filter(e => e.id !== epId) ?? null)
    })
  }

  function handleRemoveEpp(eppId: string) {
    startTransition(async () => {
      await removeEppFromPuesto(eppId, establecimientoId, empresaId)
      setEpp(prev => prev?.filter(e => e.id !== eppId) ?? null)
    })
  }

  function handleDeletePuesto() {
    startTransition(async () => {
      await deletePuesto(puesto.id, establecimientoId, empresaId)
      onDeleted()
    })
  }

  const eppAction = addEppToPuesto.bind(null, puesto.id, establecimientoId, empresaId)

  return (
    <div className="border border-gray-100 rounded-lg">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 flex-1 text-left text-sm font-medium text-gray-800 hover:text-gray-900"
        >
          <svg className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          {puesto.nombre}
          {puesto.tipo && (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
              puesto.tipo === 'operativo'
                ? 'bg-blue-50 text-blue-700'
                : 'bg-purple-50 text-purple-700'
            }`}>
              {puesto.tipo === 'operativo' ? 'Op.' : 'Admin.'}
            </span>
          )}
          {personas !== null && (
            <span className="text-xs text-gray-400 font-normal">({personas.length} trabajador{personas.length !== 1 ? 'es' : ''})</span>
          )}
          {epp !== null && epp.length > 0 && (
            <span className="text-xs bg-sig-50 text-sig-700 font-medium px-1.5 py-0.5 rounded">{epp.length} EPP</span>
          )}
        </button>
        {canDelete && (
          <button
            onClick={handleDeletePuesto}
            disabled={isPending}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Eliminar
          </button>
        )}
      </div>

      {open && (
        <div className="px-4 pb-3 border-t border-gray-50 space-y-3">
          {/* Trabajadores section */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2 mb-1">Trabajadores</p>
            {personas === null ? (
              <p className="text-xs text-gray-400 py-1">Cargando…</p>
            ) : personas.length === 0 && !showAddPersona ? (
              <p className="text-xs text-gray-400 py-1">Sin trabajadores en este puesto.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {personas.map(ep => (
                  <li key={ep.id} className="flex items-center justify-between py-1.5 text-sm">
                    <button
                      onClick={() => setSelectedEp(ep)}
                      className="text-left text-sig-500 hover:text-sig-700 font-medium"
                    >
                      {ep.directorio_personas?.apellido}, {ep.directorio_personas?.nombre}
                      {ep.directorio_personas?.dni && <span className="text-gray-400 text-xs font-normal ml-2">DNI {ep.directorio_personas.dni}</span>}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => handleRemovePersona(ep.id)}
                        disabled={isPending}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Quitar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && !showAddPersona && (
              <button
                onClick={() => setShowAddPersona(true)}
                className="mt-1 text-xs text-sig-500 hover:text-sig-700 font-medium"
              >
                + Agregar trabajador
              </button>
            )}
            {showAddPersona && (
              <TrabajadorSearchPicker
                puestoId={puesto.id}
                establecimientoId={establecimientoId}
                empresaId={empresaId}
                onAssigned={() => { setShowAddPersona(false); setPersonas(null) }}
                onCancel={() => setShowAddPersona(false)}
              />
            )}
          </div>

          {/* EPP section */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">EPP Requerido</p>
            {epp === null ? (
              <p className="text-xs text-gray-400 py-1">Cargando…</p>
            ) : epp.length === 0 && !showAddEpp ? (
              <p className="text-xs text-gray-400 py-1">Sin EPP definido.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {epp.map(e => (
                  <li key={e.id} className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-800">
                      {e.productos?.nombre}
                      {e.productos?.tamano && <span className="text-gray-500 ml-1">{e.productos.tamano}{(e.productos as any).unidades?.simbolo ?? ''}</span>}
                      {e.horas_vida_util && <span className="text-gray-400 text-xs ml-2">{e.horas_vida_util}hs vida útil</span>}
                    </span>
                    {canDelete && (
                      <button
                        onClick={() => handleRemoveEpp(e.id)}
                        disabled={isPending}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Quitar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canWrite && !showAddEpp && (
              <button
                onClick={() => setShowAddEpp(true)}
                className="mt-1 text-xs text-sig-500 hover:text-sig-700 font-medium"
              >
                + Agregar EPP
              </button>
            )}
            {showAddEpp && (
              <EppInlineForm
                action={eppAction}
                onSuccess={() => { setShowAddEpp(false); setEpp(null) }}
                onCancel={() => setShowAddEpp(false)}
              />
            )}
          </div>
        </div>
      )}

      {selectedEp?.directorio_personas && (
        <TrabajadorModal
          persona={selectedEp.directorio_personas}
          open={!!selectedEp}
          onClose={() => setSelectedEp(null)}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
    </div>
  )
}

// ---- Sector row (expandable → puestos) ----
function SectorRow({
  sector,
  establecimientoId,
  empresaId,
  canWrite,
  canDelete,
  onDeleted,
}: {
  sector: SectorEstablecimiento
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  canDelete: boolean
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [puestos, setPuestos] = useState<PuestoDeTrabajo[] | null>(null)
  const [showAddPuesto, setShowAddPuesto] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingVal, setEditingVal] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || puestos !== null) return
    const supabase = createClient()
    supabase
      .from('puestos_de_trabajo')
      .select('*')
      .eq('sector_id', sector.id)
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setPuestos((data as PuestoDeTrabajo[]) ?? []))
  }, [open, puestos, sector.id])

  function saveWorkers(sectorId: string) {
    const val = parseInt(editingVal, 10)
    if (isNaN(val) || val < 0) return
    startTransition(async () => {
      await updateSectorTrabajadores(sectorId, val, establecimientoId, empresaId)
      setEditingId(null)
    })
  }

  function handleDeleteSector() {
    startTransition(async () => {
      await deleteSector(sector.id, establecimientoId, empresaId)
      onDeleted()
    })
  }

  const puestoAction = createPuesto.bind(null, sector.id, establecimientoId, empresaId)

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Sector header */}
      <div className="flex items-center gap-3 px-5 py-3.5">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <svg className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium text-gray-900 text-sm">{sector.nombre}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${sector.es_custom ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
            {sector.es_custom ? 'Custom' : 'Predefinido'}
          </span>
          {puestos !== null && (
            <span className="text-xs text-gray-400">{puestos.length} puesto{puestos.length !== 1 ? 's' : ''}</span>
          )}
        </button>

        {canWrite && editingId === sector.id ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number" min="0" value={editingVal}
              onChange={e => setEditingVal(e.target.value)}
              className="w-16 border border-gray-300 rounded px-2 py-1 text-xs text-center"
              autoFocus
            />
            <Button size="sm" onClick={() => saveWorkers(sector.id)} disabled={isPending}>OK</Button>
            <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>×</Button>
          </div>
        ) : (
          <button
            onClick={() => canWrite && (setEditingId(sector.id), setEditingVal(sector.cantidad_trabajadores.toString()))}
            className={`text-sm text-gray-500 ${canWrite ? 'hover:text-sig-500 cursor-pointer' : 'cursor-default'}`}
            title={canWrite ? 'Click para editar trabajadores' : undefined}
          >
            {sector.cantidad_trabajadores} trabajadores
          </button>
        )}

        {canDelete && sector.es_custom && (
          <button
            onClick={handleDeleteSector}
            disabled={isPending}
            className="text-xs text-red-400 hover:text-red-600 transition-colors"
          >
            Eliminar
          </button>
        )}
      </div>

      {/* Puestos section */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-3 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Puestos de trabajo</p>

          {puestos === null ? (
            <p className="text-xs text-gray-400">Cargando…</p>
          ) : puestos.length === 0 && !showAddPuesto ? (
            <p className="text-xs text-gray-400">Sin puestos definidos.</p>
          ) : (
            <div className="space-y-1.5">
              {puestos.map(puesto => (
                <PuestoRow
                  key={puesto.id}
                  puesto={puesto}
                  establecimientoId={establecimientoId}
                  empresaId={empresaId}
                  canWrite={canWrite}
                  canDelete={canDelete}
                  onDeleted={() => setPuestos(prev => prev?.filter(p => p.id !== puesto.id) ?? null)}
                />
              ))}
            </div>
          )}

          {canWrite && !showAddPuesto && (
            <button
              onClick={() => setShowAddPuesto(true)}
              className="text-xs text-sig-500 hover:text-sig-700 font-medium mt-1"
            >
              + Agregar puesto
            </button>
          )}

          {showAddPuesto && (
            <PuestoInlineForm
              action={puestoAction}
              onSuccess={() => { setShowAddPuesto(false); setPuestos(null) }}
              onCancel={() => setShowAddPuesto(false)}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ---- Sectores Tab ----
function SectoresTab({
  sectores,
  establecimientoId,
  empresaId,
  canWrite,
  canDelete,
}: {
  sectores: SectorEstablecimiento[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  canDelete: boolean
}) {
  const [showModal, setShowModal] = useState(false)
  const [localSectores, setLocalSectores] = useState(sectores)
  const [workerCounts, setWorkerCounts] = useState<{ operativo: number; administrativo: number } | null>(null)
  const sectorAction = createSectorCustom.bind(null, establecimientoId, empresaId)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('sectores_establecimiento')
      .select('id')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data: secs }) => {
        const ids = (secs ?? []).map(s => s.id)
        if (ids.length === 0) { setWorkerCounts({ operativo: 0, administrativo: 0 }); return }
        supabase
          .from('puestos_de_trabajo')
          .select('tipo, empleado_puesto(persona_id)')
          .in('sector_id', ids)
          .not('tipo', 'is', null)
          .then(({ data: puestos }) => {
            const ops = new Set<string>()
            const adm = new Set<string>()
            ;(puestos ?? []).forEach((p: any) => {
              ;(p.empleado_puesto ?? []).forEach((ep: any) => {
                if (p.tipo === 'operativo') ops.add(ep.persona_id)
                else adm.add(ep.persona_id)
              })
            })
            setWorkerCounts({ operativo: ops.size, administrativo: adm.size })
          })
      })
  }, [establecimientoId])

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Sectores del Establecimiento</h3>
          {workerCounts !== null && (workerCounts.operativo > 0 || workerCounts.administrativo > 0) && (
            <p className="text-xs text-gray-500 mt-0.5">
              <span className="text-blue-600 font-medium">{workerCounts.operativo} operativo{workerCounts.operativo !== 1 ? 's' : ''}</span>
              <span className="text-gray-300 mx-1.5">·</span>
              <span className="text-purple-600 font-medium">{workerCounts.administrativo} administrativo{workerCounts.administrativo !== 1 ? 's' : ''}</span>
            </p>
          )}
        </div>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>
            + Sector Personalizado
          </Button>
        )}
      </div>

      {localSectores.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No hay sectores registrados
        </div>
      ) : (
        <div className="space-y-2">
          {localSectores.map(sector => (
            <SectorRow
              key={sector.id}
              sector={sector}
              establecimientoId={establecimientoId}
              empresaId={empresaId}
              canWrite={canWrite}
              canDelete={canDelete}
              onDeleted={() => setLocalSectores(prev => prev.filter(s => s.id !== sector.id))}
            />
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Agregar Sector Personalizado">
        <SectorForm
          action={sectorAction}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}

// ---- Agregar Persona form (StakeholdersTab) ----
function AgregarPersonaStakeholderForm({
  establecimientoId,
  tiposPersona,
  onSuccess,
  onCancel,
}: {
  establecimientoId: string
  tiposPersona: { id: string; nombre: string }[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState(createPersona, null)
  useEffect(() => { if (state?.success) onSuccess() }, [state])
  return (
    <form action={formAction} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Nueva persona</p>
      <input type="hidden" name="establecimiento_id" value={establecimientoId} />
      <div className="grid grid-cols-2 gap-2">
        <input name="nombre" placeholder="Nombre *" required className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        <input name="apellido" placeholder="Apellido *" required className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select name="tipo_id" required className="border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
          <option value="">Tipo *</option>
          {tiposPersona.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
        <input name="dni" placeholder="DNI" className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
      </div>
      <input name="fecha_ingreso" type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600" />
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Agregar'}</Button>
      </div>
    </form>
  )
}

// ---- Agregar Org Externa form (StakeholdersTab) ----
function AgregarOrgStakeholderForm({
  action,
  tiposOrg,
  onSuccess,
  onCancel,
}: {
  action: (prev: ActionResult<null> | null, fd: FormData) => Promise<ActionResult<null>>
  tiposOrg: { id: string; nombre: string }[]
  onSuccess: () => void
  onCancel: () => void
}) {
  const [state, formAction, pending] = useActionState(action, null)
  useEffect(() => { if (state?.success) onSuccess() }, [state])
  return (
    <form action={formAction} className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
      <p className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Nueva organización externa</p>
      <input name="nombre" placeholder="Nombre *" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
      <select name="tipo_id" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
        <option value="">Tipo *</option>
        {tiposOrg.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input name="email" type="email" placeholder="Email" className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        <input name="telefono" placeholder="Teléfono" className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
      </div>
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Agregar'}</Button>
      </div>
    </form>
  )
}

// ---- Personas Tab ----
function StakeholdersTab({
  establecimientoId,
  empresaId,
  canWrite,
}: {
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}) {
  const [personas, setPersonas] = useState<DirectorioPersona[] | null>(null)
  const [tiposPersona, setTiposPersona] = useState<{ id: string; nombre: string }[]>([])
  const [tiposOrg, setTiposOrg] = useState<{ id: string; nombre: string }[]>([])
  const [activeTipo, setActiveTipo] = useState<string>('todos')
  const [selectedPersona, setSelectedPersona] = useState<DirectorioPersona | null>(null)
  const [orgExternas, setOrgExternas] = useState<Organizacion[] | null>(null)
  const [personasOpen, setPersonasOpen] = useState(true)
  const [orgsOpen, setOrgsOpen] = useState(true)
  const [showAddPersona, setShowAddPersona] = useState(false)
  const [showAddOrg, setShowAddOrg] = useState(false)

  const loadPersonas = () => {
    createClient()
      .from('persona_establecimiento')
      .select('directorio_personas(id, nombre, apellido, dni, fecha_nacimiento, fecha_ingreso, legajo, telefono, email, tipo_id, tipo_personas(nombre), organizacion_id, notas, is_active, created_at, updated_at)')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as { directorio_personas: DirectorioPersona }[]).map(r => r.directorio_personas).filter(Boolean)
        setPersonas(list)
      })
  }

  const loadOrgs = () => {
    createClient()
      .from('organizacion_establecimiento')
      .select('organizaciones(id, nombre, email, telefono, notas, is_active, tipo_organizaciones(nombre))')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as { organizaciones: Organizacion }[])
          .map(r => r.organizaciones)
          .filter(o => o?.is_active)
        setOrgExternas(list as Organizacion[])
      })
  }

  const orgAction = addOrganizacionToEstablecimiento.bind(null, establecimientoId, empresaId)

  useEffect(() => {
    const supabase = createClient()
    loadPersonas()
    supabase.from('tipo_personas').select('id, nombre').order('nombre').then(({ data }) => setTiposPersona(data ?? []))
    loadOrgs()
    supabase.from('tipo_organizaciones').select('id, nombre').order('nombre').then(({ data }) => setTiposOrg(data ?? []))
  }, [establecimientoId]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = personas === null
    ? null
    : activeTipo === 'todos'
      ? personas
      : personas.filter(p => p.tipo_id === activeTipo)

  return (
    <div className="space-y-4">
      {/* ── Personas ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={() => setPersonasOpen(o => !o)}
            className="flex items-center gap-3 hover:opacity-75 transition-opacity"
          >
            <span className="font-semibold text-gray-900">Personas</span>
            {personas !== null && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {personas.length}
              </span>
            )}
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${personasOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
            >
              <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {canWrite && (
            <button
              onClick={() => { setShowAddPersona(true); setPersonasOpen(true) }}
              className="text-xs font-medium text-sig-600 hover:text-sig-800"
            >
              + Agregar persona
            </button>
          )}
        </div>

        {personasOpen && (
          <div className="border-t border-gray-100">
            <div className="flex gap-1 px-5 py-3 flex-wrap border-b border-gray-100">
              <button
                onClick={() => setActiveTipo('todos')}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
              >
                Todos {personas !== null && `(${personas.length})`}
              </button>
              {tiposPersona.map(t => {
                const count = personas?.filter(p => p.tipo_id === t.id).length ?? 0
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTipo(t.id)}
                    className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === t.id ? 'bg-sig-500 text-white border-sig-500' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {t.nombre} {personas !== null && `(${count})`}
                  </button>
                )
              })}
            </div>

            {filtered === null ? (
              <div className="p-8 text-center text-gray-400 text-sm">Cargando…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No hay personas registradas{activeTipo !== 'todos' ? ' de este tipo' : ''}.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr className="text-left">
                    <th className="px-5 py-3 text-gray-500 font-medium">Nombre</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">DNI</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">Ingreso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setSelectedPersona(p)}
                          className="text-sig-500 hover:text-sig-700 font-medium text-left"
                        >
                          {p.apellido}, {p.nombre}
                        </button>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{p.dni ?? '—'}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {p.tipo_personas?.nombre ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{p.fecha_ingreso ? formatDate(p.fecha_ingreso) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {showAddPersona && canWrite && (
              <div className="px-5 pb-4">
                <AgregarPersonaStakeholderForm
                  establecimientoId={establecimientoId}
                  tiposPersona={tiposPersona}
                  onSuccess={() => { setShowAddPersona(false); loadPersonas() }}
                  onCancel={() => setShowAddPersona(false)}
                />
              </div>
            )}
          </div>
        )}

        {selectedPersona && (
          <TrabajadorModal
            persona={selectedPersona}
            open={!!selectedPersona}
            onClose={() => setSelectedPersona(null)}
            establecimientoId={establecimientoId}
            empresaId={empresaId}
            canWrite={canWrite}
          />
        )}
      </div>

      {/* ── Organizaciones Externas ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={() => setOrgsOpen(o => !o)}
            className="flex items-center gap-3 hover:opacity-75 transition-opacity"
          >
            <span className="font-semibold text-gray-900">Organizaciones Externas</span>
            {orgExternas !== null && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                {orgExternas.length}
              </span>
            )}
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${orgsOpen ? 'rotate-180' : ''}`}
              viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"
            >
              <path d="M2 4l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {canWrite && (
            <button
              onClick={() => { setShowAddOrg(true); setOrgsOpen(true) }}
              className="text-xs font-medium text-sig-600 hover:text-sig-800"
            >
              + Agregar organización
            </button>
          )}
        </div>

        {orgsOpen && (
          <div className="border-t border-gray-100">
            {orgExternas === null ? (
              <div className="p-8 text-center text-gray-400 text-sm">Cargando…</div>
            ) : orgExternas.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">
                No hay organizaciones externas vinculadas a este establecimiento.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr className="text-left">
                    <th className="px-5 py-3 text-gray-500 font-medium">Nombre</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">Email</th>
                    <th className="px-5 py-3 text-gray-500 font-medium">Teléfono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orgExternas.map(o => (
                    <tr key={o.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3.5 font-medium text-gray-900">{o.nombre}</td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {o.tipo_organizaciones?.nombre ?? '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-gray-500">{o.email ?? '—'}</td>
                      <td className="px-5 py-3.5 text-gray-500">{o.telefono ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {showAddOrg && canWrite && (
              <div className="px-5 pb-4">
                <AgregarOrgStakeholderForm
                  action={orgAction}
                  tiposOrg={tiposOrg}
                  onSuccess={() => { setShowAddOrg(false); loadOrgs() }}
                  onCancel={() => setShowAddOrg(false)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Asistencia Tab ----
function AsistenciaTab({
  establecimientoId,
  empresaId,
  canWrite,
}: {
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}) {
  const [registros, setRegistros] = useState<AsistenciaDiaria[] | null>(null)
  const [personas, setPersonas] = useState<DirectorioPersona[]>([])
  const [showForm, setShowForm] = useState(false)
  const [horarioHoy, setHorarioHoy] = useState<{ inicio: string; fin: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    const diaSemana = new Date().getDay()

    supabase
      .from('asistencia_diaria')
      .select('id, fecha, hora_entrada, hora_salida, directorio_personas(nombre, apellido)')
      .eq('establecimiento_id', establecimientoId)
      .eq('fecha', today)
      .order('hora_entrada', { ascending: true })
      .then(({ data }) => setRegistros((data as unknown as AsistenciaDiaria[]) ?? []))

    supabase
      .from('persona_establecimiento')
      .select('directorio_personas(id, nombre, apellido, tipo_personas(nombre))')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as { directorio_personas: DirectorioPersona }[]).map(r => r.directorio_personas).filter(Boolean)
        setPersonas(list)
      })

    supabase
      .from('horarios_establecimiento')
      .select('hora_inicio, hora_fin, activo')
      .eq('establecimiento_id', establecimientoId)
      .eq('dia_semana', diaSemana)
      .single()
      .then(({ data }) => {
        if (data?.activo && data.hora_inicio && data.hora_fin) {
          setHorarioHoy({ inicio: data.hora_inicio.slice(0, 5), fin: data.hora_fin.slice(0, 5) })
        }
      })
  }, [establecimientoId])

  const [state, formAction, pending] = useActionState(
    createAsistencia.bind(null, establecimientoId, empresaId),
    null
  )

  useEffect(() => {
    if (state?.success) {
      setShowForm(false)
      setRegistros(null)
    }
  }, [state])

  const today = new Date().toISOString().split('T')[0]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Asistencia del día</h3>
        {canWrite && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>+ Registrar</Button>
        )}
      </div>

      {showForm && (
        <form action={formAction} className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Nuevo registro de asistencia</p>
            {horarioHoy && (
              <span className="text-xs text-gray-400">
                Horario del establecimiento: {horarioHoy.inicio} – {horarioHoy.fin}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-600 block mb-1">Persona *</label>
              <select name="persona_id" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm bg-white">
                <option value="">Seleccioná…</option>
                {personas.map(p => (
                  <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Fecha *</label>
              <input name="fecha" type="date" required defaultValue={today} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">
                Hora entrada *
                {horarioHoy && <span className="text-gray-400 font-normal ml-1">(default: {horarioHoy.inicio})</span>}
              </label>
              <input name="hora_entrada" type="time" required defaultValue={horarioHoy?.inicio ?? ''} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">
                Hora salida
                {horarioHoy && <span className="text-gray-400 font-normal ml-1">(default: {horarioHoy.fin})</span>}
              </label>
              <input name="hora_salida" type="time" defaultValue={horarioHoy?.fin ?? ''} className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Observaciones</label>
            <input name="observaciones" type="text" placeholder="Opcional…" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
          </div>
          {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="secondary" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button size="sm" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Registrar'}</Button>
          </div>
        </form>
      )}

      {registros === null ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">Cargando…</div>
      ) : registros.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          Sin registros para hoy.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Persona</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Fecha</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Entrada</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Salida</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {registros.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {r.directorio_personas ? `${r.directorio_personas.apellido}, ${r.directorio_personas.nombre}` : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{formatDate(r.fecha)}</td>
                  <td className="px-5 py-3.5 text-gray-700">{new Date(r.hora_entrada).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-5 py-3.5 text-gray-500">{r.hora_salida ? new Date(r.hora_salida).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---- Siniestros Tab ----
function SiniestrosTab({
  siniestros,
  establecimientoId,
  empresaId,
  canWrite,
}: {
  siniestros: Siniestro[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}) {
  const [showModal, setShowModal] = useState(false)
  const siniestroAction = createSiniestro.bind(null, establecimientoId, empresaId)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Siniestros Registrados</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Nuevo Siniestro</Button>
        )}
      </div>

      {!siniestros.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No hay siniestros registrados
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Fecha</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Estado</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Días Perdidos</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Derivación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {siniestros.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {SINIESTRO_TIPO_LABELS[s.tipo]}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{formatDate(s.fecha_ocurrencia)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${SINIESTRO_ESTADO_COLORS[s.estado as SiniestroEstado]}`}>
                      {SINIESTRO_ESTADO_LABELS[s.estado]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{s.dias_perdidos ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.requiere_derivacion ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.requiere_derivacion ? 'Sí' : 'No'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Siniestro">
        <SiniestroForm
          action={siniestroAction}
          personas={[]}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}

// ---- Inspecciones Tab ----
function InspeccionesTab({
  inspecciones,
  establecimientoId,
  empresaId,
  canWrite,
}: {
  inspecciones: Inspeccion[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}) {
  const [showModal, setShowModal] = useState(false)
  const inspeccionAction = createInspeccion.bind(null, establecimientoId, empresaId)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Inspecciones</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Nueva Inspección</Button>
        )}
      </div>

      {!inspecciones.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No hay inspecciones registradas
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">F. Programada</th>
                <th className="px-5 py-3 text-gray-500 font-medium">F. Realizada</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Estado</th>
                <th className="px-5 py-3 text-gray-500 font-medium text-center">Puntaje</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Observaciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {inspecciones.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 text-gray-900">{formatDate(i.fecha_programada)}</td>
                  <td className="px-5 py-3.5 text-gray-500">{formatDate(i.fecha_realizada)}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${INSPECCION_ESTADO_COLORS[i.estado as InspeccionEstado]}`}>
                      {INSPECCION_ESTADO_LABELS[i.estado]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-center">
                    {i.puntaje !== null ? (
                      <span className={`font-bold ${i.puntaje >= 80 ? 'text-green-600' : i.puntaje >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {i.puntaje}
                      </span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 max-w-xs truncate">{i.observaciones ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Inspección">
        <InspeccionForm
          action={inspeccionAction}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}

// ---- Riesgos Tab ----
function RiesgosTab({
  riesgos,
  establecimientoId,
  empresaId,
  canWrite,
}: {
  riesgos: Riesgo[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}) {
  const [showModal, setShowModal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const riesgoAction = createRiesgo.bind(null, establecimientoId, empresaId)

  const nivelesOrder: RiesgoNivel[] = ['critico', 'alto', 'medio', 'bajo']
  const byNivel: Record<string, Riesgo[]> = {}
  riesgos.forEach(r => {
    if (!byNivel[r.nivel]) byNivel[r.nivel] = []
    byNivel[r.nivel].push(r)
  })

  function handleResolver(riesgoId: string) {
    startTransition(async () => {
      await resolverRiesgo(riesgoId, establecimientoId, empresaId)
    })
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Riesgos Identificados</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Nuevo Riesgo</Button>
        )}
      </div>

      {!riesgos.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No hay riesgos registrados
        </div>
      ) : (
        <div className="space-y-4">
          {nivelesOrder.map(nivel => {
            const items = (byNivel[nivel] ?? []).filter(r => !r.resuelto)
            if (!items.length) return null
            return (
              <div key={nivel}>
                <h4 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wider">
                  {RIESGO_NIVEL_LABELS[nivel]}
                </h4>
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-50">
                      {items.map(r => (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3.5">
                            <div className="flex items-start gap-3">
                              <span className={`mt-0.5 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${RIESGO_NIVEL_COLORS[r.nivel as RiesgoNivel]}`}>
                                {RIESGO_NIVEL_LABELS[r.nivel as RiesgoNivel]}
                              </span>
                              <div>
                                <p className="text-gray-900 font-medium">{r.descripcion}</p>
                                {r.medida_correctiva && (
                                  <p className="text-gray-500 text-xs mt-0.5">Correctiva: {r.medida_correctiva}</p>
                                )}
                                <p className="text-gray-400 text-xs mt-0.5">
                                  Identificado: {formatDate(r.fecha_identificacion)}
                                </p>
                              </div>
                            </div>
                          </td>
                          {canWrite && (
                            <td className="px-5 py-3.5 text-right">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleResolver(r.id)}
                                disabled={isPending}
                              >
                                Marcar Resuelto
                              </Button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}

          {riesgos.some(r => r.resuelto) && (
            <details className="mt-2">
              <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                Ver resueltos ({riesgos.filter(r => r.resuelto).length})
              </summary>
              <div className="mt-2 bg-white rounded-xl border border-gray-200 overflow-hidden opacity-60">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-gray-50">
                    {riesgos.filter(r => r.resuelto).map(r => (
                      <tr key={r.id}>
                        <td className="px-5 py-3.5 text-gray-500 line-through">{r.descripcion}</td>
                        <td className="px-5 py-3.5 text-gray-400 text-xs">Resuelto {formatDate(r.fecha_resolucion)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Riesgo">
        <RiesgoForm
          action={riesgoAction}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}

// ---- Documentos Tab ----
function DocumentosTab({
  documentos,
  documentTypes,
  establecimientoId,
  empresaId,
  canWrite,
}: {
  documentos: Documento[]
  documentTypes: DocumentType[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}) {
  const [showModal, setShowModal] = useState(false)
  const documentoAction = createDocumento.bind(null, empresaId, establecimientoId)

  function vencimientoClass(fecha: string | null): string {
    if (!fecha) return 'text-gray-400'
    const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
    if (days < 0) return 'text-red-600 font-medium'
    if (days <= 30) return 'text-yellow-600 font-medium'
    return 'text-gray-500'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Documentación</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Agregar Documento</Button>
        )}
      </div>

      {!documentos.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No hay documentos cargados
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Vencimiento</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Archivo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {documentos.map(d => {
                const typeName = d.documento_tipos?.nombre ?? '—'
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{typeName}</td>
                    <td className={`px-5 py-3.5 ${vencimientoClass(d.fecha_vencimiento)}`}>
                      {d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {d.archivo_url ? (
                        <a href={d.archivo_url} target="_blank" rel="noopener noreferrer" className="text-sig-500 hover:underline text-xs truncate max-w-[160px] block">
                          Ver archivo
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Agregar Documento">
        <DocumentoForm
          action={documentoAction}
          documentTypes={documentTypes}
          context="establecimiento"
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}

// ---- Add Gestion Tree (3-level: grupo → categoria → gestion) ----
function AddGestionTree({
  gestionsNotAdded,
  onAdd,
}: {
  gestionsNotAdded: Gestion[]
  onAdd: (gestionId: string) => void
}) {
  const [openGrupos, setOpenGrupos] = useState<Set<string>>(new Set())
  const [openCategorias, setOpenCategorias] = useState<Set<string>>(new Set())

  const byGrupo = new Map<string, Map<string, Gestion[]>>()
  for (const g of gestionsNotAdded) {
    const grupoNombre = g.categoria_gestiones?.grupo_gestiones?.nombre ?? 'Sin grupo'
    const catNombre = g.categoria_gestiones?.nombre ?? 'Sin categoría'
    if (!byGrupo.has(grupoNombre)) byGrupo.set(grupoNombre, new Map())
    const byCat = byGrupo.get(grupoNombre)!
    if (!byCat.has(catNombre)) byCat.set(catNombre, [])
    byCat.get(catNombre)!.push(g)
  }

  function toggleGrupo(nombre: string) {
    setOpenGrupos(prev => { const s = new Set(prev); s.has(nombre) ? s.delete(nombre) : s.add(nombre); return s })
  }
  function toggleCategoria(key: string) {
    setOpenCategorias(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  }

  if (gestionsNotAdded.length === 0) {
    return (
      <div className="bg-gray-50 rounded-lg p-3 mb-4">
        <p className="text-xs text-gray-400">Todas las gestiones ya fueron agregadas.</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 rounded-lg p-3 mb-4">
      <p className="text-xs font-medium text-gray-600 mb-2">Seleccioná gestiones para agregar:</p>
      <div className="space-y-0.5 max-h-80 overflow-y-auto pr-1">
        {Array.from(byGrupo.entries()).map(([grupoNombre, byCat]) => {
          const isOpen = openGrupos.has(grupoNombre)
          const total = Array.from(byCat.values()).reduce((s, g) => s + g.length, 0)
          return (
            <div key={grupoNombre}>
              <button
                onClick={() => toggleGrupo(grupoNombre)}
                className="flex items-center gap-2 w-full text-left px-2 py-1.5 text-xs font-semibold text-gray-700 hover:bg-white rounded-lg transition-colors"
              >
                <svg className={`w-3 h-3 text-gray-400 transition-transform shrink-0 ${isOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {grupoNombre}
                <span className="text-gray-400 font-normal ml-1">({total})</span>
              </button>
              {isOpen && Array.from(byCat.entries()).map(([catNombre, gestiones]) => {
                const catKey = `${grupoNombre}:${catNombre}`
                const isCatOpen = openCategorias.has(catKey)
                return (
                  <div key={catNombre} className="ml-4">
                    <button
                      onClick={() => toggleCategoria(catKey)}
                      className="flex items-center gap-2 w-full text-left px-2 py-1 text-xs text-gray-600 hover:bg-white rounded transition-colors"
                    >
                      <svg className={`w-2.5 h-2.5 text-gray-400 transition-transform shrink-0 ${isCatOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                      {catNombre}
                      <span className="text-gray-400 font-normal">({gestiones.length})</span>
                    </button>
                    {isCatOpen && (
                      <div className="ml-4 py-0.5 space-y-0.5">
                        {gestiones.map(g => (
                          <button
                            key={g.id}
                            onClick={() => onAdd(g.id)}
                            className="block w-full text-left text-xs py-1 px-2 text-gray-700 hover:bg-sig-50 hover:text-sig-700 rounded transition-colors"
                          >
                            {g.nombre}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Gestiones Tab ----
function GestionesTab({ establecimientoId, canWrite }: { establecimientoId: string; canWrite: boolean }) {
  type PHVASection = 'planificar' | 'hacer' | 'verificar' | 'actuar'
  const [activeSection, setActiveSection] = useState<PHVASection>('planificar')
  const [gestionesEstablecimiento, setGestionesEstablecimiento] = useState<GestionEstablecimiento[] | null>(null)
  const [todasGestiones, setTodasGestiones] = useState<Gestion[]>([])
  const [registros, setRegistros] = useState<RegistroGestion[] | null>(null)
  const [observaciones, setObservaciones] = useState<ObservacionGestion[] | null>(null)
  const [personas, setPersonas] = useState<{ id: string; nombre: string; apellido: string }[]>([])
  const [showAddGestion, setShowAddGestion] = useState(false)
  const [showRegistroForm, setShowRegistroForm] = useState<string | null>(null)
  const [showObsForm, setShowObsForm] = useState<string | null>(null)

  function loadData() {
    const supabase = createClient()
    supabase
      .from('gestion_establecimiento')
      .select('*, gestiones(nombre, categoria_id, categoria_gestiones(nombre, grupo_gestiones(nombre)))')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => setGestionesEstablecimiento((data as unknown as GestionEstablecimiento[]) ?? []))
    supabase
      .from('directorio_personas')
      .select('id, nombre, apellido')
      .eq('is_active', true)
      .order('apellido')
      .then(({ data }) => setPersonas((data ?? []) as { id: string; nombre: string; apellido: string }[]))
  }

  function loadRegistros(geIds: string[]) {
    if (geIds.length === 0) { setRegistros([]); return }
    const supabase = createClient()
    supabase
      .from('registro_gestiones')
      .select('*, directorio_personas(nombre, apellido)')
      .in('gestion_establecimiento_id', geIds)
      .order('fecha_planificada')
      .then(({ data }) => setRegistros((data as unknown as RegistroGestion[]) ?? []))
  }

  function loadObservaciones(registroIds: string[]) {
    if (registroIds.length === 0) { setObservaciones([]); return }
    const supabase = createClient()
    supabase
      .from('observaciones_gestiones')
      .select('*, directorio_personas(nombre, apellido)')
      .in('registro_gestion_id', registroIds)
      .order('fecha_planificada')
      .then(({ data }) => setObservaciones((data as unknown as ObservacionGestion[]) ?? []))
  }

  useEffect(() => {
    loadData()
    const supabase = createClient()
    supabase.from('gestiones').select('*, categoria_gestiones(nombre, grupo_gestiones(nombre))').order('nombre')
      .then(({ data }) => setTodasGestiones((data as unknown as Gestion[]) ?? []))
  }, [establecimientoId])

  useEffect(() => {
    if (gestionesEstablecimiento === null) return
    const ids = gestionesEstablecimiento.map(ge => ge.id)
    loadRegistros(ids)
  }, [gestionesEstablecimiento])

  useEffect(() => {
    if (registros === null) return
    const ids = registros.map(r => r.id)
    loadObservaciones(ids)
  }, [registros])

  const PHVA_ITEMS: { id: PHVASection; label: string; icon: string }[] = [
    { id: 'planificar', label: 'Planificar', icon: 'P' },
    { id: 'hacer', label: 'Hacer', icon: 'H' },
    { id: 'verificar', label: 'Verificar', icon: 'V' },
    { id: 'actuar', label: 'Actuar', icon: 'A' },
  ]

  const estadoColors: Record<EstadoGestion, string> = {
    Realizado: 'bg-green-100 text-green-700',
    Pendiente: 'bg-red-100 text-red-700',
    Planificado: 'bg-sky-100 text-sky-700',
  }

  const gestionsNotAdded = todasGestiones.filter(
    g => !gestionesEstablecimiento?.some(ge => ge.gestion_id === g.id)
  )

  return (
    <div className="flex gap-0 min-h-[400px]">
      <nav className="w-44 shrink-0 border-r border-gray-200 pr-0 mr-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Ciclo PHVA</p>
        <div className="flex flex-col gap-1">
          {PHVA_ITEMS.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left w-full ${
                activeSection === item.id
                  ? 'bg-sig-50 text-sig-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                activeSection === item.id ? 'bg-sig-500 text-white' : 'bg-gray-200 text-gray-500'
              }`}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="flex-1 min-w-0">
        {activeSection === 'planificar' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">Gestiones del Establecimiento</h3>
              {canWrite && (
                <button onClick={() => setShowAddGestion(v => !v)} className="text-xs text-sig-500 hover:text-sig-700 font-medium">
                  {showAddGestion ? 'Cancelar' : '+ Agregar gestión'}
                </button>
              )}
            </div>

            {showAddGestion && (
              <AddGestionTree
                gestionsNotAdded={gestionsNotAdded}
                onAdd={async (gestionId) => {
                  await addGestionToEstablecimiento(gestionId, establecimientoId)
                  const supabase = createClient()
                  supabase
                    .from('gestion_establecimiento')
                    .select('*, gestiones(nombre, categoria_id, categoria_gestiones(nombre, grupo_gestiones(nombre)))')
                    .eq('establecimiento_id', establecimientoId)
                    .then(({ data }) => setGestionesEstablecimiento((data as unknown as GestionEstablecimiento[]) ?? []))
                }}
              />
            )}

            {gestionesEstablecimiento === null ? (
              <p className="text-sm text-gray-400">Cargando…</p>
            ) : gestionesEstablecimiento.length === 0 ? (
              <p className="text-sm text-gray-400">No hay gestiones asignadas a este establecimiento.</p>
            ) : (() => {
              const byGrupo = new Map<string, GestionEstablecimiento[]>()
              for (const ge of gestionesEstablecimiento) {
                const g = ge.gestiones?.categoria_gestiones?.grupo_gestiones?.nombre ?? 'Sin grupo'
                if (!byGrupo.has(g)) byGrupo.set(g, [])
                byGrupo.get(g)!.push(ge)
              }
              return (
                <div className="space-y-5">
                  {Array.from(byGrupo.entries()).map(([grupoNombre, items]) => (
                    <div key={grupoNombre}>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{grupoNombre}</p>
                      <div className="space-y-2">
                        {items.map(ge => {
                          const geRegistros = registros?.filter(r => r.gestion_establecimiento_id === ge.id) ?? []
                          return (
                            <div key={ge.id} className="bg-white border border-gray-200 rounded-xl p-4">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="font-medium text-gray-900 text-sm">{ge.gestiones?.nombre ?? '—'}</p>
                                  {ge.gestiones?.categoria_gestiones && (
                                    <p className="text-xs text-gray-400">{ge.gestiones.categoria_gestiones.nombre}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400">{geRegistros.length} registros</span>
                                  {canWrite && (
                                    <button
                                      onClick={() => setShowRegistroForm(showRegistroForm === ge.id ? null : ge.id)}
                                      className="text-xs text-sig-500 hover:text-sig-700 font-medium"
                                    >
                                      + Planificar
                                    </button>
                                  )}
                                </div>
                              </div>
                              {showRegistroForm === ge.id && (
                                <RegistroGestionForm
                                  gestionEstablecimientoId={ge.id}
                                  personas={personas}
                                  onSuccess={() => {
                                    setShowRegistroForm(null)
                                    loadRegistros(gestionesEstablecimiento.map(x => x.id))
                                  }}
                                />
                              )}
                              {geRegistros.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {geRegistros.map(r => {
                                    const estado = calcularEstadoGestion(r.fecha_ejecutada, r.fecha_planificada)
                                    return (
                                      <div key={r.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                                        <span className="text-gray-600">{r.fecha_planificada}</span>
                                        <span className={`px-2 py-0.5 rounded-full font-medium ${estadoColors[estado]}`}>{estado}</span>
                                        {r.directorio_personas && (
                                          <span className="text-gray-400">{r.directorio_personas.apellido}</span>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>
        )}

        {activeSection === 'hacer' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Ejecución de Gestiones</h3>
            {registros === null ? (
              <p className="text-sm text-gray-400">Cargando…</p>
            ) : (
              <div className="space-y-2">
                {registros
                  .filter(r => calcularEstadoGestion(r.fecha_ejecutada, r.fecha_planificada) !== 'Realizado')
                  .map(r => {
                    const estado = calcularEstadoGestion(r.fecha_ejecutada, r.fecha_planificada)
                    const ge = gestionesEstablecimiento?.find(ge => ge.id === r.gestion_establecimiento_id)
                    return (
                      <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{ge?.gestiones?.nombre ?? '—'}</p>
                            <p className="text-xs text-gray-400 mt-0.5">Planificado: {r.fecha_planificada}</p>
                            {r.directorio_personas && (
                              <p className="text-xs text-gray-400">{r.directorio_personas.apellido}, {r.directorio_personas.nombre}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${estadoColors[estado]}`}>{estado}</span>
                            {canWrite && (
                              <button
                                onClick={async () => {
                                  const hoy = new Date().toISOString().split('T')[0]
                                  const fd = new FormData()
                                  fd.set('registro_id', r.id)
                                  fd.set('fecha_ejecutada', hoy)
                                  if (r.notas) fd.set('notas', r.notas)
                                  await ejecutarGestion(null, fd)
                                  loadRegistros(gestionesEstablecimiento?.map(ge => ge.id) ?? [])
                                }}
                                className="text-xs bg-sig-500 hover:bg-sig-700 text-white px-3 py-1 rounded-lg font-medium transition-colors"
                              >
                                Ejecutar
                              </button>
                            )}
                          </div>
                        </div>
                        {canWrite && (
                          <div className="mt-2">
                            <button
                              onClick={() => setShowObsForm(showObsForm === r.id ? null : r.id)}
                              className="text-xs text-sig-500 hover:text-sig-700 font-medium"
                            >
                              + Agregar observación
                            </button>
                            {showObsForm === r.id && (
                              <ObservacionForm
                                registroGestionId={r.id}
                                personas={personas}
                                onSuccess={() => {
                                  setShowObsForm(null)
                                  loadObservaciones(registros.map(x => x.id))
                                }}
                              />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                {registros.filter(r => calcularEstadoGestion(r.fecha_ejecutada, r.fecha_planificada) !== 'Ejecutado').length === 0 && (
                  <p className="text-sm text-gray-400">No hay gestiones pendientes de ejecución.</p>
                )}
              </div>
            )}
          </div>
        )}

        {activeSection === 'verificar' && (
          <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center">
            <p className="text-sm font-medium text-gray-500">Dashboard de Verificación</p>
            <p className="text-xs text-gray-400 mt-1">En construcción — próxima versión.</p>
          </div>
        )}

        {activeSection === 'actuar' && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Observaciones — Seguimiento y Cierre</h3>
            {observaciones === null ? (
              <p className="text-sm text-gray-400">Cargando…</p>
            ) : observaciones.length === 0 ? (
              <p className="text-sm text-gray-400">No hay observaciones registradas.</p>
            ) : (
              <div className="space-y-2">
                {observaciones.map(obs => {
                  const hoy = new Date(); hoy.setHours(0,0,0,0)
                  const planDate = new Date(obs.fecha_planificada); planDate.setHours(0,0,0,0)
                  const estado = obs.fecha_cierre ? 'Cerrado' : planDate < hoy ? 'Pendiente' : 'Planificado'
                  const obsColors: Record<string, string> = { Cerrado: 'bg-sig-50 text-sig-700', Pendiente: 'bg-red-100 text-red-700', Planificado: 'bg-gray-100 text-gray-600' }
                  return (
                    <div key={obs.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-900">{obs.descripcion}</p>
                          <p className="text-xs text-gray-400 mt-0.5">Planificado: {obs.fecha_planificada}</p>
                          {obs.directorio_personas && (
                            <p className="text-xs text-gray-400">Responsable: {obs.directorio_personas.apellido}</p>
                          )}
                          {obs.fecha_cierre && (
                            <p className="text-xs text-sig-500 mt-0.5">Cerrado: {obs.fecha_cierre}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${obsColors[estado]}`}>{estado}</span>
                          {canWrite && estado !== 'Cerrado' && (
                            <button
                              onClick={async () => {
                                const hoyStr = new Date().toISOString().split('T')[0]
                                await cerrarObservacion(obs.id, hoyStr, null)
                                loadObservaciones(registros?.map(r => r.id) ?? [])
                              }}
                              className="text-xs bg-sig-500 hover:bg-sig-700 text-white px-3 py-1 rounded-lg font-medium transition-colors"
                            >
                              Cerrar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function RegistroGestionForm({
  gestionEstablecimientoId,
  personas,
  onSuccess,
}: {
  gestionEstablecimientoId: string
  personas: { id: string; nombre: string; apellido: string }[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(createRegistroGestion, null)
  useEffect(() => { if (state?.success) onSuccess() }, [state])
  return (
    <form action={formAction} className="bg-white border border-gray-200 rounded-lg p-3 mt-2 space-y-2">
      <input type="hidden" name="gestion_establecimiento_id" value={gestionEstablecimientoId} />
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Fecha planificada *</label>
          <input name="fecha_planificada" type="date" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Responsable</label>
          <select name="responsable_id" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
            <option value="">—</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Planificar'}</Button>
      </div>
    </form>
  )
}

function ObservacionForm({
  registroGestionId,
  personas,
  onSuccess,
}: {
  registroGestionId: string
  personas: { id: string; nombre: string; apellido: string }[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(createObservacionGestion, null)
  useEffect(() => { if (state?.success) onSuccess() }, [state])
  return (
    <form action={formAction} className="bg-white border border-gray-200 rounded-lg p-3 mt-2 space-y-2">
      <input type="hidden" name="registro_gestion_id" value={registroGestionId} />
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Descripción *</label>
        <textarea name="descripcion" required rows={2} className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Fecha límite *</label>
          <input name="fecha_planificada" type="date" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Responsable cierre</label>
          <select name="responsable_cierre_id" className="w-full border border-gray-300 rounded px-2 py-1.5 text-xs bg-white">
            <option value="">—</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar observación'}</Button>
      </div>
    </form>
  )
}

// ---- Main component ----
const TABS: { id: Tab; label: string }[] = [
  { id: 'sectores', label: 'Sectores' },
  { id: 'stakeholders', label: 'Stakeholders' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'siniestros', label: 'Siniestros' },
  { id: 'inspecciones', label: 'Inspecciones' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'legajo', label: 'Legajo Técnico' },
]

export function EstablecimientoTabs({
  establecimientoId,
  empresaId,
  canWrite,
  canDelete,
  sectores,
  siniestros,
  inspecciones,
  documentos,
  documentTypes,
  defaultTab,
}: EstablecimientoTabsProps) {
  const [active, setActive] = useState<Tab>(defaultTab ?? 'sectores')

  return (
    <div>
      <div className="border-b border-gray-200 mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors -mb-px border-b-2 ${
                tab.id === active
                  ? 'border-sig-500 text-sig-500'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {active === 'sectores' && (
        <SectoresTab
          sectores={sectores}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
          canDelete={canDelete}
        />
      )}
      {active === 'stakeholders' && (
        <StakeholdersTab
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
      {active === 'asistencia' && (
        <AsistenciaTab
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
      {active === 'siniestros' && (
        <SiniestrosTab
          siniestros={siniestros}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
      {active === 'inspecciones' && (
        <InspeccionesTab
          inspecciones={inspecciones}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
      {active === 'documentos' && (
        <DocumentosTab
          documentos={documentos}
          documentTypes={documentTypes}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
      {active === 'legajo' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          <p className="font-medium text-gray-600 mb-1">Legajo Técnico</p>
          <p>Próximamente — mostrará todos los documentos con check de legajo técnico.</p>
        </div>
      )}
    </div>
  )
}
