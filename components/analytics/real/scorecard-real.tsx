'use client'

import { KpiCard } from '@/components/analytics/kpi-card'
import type { GestionMetrics, SiniestroMetrics, InspeccionMetrics, FeedbackMetrics, ObservacionMetrics } from '@/lib/analytics-compute'

interface ScorecardRealProps {
  gestion: GestionMetrics
  siniestro: SiniestroMetrics
  inspeccion: InspeccionMetrics
  feedback: FeedbackMetrics
  obs: ObservacionMetrics
}

export function ScorecardReal({ gestion, siniestro, inspeccion, feedback, obs }: ScorecardRealProps) {
  const cumplimientoStatus =
    gestion.cumplimientoPct > 80 ? 'success' : gestion.cumplimientoPct >= 60 ? 'warning' : 'danger'

  const diasSinAccStatus =
    siniestro.diasSinAccidente > 90 ? 'success' : siniestro.diasSinAccidente >= 30 ? 'warning' : 'danger'

  const accidentesStatus =
    siniestro.total === 0 ? 'success' : siniestro.total <= 2 ? 'warning' : 'danger'

  const inspeccionStatus =
    inspeccion.promPuntaje > 80 ? 'success' : inspeccion.promPuntaje >= 60 ? 'warning' : 'danger'

  const obsStatus =
    obs.abiertas < 3 ? 'success' : obs.abiertas <= 8 ? 'warning' : 'danger'

  const feedbackStatus =
    feedback.total === 0
      ? 'neutral'
      : feedback.positivoPct > 70
      ? 'success'
      : feedback.positivoPct >= 40
      ? 'warning'
      : 'danger'

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      <KpiCard
        title="Cumplimiento"
        value={`${gestion.cumplimientoPct}%`}
        subtitle={`${gestion.ejecutadas}/${gestion.total} gestiones`}
        status={cumplimientoStatus}
      />
      <KpiCard
        title="Días sin accidente"
        value={siniestro.diasSinAccidente >= 999 ? '—' : siniestro.diasSinAccidente}
        subtitle={siniestro.diasSinAccidente >= 999 ? 'Sin registro' : 'días consecutivos'}
        status={diasSinAccStatus}
        pulse={diasSinAccStatus === 'danger'}
      />
      <KpiCard
        title="Siniestros"
        value={siniestro.total}
        subtitle={`${siniestro.diasPerdidos} días perdidos`}
        status={accidentesStatus}
      />
      <KpiCard
        title="Inspecciones"
        value={`${inspeccion.promPuntaje}%`}
        subtitle="puntaje promedio"
        status={inspeccionStatus}
      />
      <KpiCard
        title="Obs. abiertas"
        value={obs.abiertas}
        subtitle={`${obs.total} total`}
        status={obsStatus}
        pulse={obs.abiertas > 8}
      />
      <KpiCard
        title="Feedback positivo"
        value={feedback.total > 0 ? `${feedback.positivoPct}%` : '—'}
        subtitle={feedback.total > 0 ? `${feedback.total} respuestas` : 'Sin feedback'}
        status={feedbackStatus}
      />
    </div>
  )
}
