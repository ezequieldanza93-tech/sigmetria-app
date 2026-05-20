'use client'

import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ComposedChart,
} from 'recharts'
import { cn } from '@/lib/utils'
import { ChartCard } from '@/components/analytics/chart-card'
import { VariantSwitcher } from '@/components/analytics/variant-switcher'
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_STYLE } from '@/components/analytics/chart-config'
import type { GestionRow } from '@/lib/actions/analytics'
import type { GestionMetrics } from '@/lib/analytics-compute'

interface GestionesHysProps {
  rows: GestionRow[]
  metrics: GestionMetrics
}

function pctColor(pct: number) {
  if (pct > 80) return '#4CAF50'
  if (pct >= 60) return '#F59E0B'
  return '#EF4444'
}

export function GestionesHys({ rows, metrics }: GestionesHysProps) {
  const [variant, setVariant] = useState<1 | 2 | 3>(1)

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-border-subtle bg-surface-elevated p-10 text-center">
        <p className="text-text-secondary font-semibold">Sin gestiones registradas</p>
        <p className="text-sm text-text-tertiary mt-1">No hay datos para el período y filtros seleccionados.</p>
      </div>
    )
  }

  return (
    <ChartCard
      title="Gestiones HyS"
      subtitle="Seguimiento de ejecución y cumplimiento"
      action={
        <VariantSwitcher
          current={variant}
          onChange={setVariant}
          labels={['Tendencia', 'Por Categoría', 'Por Establecimiento']}
        />
      }
    >
      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total', value: metrics.total },
          { label: 'Ejecutadas', value: metrics.ejecutadas, color: '#4CAF50' },
          { label: 'Vencidas pendientes', value: metrics.pendientesVencidas, color: metrics.pendientesVencidas > 0 ? '#EF4444' : undefined },
          { label: '% Cumplimiento', value: `${metrics.cumplimientoPct}%`, color: pctColor(metrics.cumplimientoPct) },
        ].map((kpi, i) => (
          <div key={i} className="rounded-lg bg-surface-sunken border border-border-subtle px-4 py-3">
            <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider font-heading">{kpi.label}</p>
            <p className="text-2xl font-bold font-heading mt-1" style={{ color: kpi.color ?? 'var(--text-primary)' }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Variant 1 — Tendencia mensual */}
      {variant === 1 && (
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={metrics.tendenciaMensual} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
            <XAxis dataKey="mes" {...AXIS_STYLE} />
            <YAxis yAxisId="left" {...AXIS_STYLE} />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} {...AXIS_STYLE} tickFormatter={v => `${v}%`} />
            <Tooltip {...TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar yAxisId="left" dataKey="planificadas" name="Planificadas" fill={CHART_COLORS[1]} opacity={0.6} radius={[3, 3, 0, 0]} />
            <Bar yAxisId="left" dataKey="ejecutadas" name="Ejecutadas" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="pct" name="% Cumplimiento" stroke="#F59E0B" strokeWidth={2} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      )}

      {/* Variant 2 — Por categoría */}
      {variant === 2 && (
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={Math.max(200, metrics.porCategoria.length * 40)}>
            <BarChart
              layout="vertical"
              data={metrics.porCategoria}
              margin={{ top: 4, right: 60, left: 8, bottom: 0 }}
            >
              <XAxis type="number" domain={[0, 100]} tickFormatter={v => `${v}%`} {...AXIS_STYLE} />
              <YAxis type="category" dataKey="categoria" width={120} {...AXIS_STYLE} tick={{ ...AXIS_STYLE.tick, fontSize: 11 }} />
              <Tooltip {...TOOLTIP_STYLE} formatter={(v) => [`${v}%`, '% Cumplimiento']} />
              <Bar dataKey="pct" name="% Cumplimiento" radius={[0, 4, 4, 0]}>
                {metrics.porCategoria.map((entry, index) => (
                  <rect key={index} fill={pctColor(entry.pct)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-xs text-text-tertiary font-heading">
                  <th className="text-left pb-2 font-semibold">Categoría</th>
                  <th className="text-right pb-2 font-semibold">Total</th>
                  <th className="text-right pb-2 font-semibold">Ejecutadas</th>
                  <th className="text-right pb-2 font-semibold">Cumplimiento</th>
                  <th className="text-right pb-2 font-semibold">Índice prom.</th>
                </tr>
              </thead>
              <tbody>
                {metrics.porCategoria.map((cat, i) => (
                  <tr key={i} className="border-b border-border-subtle/50 hover:bg-surface-sunken">
                    <td className="py-2 text-text-primary">{cat.categoria}</td>
                    <td className="py-2 text-right text-text-secondary tabular-nums">{cat.total}</td>
                    <td className="py-2 text-right text-text-secondary tabular-nums">{cat.ejecutadas}</td>
                    <td className="py-2 text-right tabular-nums font-semibold" style={{ color: pctColor(cat.pct) }}>
                      {cat.pct}%
                    </td>
                    <td className="py-2 text-right text-text-tertiary tabular-nums">
                      {cat.avgIndex !== null ? cat.avgIndex : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Variant 3 — Por establecimiento */}
      {variant === 3 && (
        metrics.porEstablecimiento.length <= 1 ? (
          <div className="py-10 text-center text-text-tertiary text-sm">
            Seleccioná múltiples establecimientos para comparar
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={metrics.porEstablecimiento}
              margin={{ top: 4, right: 16, left: -16, bottom: 40 }}
            >
              <XAxis
                dataKey="nombre"
                {...AXIS_STYLE}
                angle={-30}
                textAnchor="end"
                interval={0}
                tick={{ ...AXIS_STYLE.tick, fontSize: 10 }}
              />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="total" name="Planificadas" fill={CHART_COLORS[1]} opacity={0.6} radius={[3, 3, 0, 0]} />
              <Bar dataKey="ejecutadas" name="Ejecutadas" fill={CHART_COLORS[0]} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )
      )}
    </ChartCard>
  )
}
