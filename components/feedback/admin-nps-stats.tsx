'use client'

import { useNpsStats } from '@/lib/queries/feedback'
import { KpiCard } from '@/components/analytics/kpi-card'
import { Skeleton } from '@/components/ui/skeleton'

export function AdminNpsStats() {
  const { data: stats, isLoading } = useNpsStats()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  const npsValue = stats.total_respuestas > 0 ? stats.nps_score : null
  const trend = npsValue !== null
    ? npsValue >= 50 ? 'up' : npsValue >= 0 ? 'neutral' : 'down'
    : 'neutral'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        title="NPS Score"
        value={npsValue !== null ? npsValue : '—'}
        subtitle={npsValue !== null ? `${stats.promotores} prom · ${stats.detractores} det` : 'Sin datos'}
        status={npsValue !== null ? (npsValue >= 50 ? 'success' : npsValue >= 0 ? 'warning' : 'danger') : 'neutral'}
        size="lg"
        trend={trend}
        trendValue={npsValue !== null ? `${npsValue}%` : ''}
      />
      <KpiCard
        title="Respuestas NPS"
        value={stats.total_respuestas}
        subtitle="Últimos 90 días"
        status="neutral"
        size="lg"
      />
      <KpiCard
        title="Tickets nuevos"
        value="—"
        subtitle="Calculando..."
        status="warning"
        size="lg"
        pulse
      />
      <KpiCard
        title="Tickets revisados"
        value="—"
        subtitle="Calculando..."
        status="neutral"
        size="lg"
      />
    </div>
  )
}
