'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { CumplimientoTrendPoint } from '@/lib/types'

interface TrendChartProps {
  data: CumplimientoTrendPoint[] | undefined
  loading: boolean
}

export function ComplianceTrendChart({ data, loading }: TrendChartProps) {
  if (loading) {
    return <div className="h-64 bg-surface-elevated border border-border-subtle rounded-xl animate-pulse" />
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center bg-surface-elevated border border-border-subtle rounded-xl">
        <p className="text-sm text-text-tertiary">Sin datos de tendencia</p>
      </div>
    )
  }

  return (
    <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl">
      <h3 className="text-sm font-semibold text-text-primary mb-4">Tendencia mensual de cumplimiento</h3>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
          <XAxis
            dataKey="mes"
            tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
            tickFormatter={(val) => {
              const [y, m] = val.split('-')
              return `${m}/${y.slice(2)}`
            }}
          />
          <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} unit="%" />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--surface-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value: number) => [`${value}%`, 'Cumplimiento']}
          />
          <Line
            type="monotone"
            dataKey="porcentaje"
            stroke="#4CAF50"
            strokeWidth={2}
            dot={{ fill: '#4CAF50', r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
