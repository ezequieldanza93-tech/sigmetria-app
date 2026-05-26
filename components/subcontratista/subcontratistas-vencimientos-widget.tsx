'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSubcontratistasConVencimientos } from '@/lib/queries/subcontratista'

export function SubcontratistasVencimientosWidget() {
  const [fechas, setFechas] = useState<{ desde: string; hasta: string } | null>(null)

  useEffect(() => {
    const hoy = new Date()
    setFechas({
      desde: hoy.toISOString().split('T')[0],
      hasta: new Date(hoy.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    })
  }, [])

  // Always call hooks — after hydration fechas will be set and query runs with real dates
  const { data: items = [], isLoading } = useSubcontratistasConVencimientos(
    fechas?.desde ?? '',
    fechas?.hasta ?? '',
  )

  if (!fechas) {
    return (
      <div className="bg-surface-base rounded-xl border border-border-subtle p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Subcontratistas — Docs por Vencer</h3>
        <div className="text-sm text-text-tertiary">Cargando…</div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-surface-base rounded-xl border border-border-subtle p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Subcontratistas — Docs por Vencer</h3>
        <div className="text-sm text-text-tertiary">Cargando…</div>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="bg-surface-base rounded-xl border border-border-subtle p-5">
        <h3 className="text-sm font-semibold text-text-primary mb-3">Subcontratistas — Docs por Vencer</h3>
        <div className="text-sm text-text-tertiary">Ningún documento próximo a vencer en los próximos 30 días</div>
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
    <div className="bg-surface-base rounded-xl border border-border-subtle p-5">
      <h3 className="text-sm font-semibold text-text-primary mb-3">
        Subcontratistas — Docs por Vencer
        <span className="ml-2 text-xs font-normal text-text-secondary">({items.length} documentos)</span>
      </h3>
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {entries.map(([subId, group]) => (
          <Link
            key={subId}
            href={`/dashboard/organizaciones-externas/${subId}?tab=documentos`}
            className="block bg-surface-base rounded-lg p-3 hover:bg-surface-elevated transition-colors"
          >
            <p className="text-sm font-medium text-text-primary mb-1.5 truncate">{group.nombre}</p>
            <div className="space-y-1">
              {group.docs.slice(0, 3).map(doc => (
                <div key={doc.documento_id} className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary truncate">{doc.tipo_nombre}</span>
                  <span className={`shrink-0 ml-2 font-medium ${
                    doc.dias_restantes <= 7
                      ? 'text-danger'
                      : doc.dias_restantes <= 15
                        ? 'text-orange-500'
                        : 'text-warning'
                  }`}>
                    {doc.dias_restantes <= 0
                      ? 'VENCIDO'
                      : `${doc.dias_restantes} día${doc.dias_restantes !== 1 ? 's' : ''}`
                    }
                  </span>
                </div>
              ))}
              {group.docs.length > 3 && (
                <p className="text-xs text-text-tertiary">+{group.docs.length - 3} más</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
