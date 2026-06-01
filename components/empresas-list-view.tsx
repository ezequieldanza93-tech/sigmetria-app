'use client'

import { Fragment, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Search, Plus } from 'lucide-react'
import { formatCUIT } from '@/lib/utils'
import { EmptyState } from '@/components/ui/empty-state'

interface Establecimiento {
  id: string
  nombre: string
  domicilio: string | null
}

interface Empresa {
  id: string
  razon_social: string
  cuit: string | null
  is_active: boolean
  empresas_rubros: { nombre: string } | null
  localidades: { nombre: string; provincia: string } | null
  establecimientoCount?: number
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
  const [rubroSel, setRubroSel] = useState<string>('todos')
  const [estadoSel, setEstadoSel] = useState<string>('todas')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const rubroOptions = useMemo(() => {
    const set = new Set<string>()
    for (const e of empresas) {
      const r = (e.empresas_rubros as { nombre?: string } | null)?.nombre
      if (r) set.add(r)
    }
    return Array.from(set).sort()
  }, [empresas])

  const filtered = useMemo(() => {
    const q = normalize(search)
    const qDigits = q.replace(/\D/g, '')
    return empresas.filter(e => {
      if (q) {
        const matchName = normalize(e.razon_social).includes(q)
        const cuitDigits = (e.cuit ?? '').replace(/\D/g, '')
        const matchCuit = qDigits && cuitDigits.includes(qDigits)
        if (!matchName && !matchCuit) return false
      }
      if (rubroSel !== 'todos') {
        const r = (e.empresas_rubros as { nombre?: string } | null)?.nombre ?? ''
        if (r !== rubroSel) return false
      }
      if (estadoSel === 'activas' && !e.is_active) return false
      if (estadoSel === 'inactivas' && e.is_active) return false
      return true
    })
  }, [empresas, search, rubroSel, estadoSel])

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const hasFilters = search || rubroSel !== 'todos' || estadoSel !== 'todas'
  const clearFilters = () => {
    setSearch('')
    setRubroSel('todos')
    setEstadoSel('todas')
  }

  const selectCls = 'bg-surface-base border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-sig-500/40 focus:border-sig-500 transition-shadow'

  return (
    <div className="p-4 sm:p-6 pb-24 md:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary font-heading">Empresas</h1>
          <p className="text-text-secondary text-sm mt-1">
            {hasFilters
              ? `${filtered.length} de ${empresas.length} ${empresas.length === 1 ? 'empresa' : 'empresas'}`
              : `${empresas.length} ${empresas.length === 1 ? 'empresa' : 'empresas'} con acceso`}
          </p>
        </div>
        {puedeCrear && (
          <Link
            href="/dashboard/empresas/nueva"
            className="inline-flex items-center gap-2 bg-sig-500 hover:bg-sig-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">Nueva Empresa</span>
          </Link>
        )}
      </div>

      {/* Filtros */}
      {empresas.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-52">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
              <Search size={16} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por razon social o CUIT..."
              aria-label="Buscar empresas"
              className="w-full bg-surface-base border border-border-default rounded-lg pl-10 pr-3 py-2 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-sig-500/40 focus:border-sig-500 transition-shadow"
            />
          </div>

          {rubroOptions.length > 0 && (
            <select
              value={rubroSel}
              onChange={e => setRubroSel(e.target.value)}
              aria-label="Filtrar por rubro"
              className={selectCls}
            >
              <option value="todos">Todos los rubros</option>
              {rubroOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          )}

          <select
            value={estadoSel}
            onChange={e => setEstadoSel(e.target.value)}
            aria-label="Filtrar por estado"
            className={selectCls}
          >
            <option value="todas">Todas</option>
            <option value="activas">Activas</option>
            <option value="inactivas">Inactivas</option>
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-text-tertiary hover:text-text-primary transition-colors px-2 py-2"
            >
              Limpiar
            </button>
          )}
        </div>
      )}

      {!empresas.length ? (
        <EmptyState
          variant="empresas"
          title="No tenes empresas asignadas aun"
          description="Cuando te asignen empresas o crees una nueva, apareceran aqui."
          action={puedeCrear ? { label: 'Crear primera empresa', href: '/dashboard/empresas/nueva' } : undefined}
        />
      ) : !filtered.length ? (
        <EmptyState
          variant="search"
          title="Sin resultados"
          description={`No hay empresas que coincidan con los filtros aplicados`}
          action={{ label: 'Limpiar filtros', onClick: clearFilters }}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border-subtle bg-surface-base">
                <tr className="text-left">
                  <th className="w-10 px-2 py-2.5"></th>
                  <th className="px-5 py-2.5 text-text-secondary font-medium">Razon Social</th>
                  <th className="px-5 py-2.5 text-text-secondary font-medium">CUIT</th>
                  <th className="px-5 py-2.5 text-text-secondary font-medium">Rubro</th>
                  <th className="px-5 py-2.5 text-text-secondary font-medium hidden lg:table-cell">Ubicacion</th>
                  <th className="px-5 py-2.5 text-text-secondary font-medium text-center">Estab.</th>
                  <th className="px-5 py-2.5 text-text-secondary font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map(e => {
                  const ests = e.establecimientos ?? []
                  const count = e.establecimientoCount ?? ests.length
                  const isExpanded = expanded.has(e.id)
                  return (
                    <Fragment key={e.id}>
                      <tr className="hover:bg-surface-sunken/40 transition-colors">
                        <td className="px-2 py-2.5 text-center align-top">
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(e.id)}
                              className="text-text-tertiary hover:text-sig-500 transition-colors p-1 rounded"
                              aria-label={isExpanded ? 'Colapsar establecimientos' : 'Expandir establecimientos'}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-2.5 align-top">
                          <Link
                            href={`/dashboard/empresas/${e.id}`}
                            className="font-medium text-text-primary hover:text-sig-500 transition-colors block"
                          >
                            {e.razon_social}
                          </Link>
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(e.id)}
                              className="text-xs text-text-tertiary hover:text-sig-500 transition-colors mt-0.5 text-left"
                            >
                              Ver {count} {count === 1 ? 'establecimiento' : 'establecimientos'}
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-2.5 text-text-secondary font-mono text-xs align-top">
                          {formatCUIT(e.cuit)}
                        </td>
                        <td className="px-5 py-2.5 text-text-secondary align-top">
                          {(e.empresas_rubros as { nombre?: string } | null)?.nombre ?? '—'}
                        </td>
                        <td className="px-5 py-2.5 text-text-secondary hidden lg:table-cell align-top">
                          {e.localidades
                            ? `${(e.localidades as { nombre: string }).nombre}, ${(e.localidades as { provincia: string }).provincia}`
                            : '—'}
                        </td>
                        <td className="px-5 py-2.5 text-text-secondary text-center align-top">{count}</td>
                        <td className="px-5 py-2.5 align-top">
                          <span
                            className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                              e.is_active
                                ? 'bg-success-bg text-success'
                                : 'bg-surface-sunken text-text-tertiary'
                            }`}
                          >
                            {e.is_active ? 'Activa' : 'Inactiva'}
                          </span>
                        </td>
                      </tr>
                      {isExpanded && count > 0 && (
                        <tr className="bg-surface-sunken/20">
                          <td></td>
                          <td colSpan={6} className="px-5 pb-3 pt-2">
                            <div className="flex flex-wrap gap-2">
                              {ests.map(est => (
                                <Link
                                  key={est.id}
                                  href={`/dashboard/empresas/${e.id}/establecimientos/${est.id}`}
                                  className="inline-flex flex-col bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary hover:border-sig-500 hover:text-sig-500 hover:shadow-sm transition-all max-w-full"
                                >
                                  <span className="font-medium truncate">{est.nombre}</span>
                                  {est.domicilio && (
                                    <span className="text-text-tertiary truncate">{est.domicilio}</span>
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

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {filtered.map(e => {
              const ests = e.establecimientos ?? []
              const count = ests.length
              const isExpanded = expanded.has(e.id)
              return (
                <div
                  key={e.id}
                  className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden"
                >
                  <div className="px-4 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dashboard/empresas/${e.id}`}
                          className="font-medium text-text-primary hover:text-sig-500 transition-colors block text-base"
                        >
                          {e.razon_social}
                        </Link>
                        {e.cuit && (
                          <p className="text-text-tertiary text-xs font-mono mt-1">
                            CUIT: {formatCUIT(e.cuit)}
                          </p>
                        )}
                      </div>
                      <span
                        className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${
                          e.is_active
                            ? 'bg-success-bg text-success'
                            : 'bg-surface-sunken text-text-tertiary'
                        }`}
                      >
                        {e.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-xs text-text-secondary">
                      {(e.empresas_rubros as { nombre?: string } | null)?.nombre && (
                        <span>{(e.empresas_rubros as { nombre: string }).nombre}</span>
                      )}
                      {e.localidades && (
                        <span>
                          {(e.localidades as { nombre: string }).nombre}, {(e.localidades as { provincia: string }).provincia}
                        </span>
                      )}
                    </div>

                    {count > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(e.id)}
                        className="mt-3 flex items-center gap-2 text-sm text-sig-500 font-medium"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        {count} {count === 1 ? 'establecimiento' : 'establecimientos'}
                      </button>
                    )}
                  </div>

                  {isExpanded && count > 0 && (
                    <div className="border-t border-border-subtle bg-surface-sunken/20 p-3">
                      <div className="space-y-2">
                        {ests.map(est => (
                          <Link
                            key={est.id}
                            href={`/dashboard/empresas/${e.id}/establecimientos/${est.id}`}
                            className="block bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm hover:border-sig-500 transition-colors"
                          >
                            <span className="font-medium text-text-primary">{est.nombre}</span>
                            {est.domicilio && (
                              <span className="block text-xs text-text-tertiary mt-0.5">{est.domicilio}</span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
