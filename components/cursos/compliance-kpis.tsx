'use client'

import { Users, CheckCircle, AlertTriangle, XCircle } from 'lucide-react'
import type { CumplimientoStats } from '@/lib/types'

interface ComplianceKpisProps {
  stats: CumplimientoStats | undefined
  loading: boolean
}

export function ComplianceKpis({ stats, loading }: ComplianceKpisProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-24 bg-surface-elevated border border-border-subtle rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!stats) return null

  const kpis = [
    {
      label: 'Cumplimiento global',
      value: `${stats.porcentaje_global}%`,
      icon: CheckCircle,
      color: stats.porcentaje_global >= 80 ? 'text-green-600' : stats.porcentaje_global >= 50 ? 'text-amber-600' : 'text-red-600',
      bg: stats.porcentaje_global >= 80 ? 'bg-green-100 dark:bg-green-900/30' : stats.porcentaje_global >= 50 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30',
    },
    {
      label: 'Total trabajadores',
      value: stats.total_asignaciones,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-100 dark:bg-blue-900/30',
    },
    {
      label: 'Próximos a vencer (30d)',
      value: stats.proximas_a_vencer,
      icon: AlertTriangle,
      color: stats.proximas_a_vencer > 0 ? 'text-amber-600' : 'text-green-600',
      bg: stats.proximas_a_vencer > 0 ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-green-100 dark:bg-green-900/30',
    },
    {
      label: 'Vencidos',
      value: stats.vencidas,
      icon: XCircle,
      color: stats.vencidas > 0 ? 'text-red-600' : 'text-green-600',
      bg: stats.vencidas > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-green-100 dark:bg-green-900/30',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map(kpi => (
        <div key={kpi.label} className="p-4 bg-surface-elevated border border-border-subtle rounded-xl">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${kpi.bg}`}>
              <kpi.icon size={20} className={kpi.color} />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{kpi.value}</p>
              <p className="text-xs text-text-tertiary">{kpi.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
