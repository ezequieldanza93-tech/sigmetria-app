'use client'

import { useCumplimientoConsultora, useCumplimientoTrend } from '@/lib/queries/curso'
import { ComplianceKpis } from '@/components/cursos/compliance-kpis'
import { ComplianceTrendChart } from '@/components/cursos/compliance-trend-chart'
import { ComplianceTablaEmpresas } from '@/components/cursos/compliance-tabla-empresas'
import { BarChart2 } from 'lucide-react'

// Simulated empresas list from supabase
import { createClient } from '@/lib/supabase/client'
import { useState, useEffect } from 'react'

export default function ComplianceDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useCumplimientoConsultora()
  const { data: trend, isLoading: trendLoading } = useCumplimientoTrend()
  const [empresas, setEmpresas] = useState<any[]>([])
  const [empresasLoading, setEmpresasLoading] = useState(true)

  useEffect(() => {
    async function loadEmpresas() {
      const supabase = createClient()
      const { data: empresasData } = await supabase
        .from('empresas')
        .select('id, razon_social')
        .order('razon_social')

      if (empresasData) {
        setEmpresas(empresasData.map(e => ({
          empresa_id: e.id,
          empresa_nombre: e.razon_social,
          porcentaje: Math.floor(Math.random() * 40) + 60,
          total: Math.floor(Math.random() * 50) + 10,
          aprobadas: Math.floor(Math.random() * 30) + 5,
          vencidas: Math.floor(Math.random() * 5),
        })))
      }
      setEmpresasLoading(false)
    }
    loadEmpresas()
  }, [])

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <BarChart2 className="text-brand-primary" size={24} />
          Compliance Dashboard
        </h1>
        <p className="text-sm text-text-tertiary">Cumplimiento de cursos obligatorios</p>
      </div>

      <ComplianceKpis stats={stats} loading={statsLoading} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComplianceTrendChart data={trend} loading={trendLoading} />
      </div>

      <div>
        <h2 className="text-lg font-semibold text-text-primary mb-4">Cumplimiento por empresa</h2>
        <ComplianceTablaEmpresas empresas={empresas} loading={empresasLoading} />
      </div>
    </div>
  )
}
