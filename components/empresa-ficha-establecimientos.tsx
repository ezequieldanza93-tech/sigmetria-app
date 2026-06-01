'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Building2, ExternalLink } from 'lucide-react'
import { SectoresTab } from '@/components/establecimiento/sectores-tab'
import { StakeholdersTab } from '@/components/establecimiento/stakeholders-tab'
import { AsistenciaTab } from '@/components/establecimiento/asistencia-tab'
import { IncidentesTab } from '@/components/establecimiento/incidentes-tab'
import { InspeccionesTab } from '@/components/establecimiento/inspecciones-tab'
import { DocumentosTab } from '@/components/establecimiento/documentos-tab'
import { DenunciasTab } from '@/components/establecimiento/denuncias-tab'
import { FeedbackTab } from '@/components/establecimiento/feedback-tab'
import { LegajoTab } from '@/components/establecimiento/legajo-tab'
import { InfoTab } from '@/components/establecimiento/info-tab'
import { MapaRiesgoTab } from '@/components/iperc/mapa-riesgo-tab'
import {
  getEstablecimientoFichaData,
  type EstablecimientoFichaData,
} from '@/lib/actions/establecimiento-ficha'

interface EstablecimientoLite {
  id: string
  nombre: string
}

interface Props {
  empresaId: string
  establecimientos: EstablecimientoLite[]
  canWrite: boolean
}

type Tab =
  | 'info'
  | 'sectores'
  | 'stakeholders'
  | 'asistencia'
  | 'incidentes'
  | 'inspecciones'
  | 'documentos'
  | 'legajo'
  | 'denuncias'
  | 'feedback'
  | 'mapa_riesgo'

const TABS: { id: Tab; label: string }[] = [
  { id: 'info', label: 'Información' },
  { id: 'sectores', label: 'Sectores' },
  { id: 'stakeholders', label: 'Directorio' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'incidentes', label: 'Incidentes' },
  { id: 'inspecciones', label: 'Inspecciones' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'legajo', label: 'Legajo Técnico' },
  { id: 'denuncias', label: 'Denuncias' },
  { id: 'feedback', label: 'Feedback Clientes' },
  { id: 'mapa_riesgo', label: 'Mapa de Riesgo' },
]

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: EstablecimientoFichaData }

/**
 * Ficha a nivel empresa: lista los establecimientos de la empresa como un
 * acordeón, colapsado por defecto. Al expandir cada uno se cargan (de forma
 * DIFERIDA) TODOS sus datos vía la server action getEstablecimientoFichaData
 * y se renderizan los 11 tabs del establecimiento con DATOS REALES.
 *
 * Carga diferida real: la action solo se invoca cuando el usuario expande ese
 * establecimiento puntual. El resultado se cachea por establecimientoId para
 * no re-fetchear al colapsar/expandir de nuevo.
 *
 * Nota de diseño: NO se reusa el componente EstablecimientoTabs porque ese
 * gestiona el tab activo vía el query param `?tab=` de la URL. Montar varias
 * instancias en el acordeón las haría competir por el mismo param. Acá se
 * renderizan los tabs individuales con estado local por establecimiento.
 */
export function EmpresaFichaEstablecimientos({ empresaId, establecimientos, canWrite }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [subTab, setSubTab] = useState<Record<string, Tab>>({})
  const [loadState, setLoadState] = useState<Record<string, LoadState>>({})

  const loadFicha = useCallback(
    async (estId: string) => {
      setLoadState(prev => ({ ...prev, [estId]: { status: 'loading' } }))
      try {
        const data = await getEstablecimientoFichaData(estId, empresaId)
        if (!data) {
          setLoadState(prev => ({
            ...prev,
            [estId]: { status: 'error', message: 'No se encontró el establecimiento.' },
          }))
          return
        }
        setLoadState(prev => ({ ...prev, [estId]: { status: 'ready', data } }))
      } catch {
        setLoadState(prev => ({
          ...prev,
          [estId]: { status: 'error', message: 'No se pudieron cargar los datos.' },
        }))
      }
    },
    [empresaId]
  )

  const toggle = useCallback(
    (id: string) => {
      setExpanded(prev => {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
          // Carga diferida: solo al expandir, y solo si no se cargó antes.
          setLoadState(curr => {
            const current = curr[id]
            if (!current || current.status === 'error') {
              void loadFicha(id)
            }
            return curr
          })
        }
        return next
      })
    },
    [loadFicha]
  )

  if (establecimientos.length === 0) {
    return (
      <p className="text-sm text-text-tertiary">
        Esta empresa no tiene establecimientos cargados.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-text-secondary dark:text-white mb-1">
        Fichas de establecimientos
      </h3>
      <p className="text-xs text-text-tertiary mb-3">
        {establecimientos.length}{' '}
        {establecimientos.length === 1 ? 'establecimiento' : 'establecimientos'} — clic para ver sus
        datos
      </p>

      {establecimientos.map(est => {
        const isOpen = expanded.has(est.id)
        const baseUrl = `/dashboard/empresas/${empresaId}/establecimientos/${est.id}`
        const active: Tab = subTab[est.id] ?? 'info'
        const state: LoadState = loadState[est.id] ?? { status: 'idle' }

        return (
          <div
            key={est.id}
            className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden"
          >
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
                {state.status === 'loading' && (
                  <p className="text-sm text-text-tertiary py-6 text-center">Cargando…</p>
                )}

                {state.status === 'error' && (
                  <div className="py-6 text-center">
                    <p className="text-sm text-danger mb-2">{state.message}</p>
                    <button
                      type="button"
                      onClick={() => void loadFicha(est.id)}
                      className="text-xs text-sig-500 hover:text-sig-700 transition-colors"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {state.status === 'ready' && (
                  <>
                    {/* Sub-tabs internos del establecimiento */}
                    <div className="flex flex-wrap gap-1 border-b border-border-subtle mb-4">
                      {TABS.map(t => (
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
                      {active === 'info' && (
                        <InfoTab
                          establecimiento={state.data.establecimiento}
                          canWrite={canWrite}
                          empresaId={empresaId}
                        />
                      )}
                      {active === 'sectores' && (
                        <SectoresTab
                          sectores={state.data.sectores}
                          establecimientoId={est.id}
                          empresaId={empresaId}
                          canWrite={canWrite}
                          canDelete={false}
                        />
                      )}
                      {active === 'stakeholders' && (
                        <StakeholdersTab
                          establecimientoId={est.id}
                          empresaId={empresaId}
                          canWrite={canWrite}
                        />
                      )}
                      {active === 'asistencia' && (
                        <AsistenciaTab
                          establecimientoId={est.id}
                          empresaId={empresaId}
                          canWrite={canWrite}
                        />
                      )}
                      {active === 'incidentes' && (
                        <IncidentesTab
                          incidentes={state.data.incidentes}
                          establecimientoId={est.id}
                          empresaId={empresaId}
                          canWrite={canWrite}
                        />
                      )}
                      {active === 'inspecciones' && (
                        <InspeccionesTab
                          inspecciones={state.data.inspecciones}
                          establecimientoId={est.id}
                          empresaId={empresaId}
                          canWrite={canWrite}
                        />
                      )}
                      {active === 'documentos' && (
                        <DocumentosTab
                          documentos={state.data.documentos}
                          documentTypes={state.data.documentTypes}
                          establecimientoId={est.id}
                          empresaId={empresaId}
                          canWrite={canWrite}
                        />
                      )}
                      {active === 'legajo' && (
                        <LegajoTab
                          empresaDocumentos={state.data.empresaDocumentos}
                          establecimientoDocumentos={state.data.documentos}
                          gestionesLegajo={state.data.gestionesLegajo}
                          trabajadorDocumentos={state.data.trabajadorDocumentos}
                        />
                      )}
                      {active === 'denuncias' && (
                        <DenunciasTab
                          denuncias={state.data.denuncias}
                          establecimientoId={est.id}
                          canWrite={canWrite}
                        />
                      )}
                      {active === 'feedback' && (
                        <FeedbackTab
                          feedbackClientes={state.data.feedbackClientes}
                          establecimientoId={est.id}
                          canWrite={canWrite}
                        />
                      )}
                      {active === 'mapa_riesgo' && (
                        <MapaRiesgoTab
                          establecimientoId={est.id}
                          canWrite={canWrite}
                          planoUrl={state.data.planoUrl}
                        />
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
