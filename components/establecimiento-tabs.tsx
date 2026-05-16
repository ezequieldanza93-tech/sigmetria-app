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
import { createEmpleado, removeEmpleadoFromPuesto } from '@/lib/actions/empleado'
import { createSiniestro } from '@/lib/actions/siniestro'
import { createInspeccion } from '@/lib/actions/inspeccion'
import { createRiesgo, resolverRiesgo } from '@/lib/actions/riesgo'
import { createDocumento } from '@/lib/actions/documento'
import { addEppToPuesto, removeEppFromPuesto } from '@/lib/actions/epp-por-puesto'
import { createAsistencia } from '@/lib/actions/asistencia'
import { createClient } from '@/lib/supabase/client'
import { EmpleadoModal } from '@/components/empleado-modal'
import { formatDate } from '@/lib/utils'
import { RIESGO_NIVEL_LABELS, DOCUMENTO_TIPO_LABELS } from '@/lib/constants'
import { RIESGO_NIVEL_COLORS, SINIESTRO_ESTADO_COLORS, INSPECCION_ESTADO_COLORS } from '@/lib/types'
import { SINIESTRO_TIPO_LABELS, SINIESTRO_ESTADO_LABELS, INSPECCION_ESTADO_LABELS } from '@/lib/constants'
import type {
  SectorEstablecimiento,
  PuestoDeTrabajo,
  EmpleadoPuesto,
  Siniestro,
  Inspeccion,
  Riesgo,
  Documento,
  DocumentType,
  DirectorioPersona,
  EppPorPuesto,
  Producto,
  ActionResult,
  RiesgoNivel,
  SiniestroEstado,
  InspeccionEstado,
} from '@/lib/types'

type Tab = 'sectores' | 'personas' | 'siniestros' | 'inspecciones' | 'riesgos' | 'documentos' | 'asistencia'

interface EstablecimientoTabsProps {
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  sectores: SectorEstablecimiento[]
  siniestros: Siniestro[]
  inspecciones: Inspeccion[]
  riesgos: Riesgo[]
  documentos: Documento[]
  documentTypes: DocumentType[]
  defaultTab?: Tab
}

// ---- Persona inline form ----
function PersonaInlineForm({
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
    <form action={formAction} className="bg-gray-50 rounded-lg p-3 mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <input name="nombre" placeholder="Nombre *" required className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        <input name="apellido" placeholder="Apellido *" required className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input name="dni" placeholder="DNI" className="border border-gray-300 rounded px-2 py-1.5 text-sm" />
        <input name="fecha_ingreso" type="date" className="border border-gray-300 rounded px-2 py-1.5 text-sm text-gray-600" />
      </div>
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}
      <div className="flex gap-2 justify-end">
        <Button size="sm" variant="secondary" type="button" onClick={onCancel}>Cancelar</Button>
        <Button size="sm" type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Agregar'}</Button>
      </div>
    </form>
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
    <form action={formAction} className="flex items-center gap-2 mt-2">
      <input name="nombre" placeholder="Nombre del puesto *" required className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm" />
      {state && !state.success && <span className="text-xs text-red-600">{state.error}</span>}
      <Button size="sm" variant="secondary" type="button" onClick={onCancel}>×</Button>
      <Button size="sm" type="submit" disabled={pending}>{pending ? '…' : 'Agregar'}</Button>
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
      .select('id, nombre, tamano, unidad, categoria_productos(nombre)')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => setProductos((data as unknown as Producto[]) ?? []))
  }, [])

  return (
    <form action={formAction} className="bg-blue-50 rounded-lg p-3 mt-2 space-y-2">
      <p className="text-xs font-semibold text-blue-700 mb-1">Agregar EPP</p>
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
                  {p.nombre}{p.tamano ? ` ${p.tamano}${p.unidad ?? ''}` : ''}
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
  onDeleted,
}: {
  puesto: PuestoDeTrabajo
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  onDeleted: () => void
}) {
  const [open, setOpen] = useState(false)
  const [personas, setPersonas] = useState<EmpleadoPuesto[] | null>(null)
  const [epp, setEpp] = useState<EppPorPuesto[] | null>(null)
  const [showAddPersona, setShowAddPersona] = useState(false)
  const [showAddEpp, setShowAddEpp] = useState(false)
  const [selectedEp, setSelectedEp] = useState<EmpleadoPuesto | null>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    if (personas === null) {
      supabase
        .from('empleado_puesto')
        .select('id, persona_id, fecha_desde, directorio_personas(id, nombre, apellido, dni, fecha_ingreso, legajo, telefono, email, tipo_id, tipo_personas(nombre))')
        .eq('puesto_id', puesto.id)
        .then(({ data }) => setPersonas((data as unknown as EmpleadoPuesto[]) ?? []))
    }
    if (epp === null) {
      supabase
        .from('epp_por_puesto')
        .select('id, puesto_id, producto_id, horas_vida_util, productos(id, nombre, tamano, unidad, categoria_productos(nombre))')
        .eq('puesto_id', puesto.id)
        .then(({ data }) => setEpp((data as unknown as EppPorPuesto[]) ?? []))
    }
  }, [open, personas, epp, puesto.id])

  function handleRemovePersona(epId: string) {
    startTransition(async () => {
      await removeEmpleadoFromPuesto(epId, establecimientoId, empresaId)
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

  const personaAction = createEmpleado.bind(null, puesto.id, establecimientoId, empresaId)
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
          {personas !== null && (
            <span className="text-xs text-gray-400 font-normal">({personas.length} persona{personas.length !== 1 ? 's' : ''})</span>
          )}
          {epp !== null && epp.length > 0 && (
            <span className="text-xs bg-blue-100 text-blue-700 font-medium px-1.5 py-0.5 rounded">{epp.length} EPP</span>
          )}
        </button>
        {canWrite && (
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
          {/* Personas section */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-2 mb-1">Personas</p>
            {personas === null ? (
              <p className="text-xs text-gray-400 py-1">Cargando…</p>
            ) : personas.length === 0 && !showAddPersona ? (
              <p className="text-xs text-gray-400 py-1">Sin personas en este puesto.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {personas.map(ep => (
                  <li key={ep.id} className="flex items-center justify-between py-1.5 text-sm">
                    <button
                      onClick={() => setSelectedEp(ep)}
                      className="text-left text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {ep.directorio_personas?.apellido}, {ep.directorio_personas?.nombre}
                      {ep.directorio_personas?.dni && <span className="text-gray-400 text-xs font-normal ml-2">DNI {ep.directorio_personas.dni}</span>}
                    </button>
                    {canWrite && (
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
                className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
              >
                + Agregar persona
              </button>
            )}
            {showAddPersona && (
              <PersonaInlineForm
                action={personaAction}
                onSuccess={() => { setShowAddPersona(false); setPersonas(null) }}
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
                      {e.productos?.tamano && <span className="text-gray-500 ml-1">{e.productos.tamano}{e.productos.unidad ?? ''}</span>}
                      {e.horas_vida_util && <span className="text-gray-400 text-xs ml-2">{e.horas_vida_util}hs vida útil</span>}
                    </span>
                    {canWrite && (
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
                className="mt-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
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
        <EmpleadoModal
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
  onDeleted,
}: {
  sector: SectorEstablecimiento
  establecimientoId: string
  empresaId: string
  canWrite: boolean
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
            className={`text-sm text-gray-500 ${canWrite ? 'hover:text-blue-600 cursor-pointer' : 'cursor-default'}`}
            title={canWrite ? 'Click para editar trabajadores' : undefined}
          >
            {sector.cantidad_trabajadores} trabajadores
          </button>
        )}

        {canWrite && sector.es_custom && (
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
                  onDeleted={() => setPuestos(prev => prev?.filter(p => p.id !== puesto.id) ?? null)}
                />
              ))}
            </div>
          )}

          {canWrite && !showAddPuesto && (
            <button
              onClick={() => setShowAddPuesto(true)}
              className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-1"
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
}: {
  sectores: SectorEstablecimiento[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}) {
  const [showModal, setShowModal] = useState(false)
  const [localSectores, setLocalSectores] = useState(sectores)
  const sectorAction = createSectorCustom.bind(null, establecimientoId, empresaId)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Sectores del Establecimiento</h3>
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

// ---- Personas Tab ----
function PersonasTab({
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
  const [activeTipo, setActiveTipo] = useState<string>('todos')
  const [selectedPersona, setSelectedPersona] = useState<DirectorioPersona | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('persona_establecimiento')
      .select('directorio_personas(id, nombre, apellido, dni, fecha_nacimiento, fecha_ingreso, legajo, telefono, email, tipo_id, tipo_personas(nombre), organizacion_id, notas, is_active, created_at, updated_at)')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as { directorio_personas: DirectorioPersona }[]).map(r => r.directorio_personas).filter(Boolean)
        setPersonas(list)
      })

    supabase
      .from('tipo_personas')
      .select('id, nombre')
      .order('nombre')
      .then(({ data }) => setTiposPersona(data ?? []))
  }, [establecimientoId])

  const filtered = personas === null
    ? null
    : activeTipo === 'todos'
      ? personas
      : personas.filter(p => p.tipo_id === activeTipo)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Directorio de Personas</h3>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 flex-wrap">
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
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === t.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {t.nombre} {personas !== null && `(${count})`}
            </button>
          )
        })}
      </div>

      {filtered === null ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
          No hay personas registradas{activeTipo !== 'todos' ? ' de este tipo' : ''}.
          <p className="text-xs mt-1">Las personas se agregan desde la vista de Sectores → Puestos.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
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
                      className="text-blue-600 hover:text-blue-800 font-medium text-left"
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
        </div>
      )}

      {selectedPersona && (
        <EmpleadoModal
          persona={selectedPersona}
          open={!!selectedPersona}
          onClose={() => setSelectedPersona(null)}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
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
  const [registros, setRegistros] = useState<{ id: string; fecha: string; hora_entrada: string; hora_salida: string | null; directorio_personas: { nombre: string; apellido: string } | null }[] | null>(null)
  const [personas, setPersonas] = useState<DirectorioPersona[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]
    supabase
      .from('asistencia_diaria')
      .select('id, fecha, hora_entrada, hora_salida, directorio_personas(nombre, apellido)')
      .eq('establecimiento_id', establecimientoId)
      .eq('fecha', today)
      .order('hora_entrada', { ascending: true })
      .then(({ data }) => setRegistros(data ?? []))

    supabase
      .from('persona_establecimiento')
      .select('directorio_personas(id, nombre, apellido, tipo_personas(nombre))')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const list = ((data ?? []) as unknown as { directorio_personas: DirectorioPersona }[]).map(r => r.directorio_personas).filter(Boolean)
        setPersonas(list)
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
          <p className="text-sm font-medium text-gray-700">Nuevo registro de asistencia</p>
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
              <label className="text-xs text-gray-600 block mb-1">Hora entrada *</label>
              <input name="hora_entrada" type="time" required className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-600 block mb-1">Hora salida</label>
              <input name="hora_salida" type="time" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
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
                        <a href={d.archivo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs truncate max-w-[160px] block">
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

// ---- Main component ----
const TABS: { id: Tab; label: string }[] = [
  { id: 'sectores', label: 'Sectores' },
  { id: 'personas', label: 'Personas' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'siniestros', label: 'Siniestros' },
  { id: 'inspecciones', label: 'Inspecciones' },
  { id: 'riesgos', label: 'Riesgos' },
  { id: 'documentos', label: 'Documentos' },
]

export function EstablecimientoTabs({
  establecimientoId,
  empresaId,
  canWrite,
  sectores,
  siniestros,
  inspecciones,
  riesgos,
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
                  ? 'border-blue-600 text-blue-600'
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
        />
      )}
      {active === 'personas' && (
        <PersonasTab
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
      {active === 'riesgos' && (
        <RiesgosTab
          riesgos={riesgos}
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
    </div>
  )
}
