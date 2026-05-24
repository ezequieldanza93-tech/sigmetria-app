'use client'

import { useState } from 'react'
import { Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { KpiCard } from '@/components/analytics/kpi-card'
import { AnalyticsDashboard } from '@/components/analytics/real/analytics-dashboard'
import { WidgetConfigModal } from '@/components/dashboard/widget-config-modal'
import { SubcontratistasVencimientosWidget } from '@/components/subcontratista/subcontratistas-vencimientos-widget'
import { useVisibleWidgetKeys, useDashboardKpis } from '@/lib/queries/dashboard'
import { ALL_WIDGETS } from '@/lib/constants'
import type { WidgetKey } from '@/lib/constants'
import {
  Building2, MapPin, Users, AlertTriangle, AlertOctagon,
  FileText, ClipboardCheck, CalendarX, CalendarCheck,
  Activity, Shield, Percent, type LucideIcon,
} from 'lucide-react'

const ICON_MAP: Record<string, LucideIcon> = {
  Building2, MapPin, Users, AlertTriangle, AlertOctagon,
  FileText, ClipboardCheck, CalendarX, CalendarCheck,
  Activity, Shield, Percent,
}

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function getWidgetSubtitle(key: WidgetKey): string {
  switch (key) {
    case 'siniestros_mes': return `En ${MESES[new Date().getMonth()]}`
    case 'siniestros_acumulados': return `En ${new Date().getFullYear()}`
    case 'documentos_vencer_7d': return 'Próximos 7 días'
    case 'documentos_vencer_15d': return 'Próximos 15 días'
    case 'documentos_vencer_30d': return 'Próximos 30 días'
    case 'tasa_siniestralidad': return 'Siniestros / Trabajadores'
    case 'inspecciones_pendientes': return 'Pendientes de realizar'
    case 'capacitaciones_vencidas': return 'Vencidas sin realizar'
    case 'capacitaciones_proximas': return 'Próximos 30 días'
    default: return ''
  }
}

interface DashboardShellProps {
  consultoraId: string | null
  establecimientos: { id: string; nombre: string }[]
  empresasContent: React.ReactNode
}

type DashboardTab = 'panel' | 'analytics' | 'empresas'

export function DashboardShell({ consultoraId, establecimientos, empresasContent }: DashboardShellProps) {
  const [tab, setTab] = useState<DashboardTab>('panel')
  const [configOpen, setConfigOpen] = useState(false)
  const { widgetKeys, isLoading: configLoading } = useVisibleWidgetKeys()
  const { data: kpiData, isLoading: kpiLoading } = useDashboardKpis(widgetKeys)

  const TABS: { id: DashboardTab; label: string }[] = [
    { id: 'panel', label: 'Panel Ejecutivo' },
    { id: 'analytics', label: 'Analítica' },
    { id: 'empresas', label: 'Empresas' },
  ]

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px border-b-2',
                tab === t.id
                  ? 'border-brand-primary text-brand-primary'
                  : 'border-transparent text-text-tertiary hover:text-text-primary hover:border-border-default',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === 'panel' && (
          <Button variant="secondary" size="sm" onClick={() => setConfigOpen(true)}>
            <Settings size={14} />
            Configurar Dashboard
          </Button>
        )}
      </div>

      {/* Panel Ejecutivo */}
      {tab === 'panel' && (
        <>
          {configLoading || kpiLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl bg-surface-elevated border border-border-subtle" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {widgetKeys.map(key => {
                  const widget = ALL_WIDGETS[key]
                  const value = kpiData?.[key] ?? '—'
                  const IconComp = ICON_MAP[widget.icon]
                  return (
                    <KpiCard
                      key={key}
                      title={widget.label}
                      value={value}
                      subtitle={getWidgetSubtitle(key)}
                      icon={IconComp ? <IconComp size={16} /> : undefined}
                      size="md"
                      animate
                    />
                  )
                })}
              </div>

              {/* Subcontratistas — documentos próximos a vencer */}
              <div className="mt-6">
                <SubcontratistasVencimientosWidget />
              </div>
            </>
          )}
        </>
      )}

      {/* Analítica */}
      {tab === 'analytics' && (
        consultoraId ? (
          <AnalyticsDashboard
            level="consultora"
            consultoraId={consultoraId}
            establecimientos={establecimientos}
          />
        ) : (
          <div className="rounded-xl border border-border-subtle bg-surface-elevated p-12 text-center">
            <p className="text-text-secondary font-semibold">Sin consultora asociada</p>
            <p className="text-sm text-text-tertiary mt-1">No se encontró una consultora activa para tu cuenta.</p>
          </div>
        )
      )}

      {/* Empresas */}
      {tab === 'empresas' && <>{empresasContent}</>}

      <WidgetConfigModal open={configOpen} onClose={() => setConfigOpen(false)} />
    </div>
  )
}
