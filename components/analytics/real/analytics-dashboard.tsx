'use client'

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react'
import { AnalyticsFilters } from './analytics-filters'
import { AnalyticsSkeleton } from './analytics-skeleton'
import { ScorecardReal } from './scorecard-real'
import { GestionesHys } from './gestiones-hys'
import { IncidentesSection } from './incidentes-section'
import { InspeccionesObsSection } from './inspecciones-obs-section'
import {
  getGestionRows,
  getIncidenteRows,
  getInspeccionRows,
  getFeedbackRows,
  getObservacionRows,
  getResponsableOptions,
} from '@/lib/actions/analytics'
import type { GestionRow, IncidenteRow, InspeccionRow, FeedbackRow, ObservacionRow, ResponsableOption } from '@/lib/actions/analytics'
import {
  computeGestionMetrics,
  computeIncidenteMetrics,
  computeInspeccionMetrics,
  computeFeedbackMetrics,
  computeObservacionMetrics,
} from '@/lib/analytics-compute'

// Estado de entidad para el toggle de analítica (filtrado client-side).
// 'activas' (default): empresa activa Y establecimiento.status === 'active'.
// 'inactivas': empresa inactiva O establecimiento.status === 'on_hold'.
// 'todas': todo salvo 'cancelled' (estado terminal, siempre excluido).
type EstadoEntidad = 'activas' | 'inactivas' | 'todas'

interface EstablecimientoEntidad {
  id: string
  nombre: string
  status?: 'active' | 'on_hold' | 'cancelled'
  empresaIsActive?: boolean
}

interface AnalyticsDashboardProps {
  level: 'establecimiento' | 'empresa' | 'consultora'
  establecimientoId?: string
  empresaId?: string
  consultoraId?: string
  establecimientos?: EstablecimientoEntidad[]
  initialYear?: number
}


export function AnalyticsDashboard({
  level,
  establecimientoId,
  empresaId: _empresaId,
  consultoraId: _consultoraId,
  establecimientos = [],
  initialYear,
}: AnalyticsDashboardProps) {
  // ── ALL hooks must be declared before any early return ──────────────────
  const [year, setYear] = useState<number | null>(null)
  const [month, setMonth] = useState<number | null>(null)
  const [responsableId, setResponsableId] = useState<string | null>(null)
  // Toggle de ESTADO DE ENTIDAD (empresa/establecimiento). Default 'activas' a nivel
  // consultora/empresa. Es distinto y adicional al multi-select de establecimientos.
  const [estadoEntidad, setEstadoEntidad] = useState<EstadoEntidad>('activas')
  const [selectedEstIds, setSelectedEstIds] = useState<string[]>(() => {
    if (level === 'establecimiento' && establecimientoId) return [establecimientoId]
    return establecimientos.map(e => e.id)
  })

  // Universo de establecimientos permitido por el toggle de estado de entidad.
  // 'cancelled' SIEMPRE fuera. A nivel establecimiento el toggle no aplica.
  const entityAllowedEsts = useMemo(() => {
    if (level === 'establecimiento') return establecimientos
    return establecimientos.filter(e => {
      const status = e.status ?? 'active'
      if (status === 'cancelled') return false
      const empActiva = e.empresaIsActive ?? true
      if (estadoEntidad === 'activas') return empActiva && status === 'active'
      if (estadoEntidad === 'inactivas') return !empActiva || status === 'on_hold'
      return true // 'todas' → cualquiera salvo cancelled (ya filtrado arriba)
    })
  }, [establecimientos, estadoEntidad, level])

  const entityAllowedIds = useMemo(
    () => new Set(entityAllowedEsts.map(e => e.id)),
    [entityAllowedEsts],
  )

  // Opciones del multi-select: solo establecimientos dentro del estado de entidad activo.
  const filterableEsts = useMemo(
    () => entityAllowedEsts.map(e => ({ id: e.id, nombre: e.nombre })),
    [entityAllowedEsts],
  )

  const [responsables, setResponsables] = useState<ResponsableOption[]>([])
  const [gestionRows, setGestionRows] = useState<GestionRow[]>([])
  const [incidenteRows, setIncidenteRows] = useState<IncidenteRow[]>([])
  const [inspeccionRows, setInspeccionRows] = useState<InspeccionRow[]>([])
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([])
  const [obsRows, setObsRows] = useState<ObservacionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Defer year to after hydration so server and client always agree on initial state
  useEffect(() => {
    setYear(initialYear ?? new Date().getFullYear())
  }, [initialYear])

  // establecimientoIds EFECTIVOS para las queries:
  // - nivel establecimiento → siempre el id propio (toggle no aplica).
  // - resto → intersección entre la selección manual del multi-select y el
  //   universo permitido por el toggle de estado de entidad. Si no hay selección
  //   manual, se usa todo el universo permitido por el toggle.
  const establecimientoIds =
    level === 'establecimiento' && establecimientoId
      ? [establecimientoId]
      : selectedEstIds.length > 0
      ? selectedEstIds.filter(id => entityAllowedIds.has(id))
      : entityAllowedEsts.map(e => e.id)

  // Load responsables once
  useEffect(() => {
    if (!establecimientoIds.length) return
    getResponsableOptions(establecimientoIds).then(setResponsables)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establecimientoIds.join(',')])

  const fetchData = useCallback(() => {
    // Guard: skip fetch when year hasn't been set by the effect yet
    if (year === null || !establecimientoIds.length) {
      setLoading(false)
      return
    }
    const filters = { establecimientoIds, year, month, responsableId }

    startTransition(async () => {
      setLoading(true)
      try {
        const [g, s, i, f, o] = await Promise.all([
          getGestionRows(filters),
          getIncidenteRows(filters),
          getInspeccionRows(filters),
          getFeedbackRows(filters),
          getObservacionRows(filters),
        ])
        setGestionRows(g)
        setIncidenteRows(s)
        setInspeccionRows(i)
        setFeedbackRows(f)
        setObsRows(o)
      } catch (err) {
        console.error('Analytics fetch error:', err)
      } finally {
        setLoading(false)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [establecimientoIds.join(','), year, month, responsableId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ── Early return AFTER all hooks ────────────────────────────────────────
  // On SSR and the initial client render year is null, so both sides show
  // the skeleton. After hydration the effect sets year and analytics load.
  if (year === null) {
    return <AnalyticsSkeleton />
  }

  const gMetrics = computeGestionMetrics(gestionRows)
  const sMetrics = computeIncidenteMetrics(incidenteRows)
  const iMetrics = computeInspeccionMetrics(inspeccionRows)
  const fMetrics = computeFeedbackMetrics(feedbackRows)
  const oMetrics = computeObservacionMetrics(obsRows)

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex items-center gap-3 p-4 rounded-xl border border-border-subtle bg-surface-elevated flex-wrap">
        <span className="text-xs font-semibold text-text-tertiary uppercase tracking-wider font-heading">
          Filtros
        </span>
        <AnalyticsFilters
          year={year}
          month={month}
          responsableId={responsableId}
          responsables={responsables}
          onYearChange={setYear}
          onMonthChange={setMonth}
          onResponsableChange={setResponsableId}
          estadoEntidad={level !== 'establecimiento' ? estadoEntidad : undefined}
          onEstadoEntidadChange={level !== 'establecimiento' ? setEstadoEntidad : undefined}
          establecimientos={level !== 'establecimiento' ? filterableEsts : undefined}
          selectedEstIds={level !== 'establecimiento' ? selectedEstIds : undefined}
          onEstablecimientosChange={level !== 'establecimiento' ? setSelectedEstIds : undefined}
        />
      </div>

      {loading || isPending ? (
        <AnalyticsSkeleton />
      ) : (
        <>
          <ScorecardReal
            gestion={gMetrics}
            incidente={sMetrics}
            inspeccion={iMetrics}
            feedback={fMetrics}
            obs={oMetrics}
          />
          <GestionesHys rows={gestionRows} metrics={gMetrics} />
          <IncidentesSection rows={incidenteRows} metrics={sMetrics} />
          <InspeccionesObsSection iMetrics={iMetrics} oMetrics={oMetrics} />
        </>
      )}
    </div>
  )
}
