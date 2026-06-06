'use server'

import { createClient } from '@/lib/supabase/server'
import { getDocTiposAplicables } from '@/lib/actions/aplicabilidad'
import type {
  Establecimiento,
  SectorEstablecimiento,
  Incidente,
  Inspeccion,
  Documento,
  DocumentType,
  EstablecimientoDenuncia,
  FeedbackCliente,
  EmpresaDocumento,
  EmpleadoDocumentoLegajo,
  LegajoGestion,
} from '@/lib/types'

export interface EstablecimientoFichaData {
  establecimiento: Establecimiento
  sectores: SectorEstablecimiento[]
  incidentes: Incidente[]
  inspecciones: Inspeccion[]
  documentos: Documento[]
  documentTypes: DocumentType[]
  denuncias: EstablecimientoDenuncia[]
  feedbackClientes: FeedbackCliente[]
  empresaDocumentos: EmpresaDocumento[]
  gestionesLegajo: LegajoGestion[]
  trabajadorDocumentos: EmpleadoDocumentoLegajo[]
  planoUrl: string | null
}

/**
 * Carga TODOS los datos que los tabs de la ficha del establecimiento necesitan.
 * Replica exactamente las queries de la sección `ficha` del page
 * `app/(dashboard)/dashboard/empresas/[id]/establecimientos/[estId]/page.tsx`.
 *
 * Pensado para CARGA DIFERIDA: se invoca solo cuando el usuario expande un
 * establecimiento puntual en la ficha a nivel empresa.
 */
export async function getEstablecimientoFichaData(
  establecimientoId: string,
  empresaId: string
): Promise<EstablecimientoFichaData | null> {
  const supabase = await createClient()

  const { data: establecimiento } = await supabase
    .from('establecimientos')
    .select('id, nombre, latitud, longitud, photo_site, plano_url, domicilio, codigo_postal, actividad_principal, cantidad_trabajadores, description, aplica_iso_45001, created_at, establecimientos_tipos!tipo_id(id, codigo, nombre), localidades!localidad_id(nombre, provincia)')
    .eq('id', establecimientoId)
    .single()

  if (!establecimiento) return null

  const [s1, s2, s3, s4, s5] = await Promise.all([
    supabase
      .from('establecimientos_sectores')
      .select('*')
      .eq('establecimiento_id', establecimientoId)
      .eq('is_active', true)
      .order('es_custom')
      .order('nombre'),
    supabase
      .from('incidentes')
      .select('*')
      .eq('establecimiento_id', establecimientoId)
      .order('fecha_ocurrencia', { ascending: false }),
    supabase
      .from('inspecciones')
      .select('*')
      .eq('establecimiento_id', establecimientoId)
      .order('fecha_programada', { ascending: false }),
    supabase
      .from('establecimientos_documentos')
      .select('*, documentos_tipos(nombre, categoria_legajo, periodicidad)')
      .eq('establecimiento_id', establecimientoId)
      .order('created_at', { ascending: false }),
    getDocTiposAplicables(establecimientoId),
  ])

  const sectores = (s1.data ?? []) as unknown as SectorEstablecimiento[]
  const incidentes = (s2.data ?? []) as unknown as Incidente[]
  const inspecciones = (s3.data ?? []) as unknown as Inspeccion[]
  const documentos = (s4.data ?? []) as unknown as Documento[]
  const documentTypes = s5

  const today = new Date().toISOString().split('T')[0]
  const [d1, d2, d3, d4] = await Promise.all([
    supabase.from('establecimientos_denuncias').select('*, personas_directorio(nombre, apellido)').eq('establecimiento_id', establecimientoId).order('fecha', { ascending: false }),
    supabase.from('establecimientos_feedback_clientes').select('*, personas_directorio(nombre, apellido)').eq('establecimiento_id', establecimientoId).order('fecha', { ascending: false }),
    supabase.from('empresas_documentos').select('*, documentos_tipos(nombre, categoria_legajo, periodicidad)').eq('empresa_id', empresaId).order('created_at', { ascending: false }),
    supabase
      .from('gestiones_registros')
      .select('id, fecha_planificada, notas, mostrar_lt, gestiones_establecimientos!inner(establecimiento_id, gestiones!inner(nombre, gestiones_categorias(nombre)))')
      .eq('gestiones_establecimientos.establecimiento_id', establecimientoId)
      .eq('mostrar_lt', true)
      .is('fecha_ejecutada', null)
      .gte('fecha_planificada', today)
      .order('fecha_planificada'),
  ])

  const denuncias = (d1.data ?? []) as unknown as EstablecimientoDenuncia[]
  const feedbackClientes = (d2.data ?? []) as unknown as FeedbackCliente[]
  const empresaDocumentos = (d3.data ?? []) as unknown as EmpresaDocumento[]
  const gestionesLegajo = (d4.data ?? []) as unknown as LegajoGestion[]

  let trabajadorDocumentos: EmpleadoDocumentoLegajo[] = []
  const { data: peData } = await supabase
    .from('personas_establecimientos')
    .select('persona_id')
    .eq('establecimiento_id', establecimientoId)
  const personaIds = ((peData ?? []) as { persona_id: string }[]).map(p => p.persona_id)
  if (personaIds.length > 0) {
    const { data: empDocs } = await supabase
      .from('personas_documentos')
      .select('*, documentos_tipos(nombre, categoria_legajo, periodicidad), personas_directorio(nombre, apellido, legajo)')
      .in('persona_id', personaIds)
      .order('created_at', { ascending: false })
    trabajadorDocumentos = (empDocs ?? []) as unknown as EmpleadoDocumentoLegajo[]
  }

  return {
    establecimiento: establecimiento as unknown as Establecimiento,
    sectores,
    incidentes,
    inspecciones,
    documentos,
    documentTypes,
    denuncias,
    feedbackClientes,
    empresaDocumentos,
    gestionesLegajo,
    trabajadorDocumentos,
    planoUrl: (establecimiento as unknown as Establecimiento).plano_url ?? null,
  }
}
