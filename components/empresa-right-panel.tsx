'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EstablecimientoIcon } from '@/components/icons/establecimiento-icon'
import { EmpresaStakeholdersTab } from '@/components/empresa-stakeholders-tab'
import { AuditHistorialLink } from '@/components/auditoria/audit-historial-link'

interface Establecimiento {
  id: string
  nombre: string
  domicilio: string | null
  establecimientos_tipos: { nombre: string } | null
  localidades: { nombre: string; provincia: string } | null
  cantidad_trabajadores: number | null
  establecimientos_sectores: { cantidad_trabajadores: number | null }[] | null
}

interface PersonaLink {
  persona_id: string
  establecimiento_id: string
  personas_directorio: {
    id: string
    nombre: string
    apellido: string
    dni: string | null
    fecha_ingreso: string | null
    personas_tipos: { nombre: string } | null
  } | null
  establecimientos: { id: string; nombre: string } | null
}

interface OrgLink {
  organizacion_id: string
  establecimiento_id: string
  organizaciones: {
    id: string
    nombre: string
    email: string | null
    telefono: string | null
    organizaciones_tipos: { nombre: string } | null
  } | null
  establecimientos: { id: string; nombre: string } | null
}

interface Props {
  empresaId: string
  establecimientos: Establecimiento[]
  personasLinks: PersonaLink[]
  orgsLinks: OrgLink[]
  puedeEditar: boolean
}

type Tab = 'establecimientos' | 'stakeholders'

export function EmpresaRightPanel({
  empresaId,
  establecimientos,
  personasLinks,
  orgsLinks,
  puedeEditar,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('establecimientos')

  const tabCls = (t: Tab) =>
    `px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
      activeTab === t
        ? 'border-sig-500 text-sig-600'
        : 'border-transparent text-text-secondary hover:text-text-secondary'
    }`

  return (
    <div className="flex-1 min-w-0 p-8">
      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex border-b border-border-subtle -mb-px">
          <button onClick={() => setActiveTab('establecimientos')} className={tabCls('establecimientos')}>
            Establecimientos
            <span className="ml-2 text-xs font-normal text-text-tertiary">({establecimientos.length})</span>
          </button>
          <button onClick={() => setActiveTab('stakeholders')} className={tabCls('stakeholders')}>
            Stakeholders
            <span className="ml-2 text-xs font-normal text-text-tertiary">
              ({new Set(personasLinks.map(p => p.personas_directorio?.id).filter(Boolean)).size + new Set(orgsLinks.map(o => o.organizaciones?.id).filter(Boolean)).size})
            </span>
          </button>
        </div>

        {activeTab === 'establecimientos' && (
          <div className="flex items-center gap-3">
            <AuditHistorialLink tabla="empresas" id={empresaId} />
            {puedeEditar && (
              <>
                <Link
                  href={`/dashboard/empresas/${empresaId}/editar`}
                  className="inline-flex items-center gap-1.5 border border-border-default text-text-secondary hover:bg-surface-elevated hover:text-text-primary text-sm font-medium px-3 py-2 rounded-lg transition-colors"
                >
                  Editar empresa
                </Link>
                <Link
                  href={`/dashboard/empresas/${empresaId}/establecimientos/nuevo`}
                  className="inline-flex items-center gap-1.5 bg-sig-500 hover:bg-sig-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                >
                  <span>+</span> Nuevo Establecimiento
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Tab: Establecimientos */}
      {activeTab === 'establecimientos' && (
        <>
          {!establecimientos.length ? (
            <div className="bg-surface-base rounded-xl border border-border-subtle p-12 text-center">
              <EstablecimientoIcon size={40} strokeWidth={1.5} className="mx-auto text-text-tertiary mb-3" aria-hidden="true" />
              <p className="text-text-secondary">No hay establecimientos registrados</p>
              {puedeEditar && (
                <Link
                  href={`/dashboard/empresas/${empresaId}/establecimientos/nuevo`}
                  className="mt-4 inline-block text-sig-500 hover:underline text-sm"
                >
                  Agregar el primero
                </Link>
              )}
            </div>
          ) : (
            <div className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border-subtle bg-surface-base">
                  <tr className="text-left">
                    <th className="px-5 py-3.5 text-text-secondary font-medium">Nombre</th>
                    <th className="px-5 py-3.5 text-text-secondary font-medium">Tipo</th>
                    <th className="px-5 py-3.5 text-text-secondary font-medium hidden lg:table-cell">Ubicación</th>
                    <th className="px-5 py-3.5 text-text-secondary font-medium text-center">Sectores</th>
                    <th className="px-5 py-3.5 text-text-secondary font-medium text-center">
                      <span title="Ingresado manualmente">Trab. (Manual)</span>
                    </th>
                    <th className="px-5 py-3.5 text-text-secondary font-medium text-center">
                      <span title="Calculado desde sectores → puestos → personas activas">Trab. (Auto)</span>
                    </th>
                    {puedeEditar && <th className="px-5 py-3.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {establecimientos.map(est => {
                    const sectores = est.establecimientos_sectores ?? []
                    const sectoresCount = sectores.length
                    const trabajadoresAuto = sectores.reduce((sum, s) => sum + (s.cantidad_trabajadores ?? 0), 0)
                    return (
                      <tr key={est.id} className="hover:bg-surface-base transition-colors">
                        <td className="px-5 py-4 font-medium text-text-primary">
                          <Link
                            href={`/dashboard/empresas/${empresaId}/establecimientos/${est.id}`}
                            className="hover:text-sig-500 transition-colors"
                          >
                            {est.nombre}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-text-secondary">
                          {est.establecimientos_tipos?.nombre ?? '—'}
                        </td>
                        <td className="px-5 py-4 text-text-secondary hidden lg:table-cell">
                          {(() => {
                            const parts = [est.domicilio, est.localidades?.nombre, est.localidades?.provincia].filter(Boolean)
                            if (!parts.length) return '—'
                            const query = encodeURIComponent(parts.join(', '))
                            return (
                              <a
                                href={`https://www.google.com/maps/search/?api=1&query=${query}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:text-brand-primary hover:underline transition-colors"
                              >
                                {parts.join(', ')}
                              </a>
                            )
                          })()}
                        </td>
                        <td className="px-5 py-4 text-text-secondary text-center">{sectoresCount}</td>
                        <td className="px-5 py-4 text-text-tertiary text-center">
                          {est.cantidad_trabajadores ?? <span className="text-text-tertiary">—</span>}
                        </td>
                        <td className="px-5 py-4 text-text-primary text-center font-medium">
                          {trabajadoresAuto > 0 ? trabajadoresAuto : <span className="text-text-tertiary">0</span>}
                        </td>
                        {puedeEditar && (
                          <td className="px-4 py-4 text-right">
                            <Link
                              href={`/dashboard/empresas/${empresaId}/establecimientos/${est.id}/editar`}
                              className="text-xs text-text-tertiary hover:text-sig-500 font-medium transition-colors"
                            >
                              Editar
                            </Link>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab: Stakeholders */}
      {activeTab === 'stakeholders' && (
        <EmpresaStakeholdersTab
          establecimientos={establecimientos.map(e => ({ id: e.id, nombre: e.nombre }))}
          personasLinks={personasLinks}
          orgsLinks={orgsLinks}
        />
      )}
    </div>
  )
}
