'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { InspeccionForm } from '@/components/forms/inspeccion-form'
import { formatDate } from '@/lib/utils'
import { INSPECCION_ESTADO_LABELS, INSPECCION_ESTADO_VISUAL_LABELS, INSPECCION_ESTADO_VISUAL_COLORS } from '@/lib/constants'
import { INSPECCION_ESTADO_COLORS } from '@/lib/types'
import { createInspeccion, agregarObservacionInspeccion, resolverObservacionInspeccion } from '@/lib/actions/inspeccion'
import { createClient } from '@/lib/supabase/client'
import type { Inspeccion, InspeccionEstado } from '@/lib/types'

interface InspeccionesTabProps {
  inspecciones: Inspeccion[]
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}

interface CategoriaObs {
  id: string
  nombre: string
  nivel: number
  color: string
}

export function InspeccionesTab({ inspecciones, establecimientoId, empresaId, canWrite }: InspeccionesTabProps) {
  const [showModal, setShowModal] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [observacionesMap, setObservacionesMap] = useState<Record<string, { total: number; abiertas: number }>>({})
  const [obsDescriptions, setObsDescriptions] = useState<Record<string, { id: string; descripcion: string; resuelta: boolean }[]>>({})
  const [showObsModal, setShowObsModal] = useState<string | null>(null)
  const [categorias, setCategorias] = useState<CategoriaObs[]>([])
  const [obsCategoriaId, setObsCategoriaId] = useState('')
  const [obsError, setObsError] = useState<string | null>(null)
  const inspeccionAction = createInspeccion.bind(null, establecimientoId, empresaId)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('observaciones_categorias')
      .select('id, nombre, nivel, color')
      .eq('is_active', true)
      .order('nivel')
      .then(({ data }) => setCategorias((data ?? []) as CategoriaObs[]))
  }, [])

  useEffect(() => {
    if (inspecciones.length === 0) return
    const supabase = createClient()
    const ids = inspecciones.map(i => i.id)
    supabase
      .from('inspecciones_observaciones')
      .select('id, inspeccion_id, descripcion, resuelta')
      .in('inspeccion_id', ids)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, { total: number; abiertas: number }> = {}
        const descs: Record<string, { id: string; descripcion: string; resuelta: boolean }[]> = {}
        for (const obs of data) {
          if (!map[obs.inspeccion_id]) {
            map[obs.inspeccion_id] = { total: 0, abiertas: 0 }
            descs[obs.inspeccion_id] = []
          }
          map[obs.inspeccion_id].total++
          if (!obs.resuelta) map[obs.inspeccion_id].abiertas++
          descs[obs.inspeccion_id].push(obs)
        }
        setObservacionesMap(map)
        setObsDescriptions(descs)
      })
  }, [inspecciones])

  function estadoVisual(i: Inspeccion): { label: string; color: string } | null {
    const obs = observacionesMap[i.id]
    if (!obs) return null
    if (obs.abiertas === 0) return { label: INSPECCION_ESTADO_VISUAL_LABELS.verde, color: INSPECCION_ESTADO_VISUAL_COLORS.verde }
    if (obs.total > obs.abiertas) return { label: INSPECCION_ESTADO_VISUAL_LABELS.amarillo, color: INSPECCION_ESTADO_VISUAL_COLORS.amarillo }
    return { label: INSPECCION_ESTADO_VISUAL_LABELS.rojo, color: INSPECCION_ESTADO_VISUAL_COLORS.rojo }
  }

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
        <div className="space-y-3">
          {inspecciones.map(i => {
            const visual = estadoVisual(i)
            const obs = obsDescriptions[i.id] ?? []
            return (
              <div key={i.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === i.id ? null : i.id)}
                  className="w-full text-left px-5 py-3.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="min-w-0 flex-1 grid grid-cols-5 gap-4 text-sm items-center">
                      <div><span className="text-gray-500">Prog:</span> {formatDate(i.fecha_programada)}</div>
                      <div><span className="text-gray-500">Real:</span> {formatDate(i.fecha_realizada)}</div>
                      <div>
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${INSPECCION_ESTADO_COLORS[i.estado as InspeccionEstado]}`}>
                          {INSPECCION_ESTADO_LABELS[i.estado]}
                        </span>
                      </div>
                      <div className="text-center">
                        {i.puntaje !== null ? (
                          <span className={`font-bold tabular-nums ${i.puntaje >= 80 ? 'text-green-600' : i.puntaje >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {i.puntaje}
                          </span>
                        ) : '—'}
                      </div>
                      <div>
                        {visual && (
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${visual.color}`}>
                            {visual.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${expandedId === i.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                  </div>
                </button>

                {expandedId === i.id && (
                  <div className="border-t border-gray-100 px-5 py-4 space-y-4 bg-gray-50/50">
                    {i.observaciones && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Observaciones de la inspección</p>
                        <p className="text-sm text-gray-700">{i.observaciones}</p>
                      </div>
                    )}
                    {i.entes_reguladores && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Ente regulador</p>
                        <p className="text-sm text-gray-700">{i.entes_reguladores.nombre}</p>
                      </div>
                    )}

                    {/* Observaciones de seguimiento */}
                    {(obs.length > 0 || canWrite) && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-gray-500">Observaciones de seguimiento ({obs.filter(o => !o.resuelta).length} abiertas)</p>
                          {canWrite && (
                            <Button size="sm" variant="secondary" onClick={() => setShowObsModal(i.id)}>
                              + Agregar
                            </Button>
                          )}
                        </div>
                        {obs.length > 0 ? (
                          <div className="space-y-1.5">
                            {obs.map(o => (
                              <div key={o.id} className="flex items-start gap-2 text-sm">
                                <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${o.resuelta ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className={`flex-1 ${o.resuelta ? 'text-gray-400 line-through' : 'text-gray-700'}`}>{o.descripcion}</span>
                                {!o.resuelta && canWrite && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await resolverObservacionInspeccion(o.id, establecimientoId, empresaId)
                                    }}
                                    className="text-xs text-sig-600 hover:text-sig-800 shrink-0"
                                  >
                                    Resolver
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-400">Sin observaciones de seguimiento</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Inspección">
        <InspeccionForm
          action={inspeccionAction}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>

      <Modal
        open={!!showObsModal}
        onClose={() => { setShowObsModal(null); setObsCategoriaId(''); setObsError(null) }}
        title="Agregar observación"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (!showObsModal) return
            setObsError(null)
            if (!obsCategoriaId) { setObsError('Categoría requerida'); return }
            const fd = new FormData(e.currentTarget)
            fd.set('categoria_id', obsCategoriaId)
            const res = await agregarObservacionInspeccion(showObsModal, establecimientoId, empresaId, null, fd)
            if (!res.success) { setObsError(res.error); return }
            setShowObsModal(null)
            setObsCategoriaId('')
          }}
          className="space-y-3"
        >
          {obsError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">{obsError}</div>
          )}
          <div>
            <label className="text-xs text-gray-600 block mb-1">
              Categoría <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={obsCategoriaId}
              onChange={e => setObsCategoriaId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
              style={obsCategoriaId ? { backgroundColor: categorias.find(c => c.id === obsCategoriaId)?.color, color: '#000' } : {}}
            >
              <option value="">Seleccionar…</option>
              {categorias.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-600 block mb-1">Descripción *</label>
            <textarea name="descripcion" required rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="secondary" type="button" onClick={() => { setShowObsModal(null); setObsCategoriaId(''); setObsError(null) }}>Cancelar</Button>
            <Button size="sm" type="submit">Guardar</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
