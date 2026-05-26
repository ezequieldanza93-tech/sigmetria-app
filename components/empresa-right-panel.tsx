'use client'

import { useState } from 'react'
import Link from 'next/link'
import { EmpresaStakeholdersTab } from '@/components/empresa-stakeholders-tab'

interface Establecimiento {
  id: string
  nombre: string
  establecimientos_tipos: { nombre: string }[] | null
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
        : 'border-transparent text-gray-500 hover:text-gray-700'
    }`

  return (
    <div className="flex-1 min-w-0 p-8">
      {/* Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex border-b border-gray-200 -mb-px">
          <button onClick={() => setActiveTab('establecimientos')} className={tabCls('establecimientos')}>
            Establecimientos
            <span className="ml-2 text-xs font-normal text-gray-400">({establecimientos.length})</span>
          </button>
          <button onClick={() => setActiveTab('stakeholders')} className={tabCls('stakeholders')}>
            Stakeholders
            <span className="ml-2 text-xs font-normal text-gray-400">
              ({new Set(personasLinks.map(p => p.personas_directorio?.id).filter(Boolean)).size + new Set(orgsLinks.map(o => o.organizaciones?.id).filter(Boolean)).size})
            </span>
          </button>
        </div>

        {puedeEditar && activeTab === 'establecimientos' && (
          <Link
            href={`/dashboard/empresas/${empresaId}/establecimientos/nuevo`}
            className="inline-flex items-center gap-1.5 bg-sig-500 hover:bg-sig-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            <span>+</span> Nuevo Establecimiento
          </Link>
        )}
      </div>

      {/* Tab: Establecimientos */}
      {activeTab === 'establecimientos' && (
        <>
          {!establecimientos.length ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-400 text-4xl mb-3">🏭</p>
              <p className="text-gray-500">No hay establecimientos registrados</p>
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
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr className="text-left">
                    <th className="px-5 py-3.5 text-gray-500 font-medium">Nombre</th>
                    <th className="px-5 py-3.5 text-gray-500 font-medium">Tipo</th>
                    <th className="px-5 py-3.5 text-gray-500 font-medium hidden lg:table-cell">Ubicación</th>
                    <th className="px-5 py-3.5 text-gray-500 font-medium text-center">Sectores</th>
                    <th className="px-5 py-3.5 text-gray-500 font-medium text-center">
                      <span title="Ingresado manualmente">Trab. (Manual)</span>
                    </th>
                    <th className="px-5 py-3.5 text-gray-500 font-medium text-center">
                      <span title="Calculado desde sectores → puestos → personas activas">Trab. (Auto)</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {establecimientos.map(est => {
                    const sectores = est.establecimientos_sectores ?? []
                    const sectoresCount = sectores.length
                    const trabajadoresAuto = sectores.reduce((sum, s) => sum + (s.cantidad_trabajadores ?? 0), 0)
                    return (
                      <tr key={est.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-4 font-medium text-gray-900">
                          <Link
                            href={`/dashboard/empresas/${empresaId}/establecimientos/${est.id}`}
                            className="hover:text-sig-500 transition-colors"
                          >
                            {est.nombre}
                          </Link>
                        </td>
                        <td className="px-5 py-4 text-gray-500">
                          {est.establecimientos_tipos?.[0]?.nombre ?? '—'}
                        </td>
                        <td className="px-5 py-4 text-gray-500 hidden lg:table-cell">
                          {est.localidades ? `${est.localidades.nombre}, ${est.localidades.provincia}` : '—'}
                        </td>
                        <td className="px-5 py-4 text-gray-500 text-center">{sectoresCount}</td>
                        <td className="px-5 py-4 text-gray-400 text-center">
                          {est.cantidad_trabajadores ?? <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-4 text-gray-900 text-center font-medium">
                          {trabajadoresAuto > 0 ? trabajadoresAuto : <span className="text-gray-300">0</span>}
                        </td>
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
