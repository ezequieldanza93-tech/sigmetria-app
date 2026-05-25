'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { useNpsTrend } from '@/lib/queries/feedback'
import { ChartCard } from '@/components/analytics/chart-card'
import { TOOLTIP_STYLE, AXIS_STYLE, GradientDefs, GRADIENT_IDS } from '@/components/analytics/chart-config'
import { Skeleton } from '@/components/ui/skeleton'

const MONTH_LABELS: Record<string, string> = {
  '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}

function formatMes(mes: string): string {
  const [, m] = mes.split('-')
  return MONTH_LABELS[m] ?? m
}

export function AdminNpsTrendChart() {
  const { data: trend, isLoading } = useNpsTrend()

  if (isLoading) {
    return <Skeleton className="h-72 rounded-xl" />
  }

  if (!trend?.length) {
    return (
      <ChartCard title="Trend NPS Mensual" subtitle="Últimos 12 meses">
        <div className="h-64 flex items-center justify-center text-sm text-text-tertiary">
          Sin datos de NPS para mostrar
        </div>
      </ChartCard>
    )
  }

  const chartData = trend.map((p) => ({
    mes: formatMes(p.mes),
    nps_score: p.nps_score,
    respuestas: p.total_respuestas,
  }))

  return (
    <ChartCard title="Trend NPS Mensual" subtitle="Últimos 12 meses">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <GradientDefs />
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
            <XAxis dataKey="mes" {...AXIS_STYLE} />
            <YAxis
              domain={[-100, 100]}
              tickFormatter={(v: number) => `${v}`}
              {...AXIS_STYLE}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              formatter={(value: number, name: string) => {
                if (name === 'nps_score') return [`${value}`, 'NPS Score']
                return [value, name]
              }}
              labelFormatter={(label: string) => `Mes: ${label}`}
            />
            <Line
              type="monotone"
              dataKey="nps_score"
              stroke="#4CAF50"
              strokeWidth={2.5}
              dot={{ fill: '#4CAF50', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              fill={`url(#${GRADIENT_IDS.green})`}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  )
}
