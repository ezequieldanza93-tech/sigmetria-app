'use server'

import { createClient } from '@/lib/supabase/server'
import { getDocTiposAplicables, getDocTiposAplicablesEmpresa } from '@/lib/actions/aplicabilidad'
import type {
  ActionResult,
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
  CategoriaLegajo,
  PeriodicidadDoc,
  LegajoVersion,
  LegajoEsperadoRow,
  LegajoEsperadoPersona,
  LegajoEsperados,
} from '@/lib/types'

export interface EstablecimientoFichaData {
  establecimiento: Establecimiento
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
  legajoEsperados: LegajoEsperados
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
    supabase.from('denuncias').select('*, personas_directorio(nombre, apellido), denuncias_fotos(url)').eq('establecimiento_id', establecimientoId).order('fecha_denuncia', { ascending: false }),
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

  const denuncias = (d1.data ?? []) as unknown as Denuncia[]
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

  const legajoEsperados = await getLegajoEsperados(establecimientoId, empresaId)

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
    legajoEsperados,
    planoUrl: (establecimiento as unknown as Establecimiento).plano_url ?? null,
  }
}

// ============================================================
// Legajo Técnico como CHECKLIST de documentos ESPERADOS.
// Construye, para las 5 categorías de DOCUMENTOS (no la de gestiones), la lista
// FIJA de esperados (catálogo curado: documentos_tipos con periodicidad NOT NULL)
// y, por cada uno, su última instancia vigente cargada + todo su historial.
// ============================================================

// Catálogo de esperados de UNA categoría (lista fija, igual para todos).
type TipoEsperado = { id: string; nombre: string; periodicidad: PeriodicidadDoc | null }

// Instancia cruda vigente de cualquiera de las 3 tablas *_documentos.
type DocVigente = {
  id: string
  tipo_id: string | null
  archivo_url: string | null
  fecha_vencimiento: string | null
  fecha_emision: string | null
  created_at: string
}

type DocVigentePersona = DocVigente & {
  persona_id: string
  personas_documentos_archivos: { url: string }[] | null
  personas_directorio: { nombre: string; apellido: string; legajo: string | null; tipo_id: string | null } | null
}

const toVersion = (d: DocVigente): LegajoVersion => ({
  id: d.id,
  archivo_url: d.archivo_url,
  fecha_vencimiento: d.fecha_vencimiento,
  fecha_emision: d.fecha_emision,
  created_at: d.created_at,
})

// Para cada esperado: arma { tipo_id, nombre, periodicidad, ultimo, historial }.
// `instanciasPorTipo` ya viene ordenado por created_at DESC (más nueva primero).
function buildFilas(
  catalogo: TipoEsperado[],
  instanciasPorTipo: Map<string, DocVigente[]>
): LegajoEsperadoRow[] {
  return catalogo.map(t => {
    const versiones = (instanciasPorTipo.get(t.id) ?? []).map(toVersion)
    return {
      tipo_id: t.id,
      nombre: t.nombre,
      periodicidad: t.periodicidad,
      ultimo: versiones[0] ?? null,
      historial: versiones,
    }
  })
}

/**
 * Devuelve el checklist de documentos ESPERADOS del Legajo Técnico de un
 * establecimiento, con su último cargado y su historial.
 *
 * - Catálogo: documentos_tipos con is_active (incluye unica_vez), agrupado por
 *   categoria_legajo (que refleja `nivel`), filtrado por la matriz de
 *   aplicabilidad NUEVA (documentos_tipos_tipos_establecimiento) y por el
 *   overlay de la consultora (configuracion_vencimientos.activo). Las personas
 *   se filtran además por su tipo (documentos_tipos_tipos_persona).
 * - Vigentes: instancias de empresas/establecimientos/personas_documentos con
 *   deleted_at IS NULL, ordenadas por created_at DESC. El "último" = la primera.
 * - Las 2 categorías de persona se agrupan por persona.
 */
export async function getLegajoEsperados(
  establecimientoId: string,
  empresaId: string
): Promise<LegajoEsperados> {
  const supabase = await createClient()

  // 1) Catálogo curado de esperados (las 5 categorías de documentos).
  //    Fuente: documentos_tipos activos. Ya NO se exige periodicidad → entran
  //    también los de "única vez" (Actas, Relevamientos, etc.). El agrupamiento
  //    por categoria_legajo refleja el campo `nivel` (sincronizado por migración).
  const { data: catalogoRaw } = await supabase
    .from('documentos_tipos')
    .select('id, nombre, categoria_legajo, periodicidad, requiere_pregunta, pregunta_id')
    .eq('is_active', true)
    .order('nombre')

  // Overlay por consultora: los documentos que la consultora DESACTIVÓ del
  // seguimiento (configuracion_vencimientos.activo = false) se excluyen del
  // legajo. Sin fila = se sigue (default). Se matchea por nombre.
  const { data: empresaRow } = await supabase
    .from('empresas')
    .select('consultora_id')
    .eq('id', empresaId)
    .single()
  const desactivados = new Set<string>()
  if (empresaRow?.consultora_id) {
    const { data: cvOff } = await supabase
      .from('configuracion_vencimientos')
      .select('nombre')
      .eq('consultora_id', empresaRow.consultora_id)
      .eq('activo', false)
    for (const c of (cvOff ?? []) as { nombre: string }[]) desactivados.add(c.nombre)
  }

  // Actividad económica (CIIU) del establecimiento. Acota qué tipos de documento
  // se esperan: un tipo SIN filas en documentos_tipos_actividades aplica a TODAS
  // las actividades; CON filas, solo a las cargadas. Fetch chico dedicado.
  const { data: estabRow } = await supabase
    .from('establecimientos')
    .select('actividad_id')
    .eq('id', establecimientoId)
    .single()
  const actividadId = (estabRow as { actividad_id: string | null } | null)?.actividad_id ?? null

  // Mapeo tipo de documento → actividades CIIU permitidas (documentos_tipos_actividades).
  // Sin filas para un doc = aplica a todas las actividades. Con filas = solo si la
  // actividad del establecimiento está entre las cargadas.
  const { data: dtaData } = await supabase
    .from('documentos_tipos_actividades')
    .select('documento_tipo_id, actividad_id')
  const actividadesPorDoc = new Map<string, Set<string>>()
  for (const r of (dtaData ?? []) as { documento_tipo_id: string; actividad_id: string }[]) {
    const set = actividadesPorDoc.get(r.documento_tipo_id) ?? new Set<string>()
    set.add(r.actividad_id)
    actividadesPorDoc.set(r.documento_tipo_id, set)
  }

  // Respuestas del alta del establecimiento (gating de docs condicionales).
  const { data: respData } = await supabase
    .from('establecimientos_respuestas')
    .select('pregunta_id, respuesta')
    .eq('establecimiento_id', establecimientoId)
  const respuestas = new Map<string, boolean>()
  for (const r of (respData ?? []) as { pregunta_id: string; respuesta: boolean }[]) {
    respuestas.set(r.pregunta_id, r.respuesta)
  }

  // Preguntas extra por documento (N:N, OR con documentos_tipos.pregunta_id).
  const { data: dtpData } = await supabase
    .from('documentos_tipos_preguntas')
    .select('documento_tipo_id, pregunta_id')
  const preguntasPorDoc = new Map<string, string[]>()
  for (const r of (dtpData ?? []) as { documento_tipo_id: string; pregunta_id: string }[]) {
    const arr = preguntasPorDoc.get(r.documento_tipo_id) ?? []
    arr.push(r.pregunta_id)
    preguntasPorDoc.set(r.documento_tipo_id, arr)
  }

  // Override por establecimiento (force-in / force-out de documentos puntuales).
  const { data: ovData } = await supabase
    .from('establecimiento_documentos_override')
    .select('documento_tipo_id, incluido')
    .eq('establecimiento_id', establecimientoId)
  const overrideMap = new Map<string, boolean>()
  for (const o of (ovData ?? []) as { documento_tipo_id: string; incluido: boolean }[]) {
    overrideMap.set(o.documento_tipo_id, o.incluido)
  }

  const catalogoPorCat = new Map<CategoriaLegajo, TipoEsperado[]>()
  // Lookup de TODOS los docs activos (aunque queden gateados) — necesario para
  // poder force-INCLUIR un doc que el motor no computó.
  const catalogoRawById = new Map<string, { nombre: string; periodicidad: PeriodicidadDoc | null; categoria: CategoriaLegajo }>()
  for (const t of (catalogoRaw ?? []) as {
    id: string; nombre: string; categoria_legajo: CategoriaLegajo | null; periodicidad: PeriodicidadDoc | null
    requiere_pregunta?: boolean; pregunta_id?: string | null
  }[]) {
    if (!t.categoria_legajo) continue
    catalogoRawById.set(t.id, { nombre: t.nombre, periodicidad: t.periodicidad, categoria: t.categoria_legajo })
    if (desactivados.has(t.nombre)) continue
    // Gating por actividad económica (CIIU): si el doc tiene actividades mapeadas,
    // solo se espera cuando el establecimiento tiene una actividad cargada y está
    // entre las mapeadas. Sin mapeo (set vacío/inexistente) → aplica a todas.
    const actividadesDoc = actividadesPorDoc.get(t.id)
    if (actividadesDoc && actividadesDoc.size > 0) {
      if (!actividadId || !actividadesDoc.has(actividadId)) continue
    }
    // Gating condicional (OR): si el doc requiere pregunta, entra cuando el
    // establecimiento respondió SÍ a CUALQUIERA de sus preguntas vinculadas
    // (pregunta_id simple + join N:N). Sin preguntas vinculadas → aplica siempre.
    if (t.requiere_pregunta) {
      const linked = [...(t.pregunta_id ? [t.pregunta_id] : []), ...(preguntasPorDoc.get(t.id) ?? [])]
      if (linked.length > 0 && !linked.some((pid) => respuestas.get(pid) === true)) continue
    }
    const arr = catalogoPorCat.get(t.categoria_legajo) ?? []
    arr.push({ id: t.id, nombre: t.nombre, periodicidad: t.periodicidad })
    catalogoPorCat.set(t.categoria_legajo, arr)
  }
  const cat = (c: CategoriaLegajo): TipoEsperado[] => catalogoPorCat.get(c) ?? []

  // Aplica el override sobre una categoría ya computada: saca los force-out
  // (incluido=false) y agrega los force-in (incluido=true) de esa categoría.
  const withOverride = (categoria: CategoriaLegajo, lista: TipoEsperado[]): TipoEsperado[] => {
    const out = lista.filter(t => overrideMap.get(t.id) !== false)
    const present = new Set(out.map(t => t.id))
    for (const [docId, incluido] of overrideMap) {
      if (incluido !== true || present.has(docId)) continue
      const meta = catalogoRawById.get(docId)
      if (meta && meta.categoria === categoria) {
        out.push({ id: docId, nombre: meta.nombre, periodicidad: meta.periodicidad })
      }
    }
    return out
  }

  // Mapeo tipo de persona → documentos (documentos_tipos_tipos_persona).
  // Tabla vacía globalmente → no se filtra (todas las personas ven el catálogo
  // persona completo). Con datos → cada persona ve solo los docs mapeados a SU
  // tipo (sin filas para su tipo = ese tipo no requiere documentación).
  const { data: mapPersonaRaw } = await supabase
    .from('documentos_tipos_tipos_persona')
    .select('documento_tipo_id, tipo_persona_id')
  const mapPorTipoPersona = new Map<string, Set<string>>()
  for (const r of (mapPersonaRaw ?? []) as { documento_tipo_id: string; tipo_persona_id: string }[]) {
    const set = mapPorTipoPersona.get(r.tipo_persona_id) ?? new Set<string>()
    set.add(r.documento_tipo_id)
    mapPorTipoPersona.set(r.tipo_persona_id, set)
  }
  const mappingPersonaActivo = (mapPersonaRaw ?? []).length > 0

  // 1.b) Sets de tipos APLICABLES por la matriz nueva de aplicabilidad.
  //  - establecimiento: getDocTiposAplicables (matriz documento↔tipo de estab)
  //  - empresa / empresa_por_establecimiento: sin filtro por rubro (todas) → [].
  // Las categorías persona* se filtran por tipo de persona más abajo.
  const [aplicablesEstabList, aplicablesEmpresaIds] = await Promise.all([
    getDocTiposAplicables(establecimientoId),
    getDocTiposAplicablesEmpresa(empresaId),
  ])
  const setEstab = new Set(aplicablesEstabList.map(dt => dt.id))
  const setEmpresa = new Set(aplicablesEmpresaIds)

  // Filtra el catálogo curado de una categoría por el set aplicable.
  // FALLBACK: si no hay datos maestros (set vacío) o el filtro deja la categoría
  // vacía, devuelve el catálogo curado completo (no romper UX con maestros incompletos).
  const filtrarConFallback = (catalogo: TipoEsperado[], aplicables: Set<string>): TipoEsperado[] => {
    if (aplicables.size === 0) return catalogo
    const filtrado = catalogo.filter(t => aplicables.has(t.id))
    return filtrado.length > 0 ? filtrado : catalogo
  }

  // 2) Personas del establecimiento (para las categorías persona*). Traemos
  //    también su directorio para poder listar a TODAS (incluso sin docs → pendiente).
  const { data: peData } = await supabase
    .from('personas_establecimientos')
    .select('persona_id, personas_directorio(nombre, apellido, legajo, tipo_id)')
    .eq('establecimiento_id', establecimientoId)
  const personasEstab = (peData ?? []) as unknown as {
    persona_id: string
    personas_directorio: { nombre: string; apellido: string; legajo: string | null; tipo_id: string | null } | null
  }[]
  const personaIds = personasEstab.map(p => p.persona_id)

  // 3) Instancias vigentes (deleted_at IS NULL), ordenadas DESC por created_at.
  const docSelect = 'id, tipo_id, archivo_url, fecha_vencimiento, fecha_emision, created_at, documentos_tipos(nombre, categoria_legajo, periodicidad)'
  const personaSelect = 'id, tipo_id, persona_id, personas_documentos_archivos(url), fecha_vencimiento, fecha_emision, created_at, documentos_tipos(nombre, categoria_legajo, periodicidad), personas_directorio(nombre, apellido, legajo, tipo_id)'

  const [empRes, estRes, perRes] = await Promise.all([
    supabase
      .from('empresas_documentos')
      .select(docSelect)
      .eq('empresa_id', empresaId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('establecimientos_documentos')
      .select(docSelect)
      .eq('establecimiento_id', establecimientoId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false }),
    personaIds.length > 0
      ? supabase
          .from('personas_documentos')
          .select(personaSelect)
          .in('persona_id', personaIds)
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as DocVigentePersona[] }),
  ])

  // Empresa: separar por categoria_legajo del tipo (empresa vs empresa_por_establecimiento).
  const empresaPorTipo = new Map<string, DocVigente[]>()
  const empresaEstabPorTipo = new Map<string, DocVigente[]>()
  for (const d of (empRes.data ?? []) as unknown as (DocVigente & { documentos_tipos: { categoria_legajo?: CategoriaLegajo | null } | null })[]) {
    if (!d.tipo_id) continue
    const target = d.documentos_tipos?.categoria_legajo === 'empresa_por_establecimiento' ? empresaEstabPorTipo : empresaPorTipo
    const arr = target.get(d.tipo_id) ?? []
    arr.push(d)
    target.set(d.tipo_id, arr)
  }

  // Establecimiento.
  const estabPorTipo = new Map<string, DocVigente[]>()
  for (const d of (estRes.data ?? []) as unknown as DocVigente[]) {
    if (!d.tipo_id) continue
    const arr = estabPorTipo.get(d.tipo_id) ?? []
    arr.push(d)
    estabPorTipo.set(d.tipo_id, arr)
  }

  // Personas: agrupar por persona_id y dentro por categoria_legajo del tipo.
  // persona -> { categoria -> (tipo_id -> versiones) }
  const personaData = (perRes.data ?? []) as unknown as DocVigentePersona[]
  const porPersona = new Map<string, {
    persona: DocVigentePersona['personas_directorio']
    persona_tipo_id: string | null
    persona_legajo: Map<string, DocVigente[]>
    persona_estab: Map<string, DocVigente[]>
  }>()
  // Sembrar TODAS las personas del establecimiento (aunque no tengan docs → pendiente).
  for (const p of personasEstab) {
    porPersona.set(p.persona_id, {
      persona: p.personas_directorio,
      persona_tipo_id: p.personas_directorio?.tipo_id ?? null,
      persona_legajo: new Map(),
      persona_estab: new Map(),
    })
  }
  for (const d of personaData) {
    if (!d.tipo_id) continue
    const catLegajo = (d as unknown as { documentos_tipos: { categoria_legajo?: CategoriaLegajo | null } | null }).documentos_tipos?.categoria_legajo
    // Normalizar archivo_url desde la tabla hija (post-migración 1FN).
    const dNorm: DocVigente = { ...d, archivo_url: d.personas_documentos_archivos?.[0]?.url ?? null }
    let entry = porPersona.get(d.persona_id)
    if (!entry) {
      entry = { persona: d.personas_directorio, persona_tipo_id: d.personas_directorio?.tipo_id ?? null, persona_legajo: new Map(), persona_estab: new Map() }
      porPersona.set(d.persona_id, entry)
    }
    const target = catLegajo === 'persona_por_establecimiento' ? entry.persona_estab : entry.persona_legajo
    const arr = target.get(d.tipo_id) ?? []
    arr.push(dNorm)
    target.set(d.tipo_id, arr)
  }

  // 4) Construir las filas de persona: por CADA persona, el catálogo fijo de esa categoría.
  const buildPersonas = (
    catalogo: TipoEsperado[],
    pick: (e: { persona_legajo: Map<string, DocVigente[]>; persona_estab: Map<string, DocVigente[]> }) => Map<string, DocVigente[]>
  ): LegajoEsperadoPersona[] => {
    const out: LegajoEsperadoPersona[] = []
    for (const [persona_id, entry] of porPersona) {
      // Filtrar el catálogo persona por el TIPO de la persona (si hay mapeo).
      let catalogoPersona = catalogo
      if (mappingPersonaActivo) {
        const permitidos = entry.persona_tipo_id
          ? mapPorTipoPersona.get(entry.persona_tipo_id) ?? new Set<string>()
          : new Set<string>()
        catalogoPersona = catalogo.filter(t => permitidos.has(t.id))
      }
      out.push({
        persona_id,
        persona: entry.persona,
        filas: buildFilas(catalogoPersona, pick(entry)),
      })
    }
    // Orden estable por apellido/nombre.
    out.sort((a, b) => {
      const an = `${a.persona?.apellido ?? ''} ${a.persona?.nombre ?? ''}`.trim()
      const bn = `${b.persona?.apellido ?? ''} ${b.persona?.nombre ?? ''}`.trim()
      return an.localeCompare(bn)
    })
    return out
  }

  return {
    empresa: buildFilas(withOverride('empresa', filtrarConFallback(cat('empresa'), setEmpresa)), empresaPorTipo),
    empresa_por_establecimiento: buildFilas(withOverride('empresa_por_establecimiento', filtrarConFallback(cat('empresa_por_establecimiento'), setEmpresa)), empresaEstabPorTipo),
    establecimiento: buildFilas(withOverride('establecimiento', filtrarConFallback(cat('establecimiento'), setEstab)), estabPorTipo),
    persona: buildPersonas(cat('persona'), e => e.persona_legajo),
    persona_por_establecimiento: buildPersonas(cat('persona_por_establecimiento'), e => e.persona_estab),
  }
}

/**
 * Override del legajo para un establecimiento puntual.
 *   incluido = true  → forzar INCLUIR el documento aunque el motor no lo compute.
 *   incluido = false → forzar EXCLUIR el documento aunque el motor lo compute.
 *   incluido = null  → quitar el override (vuelve a lo que computa el motor).
 */
export async function setDocumentoOverride(
  establecimientoId: string,
  documentoTipoId: string,
  incluido: boolean | null,
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()

  if (incluido === null) {
    const { error } = await supabase
      .from('establecimiento_documentos_override')
      .delete()
      .eq('establecimiento_id', establecimientoId)
      .eq('documento_tipo_id', documentoTipoId)
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  const { error } = await supabase
    .from('establecimiento_documentos_override')
    .upsert(
      {
        establecimiento_id: establecimientoId,
        documento_tipo_id: documentoTipoId,
        incluido,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'establecimiento_id,documento_tipo_id' },
    )
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/**
 * Crea un tipo de documento PROPIO de la consultora (custom, no global) y queda
 * disponible en el legajo de sus establecimientos. consultora_id se toma de la
 * empresa. nivel define la categoría del legajo y el aplica_* (exactamente uno).
 */
export async function createDocumentoCustom(
  empresaId: string,
  input: { nombre: string; nivel: 'empresa' | 'establecimiento' | 'persona'; periodicidad?: PeriodicidadDoc | null },
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createClient()

  const nombre = input.nombre.trim()
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }

  const { data: emp } = await supabase.from('empresas').select('consultora_id').eq('id', empresaId).single()
  const consultoraId = (emp as { consultora_id: string } | null)?.consultora_id
  if (!consultoraId) return { success: false, error: 'No se pudo determinar la consultora' }

  const map = {
    empresa: { categoria_legajo: 'empresa', aplica_empresa: true, aplica_establecimiento: false, aplica_empleado: false },
    establecimiento: { categoria_legajo: 'establecimiento', aplica_empresa: false, aplica_establecimiento: true, aplica_empleado: false },
    persona: { categoria_legajo: 'persona', aplica_empresa: false, aplica_establecimiento: false, aplica_empleado: true },
  }[input.nivel]

  const { error } = await supabase.from('documentos_tipos').insert({
    consultora_id: consultoraId,
    nombre,
    nivel: input.nivel,
    categoria_legajo: map.categoria_legajo,
    aplica_empresa: map.aplica_empresa,
    aplica_establecimiento: map.aplica_establecimiento,
    aplica_empleado: map.aplica_empleado,
    periodicidad: input.periodicidad ?? null,
    vigencia_tipo: input.periodicidad ? 'periodica' : 'unica_vez',
    pais_id: 'AR',
    is_active: true,
    requiere_pregunta: false,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

/** Overrides del legajo de un establecimiento (con el nombre del documento). */
export async function getDocumentoOverrides(
  establecimientoId: string,
): Promise<{ documento_tipo_id: string; incluido: boolean; nombre: string }[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('establecimiento_documentos_override')
    .select('documento_tipo_id, incluido, documentos_tipos(nombre)')
    .eq('establecimiento_id', establecimientoId)
  return ((data ?? []) as unknown as {
    documento_tipo_id: string
    incluido: boolean
    documentos_tipos: { nombre: string } | null
  }[]).map(o => ({
    documento_tipo_id: o.documento_tipo_id,
    incluido: o.incluido,
    nombre: o.documentos_tipos?.nombre ?? 'Documento',
  }))
}

// ============================================================
// F2 . Sello de revision del Legajo Tecnico (cadena de custodia).
// Un profesional "confirma" que reviso el legajo auto-armado. Queda el timestamp
// + el autor. Mientras legajo_revisado_at sea NULL -> revision pendiente.
// ============================================================

/** Estado de revision del legajo de un establecimiento + nombre del revisor. */
export interface LegajoRevision {
  revisado_at: string | null
  revisado_by: string | null
  revisor_nombre: string | null
}

export async function getLegajoRevision(
  establecimientoId: string,
): Promise<LegajoRevision> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('establecimientos')
    .select('legajo_revisado_at, legajo_revisado_by')
    .eq('id', establecimientoId)
    .single()

  const row = (data ?? null) as { legajo_revisado_at: string | null; legajo_revisado_by: string | null } | null
  if (!row) return { revisado_at: null, revisado_by: null, revisor_nombre: null }

  let revisor_nombre: string | null = null
  if (row.legajo_revisado_by) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', row.legajo_revisado_by)
      .single()
    revisor_nombre = (prof as { full_name: string | null } | null)?.full_name ?? null
  }

  return {
    revisado_at: row.legajo_revisado_at,
    revisado_by: row.legajo_revisado_by,
    revisor_nombre,
  }
}

/**
 * Sella el Legajo Tecnico como revisado por el usuario actual (timestamp = ahora).
 * Es el "visto bueno" del profesional sobre el legajo auto-armado (Disp. 15/2026).
 * RLS: el UPDATE pasa por has_establecimiento_write_access del establecimiento.
 */
export async function confirmarLegajo(
  establecimientoId: string,
): Promise<ActionResult<{ revisado_at: string; revisor_nombre: string | null }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const revisado_at = new Date().toISOString()
  const { error } = await supabase
    .from('establecimientos')
    .update({ legajo_revisado_at: revisado_at, legajo_revisado_by: user.id })
    .eq('id', establecimientoId)

  if (error) return { success: false, error: error.message }

  const { data: prof } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single()
  const revisor_nombre = (prof as { full_name: string | null } | null)?.full_name ?? null

  return { success: true, data: { revisado_at, revisor_nombre } }
}

// ============================================================
// B2 . Catalogo global para el modal "force-in".
// Lista TODOS los docs activos del catalogo (genericos Sigmetria + propios de la
// consultora), agrupados por categoria, marcando cuales YA estan computados en el
// legajo de este establecimiento. El modal dispara setDocumentoOverride(incluido=true)
// para los que el profesional quiera agregar a mano aunque el motor no los compute.
// ============================================================

/** Un item del catalogo global para el modal de "agregar del catalogo". */
export interface CatalogoGlobalItem {
  tipo_id: string
  nombre: string
  categoria: CategoriaLegajo
  periodicidad: PeriodicidadDoc | null
  /** Ya esta en el legajo computado (motor) o forzado (override incluido=true). */
  ya_incluido: boolean
}

export async function getCatalogoGlobal(
  establecimientoId: string,
  empresaId: string,
): Promise<CatalogoGlobalItem[]> {
  const supabase = await createClient()

  // Consultora de la empresa: el catalogo = genericos (consultora_id IS NULL) +
  // propios de esta consultora.
  const { data: empresaRow } = await supabase
    .from('empresas')
    .select('consultora_id')
    .eq('id', empresaId)
    .single()
  const consultoraId = (empresaRow as { consultora_id: string | null } | null)?.consultora_id ?? null

  let query = supabase
    .from('documentos_tipos')
    .select('id, nombre, categoria_legajo, periodicidad, consultora_id')
    .eq('is_active', true)
    .order('nombre')
  query = consultoraId
    ? query.or(`consultora_id.is.null,consultora_id.eq.${consultoraId}`)
    : query.is('consultora_id', null)
  const { data: catalogoRaw } = await query

  // Lo que YA esta en el legajo (computado por el motor + force-in vigentes):
  // reunimos los tipo_id de todas las categorias de esperados.
  const legajo = await getLegajoEsperados(establecimientoId, empresaId)
  const yaIncluidos = new Set<string>()
  const addFilas = (filas: LegajoEsperadoRow[]) => filas.forEach(f => yaIncluidos.add(f.tipo_id))
  addFilas(legajo.empresa)
  addFilas(legajo.empresa_por_establecimiento)
  addFilas(legajo.establecimiento)
  legajo.persona.forEach(p => addFilas(p.filas))
  legajo.persona_por_establecimiento.forEach(p => addFilas(p.filas))

  return ((catalogoRaw ?? []) as {
    id: string; nombre: string; categoria_legajo: CategoriaLegajo | null; periodicidad: PeriodicidadDoc | null
  }[])
    .filter(t => t.categoria_legajo !== null)
    .map(t => ({
      tipo_id: t.id,
      nombre: t.nombre,
      categoria: t.categoria_legajo as CategoriaLegajo,
      periodicidad: t.periodicidad,
      ya_incluido: yaIncluidos.has(t.id),
    }))
}
