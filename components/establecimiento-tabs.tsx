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
import { createClient } from '@/lib/supabase/client'
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
  Empleado,
  ActionResult,
  RiesgoNivel,
  SiniestroEstado,
  InspeccionEstado,
} from '@/lib/types'

type Tab = 'sectores' | 'empleados' | 'siniestros' | 'inspecciones' | 'riesgos' | 'documentos'

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
  empleados: Empleado[]
  defaultTab?: Tab
}

// ---- Empleado form inline ----
function EmpleadoInlineForm({
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
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
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
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
      <Button size="sm" variant="secondary" type="button" onClick={onCancel}>×</Button>
      <Button size="sm" type="submit" disabled={pending}>{pending ? '…' : 'Agregar'}</Button>
    </form>
  )
}

// ---- Puesto row (expandable → empleados) ----
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
  const [empleados, setEmpleados] = useState<EmpleadoPuesto[] | null>(null)
  const [showAddEmpleado, setShowAddEmpleado] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (!open || empleados !== null) return
    const supabase = createClient()
    supabase
      .from('empleado_puesto')
      .select('id, empleado_id, fecha_desde, empleados(id, nombre, apellido, dni, fecha_ingreso)')
      .eq('puesto_id', puesto.id)
      .then(({ data }) => setEmpleados((data as EmpleadoPuesto[]) ?? []))
  }, [open, empleados, puesto.id])

  function handleRemoveEmpleado(epId: string) {
    startTransition(async () => {
      await removeEmpleadoFromPuesto(epId, establecimientoId, empresaId)
      setEmpleados(prev => prev?.filter(e => e.id !== epId) ?? null)
    })
  }

  function handleDeletePuesto() {
    startTransition(async () => {
      await deletePuesto(puesto.id, establecimientoId, empresaId)
      onDeleted()
    })
  }

  const empleadoAction = createEmpleado.bind(null, puesto.id, establecimientoId, empresaId)

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
          {empleados !== null && (
            <span className="text-xs text-gray-400 font-normal">({empleados.length})</span>
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
        <div className="px-4 pb-3 border-t border-gray-50">
          {empleados === null ? (
            <p className="text-xs text-gray-400 py-2">Cargando…</p>
          ) : empleados.length === 0 && !showAddEmpleado ? (
            <p className="text-xs text-gray-400 py-2">Sin empleados en este puesto.</p>
          ) : (
            <ul className="divide-y divide-gray-50 mt-1">
              {empleados.map(ep => (
                <li key={ep.id} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="text-gray-800">
                    {ep.empleados?.apellido}, {ep.empleados?.nombre}
                    {ep.empleados?.dni && <span className="text-gray-400 text-xs ml-2">DNI {ep.empleados.dni}</span>}
                  </span>
                  {canWrite && (
                    <button
                      onClick={() => handleRemoveEmpleado(ep.id)}
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

          {canWrite && !showAddEmpleado && (
            <button
              onClick={() => setShowAddEmpleado(true)}
              className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              + Agregar empleado
            </button>
          )}

          {showAddEmpleado && (
            <EmpleadoInlineForm
              action={empleadoAction}
              onSuccess={() => {
                setShowAddEmpleado(false)
                setEmpleados(null)
              }}
              onCancel={() => setShowAddEmpleado(false)}
            />
          )}
        </div>
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

        {/* Workers count inline edit */}
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
              onSuccess={() => {
                setShowAddPuesto(false)
                setPuestos(null)
              }}
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

// ---- Siniestros Tab ----
function SiniestrosTab({
  siniestros,
  empleados,
  establecimientoId,
  empresaId,
  canWrite,
}: {
  siniestros: Siniestro[]
  empleados: Empleado[]
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
          empleados={empleados}
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

          {/* Resueltos */}
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
                <th className="px-5 py-3 text-gray-500 font-medium">Legajo</th>
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
                      <span className="text-gray-300">—</span>
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
  { id: 'empleados', label: 'Empleados' },
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
  empleados,
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
      {active === 'empleados' && (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          Gestión de empleados próximamente
        </div>
      )}
      {active === 'siniestros' && (
        <SiniestrosTab
          siniestros={siniestros}
          empleados={empleados}
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
