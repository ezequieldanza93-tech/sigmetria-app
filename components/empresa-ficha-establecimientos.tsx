'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Building2, ExternalLink } from 'lucide-react'
import { StakeholdersTab } from '@/components/establecimiento/stakeholders-tab'
import { AsistenciaTab } from '@/components/establecimiento/asistencia-tab'

interface EstablecimientoLite {
  id: string
  nombre: string
}

interface Props {
  empresaId: string
  establecimientos: EstablecimientoLite[]
  canWrite: boolean
}

/**
 * Ficha a nivel empresa: lista los establecimientos de la empresa como un
 * acordeón, colapsado por defecto. Al expandir cada uno se muestran sus datos
 * agrupados por establecimiento.
 *
 * Diseño: los tabs que cargan sus propios datos client-side (Directorio,
 * Asistencia — solo necesitan establecimientoId) se embeben con datos REALES.
 * Los tabs que requieren queries pesadas pre-cargadas en el server (Sectores,
 * Incidentes, Inspecciones, Documentos, Legajo, Denuncias, Feedback, Mapa)
 * se ofrecen como acceso directo a la ficha del establecimiento, para no
 * cargar decenas de queries por cada establecimiento de golpe.
 * Carga diferida: nada se monta hasta que el usuario expande el acordeón.
 */

const EMBEBIDOS = [
  { id: 'stakeholders', label: 'Directorio' },
  { id: 'asistencia', label: 'Asistencia' },
] as const

const ACCESOS = [
  { id: 'info', label: 'Información' },
  { id: 'sectores', label: 'Sectores' },
  { id: 'incidentes', label: 'Incidentes' },
  { id: 'inspecciones', label: 'Inspecciones' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'legajo', label: 'Legajo Técnico' },
  { id: 'denuncias', label: 'Denuncias' },
  { id: 'feedback', label: 'Feedback Clientes' },
  { id: 'mapa_riesgo', label: 'Mapa de Riesgo' },
]

export function EmpresaFichaEstablecimientos({ empresaId, establecimientos, canWrite }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [subTab, setSubTab] = useState<Record<string, string>>({})

  if (establecimientos.length === 0) {
    return (
      <p className="text-sm text-text-tertiary">
        Esta empresa no tiene establecimientos cargados.
      </p>
    )
  }

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-text-secondary dark:text-white mb-1">
        Fichas de establecimientos
      </h3>
      <p className="text-xs text-text-tertiary mb-3">
        {establecimientos.length} {establecimientos.length === 1 ? 'establecimiento' : 'establecimientos'} — clic para ver sus datos
      </p>

      {establecimientos.map(est => {
        const isOpen = expanded.has(est.id)
        const baseUrl = `/dashboard/empresas/${empresaId}/establecimientos/${est.id}`
        const active = subTab[est.id] ?? 'stakeholders'
        return (
          <div key={est.id} className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(est.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-sunken/40 transition-colors"
            >
              <span className="text-text-tertiary shrink-0">
                {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </span>
              <Building2 size={16} className="text-sig-500 shrink-0" aria-hidden="true" />
              <span className="font-medium text-text-primary truncate flex-1">{est.nombre}</span>
              <Link
                href={baseUrl}
                onClick={e => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-xs text-sig-500 hover:text-sig-700 transition-colors shrink-0"
              >
                Abrir ficha <ExternalLink size={13} aria-hidden="true" />
              </Link>
            </button>

            {isOpen && (
              <div className="border-t border-border-subtle bg-surface-sunken/20 p-4">
                {/* Sub-tabs internos del establecimiento */}
                <div className="flex flex-wrap gap-1 border-b border-border-subtle mb-4">
                  {EMBEBIDOS.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSubTab(prev => ({ ...prev, [est.id]: t.id }))}
                      className={`px-3 py-1.5 text-xs font-medium rounded-t-lg -mb-px border-b-2 transition-colors ${
                        active === t.id
                          ? 'border-sig-500 text-sig-600'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className="bg-surface-base rounded-lg p-3">
                  {active === 'stakeholders' && (
                    <StakeholdersTab establecimientoId={est.id} empresaId={empresaId} canWrite={canWrite} />
                  )}
                  {active === 'asistencia' && (
                    <AsistenciaTab establecimientoId={est.id} empresaId={empresaId} canWrite={canWrite} />
                  )}
                </div>

                {/* Accesos directos al resto de las secciones */}
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wider text-text-tertiary mb-2">Más secciones</p>
                  <div className="flex flex-wrap gap-2">
                    {ACCESOS.map(tab => (
                      <Link
                        key={tab.id}
                        href={`${baseUrl}?tab=${tab.id}`}
                        className="inline-flex items-center bg-surface-base border border-border-subtle rounded-lg px-3 py-1.5 text-xs text-text-secondary hover:border-sig-500 hover:text-sig-500 transition-all"
                      >
                        {tab.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
