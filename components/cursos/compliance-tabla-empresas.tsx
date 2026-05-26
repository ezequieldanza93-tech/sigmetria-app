'use client'

import Link from 'next/link'
import { ChevronRight, Building2 } from 'lucide-react'

interface EmpresaRow {
  empresa_id: string
  empresa_nombre: string
  porcentaje: number
  total: number
  aprobadas: number
  vencidas: number
}

interface TablaEmpresasProps {
  empresas: EmpresaRow[] | undefined
  loading: boolean
}

export function ComplianceTablaEmpresas({ empresas, loading }: TablaEmpresasProps) {
  if (loading) {
    return <div className="h-48 bg-surface-elevated border border-border-subtle rounded-xl animate-pulse" />
  }

  if (!empresas || empresas.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 bg-surface-elevated border border-border-subtle rounded-xl">
        <p className="text-sm text-text-tertiary">Sin datos de empresas</p>
      </div>
    )
  }

  return (
    <div className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-sunken/50">
              <th className="text-left px-4 py-3 font-semibold text-text-secondary">Empresa</th>
              <th className="text-center px-4 py-3 font-semibold text-text-secondary">Total</th>
              <th className="text-center px-4 py-3 font-semibold text-text-secondary">Aprobadas</th>
              <th className="text-center px-4 py-3 font-semibold text-text-secondary">Vencidas</th>
              <th className="text-center px-4 py-3 font-semibold text-text-secondary">%</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {empresas.map(emp => (
              <tr key={emp.empresa_id} className="border-b border-border-subtle hover:bg-surface-sunken/50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Building2 size={16} className="text-text-tertiary" />
                    <span className="font-medium text-text-primary">{emp.empresa_nombre}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-center text-text-secondary">{emp.total}</td>
                <td className="px-4 py-3 text-center text-success font-medium">{emp.aprobadas}</td>
                <td className={`px-4 py-3 text-center font-medium ${emp.vencidas > 0 ? 'text-danger' : 'text-text-tertiary'}`}>
                  {emp.vencidas}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-center">
                    <div className="w-16 h-2 bg-surface-sunken rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${
                          emp.porcentaje >= 80 ? 'bg-success' : emp.porcentaje >= 50 ? 'bg-amber-500' : 'bg-danger'
                        }`}
                        style={{ width: `${emp.porcentaje}%` }}
                      />
                    </div>
                    <span className={`text-sm font-medium ${
                      emp.porcentaje >= 80 ? 'text-success' : emp.porcentaje >= 50 ? 'text-amber-600' : 'text-danger'
                    }`}>
                      {emp.porcentaje}%
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/cursos/compliance/empresa/${emp.empresa_id}`}
                    className="flex items-center justify-center p-1 text-text-tertiary hover:text-brand-primary transition-colors"
                  >
                    <ChevronRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
