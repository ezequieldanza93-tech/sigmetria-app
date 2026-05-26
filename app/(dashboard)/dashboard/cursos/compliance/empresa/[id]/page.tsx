'use client'

import { use } from 'react'
import Link from 'next/link'
import { ArrowLeft, Building2 } from 'lucide-react'
import { useCumplimientoEmpresa } from '@/lib/queries/curso'
import { CursoProgressBar } from '@/components/cursos/curso-progress-bar'

export default function ComplianceEmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { data: empresa, isLoading } = useCumplimientoEmpresa(id)

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/cursos/compliance"
          className="p-2 text-text-tertiary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Building2 size={24} className="text-brand-primary" />
            {empresa?.empresa_nombre ?? 'Cargando...'}
          </h1>
          <p className="text-sm text-text-tertiary">Detalle de cumplimiento por establecimiento</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-surface-elevated border border-border-subtle rounded-xl animate-pulse" />
          ))}
        </div>
      ) : empresa ? (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl text-center">
              <p className="text-2xl font-bold text-text-primary">{empresa.porcentaje}%</p>
              <p className="text-xs text-text-tertiary">Cumplimiento</p>
            </div>
            <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl text-center">
              <p className="text-2xl font-bold text-text-primary">{empresa.total}</p>
              <p className="text-xs text-text-tertiary">Total asignaciones</p>
            </div>
            <div className="p-4 bg-surface-elevated border border-border-subtle rounded-xl text-center">
              <p className="text-2xl font-bold text-success">{empresa.aprobadas}</p>
              <p className="text-xs text-text-tertiary">Aprobadas</p>
            </div>
          </div>

          {/* Detalle por establecimiento */}
          {empresa.detalle_por_establecimiento && empresa.detalle_por_establecimiento.length > 0 ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-text-primary">Establecimientos</h3>
              {empresa.detalle_por_establecimiento.map((est: any) => (
                <div key={est.establecimiento_id} className="p-4 bg-surface-elevated border border-border-subtle rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-text-primary">{est.establecimiento_nombre}</span>
                    <span className={`text-sm font-medium ${
                      est.porcentaje >= 80 ? 'text-success' : est.porcentaje >= 50 ? 'text-amber-600' : 'text-danger'
                    }`}>
                      {est.porcentaje}%
                    </span>
                  </div>
                  <CursoProgressBar value={est.porcentaje} />
                  <p className="text-xs text-text-tertiary mt-1">
                    {est.aprobadas} de {est.total} aprobadas
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-tertiary text-center py-8">Sin establecimientos con datos</p>
          )}
        </>
      ) : (
        <p className="text-sm text-text-tertiary text-center py-8">Empresa no encontrada</p>
      )}
    </div>
  )
}
