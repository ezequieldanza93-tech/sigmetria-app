'use client'

import { formatCUIT } from '@/lib/utils'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sub: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  org: any
  rubro: { nombre: string } | null
  tipoEst: { nombre: string } | null
  puedeEditar: boolean
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-text-tertiary text-xs font-medium mb-0.5">{label}</p>
      <p className="text-text-primary">{value ?? '—'}</p>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider pb-2 border-b border-border-subtle mb-3">
      {children}
    </h3>
  )
}

export function SubcontratistaInfoTab({ sub, org, rubro, tipoEst }: Props) {
  return (
    <div className="max-w-3xl">
      <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 space-y-6">

        {/* ── Datos Generales ── */}
        <div>
          <SectionTitle>Datos Generales</SectionTitle>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <DataRow label="Razón Social" value={org.nombre} />
            <DataRow label="Tipo Identidad" value={org.tipo_identidad_impositiva} />
            <DataRow label="CUIT" value={org.cuit ? formatCUIT(org.cuit) : '—'} />
            <DataRow label="Rubro" value={rubro?.nombre} />
          </div>
        </div>

        {/* ── Ubicación ── */}
        {(org.domicilio || org.localidades) && (
          <div>
            <SectionTitle>Ubicación</SectionTitle>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <DataRow label="Domicilio" value={org.domicilio} />
              <DataRow label="Localidad" value={
                org.localidades ? `${org.localidades.nombre}, ${org.localidades.provincia}` : null
              } />
              <DataRow label="Código Postal" value={org.codigo_postal} />
            </div>
          </div>
        )}

        {/* ── Contacto ── */}
        {(org.email || org.telefono) && (
          <div>
            <SectionTitle>Contacto</SectionTitle>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <DataRow label="Email" value={org.email} />
              <DataRow label="Teléfono" value={org.telefono} />
            </div>
          </div>
        )}

        {/* ── ART ── */}
        {sub.art_id && (
          <div>
            <SectionTitle>ART</SectionTitle>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <DataRow label="ART" value={sub.organizaciones_externas_art?.nombre ?? (typeof sub.art_id === 'string' && sub.art_id.length > 10 ? 'Cargada' : sub.art_id)} />
              <DataRow label="Nº de Contrato" value={sub.art_numero_contrato} />
            </div>
          </div>
        )}

        {/* ── Actividad ── */}
        <div>
          <SectionTitle>Actividad</SectionTitle>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <DataRow label="Tipo de Establecimiento" value={tipoEst?.nombre} />
            <DataRow label="Actividad Principal" value={sub.actividad_principal} />
            <DataRow label="Cantidad de Trabajadores" value={sub.cantidad_trabajadores} />
          </div>
        </div>

        {/* ── Información General ── */}
        {sub.informacion_general && (
          <div>
            <SectionTitle>Información General</SectionTitle>
            <p className="text-sm text-text-primary whitespace-pre-wrap">{sub.informacion_general}</p>
          </div>
        )}
      </div>
    </div>
  )
}
