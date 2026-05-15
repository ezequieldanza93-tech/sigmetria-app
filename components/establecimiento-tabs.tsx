'use client'

import { useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { SectorForm } from '@/components/forms/sector-form'
import { SiniestroForm } from '@/components/forms/siniestro-form'
import { InspeccionForm } from '@/components/forms/inspeccion-form'
import { RiesgoForm } from '@/components/forms/riesgo-form'
import { DocumentoForm } from '@/components/forms/documento-form'
import { updateSectorTrabajadores, createSectorCustom, deleteSector } from '@/lib/actions/sector'
import { createSiniestro } from '@/lib/actions/siniestro'
import { createInspeccion } from '@/lib/actions/inspeccion'
import { createRiesgo, resolverRiesgo } from '@/lib/actions/riesgo'
import { createDocumento } from '@/lib/actions/documento'
import { formatDate } from '@/lib/utils'
import { RIESGO_NIVEL_LABELS, DOCUMENTO_TIPO_LABELS } from '@/lib/constants'
import { RIESGO_NIVEL_COLORS, SINIESTRO_ESTADO_COLORS, INSPECCION_ESTADO_COLORS } from '@/lib/types'
import { SINIESTRO_TIPO_LABELS, SINIESTRO_ESTADO_LABELS, INSPECCION_ESTADO_LABELS } from '@/lib/constants'
import type {
  SectorEstablecimiento,
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingVal, setEditingVal] = useState<string>('')
  const [isPending, startTransition] = useTransition()

  const sectorAction = createSectorCustom.bind(null, establecimientoId, empresaId)

  function startEdit(sector: SectorEstablecimiento) {
    setEditingId(sector.id)
    setEditingVal(sector.cantidad_trabajadores.toString())
  }

  function saveEdit(sectorId: string) {
    const val = parseInt(editingVal, 10)
    if (isNaN(val) || val < 0) return
    startTransition(async () => {
      await updateSectorTrabajadores(sectorId, val, establecimientoId, empresaId)
      setEditingId(null)
    })
  }

  function handleDelete(sectorId: string) {
    startTransition(async () => {
      await deleteSector(sectorId, establecimientoId, empresaId)
    })
  }

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

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100 bg-gray-50">
            <tr className="text-left">
              <th className="px-5 py-3 text-gray-500 font-medium">Sector</th>
              <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
              <th className="px-5 py-3 text-gray-500 font-medium text-center">Trabajadores</th>
              {canWrite && <th className="px-5 py-3 text-gray-500 font-medium"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sectores.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-5 py-3.5 font-medium text-gray-900">{s.nombre}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${s.es_custom ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {s.es_custom ? 'Custom' : 'Predefinido'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-center">
                  {canWrite && editingId === s.id ? (
                    <div className="flex items-center justify-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={editingVal}
                        onChange={e => setEditingVal(e.target.value)}
                        className="w-20 border border-gray-300 rounded px-2 py-1 text-sm text-center"
                        autoFocus
                      />
                      <Button size="sm" onClick={() => saveEdit(s.id)} disabled={isPending}>OK</Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>×</Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => canWrite && startEdit(s)}
                      className={`font-medium ${canWrite ? 'cursor-pointer hover:text-blue-600' : 'cursor-default'} text-gray-900`}
                      title={canWrite ? 'Click para editar' : undefined}
                    >
                      {s.cantidad_trabajadores}
                    </button>
                  )}
                </td>
                {canWrite && (
                  <td className="px-5 py-3.5 text-right">
                    {s.es_custom && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(s.id)}
                        disabled={isPending}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        Eliminar
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
                const fileUrl = d.file_url ?? d.archivo_url
                const fileName = d.file_name ?? (d.archivo_url ? 'Ver archivo' : null)
                const typeName = d.document_types?.name ?? d.nombre
                return (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3.5 font-medium text-gray-900">{typeName}</td>
                    <td className={`px-5 py-3.5 ${vencimientoClass(d.fecha_vencimiento)}`}>
                      {d.fecha_vencimiento ? formatDate(d.fecha_vencimiento) : '—'}
                    </td>
                    <td className="px-5 py-3.5">
                      {d.include_in_legajo ? (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          Legajo
                        </span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      {fileUrl ? (
                        <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs truncate max-w-[160px] block">
                          {fileName}
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
}: EstablecimientoTabsProps) {
  const [active, setActive] = useState<Tab>('sectores')

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
