'use client'

import { useState } from 'react'
import { SectoresTab } from '@/components/establecimiento/sectores-tab'
import { StakeholdersTab } from '@/components/establecimiento/stakeholders-tab'
import { AsistenciaTab } from '@/components/establecimiento/asistencia-tab'
import { SiniestrosTab } from '@/components/establecimiento/siniestros-tab'
import { InspeccionesTab } from '@/components/establecimiento/inspecciones-tab'
import { DocumentosTab } from '@/components/establecimiento/documentos-tab'
import { DenunciasTab } from '@/components/establecimiento/denuncias-tab'
import { FeedbackTab } from '@/components/establecimiento/feedback-tab'
import { LegajoTab } from '@/components/establecimiento/legajo-tab'
import type {
  SectorEstablecimiento,
  Siniestro,
  Inspeccion,
  Documento,
  DocumentType,
  EstablecimientoDenuncia,
  FeedbackCliente,
  EmpresaDocumento,
  EmpleadoDocumentoLegajo,
  LegajoGestion,
} from '@/lib/types'

type Tab = 'sectores' | 'stakeholders' | 'asistencia' | 'siniestros' | 'inspecciones' | 'documentos' | 'legajo' | 'denuncias' | 'feedback'

interface EstablecimientoTabsProps {
  establecimientoId: string
  empresaId: string
  canWrite: boolean
  canDelete: boolean
  sectores: SectorEstablecimiento[]
  siniestros: Siniestro[]
  inspecciones: Inspeccion[]
  documentos: Documento[]
  documentTypes: DocumentType[]
  denuncias: EstablecimientoDenuncia[]
  feedbackClientes: FeedbackCliente[]
  empresaDocumentos: EmpresaDocumento[]
  gestionesLegajo: LegajoGestion[]
  trabajadorDocumentos: EmpleadoDocumentoLegajo[]
  defaultTab?: Tab
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'sectores', label: 'Sectores' },
  { id: 'stakeholders', label: 'Stakeholders' },
  { id: 'asistencia', label: 'Asistencia' },
  { id: 'siniestros', label: 'Siniestros' },
  { id: 'inspecciones', label: 'Inspecciones' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'legajo', label: 'Legajo Técnico' },
  { id: 'denuncias', label: 'Denuncias' },
  { id: 'feedback', label: 'Feedback Clientes' },
]

export function EstablecimientoTabs({
  establecimientoId,
  empresaId,
  canWrite,
  canDelete,
  sectores,
  siniestros,
  inspecciones,
  documentos,
  documentTypes,
  denuncias,
  feedbackClientes,
  empresaDocumentos,
  gestionesLegajo,
  trabajadorDocumentos,
  defaultTab,
}: EstablecimientoTabsProps) {
  const [active, setActive] = useState<Tab>(defaultTab ?? 'sectores')

  return (
    <div>
      <div className="border-b border-gray-200 dark:border-border-subtle mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors -mb-px border-b-2 ${
                tab.id === active
                  ? 'border-sig-500 text-sig-500'
                  : 'border-transparent text-gray-500 dark:text-white hover:text-gray-700 dark:hover:text-white hover:border-gray-300 dark:hover:border-slate-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {active === 'sectores' && (
        <SectoresTab
          sectores={sectores}
          establecimientoId={establecimientoId}
          empresaId={empresaId}
          canWrite={canWrite}
          canDelete={canDelete}
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
      {active === 'siniestros' && (
        <SiniestrosTab
          siniestros={siniestros}
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
          empresaDocumentos={empresaDocumentos}
          establecimientoDocumentos={documentos}
          gestionesLegajo={gestionesLegajo}
          trabajadorDocumentos={trabajadorDocumentos}
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
    </div>
  )
}
