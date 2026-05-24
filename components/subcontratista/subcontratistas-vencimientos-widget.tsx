'use client'

import Link from 'next/link'
import { useSubcontratistasConVencimientos } from '@/lib/queries/subcontratista'
import { formatDate } from '@/lib/utils'

export function SubcontratistasVencimientosWidget() {
  const hoy = new Date()
  const fechaDesde = hoy.toISOString().split('T')[0]
  const fechaHasta = new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data: items = [], isLoading } = useSubcontratistasConVencimientos(fechaDesde, fechaHasta)

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Subcontratistas — Docs por Vencer</h3>
        <div className="text-sm text-gray-400">Cargando…</div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">Subcontratistas — Docs por Vencer</h3>
        <div className="text-sm text-gray-400">Ningún documento próximo a vencer en los próximos 30 días</div>
      </div>
    )
  }

  // Group by subcontratista
  const grouped: Record<string, { nombre: string; docs: typeof items }> = {}
  items.forEach(item => {
    if (!grouped[item.subcontratista_id]) {
      grouped[item.subcontratista_id] = { nombre: item.subcontratista_nombre, docs: [] }
    }
    grouped[item.subcontratista_id].docs.push(item)
  })

  const entries = Object.entries(grouped)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        Subcontratistas — Docs por Vencer
        <span className="ml-2 text-xs font-normal text-gray-500">({items.length} documentos)</span>
      </h3>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {entries.map(([subId, group]) => (
          <Link
            key={subId}
            href={`/dashboard/organizaciones-externas/${subId}?tab=documentos`}
            className="block bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
          >
            <p className="text-sm font-medium text-gray-900 mb-1.5 truncate">{group.nombre}</p>
            <div className="space-y-1">
              {group.docs.slice(0, 3).map(doc => (
                <div key={doc.documento_id} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600 truncate">{doc.tipo_nombre}</span>
                  <span className={`shrink-0 ml-2 font-medium ${
                    doc.dias_restantes <= 7
                      ? 'text-red-600'
                      : doc.dias_restantes <= 15
                        ? 'text-orange-500'
                        : 'text-yellow-600'
                  }`}>
                    {doc.dias_restantes <= 0
                      ? 'VENCIDO'
                      : `${doc.dias_restantes} día${doc.dias_restantes !== 1 ? 's' : ''}`
                    }
                  </span>
                </div>
              ))}
              {group.docs.length > 3 && (
                <p className="text-xs text-gray-400">+{group.docs.length - 3} más</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
