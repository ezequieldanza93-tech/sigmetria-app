'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { CierreObservacionModal } from '@/components/cierre-observacion-modal'
import { MultiSelectFilter } from '@/components/ui/multi-select-filter'
import type { ObservacionGestion } from '@/lib/types'

interface ObsRow extends ObservacionGestion {
  fecha_ejecutada?: string | null
  gestion_nombre?: string
  gestion_categoria?: string
  gestion_grupo?: string
  registro_notas?: string | null
  registro_observaciones?: string | null
  registro_fecha_planificada?: string
  registro_id?: string
  _comment_count?: number
  _foto_count?: number
}

function getEstado(obs: ObsRow): string {
  if (obs.fecha_cierre) return 'Cerrado'
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
  const plan = new Date(obs.fecha_planificada); plan.setHours(0, 0, 0, 0)
  return plan < hoy ? 'Vencido' : 'Planificado'
}


export function ActuarView({ establecimientoId, canWrite = true }: { establecimientoId: string; canWrite?: boolean }) {
  const [observaciones, setObservaciones] = useState<ObsRow[] | null>(null)
  const [selectedObs, setSelectedObs] = useState<ObsRow | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [searchText, setSearchText] = useState('')
  const [quickFilter, setQuickFilter] = useState<'all' | 'week' | 'month'>('all')
  const [filterEstado, setFilterEstado] = useState<Set<string>>(new Set(['Planificado', 'Vencido']))
  const [filterResponsable, setFilterResponsable] = useState<Set<string> | null>(null)
  const [filterAspecto, setFilterAspecto] = useState<Set<string> | null>(null)
  const [filterGestion, setFilterGestion] = useState<Set<string> | null>(null)
  const [filterSector, setFilterSector] = useState<Set<string> | null>(null)
  const [filterPuesto, setFilterPuesto] = useState<Set<string> | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Cap defensivo: si una consultora tiene miles de gestiones ejecutadas el
    // payload se vuelve inmanejable y la vista se cuelga. 500 cubre el caso
    // típico; cuando se necesite ir más atrás conviene paginar con searchParams.
    supabase
      .from('gestiones_registros')
      .select(`
        id,
        fecha_ejecutada,
        fecha_planificada,
        notas,
        observaciones,
        gestion_establecimiento_id,
        gestiones_establecimientos!inner(
          gestiones!inner(
            id,
            nombre,
            gestiones_categorias(
              nombre,
              gestiones_grupos(nombre)
            )
          )
        )
      `)
      .not('fecha_ejecutada', 'is', null)
      .order('fecha_ejecutada', { ascending: false })
      .limit(500)
      .then(({ data: rgData }) => {
        const rgRecords = (rgData ?? []) as unknown as {
          id: string
          fecha_ejecutada: string | null
          fecha_planificada: string
          notas: string | null
          observaciones: string | null
          gestion_establecimiento_id: string
          gestiones_establecimientos: {
            gestiones: {
              id: string
              nombre: string
              gestiones_categorias: {
                nombre: string
                gestiones_grupos: { nombre: string } | null
              } | null
            }
          }
        }[]

        if (rgRecords.length === 0) { setObservaciones([]); return }

        const rgIds = rgRecords.map(rg => rg.id)
        const rgMap = new Map(rgRecords.map(rg => [rg.id, rg]))

        supabase
          .from('gestiones_observaciones')
          .select(`
            id, registro_gestion_id, descripcion, fecha_planificada, fecha_cierre,
            clasificacion_id, categoria_id, responsable_id, responsable_cierre_id,
            evidencia_cierre_url, foto_url, sector_id, puesto_id, cliente_visto_at,
            personas_directorio!responsable_id(nombre, apellido),
            observaciones_clasificaciones(nombre),
            observaciones_categorias(nombre, nivel),
            establecimientos_sectores!sector_id(nombre),
            puestos_de_trabajo!puesto_id(nombre)
          `)
          .in('registro_gestion_id', rgIds)
          .order('fecha_planificada', { ascending: true })
          .then(({ data: obsData }) => {
            const obsRows: ObsRow[] = ((obsData ?? []) as unknown as ObsRow[]).map(o => {
              const rg = rgMap.get(o.registro_gestion_id)
              const gestionInfo = rg?.gestiones_establecimientos?.gestiones
              return {
                ...(o as unknown as ObservacionGestion),
                fecha_ejecutada: rg?.fecha_ejecutada ?? null,
                gestion_nombre: gestionInfo?.nombre,
                gestion_categoria: gestionInfo?.gestiones_categorias?.nombre,
                gestion_grupo: gestionInfo?.gestiones_categorias?.gestiones_grupos?.nombre,
                registro_notas: rg?.notas ?? null,
                registro_observaciones: rg?.observaciones ?? null,
                registro_fecha_planificada: rg?.fecha_planificada,
                registro_id: rg?.id,
              }
            })

            // Fetch comment and photo counts (tables may not exist yet pre-migration)
            const obsIds = obsRows.map(o => o.id)
            Promise.allSettled([
              supabase.from('observaciones_comentarios').select('observacion_id').in('observacion_id', obsIds),
              supabase.from('observaciones_fotos_cliente').select('observacion_id').in('observacion_id', obsIds),
            ]).then(([comentRes, fotoRes]) => {
              const comentData = comentRes.status === 'fulfilled' ? (comentRes.value.data ?? []) : []
              const fotoData   = fotoRes.status   === 'fulfilled' ? (fotoRes.value.data   ?? []) : []

              const comentCount: Record<string, number> = {}
              for (const c of comentData) {
                comentCount[c.observacion_id] = (comentCount[c.observacion_id] ?? 0) + 1
              }
              const fotoCount: Record<string, number> = {}
              for (const f of fotoData) {
                fotoCount[f.observacion_id] = (fotoCount[f.observacion_id] ?? 0) + 1
              }

              const full = obsRows.map(o => ({
                ...o,
                _comment_count: comentCount[o.id] ?? 0,
                _foto_count: fotoCount[o.id] ?? 0,
              }))

              setObservaciones(full)

              // Init filters to all-on
              const responsables = new Set<string>()
              const aspectos = new Set<string>()
              const gestiones = new Set<string>()
              for (const o of full) {
                if (o.responsable_id) responsables.add(o.responsable_id)
                if (o.categoria_id) aspectos.add(o.categoria_id)
                if (o.gestion_nombre) gestiones.add(o.gestion_nombre)
              }
              const sectores = new Set<string>()
              const puestos  = new Set<string>()
              for (const o of full) {
                if (o.sector_id) sectores.add(o.sector_id)
                if (o.puesto_id) puestos.add(o.puesto_id)
              }
              setFilterResponsable(responsables)
              setFilterAspecto(aspectos)
              setFilterGestion(gestiones)
              setFilterSector(sectores)
              setFilterPuesto(puestos)
            })
          })
      })
  }, [establecimientoId, refreshKey])

  const sorted = (observaciones ?? []).slice().sort(
    (a, b) => new Date(a.fecha_planificada).getTime() - new Date(b.fecha_planificada).getTime()
  )

  const hoy = new Date(); hoy.setHours(0, 0, 0, 0)

  const dayOfWeek = hoy.getDay()
  const monday = new Date(hoy); monday.setDate(hoy.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1))
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)

  const startOfMonth = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const endOfMonth = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)

  function isInRange(dateStr: string, start: Date, end: Date): boolean {
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
    return d >= start && d <= end
  }

  const q = searchText.toLowerCase().trim()
  const filtered = sorted.filter(obs => {
    if (!filterEstado.has(getEstado(obs))) return false
    if (filterResponsable && obs.responsable_id && !filterResponsable.has(obs.responsable_id)) return false
    if (filterAspecto && obs.categoria_id && !filterAspecto.has(obs.categoria_id)) return false
    if (filterGestion && obs.gestion_nombre && !filterGestion.has(obs.gestion_nombre)) return false
    if (filterSector && obs.sector_id && !filterSector.has(obs.sector_id)) return false
    if (filterPuesto && obs.puesto_id && !filterPuesto.has(obs.puesto_id)) return false
    if (q && !obs.descripcion.toLowerCase().includes(q) && !obs.gestion_nombre?.toLowerCase().includes(q)) return false
    if (quickFilter === 'week' && !isInRange(obs.fecha_planificada, monday, sunday)) return false
    if (quickFilter === 'month' && !isInRange(obs.fecha_planificada, startOfMonth, endOfMonth)) return false
    return true
  })

  // Bucket privado `documentos`: firmamos las fotos de observación en el cliente (batch).
  const { getUrl } = useSignedUrls('documentos', (observaciones ?? []).map(o => o.foto_url))

  const responsableOptions = observaciones
    ? [...new Set(observaciones.filter(o => o.responsable_id && o.personas_directorio).map(o => o.responsable_id!))]
        .map(id => {
          const o = observaciones.find(o => o.responsable_id === id)
          const p = o?.personas_directorio
          return { value: id, label: p ? `${p.apellido}, ${p.nombre}` : id }
        })
        .sort((a, b) => a.label.localeCompare(b.label))
    : []

  const aspectoOptions = observaciones
    ? [...new Set(observaciones.filter(o => o.categoria_id && o.observaciones_categorias).map(o => o.categoria_id!))]
        .map(id => {
          const o = observaciones.find(o => o.categoria_id === id)
          return { value: id, label: o?.observaciones_categorias?.nombre ?? id }
        })
        .sort((a, b) => a.label.localeCompare(b.label))
    : []

  const gestionOptions = observaciones
    ? [...new Set(observaciones.filter(o => o.gestion_nombre).map(o => o.gestion_nombre!))]
        .map(n => ({ value: n, label: n }))
        .sort((a, b) => a.label.localeCompare(b.label))
    : []

  const sectorOptions = observaciones
    ? [...new Set(observaciones.filter(o => o.sector_id && o.establecimientos_sectores).map(o => o.sector_id!))]
        .map(id => {
          const o = observaciones.find(o => o.sector_id === id)
          return { value: id, label: o?.establecimientos_sectores?.nombre ?? id }
        })
        .sort((a, b) => a.label.localeCompare(b.label))
    : []

  const puestoOptions = observaciones
    ? [...new Set(observaciones.filter(o => o.puesto_id && o.puestos_de_trabajo).map(o => o.puesto_id!))]
        .map(id => {
          const o = observaciones.find(o => o.puesto_id === id)
          return { value: id, label: o?.puestos_de_trabajo?.nombre ?? id }
        })
        .sort((a, b) => a.label.localeCompare(b.label))
    : []

  if (observaciones === null) {
    return <p className="text-sm text-text-tertiary">Cargando observaciones...</p>
  }

  if (observaciones.length === 0) {
    return (
      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-12 text-center">
        <p className="font-semibold text-text-primary">Seguimiento de Observaciones</p>
        <p className="text-sm text-text-tertiary mt-1">
          No hay observaciones de gestiones ejecutadas.
        </p>
      </div>
    )
  }

  const estadoOptions = [
    { value: 'Planificado', label: 'Planificado' },
    { value: 'Vencido', label: 'Vencido' },
    { value: 'Cerrado', label: 'Cerrado' },
  ]

  const obsColors: Record<string, string> = {
    Cerrado: 'bg-success-bg text-success',
    Vencido: 'bg-danger-bg text-danger',
    Planificado: 'bg-sky-100 text-sky-700',
  }

  const catDot: Record<number, string> = {
    1: 'bg-yellow-400',
    2: 'bg-orange-500',
    3: 'bg-danger',
    4: 'bg-red-700',
  }

  return (
    <div>
      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <input
          type="text"
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          placeholder="Buscar observación..."
          className="flex-1 min-w-[200px] px-3 py-1.5 text-xs border border-border-default rounded-lg bg-surface-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        />
        <div className="flex items-center gap-1">
          {(['all', 'week', 'month'] as const).map(qf => (
            <button
              key={qf}
              onClick={() => setQuickFilter(qf)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                quickFilter === qf
                  ? 'bg-brand-primary text-white'
                  : 'border border-border-default text-text-tertiary hover:bg-surface-elevated'
              }`}
            >
              {qf === 'all' ? 'Todas' : qf === 'week' ? 'Esta semana' : 'Este mes'}
            </button>
          ))}
        </div>
        <MultiSelectFilter
          label="Estado"
          options={estadoOptions}
          selected={filterEstado}
          onChange={setFilterEstado}
        />
        {responsableOptions.length > 0 && (
          <MultiSelectFilter
            label="Responsable"
            options={responsableOptions}
            selected={filterResponsable ?? new Set(responsableOptions.map(o => o.value))}
            onChange={setFilterResponsable}
          />
        )}
        {aspectoOptions.length > 0 && (
          <MultiSelectFilter
            label="Aspecto HyS"
            options={aspectoOptions}
            selected={filterAspecto ?? new Set(aspectoOptions.map(o => o.value))}
            onChange={setFilterAspecto}
          />
        )}
        {gestionOptions.length > 0 && (
          <MultiSelectFilter
            label="Gestión origen"
            options={gestionOptions}
            selected={filterGestion ?? new Set(gestionOptions.map(o => o.value))}
            onChange={setFilterGestion}
          />
        )}
        {sectorOptions.length > 0 && (
          <MultiSelectFilter
            label="Sector"
            options={sectorOptions}
            selected={filterSector ?? new Set(sectorOptions.map(o => o.value))}
            onChange={setFilterSector}
          />
        )}
        {puestoOptions.length > 0 && (
          <MultiSelectFilter
            label="Puesto"
            options={puestoOptions}
            selected={filterPuesto ?? new Set(puestoOptions.map(o => o.value))}
            onChange={setFilterPuesto}
          />
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-text-tertiary">
          {filtered.length} de {observaciones.length} observaciones
        </p>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map(obs => {
          const estado = getEstado(obs)
          const hoy = new Date(); hoy.setHours(0, 0, 0, 0)
          const planDate = new Date(obs.fecha_planificada); planDate.setHours(0, 0, 0, 0)
          const diffDays = Math.ceil((planDate.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
          const vencido = estado === 'Vencido'

          return (
            <div key={obs.id} className="bg-surface-base dark:bg-surface-elevated border border-border-default rounded-xl p-4 cursor-pointer hover:border-brand-muted transition-colors" onClick={() => setSelectedObs(obs)}>
              <div className="flex items-start justify-between gap-4">
                {obs.foto_url && getUrl(obs.foto_url) && (
                  <div className="relative h-[2.5cm] w-[3.3cm] shrink-0 rounded-lg overflow-hidden border border-border-subtle">
                    <Image src={getUrl(obs.foto_url)!} alt="Foto observación" fill sizes="125px" className="object-cover" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{obs.descripcion}</p>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    {/* Fecha vencimiento */}
                    <span className={`text-xs font-semibold ${vencido ? 'text-danger' : 'text-amber-600'}`}>
                      {vencido ? `🔴 Vencido hace ${-diffDays} día${-diffDays !== 1 ? 's' : ''}` : `📅 Vence en ${diffDays} día${diffDays !== 1 ? 's' : ''}`}
                    </span>
                    <span className="text-xs text-text-tertiary">
                      {obs.fecha_planificada}
                    </span>

                    {obs.gestion_nombre && (
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setSelectedObs(obs) }}
                        className="text-xs font-medium text-sig-600 hover:text-sig-800 hover:underline text-left"
                      >
                        {obs.gestion_nombre}
                      </button>
                    )}
                    {obs.observaciones_clasificaciones && (
                      <span className="text-xs text-text-tertiary">
                        {obs.observaciones_clasificaciones.nombre}
                      </span>
                    )}
                    {obs.observaciones_categorias && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-text-tertiary">
                        <span className={`w-2 h-2 rounded-full ${catDot[obs.observaciones_categorias.nivel] ?? 'bg-gray-300'}`} />
                        {obs.observaciones_categorias.nombre}
                      </span>
                    )}
                    {obs.establecimientos_sectores && (
                      <span className="text-xs text-text-tertiary">
                        🏭 {obs.establecimientos_sectores.nombre}
                      </span>
                    )}
                    {obs.puestos_de_trabajo && (
                      <span className="text-xs text-text-tertiary">
                        👷 {obs.puestos_de_trabajo.nombre}
                      </span>
                    )}
                    {obs.fecha_ejecutada && (
                      <span className="text-xs text-text-tertiary">
                        Ejecutada: {obs.fecha_ejecutada}
                      </span>
                    )}
                    {obs.personas_directorio && (
                      <span className="text-xs text-text-tertiary">
                        👤 {obs.personas_directorio.apellido}, {obs.personas_directorio.nombre}
                      </span>
                    )}
                    {obs.fecha_cierre && (
                      <span className="text-xs text-success">✓ Cerrado: {obs.fecha_cierre}</span>
                    )}
                  </div>

                  {/* Indicators */}
                  {((obs._comment_count ?? 0) > 0 || (obs._foto_count ?? 0) > 0 || obs.cliente_visto_at) && (
                    <div className="flex items-center gap-3 mt-2">
                      {(obs._comment_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
                          💬 {obs._comment_count}
                        </span>
                      )}
                      {(obs._foto_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
                          📸 {obs._foto_count}
                        </span>
                      )}
                      {obs.cliente_visto_at && (
                        <span className="inline-flex items-center gap-1 text-xs text-success">
                          ✓ Visto por cliente
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${obsColors[estado]}`}>
                  {estado}
                </span>
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <p className="text-sm text-text-tertiary text-center py-8">No hay observaciones con los filtros seleccionados.</p>
        )}
      </div>

      <CierreObservacionModal
        observacion={selectedObs}
        onClose={() => setSelectedObs(null)}
        onSuccess={() => setRefreshKey(k => k + 1)}
        canWrite={canWrite}
      />
    </div>
  )
}
