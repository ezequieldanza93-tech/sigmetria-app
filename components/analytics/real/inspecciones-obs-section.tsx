'use client'

import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { ChartCard } from '@/components/analytics/chart-card'
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_STYLE } from '@/components/analytics/chart-config'
import type { InspeccionMetrics, ObservacionMetrics } from '@/lib/analytics-compute'
import { AlertTriangle } from 'lucide-react'

interface InspeccionesObsSectionProps {
  iMetrics: InspeccionMetrics
  oMetrics: ObservacionMetrics
}

const PIE_COLORS = ['#3B82F6', '#F59E0B', '#4CAF50', '#8B5CF6']

export function InspeccionesObsSection({ iMetrics, oMetrics }: InspeccionesObsSectionProps) {
  const obsData = [
    { name: 'Abiertas', value: oMetrics.abiertas },
    { name: 'Cerradas', value: oMetrics.cerradas },
  ].filter(d => d.value > 0)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Inspecciones */}
      <ChartCard
        title="Inspecciones"
        subtitle="Programadas y realizadas"
        badge={
          iMetrics.promPuntaje > 0
            ? {
                label: `${iMetrics.promPuntaje}% puntaje`,
                color: iMetrics.promPuntaje > 80 ? 'green' : iMetrics.promPuntaje >= 60 ? 'amber' : 'red',
              }
            : undefined
        }
      >
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Total', value: iMetrics.total },
            { label: 'Realizadas', value: iMetrics.realizadas, color: '#4CAF50' },
            { label: 'Con obs.', value: iMetrics.conObservaciones, color: iMetrics.conObservaciones > 0 ? '#F59E0B' : undefined },
            { label: 'Sin obs.', value: iMetrics.sinObservaciones },
          ].map((kpi, i) => (
            <div key={i} className="rounded-lg bg-surface-sunken border border-border-subtle px-3 py-2.5">
              <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider font-heading">{kpi.label}</p>
              <p className="text-xl font-bold font-heading mt-0.5" style={{ color: kpi.color ?? 'var(--text-primary)' }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {iMetrics.tendencia.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={iMetrics.tendencia} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
              <XAxis dataKey="mes" {...AXIS_STYLE} />
              <YAxis domain={[0, 100]} tickFormatter={v => `${v}%`} {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v}%`, 'Puntaje']} />
              <Line type="monotone" dataKey="puntaje" stroke={CHART_COLORS[0]} strokeWidth={2} dot={{ r: 3 }} name="Puntaje" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-6 text-center text-sm text-text-tertiary">Sin tendencia mensual disponible</div>
        )}
      </ChartCard>

      {/* Observaciones */}
      <ChartCard
        title="Observaciones"
        subtitle="Estado de cierre de observaciones"
        badge={
          oMetrics.abiertas > 5
            ? { label: `${oMetrics.abiertas} abiertas`, color: 'red' }
            : oMetrics.abiertas > 0
            ? { label: `${oMetrics.abiertas} abiertas`, color: 'amber' }
            : oMetrics.total > 0
            ? { label: 'Todas cerradas', color: 'green' }
            : undefined
        }
      >
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Total', value: oMetrics.total },
            {
              label: 'Abiertas',
              value: oMetrics.abiertas,
              color: oMetrics.abiertas > 5 ? '#EF4444' : oMetrics.abiertas > 0 ? '#F59E0B' : undefined,
            },
            { label: 'Cerradas', value: oMetrics.cerradas, color: '#4CAF50' },
            { label: 'Días prom. cierre', value: oMetrics.promDiasResolucion > 0 ? oMetrics.promDiasResolucion : '—' },
          ].map((kpi, i) => (
            <div key={i} className="rounded-lg bg-surface-sunken border border-border-subtle px-3 py-2.5">
              <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider font-heading">{kpi.label}</p>
              <p className="text-xl font-bold font-heading mt-0.5" style={{ color: kpi.color ?? 'var(--text-primary)' }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {oMetrics.abiertas > 5 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 mb-3">
            <AlertTriangle size={14} className="text-red-400 shrink-0" />
            <p className="text-xs text-red-400 font-medium">
              Hay {oMetrics.abiertas} observaciones abiertas que requieren atención
            </p>
          </div>
        )}

        {obsData.length > 0 ? (
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={obsData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                {obsData.map((_, i) => (
                  <Cell key={i} fill={i === 0 ? '#F59E0B' : '#4CAF50'} />
                ))}
              </Pie>
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="py-6 text-center text-sm text-text-tertiary">Sin observaciones registradas</div>
        )}
      </ChartCard>
    </div>
  )
}
