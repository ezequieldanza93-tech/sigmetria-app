'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { DENUNCIA_TIPO_LABELS, SEGUIMIENTO_ESTADO_LABELS, SEGUIMIENTO_ESTADO_BADGE, DENUNCIANTE_TIPO_LABELS } from '@/lib/constants'
import { Search, Eye, Lock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Denuncia } from '@/lib/types'

interface Props {
  denuncias: Denuncia[]
}

const ITEMS_PER_PAGE = 15

export function DenunciasListClient({ denuncias }: Props) {
  const [search, setSearch] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [page, setPage] = useState(1)

  const filtrados = useMemo(() => {
    let items = denuncias

    if (search) {
      const q = search.toLowerCase()
      items = items.filter(d =>
        d.titulo.toLowerCase().includes(q) ||
        d.empresas?.razon_social?.toLowerCase().includes(q)
      )
    }

    if (filtroEstado) items = items.filter(d => d.estado === filtroEstado)
    if (filtroTipo) items = items.filter(d => d.tipo_denuncia === filtroTipo)

    return items
  }, [denuncias, search, filtroEstado, filtroTipo])

  const totalPages = Math.max(1, Math.ceil(filtrados.length / ITEMS_PER_PAGE))
  const paginados = filtrados.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE)

  if (page > totalPages) setPage(1)

  const estadoOptions = [
    { value: '', label: 'Todos los estados' },
    ...Object.entries(SEGUIMIENTO_ESTADO_LABELS).map(([value, label]) => ({ value, label })),
  ]

  const tipoOptions = [
    { value: '', label: 'Todos los tipos' },
    ...Object.entries(DENUNCIA_TIPO_LABELS).map(([value, label]) => ({ value, label })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" aria-hidden="true" />
          <input
            type="search"
            aria-label="Buscar denuncias por título o empresa"
            placeholder="Buscar por título o empresa..."
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
        <Card padding="lg">
          <p className="text-center text-text-tertiary py-8">
            {denuncias.length === 0
              ? 'No hay denuncias registradas todavía.'
              : 'No se encontraron denuncias con los filtros seleccionados.'}
          </p>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle text-text-tertiary text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-3 font-medium">Título</th>
                  <th className="text-left py-3 px-3 font-medium">Tipo</th>
                  <th className="text-left py-3 px-3 font-medium">Denunciante</th>
                  <th className="text-left py-3 px-3 font-medium">Empresa</th>
                  <th className="text-left py-3 px-3 font-medium">Estado</th>
                  <th className="text-left py-3 px-3 font-medium hidden lg:table-cell">Fecha</th>
                  <th className="text-right py-3 px-3 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody>
                {paginados.map(d => (
                  <tr key={d.id} className="border-b border-border-subtle hover:bg-surface-sunken/50 transition-colors">
                    <td className="py-3 px-3 font-medium text-text-primary flex items-center gap-1.5">
                      {d.titulo}
                      {d.confidencial && <Lock size={12} className="text-text-tertiary" />}
                    </td>
                    <td className="py-3 px-3 text-text-secondary">{DENUNCIA_TIPO_LABELS[d.tipo_denuncia]}</td>
                    <td className="py-3 px-3 text-text-secondary">
                      {d.denunciante_tipo === 'anonimo' ? 'Anónimo' : (d.denunciante_nombre ?? DENUNCIANTE_TIPO_LABELS[d.denunciante_tipo])}
                    </td>
                    <td className="py-3 px-3 text-text-secondary">{d.empresas?.razon_social ?? '—'}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEGUIMIENTO_ESTADO_BADGE[d.estado]}`}>
                        {SEGUIMIENTO_ESTADO_LABELS[d.estado]}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-text-secondary hidden lg:table-cell">{formatDate(d.created_at)}</td>
                    <td className="py-3 px-3 text-right">
                      <Link
                        href={`/dashboard/denuncias/${d.id}`}
                        className="inline-flex items-center gap-1 text-sm text-brand-primary hover:text-brand-hover"
                      >
                        <Eye size={16} />
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
