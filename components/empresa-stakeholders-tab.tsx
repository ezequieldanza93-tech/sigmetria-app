'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/utils'

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

interface Establecimiento {
  id: string
  nombre: string
}

interface Props {
  establecimientos: Establecimiento[]
  personasLinks: PersonaLink[]
  orgsLinks: OrgLink[]
}

export function EmpresaStakeholdersTab({ establecimientos, personasLinks, orgsLinks }: Props) {
  const [filterEstId, setFilterEstId] = useState('')

  const filteredPersonasLinks = filterEstId
    ? personasLinks.filter(p => p.establecimiento_id === filterEstId)
    : personasLinks

  const filteredOrgsLinks = filterEstId
    ? orgsLinks.filter(o => o.establecimiento_id === filterEstId)
    : orgsLinks

  // Group personas: one entry per unique persona_id with all their establishments
  const personaMap = new Map<string, {
    persona: PersonaLink['personas_directorio']
    establecimientos: string[]
  }>()
  for (const link of filteredPersonasLinks) {
    if (!link.personas_directorio) continue
    const existing = personaMap.get(link.personas_directorio.id)
    const estNombre = link.establecimientos?.nombre ?? '—'
    if (existing) {
      existing.establecimientos.push(estNombre)
    } else {
      personaMap.set(link.personas_directorio.id, {
        persona: link.personas_directorio,
        establecimientos: [estNombre],
      })
    }
  }

  // Group orgs: one entry per unique org_id with all their establishments
  const orgMap = new Map<string, {
    org: OrgLink['organizaciones']
    establecimientos: string[]
  }>()
  for (const link of filteredOrgsLinks) {
    if (!link.organizaciones) continue
    const existing = orgMap.get(link.organizaciones.id)
    const estNombre = link.establecimientos?.nombre ?? '—'
    if (existing) {
      existing.establecimientos.push(estNombre)
    } else {
      orgMap.set(link.organizaciones.id, {
        org: link.organizaciones,
        establecimientos: [estNombre],
      })
    }
  }

  const personas = Array.from(personaMap.values())
  const orgs = Array.from(orgMap.values())

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700 shrink-0">Filtrar por establecimiento:</label>
        <select
          value={filterEstId}
          onChange={e => setFilterEstId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
        >
          <option value="">Todos los establecimientos</option>
          {establecimientos.map(e => (
            <option key={e.id} value={e.id}>{e.nombre}</option>
          ))}
        </select>
        {filterEstId && (
          <button
            onClick={() => setFilterEstId('')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Personas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-900">Personas</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {personas.length}
            </span>
          </div>
        </div>

        {personas.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No hay personas registradas{filterEstId ? ' para este establecimiento' : ''}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Nombre</th>
                <th className="px-5 py-3 text-gray-500 font-medium">DNI</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Ingreso</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Establecimientos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {personas.map(({ persona, establecimientos: ests }) => (
                <tr key={persona!.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">
                    {persona!.apellido}, {persona!.nombre}
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{persona!.dni ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {persona!.personas_tipos?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {persona!.fecha_ingreso ? formatDate(persona!.fecha_ingreso) : '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {ests.map(e => (
                        <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-sig-50 text-sig-700 border border-sig-200">
                          {e}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Organizaciones Externas */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-gray-900">Organizaciones Externas</span>
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
              {orgs.length}
            </span>
          </div>
        </div>

        {orgs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            No hay organizaciones externas registradas{filterEstId ? ' para este establecimiento' : ''}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Nombre</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Email</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Teléfono</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Establecimientos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orgs.map(({ org, establecimientos: ests }) => (
                <tr key={org!.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{org!.nombre}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {org!.organizaciones_tipos?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{org!.email ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">{org!.telefono ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {ests.map(e => (
                        <span key={e} className="text-xs px-2 py-0.5 rounded-full bg-sig-50 text-sig-700 border border-sig-200">
                          {e}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
