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
    <div className="p-4 sm:p-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-6 gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary font-heading">Empresas</h1>
          <p className="text-text-secondary text-sm mt-1">
            {search
              ? `${filtered.length} de ${empresas.length} ${empresas.length === 1 ? 'empresa' : 'empresas'}`
              : `${empresas.length} ${empresas.length === 1 ? 'empresa' : 'empresas'} con acceso`}
          </p>
        </div>
        {puedeCrear && (
          <Link
            href="/dashboard/empresas/nueva"
            className="inline-flex items-center gap-2 bg-brand-primary hover:bg-brand-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shrink-0"
          >
            <Plus size={16} strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">Nueva Empresa</span>
          </Link>
        )}
      </div>

      {empresas.length > 0 && (
        <div className="mb-4 relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none">
            <Search size={16} strokeWidth={1.75} aria-hidden="true" />
          </span>
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por razon social o CUIT..."
            aria-label="Buscar empresas"
            className="w-full bg-surface-base border border-border-default rounded-lg pl-10 pr-3 py-2.5 text-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-primary/40 focus:border-brand-primary transition-shadow"
          />
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
          description={`No se encontraron empresas con "${search}"`}
          action={{ label: 'Limpiar busqueda', onClick: () => setSearch('') }}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border-subtle bg-surface-sunken">
                <tr className="text-left">
                  <th className="w-10 px-2 py-3.5"></th>
                  <th className="px-5 py-3.5 text-text-secondary font-medium">Razon Social</th>
                  <th className="px-5 py-3.5 text-text-secondary font-medium">CUIT</th>
                  <th className="px-5 py-3.5 text-text-secondary font-medium">Rubro</th>
                  <th className="px-5 py-3.5 text-text-secondary font-medium hidden lg:table-cell">Ubicacion</th>
                  <th className="px-5 py-3.5 text-text-secondary font-medium text-center">Estab.</th>
                  <th className="px-5 py-3.5 text-text-secondary font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {filtered.map(e => {
                  const ests = e.establecimientos ?? []
                  const count = e.establecimientoCount ?? ests.length
                  const isExpanded = expanded.has(e.id)
                  return (
                    <Fragment key={e.id}>
                      <tr className="hover:bg-surface-sunken/50 transition-colors">
                        <td className="px-2 py-4 text-center align-top">
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(e.id)}
                              className="text-text-tertiary hover:text-text-primary transition-colors p-1 rounded"
                              aria-label={isExpanded ? 'Colapsar establecimientos' : 'Expandir establecimientos'}
                              aria-expanded={isExpanded}
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4 align-top">
                          <Link
                            href={`/dashboard/empresas/${e.id}`}
                            className="font-medium text-text-primary hover:text-brand-primary transition-colors block"
                          >
                            {e.razon_social}
                          </Link>
                          {count > 0 && (
                            <button
                              type="button"
                              onClick={() => toggleExpand(e.id)}
                              className="text-xs text-text-tertiary hover:text-brand-primary transition-colors mt-0.5 text-left"
                            >
                              Ver {count} {count === 1 ? 'establecimiento' : 'establecimientos'}
                            </button>
                          )}
                        </td>
                        <td className="px-5 py-4 text-text-secondary font-mono text-xs align-top">
                          {formatCUIT(e.cuit)}
                        </td>
                        <td className="px-5 py-4 text-text-secondary align-top">
                          {(e.empresas_rubros as { nombre?: string } | null)?.nombre ?? '—'}
                        </td>
                        <td className="px-5 py-4 text-text-secondary hidden lg:table-cell align-top">
                          {e.localidades
                            ? `${(e.localidades as { nombre: string }).nombre}, ${(e.localidades as { provincia: string }).provincia}`
                            : '—'}
                        </td>
                        <td className="px-5 py-4 text-text-secondary text-center align-top">{count}</td>
                        <td className="px-5 py-4 align-top">
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
                        <tr className="bg-surface-sunken/30">
                          <td></td>
                          <td colSpan={6} className="px-5 pb-3">
                            <div className="flex flex-wrap gap-2">
                              {ests.map(est => (
                                <Link
                                  key={est.id}
                                  href={`/dashboard/empresas/${e.id}/establecimientos/${est.id}`}
                                  className="inline-flex flex-col bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary hover:border-brand-primary hover:text-brand-primary hover:shadow-sm transition-all max-w-full"
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
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/dashboard/empresas/${e.id}`}
                          className="font-medium text-text-primary hover:text-brand-primary transition-colors block text-base"
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
                        className="mt-3 flex items-center gap-2 text-sm text-brand-primary font-medium"
                        aria-expanded={isExpanded}
                      >
                        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        {count} {count === 1 ? 'establecimiento' : 'establecimientos'}
                      </button>
                    )}
                  </div>

                  {isExpanded && count > 0 && (
                    <div className="border-t border-border-subtle bg-surface-sunken/30 p-3">
                      <div className="space-y-2">
                        {ests.map(est => (
                          <Link
                            key={est.id}
                            href={`/dashboard/empresas/${e.id}/establecimientos/${est.id}`}
                            className="block bg-surface-base border border-border-subtle rounded-lg px-3 py-2 text-sm hover:border-brand-primary transition-colors"
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
