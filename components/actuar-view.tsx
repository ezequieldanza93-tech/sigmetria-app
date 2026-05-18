'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import type { ObservacionGestion, RegistroGestion } from '@/lib/types'

interface ObsRow extends ObservacionGestion {
  fecha_ejecutada?: string | null
  gestion_nombre?: string
  gestion_categoria?: string
  gestion_grupo?: string
  registro_notas?: string | null
  registro_observaciones?: string | null
  registro_fecha_planificada?: string
  registro_id?: string
}

export function ActuarView({ establecimientoId }: { establecimientoId: string }) {
  const [observaciones, setObservaciones] = useState<ObsRow[] | null>(null)
  const [selectedObs, setSelectedObs] = useState<ObsRow | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('registro_gestiones')
      .select(`
        id,
        fecha_ejecutada,
        fecha_planificada,
        notas,
        observaciones,
        gestion_establecimiento_id,
        gestion_establecimiento!inner(
          gestiones!inner(
            id,
            nombre,
            categoria_gestiones(
              nombre,
              grupo_gestiones(nombre)
            )
          )
        )
      `)
      .not('fecha_ejecutada', 'is', null)
      .then(({ data: rgData }) => {
        const rgRecords = (rgData ?? []) as unknown as {
          id: string
          fecha_ejecutada: string | null
          fecha_planificada: string
          notas: string | null
          observaciones: string | null
          gestion_establecimiento_id: string
          gestion_establecimiento: {
            gestiones: {
              id: string
              nombre: string
              categoria_gestiones: {
                nombre: string
                grupo_gestiones: { nombre: string } | null
              } | null
            }
          }
        }[]

        if (rgRecords.length === 0) { setObservaciones([]); return }

        const rgIds = rgRecords.map(rg => rg.id)
        const rgMap = new Map(rgRecords.map(rg => [rg.id, rg]))

        supabase
          .from('observaciones_gestiones')
          .select('*, directorio_personas!responsable_id(nombre, apellido), clasificacion_observaciones(nombre), observacion_categoria(nombre, nivel)')
          .in('registro_gestion_id', rgIds)
          .order('fecha_planificada', { ascending: false })
          .then(({ data: obsData }) => {
            const full: ObsRow[] = ((obsData ?? []) as unknown as ObsRow[]).map(o => {
              const rg = rgMap.get(o.registro_gestion_id)
              const gestionInfo = rg?.gestion_establecimiento?.gestiones
              return {
                ...(o as unknown as ObservacionGestion),
                fecha_ejecutada: rg?.fecha_ejecutada ?? null,
                gestion_nombre: gestionInfo?.nombre,
                gestion_categoria: gestionInfo?.categoria_gestiones?.nombre,
                gestion_grupo: gestionInfo?.categoria_gestiones?.grupo_gestiones?.nombre,
                registro_notas: rg?.notas ?? null,
                registro_observaciones: rg?.observaciones ?? null,
                registro_fecha_planificada: rg?.fecha_planificada,
                registro_id: rg?.id,
              }
            })
            setObservaciones(full)
          })
      })
  }, [establecimientoId])

  if (observaciones === null) {
    return <p className="text-sm text-gray-400">Cargando observaciones...</p>
  }

  if (observaciones.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="font-semibold text-gray-700">Actuar</p>
        <p className="text-sm text-gray-400 mt-1">
          No hay observaciones de gestiones ejecutadas.
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">
          Observaciones de Gestiones Ejecutadas
        </h3>
        <span className="text-xs bg-gray-100 text-gray-500 rounded-full px-2.5 py-0.5">
          {observaciones.length}
        </span>
      </div>

      <div className="space-y-2">
        {observaciones.map(obs => {
          const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
          const planDate = new Date(obs.fecha_planificada); planDate.setHours(0, 0, 0, 0)
          const cerrado = obs.fecha_cierre !== null
          const estado = cerrado ? 'Cerrado' : planDate < hoy ? 'Pendiente' : 'Planificado'
          const obsColors: Record<string, string> = {
            Cerrado: 'bg-green-100 text-green-700',
            Pendiente: 'bg-red-100 text-red-700',
            Planificado: 'bg-sky-100 text-sky-700',
          }
          const catDot: Record<number, string> = {
            1: 'bg-yellow-400',
            2: 'bg-orange-500',
            3: 'bg-red-500',
            4: 'bg-red-700',
          }

          return (
            <div key={obs.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{obs.descripcion}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {obs.gestion_nombre && (
                      <button
                        onClick={() => setSelectedObs(obs)}
                        className="text-xs font-medium text-sig-600 hover:text-sig-800 hover:underline text-left"
                      >
                        {obs.gestion_nombre}
                      </button>
                    )}
                    {obs.clasificacion_observaciones && (
                      <span className="text-xs text-gray-400">
                        {obs.clasificacion_observaciones.nombre}
                      </span>
                    )}
                    {obs.observacion_categoria && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                        <span className={`w-2 h-2 rounded-full ${catDot[obs.observacion_categoria.nivel] ?? 'bg-gray-300'}`} />
                        {obs.observacion_categoria.nombre}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">
                      Fecha límite: {obs.fecha_planificada}
                    </span>
                    {obs.fecha_ejecutada && (
                      <span className="text-xs text-gray-400">
                        Gestión ejecutada: {obs.fecha_ejecutada}
                      </span>
                    )}
                    {obs.directorio_personas && (
                      <span className="text-xs text-gray-400">
                        Responsable: {obs.directorio_personas.apellido}, {obs.directorio_personas.nombre}
                      </span>
                    )}
                    {obs.fecha_cierre && (
                      <span className="text-xs text-green-600">Cerrado: {obs.fecha_cierre}</span>
                    )}
                  </div>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ml-3 ${obsColors[estado]}`}>
                  {estado}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      <Modal
        open={selectedObs !== null}
        onClose={() => setSelectedObs(null)}
        title={selectedObs?.gestion_nombre ?? 'Detalle de Gestión'}
        className="max-w-2xl"
      >
        {selectedObs && (
          <div className="space-y-5 text-sm">
            {/* Grupo / Categoría */}
            <div className="grid grid-cols-2 gap-4">
              {selectedObs.gestion_grupo && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Grupo</p>
                  <p className="text-gray-900 font-medium">{selectedObs.gestion_grupo}</p>
                </div>
              )}
              {selectedObs.gestion_categoria && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Categoría</p>
                  <p className="text-gray-900 font-medium">{selectedObs.gestion_categoria}</p>
                </div>
              )}
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-4">
              {selectedObs.registro_fecha_planificada && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Fecha planificada</p>
                  <p className="text-gray-900">{selectedObs.registro_fecha_planificada}</p>
                </div>
              )}
              {selectedObs.fecha_ejecutada && (
                <div>
                  <p className="text-xs text-gray-400 mb-0.5">Fecha ejecutada</p>
                  <p className="text-gray-900">{selectedObs.fecha_ejecutada}</p>
                </div>
              )}
            </div>

            {/* Responsable */}
            {selectedObs.directorio_personas && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Responsable</p>
                <p className="text-gray-900">
                  {selectedObs.directorio_personas.apellido}, {selectedObs.directorio_personas.nombre}
                </p>
              </div>
            )}

            {/* Observaciones del registro */}
            {selectedObs.registro_observaciones && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Observaciones de la gestión</p>
                <p className="text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{selectedObs.registro_observaciones}</p>
              </div>
            )}

            {/* Notas */}
            {selectedObs.registro_notas && (
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Notas</p>
                <p className="text-gray-700 bg-gray-50 rounded-lg px-3 py-2">{selectedObs.registro_notas}</p>
              </div>
            )}

            {/* Detalle de la observación */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-xs text-gray-400 mb-0.5">Observación de seguimiento</p>
              {selectedObs.observacion_categoria && (
                <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                  <span className={`w-2 h-2 rounded-full ${
                    selectedObs.observacion_categoria.nivel === 4 ? 'bg-red-700' :
                    selectedObs.observacion_categoria.nivel === 3 ? 'bg-red-500' :
                    selectedObs.observacion_categoria.nivel === 2 ? 'bg-orange-500' :
                    selectedObs.observacion_categoria.nivel === 1 ? 'bg-yellow-400' :
                    'bg-gray-300'
                  }`} />
                  {selectedObs.observacion_categoria.nombre}
                </span>
              )}
              <p className="text-gray-900 font-medium">{selectedObs.descripcion}</p>
              {selectedObs.fecha_planificada && (
                <p className="text-xs text-gray-500 mt-1">
                  Fecha límite: {selectedObs.fecha_planificada}
                  {selectedObs.fecha_cierre && ` — Cerrado: ${selectedObs.fecha_cierre}`}
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
