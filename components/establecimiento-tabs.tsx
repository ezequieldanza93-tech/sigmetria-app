'use client'

import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { useCallback } from 'react'
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
import { AuditoriaLegalTab } from '@/components/establecimiento/auditoria-legal-tab'
import { AuditHistorialLink } from '@/components/auditoria/audit-historial-link'
import { EstadoActivoToggle } from '@/components/papelera/estado-activo-toggle'
import { BorrarEntidadButton } from '@/components/papelera/borrar-entidad-button'
import type {
  Establecimiento,
  SectorEstablecimiento,
  Incidente,
  Inspeccion,
  Documento,
  DocumentType,
  Denuncia,
  FeedbackCliente,
  EmpresaDocumento,
  EmpleadoDocumentoLegajo,
  LegajoGestion,
  LegajoEsperados,
} from '@/lib/types'

type Tab = 'info' | 'sectores' | 'stakeholders' | 'asistencia' | 'incidentes' | 'inspecciones' | 'documentos' | 'legajo' | 'auditoria_legal' | 'denuncias' | 'feedback' | 'mapa_riesgo'

interface EstablecimientoTabsProps {
  establecimiento: Establecimiento
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  canDelete: boolean
  /** Admin principal (full_access_main) o super admin: habilita papelera + toggle de estado. */
  esAdminPrincipal?: boolean
  establecimientoNombre?: string
  establecimientoStatus?: string | null
  sectores: SectorEstablecimiento[]
  incidentes: Incidente[]
  inspecciones: Inspeccion[]
  documentos: Documento[]
  documentTypes: DocumentType[]
  denuncias: Denuncia[]
  feedbackClientes: FeedbackCliente[]
  empresaDocumentos: EmpresaDocumento[]
  gestionesLegajo: LegajoGestion[]
  trabajadorDocumentos: EmpleadoDocumentoLegajo[]
  legajoEsperados: LegajoEsperados | null
  defaultTab?: Tab
  planoUrl?: string | null
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'info', label: 'Información' },
  { id: 'sectores', label: 'Sectores/Rubros' },
  { id: 'stakeholders', label: 'Directorio' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'incidentes', label: 'Incidentes' },
  { id: 'inspecciones', label: 'Inspecciones' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'legajo', label: 'Legajo Técnico' },
  { id: 'auditoria_legal', label: 'Auditoría legal' },
  { id: 'denuncias', label: 'Denuncias' },
  { id: 'feedback', label: 'Feedback Clientes' },
  { id: 'mapa_riesgo', label: 'Mapa de Riesgo' },
]

const VALID_TABS = new Set<string>(TABS.map(t => t.id))

export function EstablecimientoTabs({
  establecimiento,
  establecimientoId,
  empresaId,
  canWrite,
  canDelete,
  esAdminPrincipal = false,
  establecimientoNombre,
  establecimientoStatus,
  sectores,
  incidentes,
  inspecciones,
  documentos,
  documentTypes,
  denuncias,
  feedbackClientes,
  gestionesLegajo,
  legajoEsperados,
  defaultTab = 'info',
  planoUrl,
}: EstablecimientoTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  
  const urlTab = searchParams.get('tab')
  const active: Tab = (urlTab && VALID_TABS.has(urlTab) ? urlTab : defaultTab) as Tab

  const setActive = useCallback((tabId: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tabId)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }, [router, pathname, searchParams])

  const tabPanelId = `tabpanel-${active}`
  const tabId = (id: Tab) => `tab-${id}`

  return (
    <div>
      <div className="flex items-center justify-between gap-4 border-b border-border-subtle mb-6">
        <div
          role="tablist"
          aria-label="Secciones del establecimiento"
          className="flex gap-1 overflow-x-auto scrollbar-hide"
        >
          {TABS.map(tab => {
            const isActive = tab.id === active
            return (
              <button
                key={tab.id}
                id={tabId(tab.id)}
                role="tab"
                aria-selected={isActive}
                aria-controls={tabPanelId}
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActive(tab.id)}
                onKeyDown={(e) => {
                  const currentIndex = TABS.findIndex(t => t.id === active)
                  if (e.key === 'ArrowRight') {
                    e.preventDefault()
                    const nextIndex = (currentIndex + 1) % TABS.length
                    setActive(TABS[nextIndex].id)
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault()
                    const prevIndex = (currentIndex - 1 + TABS.length) % TABS.length
                    setActive(TABS[prevIndex].id)
                  } else if (e.key === 'Home') {
                    e.preventDefault()
                    setActive(TABS[0].id)
                  } else if (e.key === 'End') {
                    e.preventDefault()
                    setActive(TABS[TABS.length - 1].id)
                  }
                }}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors -mb-px border-b-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 ${
                  isActive
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border-default'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {esAdminPrincipal && (
            <EstadoActivoToggle
              tabla="establecimientos"
              id={establecimientoId}
              activo={establecimientoStatus === 'active'}
            />
          )}
          {esAdminPrincipal && (
            <BorrarEntidadButton
              tabla="establecimientos"
              id={establecimientoId}
              nombre={establecimientoNombre ?? establecimiento.nombre}
              redirectTo={`/dashboard/empresas/${empresaId}`}
            />
          )}
          <AuditHistorialLink tabla="establecimientos" id={establecimientoId} className="shrink-0" />
        </div>
      </div>

      <div
        id={tabPanelId}
        role="tabpanel"
        aria-labelledby={tabId(active)}
        tabIndex={0}
      >

      {active === 'info' && (
        <InfoTab
          establecimiento={establecimiento}
          canWrite={canWrite}
          empresaId={empresaId}
        />
      )}
      {active === 'sectores' && (
        <SectoresTab
          sectores={sectores}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
          canDelete={canDelete}
          esAdminPrincipal={esAdminPrincipal}
        />
      )}
      {active === 'stakeholders' && (
        <StakeholdersTab
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
      {active === 'asistencia' && (
        <AsistenciaTab
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
      {active === 'incidentes' && (
        <IncidentesTab
          incidentes={incidentes}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
      {active === 'inspecciones' && (
        <InspeccionesTab
          inspecciones={inspecciones}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
      {active === 'documentos' && (
        <DocumentosTab
          documentos={documentos}
          documentTypes={documentTypes}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
        />
      )}
      {active === 'legajo' && (
        <LegajoTab
          legajoEsperados={legajoEsperados}
          gestionesLegajo={gestionesLegajo}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          documentTypes={documentTypes}
          canWrite={canWrite}
        />
      )}
      {active === 'auditoria_legal' && (
        <AuditoriaLegalTab
          establecimientoId={establecimientoId}
          canWrite={canWrite}
        />
      )}
      {active === 'denuncias' && (
        <DenunciasTab
          denuncias={denuncias}
          establecimientoId={establecimientoId}
          canWrite={canWrite}
        />
      )}
      {active === 'feedback' && (
        <FeedbackTab
          feedbackClientes={feedbackClientes}
          establecimientoId={establecimientoId}
          canWrite={canWrite}
        />
      )}
      {active === 'mapa_riesgo' && (
        <MapaRiesgoTab
          establecimientoId={establecimientoId}
          canWrite={canWrite}
          planoUrl={planoUrl ?? null}
        />
      )}
      </div>
    </div>
  )
}
