'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ObservacionGestion } from '@/lib/types'

interface ObsRow extends ObservacionGestion {
  gestion_nombre?: string
  fecha_ejecutada?: string | null
}

export function ActuarView({ establecimientoId }: { establecimientoId: string }) {
  const [observaciones, setObservaciones] = useState<ObsRow[] | null>(null)

  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('gestion_establecimiento')
      .select('id')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data: geData }) => {
        const geIds = (geData ?? []).map(ge => ge.id)
        if (geIds.length === 0) { setObservaciones([]); return }

        supabase
          .from('registro_gestiones')
          .select('id, fecha_ejecutada, gestion_establecimiento_id')
          .not('fecha_ejecutada', 'is', null)
          .in('gestion_establecimiento_id', geIds)
          .then(({ data: rgData }) => {
            const rgIds = (rgData ?? []).map(rg => rg.id)
            if (rgIds.length === 0) { setObservaciones([]); return }

            const rgMap = new Map((rgData ?? []).map(rg => [rg.id, rg]))

            supabase
              .from('observaciones_gestiones')
              .select('*, directorio_personas!responsable_id(nombre, apellido), clasificacion_observaciones(nombre)')
              .in('registro_gestion_id', rgIds)
              .order('fecha_planificada', { ascending: false })
              .then(({ data: obsData }) => {
                const full: ObsRow[] = ((obsData ?? []) as unknown as ObsRow[]).map(o => ({
                  ...(o as unknown as ObservacionGestion),
                  fecha_ejecutada: rgMap.get(o.registro_gestion_id)?.fecha_ejecutada ?? null,
                }))
                setObservaciones(full)
              })
          })
      })
  }, [establecimientoId])

  if (observaciones === null) {
    return <p className="text-sm text-gray-400">Cargando observaciones…</p>
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

          return (
            <div key={obs.id} className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{obs.descripcion}</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                    {obs.clasificacion_observaciones && (
                      <span className="text-xs text-gray-400">
                        {obs.clasificacion_observaciones.nombre}
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
    </div>
  )
}
