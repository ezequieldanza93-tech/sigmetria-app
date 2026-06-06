import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { canWrite } from '@/lib/types'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { GestionesAgenda } from '@/components/establecimiento-gestiones-agenda'
import { EstablecimientoTabs } from '@/components/establecimiento-tabs'
import { ActuarView } from '@/components/actuar-view'
import { getDocTiposAplicables } from '@/lib/actions/aplicabilidad'
import type {
  SectorEstablecimiento, Incidente, Inspeccion, Riesgo, Documento, DocumentType,
  EstablecimientoDenuncia, FeedbackCliente, EmpresaDocumento, EmpleadoDocumentoLegajo, LegajoGestion,
  Capacitacion, Medicion,
} from '@/lib/types'
import { AnalyticsDashboard } from '@/components/analytics/real/analytics-dashboard'
import { LegajoTecnico } from '@/components/establecimiento/legajo-tecnico'
import { QRPanel } from '@/components/establecimiento/qr-panel'

type Section = 'agenda' | 'ficha' | 'dashboard' | 'seguimiento' | 'legajo'
const VALID_SECTIONS: Section[] = ['agenda', 'ficha', 'dashboard', 'seguimiento', 'legajo']

interface Props {
  params: Promise<{ id: string; estId: string }>
  searchParams: Promise<{ section?: string }>
}

export default async function EstablecimientoDetailPage({ params, searchParams }: Props) {
  const { id: empresaId, estId } = await params
  const { section: rawSection } = await searchParams
  const section: Section = (VALID_SECTIONS as string[]).includes(rawSection ?? '')
    ? (rawSection as Section)
    : 'agenda'

  const supabase = await createClient()

  const [
    effective,
    { data: establecimiento },
    { data: empresa },
  ] = await Promise.all([
    getEffectiveRole(),
    supabase.from('establecimientos').select('id, nombre, latitud, longitud, photo_site, plano_url, domicilio, codigo_postal, actividad_principal, cantidad_trabajadores, description, aplica_iso_45001, created_at, establecimientos_tipos!tipo_id(id, codigo, nombre), localidades!localidad_id(nombre, provincia)').eq('id', estId).single(),
    supabase.from('empresas').select('id, razon_social').eq('id', empresaId).single(),
  ])

  if (!effective) redirect('/login')
  if (!establecimiento || !empresa) notFound()

  const userCanWrite =
    canWrite(effective.effectiveUserRole, effective.effectiveSystemRole) ||
    effective.isSuperAdmin === true

  // Section-specific data fetching
  let sectores: SectorEstablecimiento[] = []
  let incidentes: Incidente[] = []
  let inspecciones: Inspeccion[] = []
  let riesgos: Riesgo[] = []
  let documentos: Documento[] = []
  let documentTypes: DocumentType[] = []
  let denuncias: EstablecimientoDenuncia[] = []
  let feedbackClientes: FeedbackCliente[] = []
  let empresaDocumentos: EmpresaDocumento[] = []
  let gestionesLegajo: LegajoGestion[] = []
  let trabajadorDocumentos: EmpleadoDocumentoLegajo[] = []

  // Legajo QR section data
  let legajoCapacitaciones: (Capacitacion & { _asistentes?: number })[] = []
  let legajoRiesgos: Riesgo[] = []
  let legajoIncidentes: Incidente[] = []
  let legajoInspecciones: Inspeccion[] = []
  let legajoDocumentos: Documento[] = []
  const legajoMedicionesPorTipo: Record<string, Medicion[]> = {}
  let verificacionToken: string | null = null

  if (section === 'ficha') {
    const [s1, s2, s3, s4, s5] = await Promise.all([
      supabase
        .from('establecimientos_sectores')
        .select('*')
        .eq('establecimiento_id', estId)
        .eq('is_active', true)
        .order('es_custom')
        .order('nombre'),
      supabase
        .from('incidentes')
        .select('*')
        .eq('establecimiento_id', estId)
        .order('fecha_ocurrencia', { ascending: false }),
      supabase
        .from('inspecciones')
        .select('*')
        .eq('establecimiento_id', estId)
        .order('fecha_programada', { ascending: false }),
      supabase
        .from('establecimientos_documentos')
        .select('*, documentos_tipos(nombre, categoria_legajo, periodicidad)')
        .eq('establecimiento_id', estId)
        .order('created_at', { ascending: false }),
      getDocTiposAplicables(estId),
    ])
    sectores = (s1.data ?? []) as unknown as SectorEstablecimiento[]
    incidentes = (s2.data ?? []) as unknown as Incidente[]
    inspecciones = (s3.data ?? []) as unknown as Inspeccion[]
    documentos = (s4.data ?? []) as unknown as Documento[]
    documentTypes = s5

    const today = new Date().toISOString().split('T')[0]
    const [d1, d2, d3, d4] = await Promise.all([
      supabase.from('establecimientos_denuncias').select('*, personas_directorio(nombre, apellido)').eq('establecimiento_id', estId).order('fecha', { ascending: false }),
      supabase.from('establecimientos_feedback_clientes').select('*, personas_directorio(nombre, apellido)').eq('establecimiento_id', estId).order('fecha', { ascending: false }),
      supabase.from('empresas_documentos').select('*, documentos_tipos(nombre, categoria_legajo, periodicidad)').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
      supabase
        .from('gestiones_registros')
        .select('id, fecha_planificada, notas, mostrar_lt, gestiones_establecimientos!inner(establecimiento_id, gestiones!inner(nombre, gestiones_categorias(nombre)))')
        .eq('gestiones_establecimientos.establecimiento_id', estId)
        .eq('mostrar_lt', true)
        .is('fecha_ejecutada', null)
        .gte('fecha_planificada', today)
        .order('fecha_planificada'),
    ])
    denuncias = (d1.data ?? []) as unknown as EstablecimientoDenuncia[]
    feedbackClientes = (d2.data ?? []) as unknown as FeedbackCliente[]
    empresaDocumentos = (d3.data ?? []) as unknown as EmpresaDocumento[]
    gestionesLegajo = (d4.data ?? []) as unknown as LegajoGestion[]

    const { data: peData } = await supabase
      .from('personas_establecimientos')
      .select('persona_id')
      .eq('establecimiento_id', estId)
    const personaIds = ((peData ?? []) as { persona_id: string }[]).map(p => p.persona_id)
    if (personaIds.length > 0) {
      const { data: empDocs } = await supabase
        .from('personas_documentos')
        .select('*, documentos_tipos(nombre, categoria_legajo, periodicidad), personas_directorio(nombre, apellido, legajo)')
        .in('persona_id', personaIds)
        .order('created_at', { ascending: false })
      trabajadorDocumentos = (empDocs ?? []) as unknown as EmpleadoDocumentoLegajo[]
    }
  }

  if (section === 'agenda') {
    const { data } = await supabase
      .from('riesgos')
      .select('*')
      .eq('establecimiento_id', estId)
      .order('fecha_identificacion', { ascending: false })
    riesgos = (data ?? []) as unknown as Riesgo[]
  }

  if (section === 'seguimiento') {
    const { data } = await supabase
      .from('riesgos')
      .select('*')
      .eq('establecimiento_id', estId)
      .order('fecha_identificacion', { ascending: false })
    riesgos = (data ?? []) as unknown as Riesgo[]
  }

  if (section === 'legajo') {
    const ahora12m = new Date()
    ahora12m.setFullYear(ahora12m.getFullYear() - 1)
    const doce = ahora12m.toISOString().split('T')[0]

    const [tk, insp, docs, caps, rgs, meds, sins] = await Promise.all([
      supabase.from('verificacion_tokens').select('token').eq('establecimiento_id', estId).single(),
      supabase.from('inspecciones').select('*').eq('establecimiento_id', estId).in('estado', ['realizada', 'con_observaciones']).order('fecha_realizada', { ascending: false }),
      supabase.from('establecimientos_documentos').select('*, documentos_tipos(nombre, categoria_legajo, periodicidad)').eq('establecimiento_id', estId).eq('legajo_tecnico', true).order('fecha_vencimiento', { ascending: true, nullsFirst: false }),
      supabase.from('capacitaciones').select('id, titulo, fecha_realizada, capacitaciones_asistentes(id)').eq('empresa_id', empresaId).or(`establecimiento_id.eq.${estId},establecimiento_id.is.null`).eq('estado', 'realizada').gte('fecha_realizada', doce).order('fecha_realizada', { ascending: false }),
      supabase.from('riesgos').select('*').eq('establecimiento_id', estId).eq('resuelto', false),
      supabase.from('mediciones').select('*, unidades(nombre, simbolo)').eq('establecimiento_id', estId).order('fecha', { ascending: false }),
      supabase.from('incidentes').select('*').eq('establecimiento_id', estId).in('estado', ['pendiente', 'en_investigacion']).order('fecha_ocurrencia', { ascending: false }),
    ])

    verificacionToken = tk.data?.token ?? null
    legajoInspecciones = (insp.data ?? []) as unknown as Inspeccion[]
    legajoDocumentos = (docs.data ?? []) as unknown as Documento[]
    legajoCapacitaciones = ((caps.data ?? []) as unknown as (Capacitacion & { capacitaciones_asistentes?: { id: string }[] })[])
      .map(c => ({ ...c, _asistentes: c.capacitaciones_asistentes?.length ?? 0 }))
    legajoRiesgos = (rgs.data ?? []) as unknown as Riesgo[]
    legajoIncidentes = (sins.data ?? []) as unknown as Incidente[]
    for (const m of (meds.data ?? []) as unknown as Medicion[]) {
      if (!legajoMedicionesPorTipo[m.tipo]) legajoMedicionesPorTipo[m.tipo] = []
      if (legajoMedicionesPorTipo[m.tipo].length < 3) legajoMedicionesPorTipo[m.tipo].push(m)
    }
  }

  return (
    <div className="p-0">
      {/* Content */}
      {section === 'agenda' && (
        <GestionesAgenda
          establecimientoId={estId}
          empresaId={empresaId}
          canWrite={userCanWrite}
          riesgos={riesgos}
          establecimientoNombre={establecimiento.nombre}
        />
      )}

      {section === 'ficha' && (
        <>
          <EstablecimientoTabs
            establecimiento={establecimiento as unknown as import('@/lib/types').Establecimiento}
            establecimientoId={estId}
            empresaId={empresaId}
            canWrite={userCanWrite}
            canDelete={false}
            sectores={sectores}
            incidentes={incidentes}
            inspecciones={inspecciones}
            documentos={documentos}
            documentTypes={documentTypes}
            denuncias={denuncias}
            feedbackClientes={feedbackClientes}
            empresaDocumentos={empresaDocumentos}
            gestionesLegajo={gestionesLegajo}
            trabajadorDocumentos={trabajadorDocumentos}
            planoUrl={establecimiento.plano_url}
          />
        </>
      )}

      {section === 'dashboard' && (
        <div className="px-6 py-6">
          <AnalyticsDashboard
            level="establecimiento"
            establecimientoId={estId}
          />
        </div>
      )}

      {section === 'seguimiento' && (
        <ActuarView establecimientoId={estId} canWrite={userCanWrite} />
      )}

      {section === 'legajo' && (
        <div className="px-6 py-6 max-w-5xl">
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            <div className="flex-1 min-w-0">
              <LegajoTecnico
                establecimiento={establecimiento as unknown as import('@/lib/types').Establecimiento}
                empresa={empresa}
                ultimaInspeccion={legajoInspecciones[0] ?? null}
                totalInspecciones12m={legajoInspecciones.length}
                documentos={legajoDocumentos}
                capacitaciones={legajoCapacitaciones}
                riesgos={legajoRiesgos}
                medicionesPorTipo={legajoMedicionesPorTipo}
                incidentes={legajoIncidentes}
                ahora={new Date()}
              />
            </div>
            <div className="w-full lg:w-72 shrink-0">
              {verificacionToken ? (
                <QRPanel
                  token={verificacionToken}
                  establecimientoId={estId}
                  empresaId={empresaId}
                  establecimientoNombre={establecimiento.nombre}
                />
              ) : (
                <div className="bg-surface-elevated border border-border-subtle rounded-xl p-5">
                  <p className="text-sm text-text-tertiary text-center">
                    No hay token QR generado para este establecimiento.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
