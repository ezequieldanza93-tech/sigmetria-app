'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { formatCUIT } from '@/lib/utils'

interface Establecimiento {
  id: string
  nombre: string
  domicilio: string | null
  is_active: boolean
}

interface Empresa {
  id: string
  razon_social: string
  cuit: string | null
  is_active: boolean
  empresas_rubros: { nombre: string } | null
  localidades: { nombre: string; provincia: string } | null
  establecimientos: Establecimiento[]
}

function normalize(value: string | null | undefined): string {
  return (value ?? '').toLowerCase().trim()
}

export function EmpresasListView({
  empresas,
  puedeCrear,
}: {
  empresas: Empresa[]
  puedeCrear: boolean
}) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const filtered = useMemo(() => {
    const q = normalize(search)
    if (!q) return empresas
    // CUIT comparison ignores dashes/spaces
    const qDigits = q.replace(/\D/g, '')
    return empresas.filter(e => {
      if (normalize(e.razon_social).includes(q)) return true
      const cuitDigits = (e.cuit ?? '').replace(/\D/g, '')
      if (qDigits && cuitDigits.includes(qDigits)) return true
      return false
    })
  }, [empresas, search])

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">Empresas</h1>
          <p className="text-gray-500 text-sm mt-1">
            {search
              ? `${filtered.length} de ${empresas.length} ${empresas.length === 1 ? 'empresa' : 'empresas'}`
              : `${empresas.length} ${empresas.length === 1 ? 'empresa' : 'empresas'} con acceso`}
          </p>
        </div>
        {puedeCrear && (
          <Link
            href="/dashboard/empresas/nueva"
            className="inline-flex items-center gap-2 bg-sig-500 hover:bg-sig-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            <span>+</span> <span className="hidden sm:inline">Nueva Empresa</span>
          </Link>
        )}
      </div>

      {empresas.length > 0 && (
        <div className="mb-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <Search size={16} strokeWidth={1.75} />
          </span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por razón social o CUIT…"
            className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-sig-500/40 focus:border-sig-500"
          />
        </div>
      )}

      {!empresas.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-4xl mb-3">🏢</p>
          <p className="text-gray-500 font-medium">No tenés empresas asignadas aún</p>
          {puedeCrear && (
            <Link
              href="/dashboard/empresas/nueva"
              className="mt-4 inline-block text-sig-500 hover:underline text-sm"
            >
              Crear la primera empresa
            </Link>
          )}
        </div>
      ) : !filtered.length ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <p className="text-gray-400 text-2xl mb-2">🔍</p>
          <p className="text-gray-500 text-sm">
            No se encontraron empresas con &ldquo;{search}&rdquo;
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="w-10 px-2 py-3.5"></th>
                <th className="px-3 sm:px-5 py-3.5 text-gray-500 font-medium">Razón Social</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium hidden md:table-cell">CUIT</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium hidden md:table-cell">Rubro</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium hidden lg:table-cell">Ubicación</th>
                <th className="px-3 sm:px-5 py-3.5 text-gray-500 font-medium text-center">Estab.</th>
                <th className="px-5 py-3.5 text-gray-500 font-medium hidden sm:table-cell">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(e => {
                const ests = e.establecimientos ?? []
                const count = ests.length
                const isExpanded = expanded.has(e.id)
                return (
                  <Fragment key={e.id}>
                    <tr className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-4 text-center align-top">
                        {count > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(e.id)}
                            className="text-gray-400 hover:text-gray-700 transition-colors p-1 rounded"
                            aria-label={isExpanded ? 'Colapsar establecimientos' : 'Expandir establecimientos'}
                            aria-expanded={isExpanded}
                          >
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        )}
                      </td>
                      <td className="px-3 sm:px-5 py-4 align-top">
                        <Link
                          href={`/dashboard/empresas/${e.id}`}
                          className="font-medium text-gray-900 hover:text-sig-500 transition-colors block"
                        >
                          {e.razon_social}
                        </Link>
                        {count > 0 && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(e.id)}
                            className="text-xs text-gray-500 hover:text-sig-500 transition-colors mt-0.5 text-left"
                          >
                            Ver establecimientos de la empresa: {count}
                          </button>
                        )}
                      </td>
                      <td className="px-5 py-4 text-gray-500 font-mono text-xs hidden md:table-cell align-top">
                        {formatCUIT(e.cuit)}
                      </td>
                      <td className="px-5 py-4 text-gray-500 hidden md:table-cell align-top">
                        {(e.empresas_rubros as { nombre?: string } | null)?.nombre ?? '—'}
                      </td>
                      <td className="px-5 py-4 text-gray-500 hidden lg:table-cell align-top">
                        {e.localidades
                          ? `${(e.localidades as { nombre: string }).nombre}, ${(e.localidades as { provincia: string }).provincia}`
                          : '—'}
                      </td>
                      <td className="px-3 sm:px-5 py-4 text-gray-500 text-center align-top">{count}</td>
                      <td className="px-5 py-4 hidden sm:table-cell align-top">
                        <span
                          className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${e.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                        >
                          {e.is_active ? 'Activa' : 'Inactiva'}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && count > 0 && (
                      <tr className="bg-gray-50/50">
                        <td></td>
                        <td colSpan={6} className="px-3 sm:px-5 pb-3">
                          <div className="flex flex-wrap gap-2">
                            {ests.map(est => (
                              <Link
                                key={est.id}
                                href={`/dashboard/empresas/${e.id}/establecimientos/${est.id}`}
                                className="inline-flex flex-col bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 hover:border-sig-500 hover:text-sig-500 hover:shadow-sm transition-all max-w-full"
                              >
                                <span className="font-medium truncate">{est.nombre}</span>
                                {est.domicilio && (
                                  <span className="text-gray-400 truncate">{est.domicilio}</span>
                                )}
                              </Link>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
