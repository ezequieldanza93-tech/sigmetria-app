'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Select } from '@/components/ui/select'
import { INCIDENTE_TIPO_LABELS, SEGUIMIENTO_ESTADO_LABELS, SEGUIMIENTO_ESTADO_BADGE, SEVERIDAD_LABELS, SEVERIDAD_BADGE } from '@/lib/constants'
import { Search, Eye, Plus } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Incidente } from '@/lib/types'

interface IncidentesTabProps {
  incidentes: Incidente[]
}

const ITEMS_PER_PAGE = 15

export function IncidentesTab({ incidentes }: IncidentesTabProps) {
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [page, setPage] = useState(1)

  const filtrados = useMemo(() => {
    let items = incidentes

    if (search) {
      const q = search.toLowerCase()
      items = items.filter(i => i.titulo.toLowerCase().includes(q))
    }

    if (filtroEstado) {
      items = items.filter(i => i.estado === filtroEstado)
    }

    if (filtroTipo) {
      items = items.filter(i => i.tipo_incidente === filtroTipo)
    }

    return items
  }, [incidentes, search, filtroEstado, filtroTipo])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / ITEMS_PER_PAGE))
  const paginados = filtrados.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  if (page > totalPages) setPage(1)

  const estadoOptions = [
    { value: '', label: 'Todos los estados' },
    ...Object.entries(SEGUIMIENTO_ESTADO_LABELS).map(([value, label]) => ({ value, label })),
  ]

  const tipoOptions = [
    { value: '', label: 'Todos los tipos' },
    ...Object.entries(INCIDENTE_TIPO_LABELS).map(([value, label]) => ({ value, label })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-text-primary dark:text-white">Incidentes</h3>
        <Link
          href="/dashboard/incidentes/nuevo"
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-brand-primary hover:bg-brand-hover rounded-lg transition-colors"
        >
          <Plus size={16} aria-hidden="true" />
          Nuevo Incidente
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar incidentes por título"
            placeholder="Buscar por título..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-9 pr-3 py-2 border border-border-default rounded-lg text-sm bg-surface-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary"
          />
        </div>
        <Select
          options={estadoOptions}
          value={filtroEstado}
          onChange={e => { setFiltroEstado(e.target.value); setPage(1) }}
          className="w-full sm:w-44"
        />
        <Select
          options={tipoOptions}
          value={filtroTipo}
          onChange={e => { setFiltroTipo(e.target.value); setPage(1) }}
          className="w-full sm:w-44"
        />
      </div>

      {paginados.length === 0 ? (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
          {incidentes.length === 0
            ? 'No hay incidentes registrados todavía.'
            : 'No se encontraron incidentes con los filtros seleccionados.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Listado de incidentes">
              <thead>
                <tr className="border-b border-border-subtle text-text-tertiary text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-3 font-medium">Título</th>
                  <th className="text-left py-3 px-3 font-medium">Tipo</th>
                  <th className="text-left py-3 px-3 font-medium hidden sm:table-cell">Severidad</th>
                  <th className="text-left py-3 px-3 font-medium">Estado</th>
                  <th className="text-left py-3 px-3 font-medium hidden lg:table-cell">Fecha</th>
                  <th className="text-right py-3 px-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {paginados.map(inc => (
                  <tr key={inc.id} className="border-b border-border-subtle hover:bg-surface-sunken/50 transition-colors">
                    <td className="py-3 px-3 font-medium text-text-primary">{inc.titulo}</td>
                    <td className="py-3 px-3 text-text-secondary">{INCIDENTE_TIPO_LABELS[inc.tipo_incidente]}</td>
                    <td className="py-3 px-3 hidden sm:table-cell">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERIDAD_BADGE[inc.severidad]}`}>
                        {SEVERIDAD_LABELS[inc.severidad]}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEGUIMIENTO_ESTADO_BADGE[inc.estado]}`}>
                        {SEGUIMIENTO_ESTADO_LABELS[inc.estado]}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-text-secondary hidden lg:table-cell">{formatDate(inc.created_at)}</td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/dashboard/incidentes/${inc.id}`}
                        className="inline-flex items-center gap-1 text-sm text-brand-primary hover:text-brand-hover"
                        aria-label={`Ver incidente: ${inc.titulo}`}
                      >
                        <Eye size={16} aria-hidden="true" />
                        Ver
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-text-tertiary">
                Página {page} de {totalPages} ({filtrados.length} resultados)
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-border-default rounded-lg disabled:opacity-30 hover:bg-surface-elevated transition-colors"
                >
                  Anterior
                </button>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-border-default rounded-lg disabled:opacity-30 hover:bg-surface-elevated transition-colors"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
