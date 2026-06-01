'use client'

import React, { useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { ChartCard } from '@/components/analytics/chart-card'
import { VariantSwitcher } from '@/components/analytics/variant-switcher'
import { CHART_COLORS, TOOLTIP_STYLE, AXIS_STYLE } from '@/components/analytics/chart-config'
import type { IncidenteRow } from '@/lib/actions/analytics'
import type { IncidenteMetrics } from '@/lib/analytics-compute'
import { CheckCircle2 } from 'lucide-react'

interface IncidentesSectionProps {
  rows: IncidenteRow[]
  metrics: IncidenteMetrics
}

const PIE_COLORS = ['#EF4444', '#F59E0B', '#3B82F6', '#8B5CF6']

const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_investigacion: 'En investigación',
  cerrado: 'Cerrado',
}

export function IncidentesSection({ rows, metrics }: IncidentesSectionProps) {
  const [variant, setVariant] = useState<1 | 2 | 3>(1)

  if (rows.length === 0 && variant !== 3) {
    return (
      <ChartCard
        title="Incidentes"
        subtitle="Incidentes y accidentes (leves, moderados y graves)"
      >
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <CheckCircle2 size={40} className="text-[#4CAF50]" />
          <p className="font-semibold text-text-primary">Sin incidentes en el período</p>
          <p className="text-sm text-text-tertiary">No se registraron incidentes ni accidentes.</p>
        </div>
      </ChartCard>
    )
  }

  return (
    <ChartCard
      title="Incidentes"
      subtitle="Incidentes y accidentes (leves, moderados y graves)"
      action={
        <VariantSwitcher
          current={variant}
          onChange={setVariant}
          labels={['Resumen', 'Tendencia', 'Detalle']}
        />
      }
    >
      {/* Variant 1 — Resumen */}
      {variant === 1 && (
        <div className="space-y-5">
          {/* Hero card */}
          <div
            className="rounded-xl p-6 text-center"
            style={{ background: 'linear-gradient(135deg, #0a0f0a 0%, #0d1f0d 50%, #0a0f0a 100%)' }}
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50 font-heading mb-1">
              Días sin accidente
            </p>
            <p className="text-6xl font-bold font-heading text-white tabular-nums">
              {metrics.diasSinAccidente >= 999 ? '—' : metrics.diasSinAccidente}
            </p>
            {metrics.diasSinAccidente < 999 && (
              <p className="text-sm text-white/50 mt-1">días consecutivos sin accidente</p>
            )}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total incidentes', value: metrics.total },
              { label: 'Días perdidos', value: metrics.diasPerdidos, color: metrics.diasPerdidos > 0 ? '#EF4444' : undefined },
              { label: 'Accidentes', value: metrics.porTipo.filter(t => t.tipo.startsWith('Accidente')).reduce((s, t) => s + t.count, 0), color: '#EF4444' },
              { label: 'Incidentes', value: metrics.porTipo.find(t => t.tipo === 'Incidente')?.count ?? 0, color: '#F59E0B' },
            ].map((kpi, i) => (
              <div key={i} className="rounded-lg bg-surface-sunken border border-border-subtle px-4 py-3">
                <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider font-heading">{kpi.label}</p>
                <p className="text-2xl font-bold font-heading mt-1" style={{ color: kpi.color ?? 'var(--text-primary)' }}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Pie chart */}
          {metrics.porTipo.length > 0 && (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={metrics.porTipo} dataKey="count" nameKey="tipo" cx="50%" cy="50%" outerRadius={70} label={({ name, value }) => `${name}: ${value}`} labelLine={false}>
                  {metrics.porTipo.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* Variant 2 — Tendencia */}
      {variant === 2 && (
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={metrics.mensual} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
              <XAxis dataKey="mes" {...AXIS_STYLE} />
              <YAxis {...AXIS_STYLE} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" name="Incidentes" fill={CHART_COLORS[3]} radius={[3, 3, 0, 0]} />
              <Bar dataKey="diasPerdidos" name="Días perdidos" fill={CHART_COLORS[2]} radius={[3, 3, 0, 0]} opacity={0.7} />
            </BarChart>
          </ResponsiveContainer>

          {/* Estado distribution */}
          {metrics.porEstado.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {metrics.porEstado.map((e, i) => (
                <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-sunken border border-border-subtle text-xs">
                  <span className="font-medium text-text-primary">{ESTADO_LABELS[e.estado] ?? e.estado}</span>
                  <span className="text-text-tertiary">{e.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Variant 3 — Detalle */}
      {variant === 3 && (
        rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle2 size={40} className="text-[#4CAF50]" />
            <p className="font-semibold text-text-primary">Sin incidentes en el período</p>
            <p className="text-sm text-text-tertiary">No se registraron incidentes ni accidentes.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Total', value: metrics.total },
                { label: 'Días perdidos', value: metrics.diasPerdidos },
                { label: 'Días sin accidente', value: metrics.diasSinAccidente >= 999 ? '—' : metrics.diasSinAccidente },
              ].map((kpi, i) => (
                <div key={i} className="rounded-lg bg-surface-sunken border border-border-subtle px-4 py-3">
                  <p className="text-[10px] font-semibold text-text-tertiary uppercase tracking-wider font-heading">{kpi.label}</p>
                  <p className="text-2xl font-bold font-heading mt-1 text-text-primary">{kpi.value}</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {metrics.porTipo.length > 0 && (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={metrics.porTipo} dataKey="count" nameKey="tipo" cx="50%" cy="50%" outerRadius={65}>
                      {metrics.porTipo.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
              {metrics.porEstado.length > 0 && (
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={metrics.porEstado.map(e => ({ ...e, estado: ESTADO_LABELS[e.estado] ?? e.estado }))} dataKey="count" nameKey="estado" cx="50%" cy="50%" outerRadius={65}>
                      {metrics.porEstado.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip {...TOOLTIP_STYLE} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )
      )}
    </ChartCard>
  )
}
