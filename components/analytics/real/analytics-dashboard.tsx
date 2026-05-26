'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { AnalyticsFilters } from './analytics-filters'
import { AnalyticsSkeleton } from './analytics-skeleton'
import { ScorecardReal } from './scorecard-real'
import { GestionesHys } from './gestiones-hys'
import { SiniestrosSection } from './siniestros-section'
import { InspeccionesObsSection } from './inspecciones-obs-section'
import {
  getGestionRows,
  getSiniestroRows,
  getInspeccionRows,
  getFeedbackRows,
  getObservacionRows,
  getResponsableOptions,
} from '@/lib/actions/analytics'
import type { GestionRow, SiniestroRow, InspeccionRow, FeedbackRow, ObservacionRow, ResponsableOption } from '@/lib/actions/analytics'
import {
  computeGestionMetrics,
  computeSiniestroMetrics,
  computeInspeccionMetrics,
  computeFeedbackMetrics,
  computeObservacionMetrics,
} from '@/lib/analytics-compute'

interface AnalyticsDashboardProps {
  level: 'establecimiento' | 'empresa' | 'consultora'
  establecimientoId?: string
  empresaId?: string
  consultoraId?: string
  establecimientos?: { id: string; nombre: string }[]
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
  const [selectedEstIds, setSelectedEstIds] = useState<string[]>(() => {
    if (level === 'establecimiento' && establecimientoId) return [establecimientoId]
    return establecimientos.map(e => e.id)
  })

  const [responsables, setResponsables] = useState<ResponsableOption[]>([])
  const [gestionRows, setGestionRows] = useState<GestionRow[]>([])
  const [siniestroRows, setSiniestroRows] = useState<SiniestroRow[]>([])
  const [inspeccionRows, setInspeccionRows] = useState<InspeccionRow[]>([])
  const [feedbackRows, setFeedbackRows] = useState<FeedbackRow[]>([])
  const [obsRows, setObsRows] = useState<ObservacionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isPending, startTransition] = useTransition()

  // Defer year to after hydration so server and client always agree on initial state
  useEffect(() => {
    setYear(initialYear ?? new Date().getFullYear())
  }, [initialYear])

  // Determine actual establecimientoIds for queries
  const establecimientoIds =
    level === 'establecimiento' && establecimientoId
      ? [establecimientoId]
      : selectedEstIds.length > 0
      ? selectedEstIds
      : establecimientos.map(e => e.id)

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
          getSiniestroRows(filters),
          getInspeccionRows(filters),
          getFeedbackRows(filters),
          getObservacionRows(filters),
        ])
        setGestionRows(g)
        setSiniestroRows(s)
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
  const sMetrics = computeSiniestroMetrics(siniestroRows)
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
          establecimientos={level !== 'establecimiento' ? establecimientos : undefined}
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
            siniestro={sMetrics}
            inspeccion={iMetrics}
            feedback={fMetrics}
            obs={oMetrics}
          />
          <GestionesHys rows={gestionRows} metrics={gMetrics} />
          <SiniestrosSection rows={siniestroRows} metrics={sMetrics} />
          <InspeccionesObsSection iMetrics={iMetrics} oMetrics={oMetrics} />
        </>
      )}
    </div>
  )
}
