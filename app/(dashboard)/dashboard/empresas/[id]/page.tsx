import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canWrite, canAuditarGeo } from '@/lib/types'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { formatCUIT } from '@/lib/utils'
import { EmpresaDocumentosSection } from '@/components/empresa-documentos-section'
import { EmpresaRightPanel } from '@/components/empresa-right-panel'
import { EmpresaFichaHero } from '@/components/empresa-ficha-hero'
import { EmpresaFichaEstablecimientos } from '@/components/empresa-ficha-establecimientos'
import { EmpresaMapaEstablecimientos } from '@/components/empresa-mapa-establecimientos'
import { AnalyticsDashboard } from '@/components/analytics/real/analytics-dashboard'
import { ExportEmpresaButton } from '@/components/export/export-empresa-button'
import { BorrarEntidadButton } from '@/components/papelera/borrar-entidad-button'
import { EstadoActivoToggle } from '@/components/papelera/estado-activo-toggle'
import { GestionesAggregate } from '@/components/aggregate/gestiones-aggregate'
import { SeguimientoAggregate } from '@/components/aggregate/seguimiento-aggregate'
import { getGestionesAggregate, getSeguimientoAggregate } from '@/lib/queries/aggregate'
import type { DocumentType, Documento } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ section?: string; tab?: string }>
}

const SECTIONS = ['establecimientos', 'gestiones', 'seguimiento', 'dashboard', 'ficha'] as const
type Section = (typeof SECTIONS)[number]

// Map legacy ?tab= values to new ?section= names.
const TAB_TO_SECTION: Record<string, Section> = {
  establecimientos: 'establecimientos',
  ficha: 'ficha',
  dashboard: 'dashboard',
}

export default async function EmpresaDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { section: rawSection, tab: rawTab } = await searchParams
  const raw = rawSection ?? (rawTab ? TAB_TO_SECTION[rawTab] : undefined) ?? 'establecimientos'
  const section: Section = (SECTIONS as readonly string[]).includes(raw)
    ? (raw as Section)
    : 'establecimientos'

  const supabase = await createClient()

  const [effective, { data: empresa }] = await Promise.all([
    getEffectiveRole(),
    supabase.from('empresas').select('*, actividades_economicas!actividad_id(codigo, nombre), localidades(nombre, provincia), organizaciones_externas!art_id(nombre)').eq('id', id).single(),
  ])

  if (!effective) redirect('/login')
  if (!empresa) notFound()

  const puedeEditar = canWrite(effective.effectiveUserRole, effective.effectiveSystemRole)
  const esAdminPrincipal = effective.effectiveUserRole === 'full_access_main' || effective.isSuperAdmin === true

  // Fetch data by section
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let establecimientos: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let documentos: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let documentTypes: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let personasLinks: any[] = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let orgsLinks: any[] = []

  if (['establecimientos', 'dashboard', 'gestiones', 'seguimiento'].includes(section)) {
    const { data } = await supabase
      .from('establecimientos')
      .select('id, nombre, status, domicilio, establecimientos_tipos!tipo_id(nombre), localidades!localidad_id(nombre, provincia), cantidad_trabajadores, establecimientos_sectores(cantidad_trabajadores)')
      .eq('empresa_id', id)
      .neq('status', 'cancelled')
      .order('nombre')
    establecimientos = data ?? []
    if (section === 'establecimientos') {
      const estIds = establecimientos.map(e => e.id)
      if (estIds.length > 0) {
        const [pe, oe] = await Promise.all([
          supabase
            .from('personas_establecimientos')
            .select('persona_id, establecimiento_id, personas_directorio!persona_id(id, nombre, apellido, dni, fecha_ingreso, personas_tipos!tipo_id(nombre)), establecimientos!establecimiento_id(id, nombre)')
            .in('establecimiento_id', estIds),
          supabase
            .from('organizaciones_establecimientos')
            .select('organizacion_id, establecimiento_id, organizaciones!organizacion_id(id, nombre, email, telefono, organizaciones_tipos!tipo_id(nombre)), establecimientos!establecimiento_id(id, nombre)')
            .in('establecimiento_id', estIds),
        ])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        personasLinks = (pe.data ?? []) as any[]
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        orgsLinks = (oe.data ?? []) as any[]
      }
    }
  }

  if (section === 'ficha') {
    const [d1, d2, d3] = await Promise.all([
      supabase
        .from('empresas_documentos')
        .select('*, documentos_tipos(nombre)')
        .eq('empresa_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('documentos_tipos')
        .select('id, nombre, aplica_empresa, aplica_establecimiento, aplica_empleado, is_active')
        .eq('is_active', true)
        .eq('aplica_empresa', true)
        .order('nombre'),
      supabase
        .from('establecimientos')
        .select('id, nombre, status, latitud, longitud, domicilio, establecimientos_tipos!tipo_id(codigo, nombre)')
        .eq('empresa_id', id)
        .neq('status', 'cancelled')
        .order('nombre'),
    ])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documentos = (d1.data ?? []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    documentTypes = (d2.data ?? []) as any[]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    establecimientos = (d3.data ?? []) as any[]
  }

  const estContext = establecimientos.map(e => ({
    id: e.id as string,
    nombre: e.nombre as string,
    empresa_id: id,
    empresa_razon_social: empresa.razon_social as string,
  }))

  const gestionesRows = section === 'gestiones' ? await getGestionesAggregate(estContext) : []
  const seguimientoRows = section === 'seguimiento' ? await getSeguimientoAggregate(estContext) : []

  return (
    <>
      {section === 'establecimientos' && (
        <div className="px-4 py-4 sm:p-6">
          <h1 className="text-xl font-bold text-text-primary mb-4">{empresa.razon_social}</h1>
          <EmpresaRightPanel
            empresaId={id}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            establecimientos={(establecimientos ?? []) as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            personasLinks={(personasLinks ?? []) as any}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            orgsLinks={(orgsLinks ?? []) as any}
            puedeEditar={puedeEditar}
          />
        </div>
      )}

      {section === 'gestiones' && (
        <GestionesAggregate
          rows={gestionesRows}
          title={`Gestiones (${empresa.razon_social})`}
          canAuditarGeo={canAuditarGeo(effective.effectiveUserRole, effective.effectiveSystemRole)}
        />
      )}

      {section === 'seguimiento' && <SeguimientoAggregate rows={seguimientoRows} empresaId={id} />}

      {section === 'dashboard' && (
        <div className="p-6">
          <AnalyticsDashboard
            level="empresa"
            empresaId={id}
            establecimientos={establecimientos.map(e => ({
              id: e.id,
              nombre: e.nombre,
              // status del establecimiento + is_active de ESTA empresa para el toggle de entidad.
              status: (e.status as 'active' | 'on_hold' | 'cancelled' | undefined) ?? 'active',
              empresaIsActive: empresa.is_active as boolean,
            }))}
          />
        </div>
      )}

      {section === 'ficha' && (
        <div className="p-6">
          <h1 className="text-xl font-bold text-text-primary mb-4">{empresa.razon_social}</h1>
          <div className="w-full">
            {(() => {
              const e = empresa as typeof empresa & { latitude?: number | null; longitude?: number | null }
              const addressParts = [
                e.domicilio,
                (e.localidades as { nombre: string } | null)?.nombre,
                (e.localidades as { provincia: string } | null)?.provincia,
              ].filter(Boolean)
              return (
                <EmpresaFichaHero
                  address={addressParts.length > 0 ? addressParts.join(', ') : null}
                  lat={e.latitude ?? null}
                  lng={e.longitude ?? null}
                />
              )
            })()}

            <div className="bg-surface-elevated rounded-xl border border-border-subtle p-6 space-y-6">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">{empresa.razon_social}</h2>
                  {empresa.cuit && (
                    <p className="text-sm text-text-tertiary font-mono">{formatCUIT(empresa.cuit)}</p>
                  )}
                  {(empresa.actividades_economicas as unknown as { codigo: string; nombre: string } | null)?.nombre && (
                    <p className="text-sm text-text-tertiary mt-0.5">
                      {(empresa.actividades_economicas as unknown as { codigo: string; nombre: string }).codigo} — {(empresa.actividades_economicas as unknown as { codigo: string; nombre: string }).nombre}
                    </p>
                  )}
                </div>
                {esAdminPrincipal ? (
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <p className="text-text-tertiary text-xs font-medium">Estado</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${empresa.is_active ? 'bg-success-bg text-success' : 'bg-surface-elevated text-text-secondary border border-border-default'}`}>
                        {empresa.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                      <EstadoActivoToggle tabla="empresas" id={id} activo={empresa.is_active as boolean} />
                    </div>
                  </div>
                ) : (
                  <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${empresa.is_active ? 'bg-success-bg text-success' : 'bg-surface-elevated text-text-secondary'}`}>
                    {empresa.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                {empresa.domicilio && (
                  <div>
                    <p className="text-text-tertiary text-xs font-medium mb-0.5">Domicilio</p>
                    {(() => {
                      const parts = [
                        empresa.domicilio,
                        (empresa.localidades as { nombre: string } | null)?.nombre,
                        (empresa.localidades as { provincia: string } | null)?.provincia,
                      ].filter(Boolean)
                      const query = encodeURIComponent(parts.join(', '))
                      return (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${query}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-text-primary hover:text-brand-primary hover:underline transition-colors"
                        >
                          {empresa.domicilio}
                        </a>
                      )
                    })()}
                  </div>
                )}
                {empresa.localidades && (
                  <div>
                    <p className="text-text-tertiary text-xs font-medium mb-0.5">Ubicación</p>
                    <p className="text-text-primary">{empresa.localidades.nombre}, {empresa.localidades.provincia}</p>
                  </div>
                )}
                {empresa.codigo_postal && (
                  <div>
                    <p className="text-text-tertiary text-xs font-medium mb-0.5">CP</p>
                    <p className="text-text-primary">{empresa.codigo_postal}</p>
                  </div>
                )}
                {empresa.organizaciones_externas && (
                  <div>
                    <p className="text-text-tertiary text-xs font-medium mb-0.5">ART</p>
                    <p className="text-text-primary">{empresa.organizaciones_externas.nombre}</p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {puedeEditar && (
                  <Link
                    href={`/dashboard/empresas/${id}/editar`}
                    className="inline-flex items-center gap-1.5 border border-border-default text-text-tertiary hover:bg-surface-elevated hover:text-text-primary text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                  >
                    Editar información
                  </Link>
                )}
                {puedeEditar && <ExportEmpresaButton empresaId={id} />}
                {esAdminPrincipal && (
                  <BorrarEntidadButton tabla="empresas" id={id} nombre={empresa.razon_social as string} redirectTo="/dashboard/empresas" />
                )}
                {(() => {
                  const e = empresa as typeof empresa & { latitude?: number | null; longitude?: number | null }
                  return (
                    <EmpresaMapaEstablecimientos
                      empresa={{
                        razon_social: empresa.razon_social as string,
                        latitude: e.latitude ?? null,
                        longitude: e.longitude ?? null,
                        domicilio: (empresa.domicilio as string | null) ?? null,
                      }}
                      establecimientos={(establecimientos ?? []).map((est) => {
                        const tipoRel = Array.isArray(est.establecimientos_tipos)
                          ? est.establecimientos_tipos[0]
                          : est.establecimientos_tipos
                        return {
                          id: est.id as string,
                          nombre: est.nombre as string,
                          latitud: (est.latitud as number | null) ?? null,
                          longitud: (est.longitud as number | null) ?? null,
                          domicilio: (est.domicilio as string | null) ?? null,
                          tipo: tipoRel
                            ? { codigo: tipoRel.codigo as string, nombre: tipoRel.nombre as string }
                            : null,
                        }
                      })}
                    />
                  )
                })()}
              </div>

              <div className="border-t border-border-subtle pt-4">
                <EmpresaDocumentosSection
                  empresaId={id}
                  documentos={(documentos ?? []) as Documento[]}
                  documentTypes={(documentTypes ?? []) as DocumentType[]}
                  canWrite={puedeEditar}
                />
              </div>

              <div className="border-t border-border-subtle pt-4">
                <EmpresaFichaEstablecimientos
                  empresaId={id}
                  establecimientos={(establecimientos ?? []).map((e) => ({ id: e.id, nombre: e.nombre, status: e.status }))}
                  canWrite={puedeEditar}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
