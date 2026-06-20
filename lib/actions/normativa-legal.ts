'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { uploadAsset } from '@/lib/storage/upload'
import type { ActionResult } from '@/lib/types'

// ============================================================
// TIPOS
// ============================================================

export type NormativaAmbito = 'Nacional' | 'Provincial' | 'Municipal' | 'Internacional' | 'Interno'
export type NormativaTipo =
  | 'Ley'
  | 'Decreto'
  | 'Resolución'
  | 'Disposición'
  | 'Laudo'
  | 'Reglamento'
  | 'Ordenanza'
  | 'Otro'
export type NormativaEstado = 'Vigente' | 'Modificada' | 'Derogada'

export interface NormativaCategoria {
  id: string
  consultora_id: string | null
  nombre: string
  ambito: NormativaAmbito
  orden: number | null
}

export interface NormativaCategoriaConConteo extends NormativaCategoria {
  normas_count: number
}

export interface NormativaNorma {
  id: string
  consultora_id: string | null
  categoria_id: string | null
  tipo: NormativaTipo
  numero: string | null
  anio: number | null
  titulo: string
  nombre_completo: string | null
  organismo: string | null
  ambito: NormativaAmbito
  url_oficial: string | null
  pdf_path: string | null
  estado: NormativaEstado
  modificaciones: string | null
  descripcion: string | null
  aplica_a_todos: boolean
  airtable_id: string | null
  orden: number | null
}

export interface TipoEstablecimientoRef {
  codigo: string
  nombre: string
}

export interface NormativaNormaConConteo extends NormativaNorma {
  requisitos_count: number
  tipos: TipoEstablecimientoRef[]
}

export interface NormativaRequisito {
  id: string
  norma_id: string
  articulo: string | null
  descripcion_corta: string | null
  descripcion_oficial: string | null
  code: string | null
  orden: number | null
}

export interface TipoEstablecimientoOption {
  id: string
  codigo: string
  nombre: string
}

export interface NormativaFiltros {
  categoria_id?: string | null
  /** Tipos seleccionados. Si están todos (o el array está vacío) no se filtra por tipo. */
  tipos?: string[]
  /** Ámbitos seleccionados. Si están todos (o el array está vacío) no se filtra por ámbito. */
  ambitos?: string[]
  /** Estados seleccionados. Si están todos (o el array está vacío) no se filtra por estado. */
  estados?: string[]
  /**
   * Ids de tipos de establecimiento seleccionados. Una norma aplica si
   * `aplica_a_todos = true` OR tiene una fila en
   * `normativa_normas_tipos_establecimiento` con un tipo seleccionado.
   * Si están todos (o el array está vacío) no se filtra.
   */
  tiposEstablecimiento?: string[]
  search?: string | null
}

const REVALIDATE_PATH = '/dashboard/configuracion/normativa-legal'

// ============================================================
// HELPERS
// ============================================================

async function getConsultoraId(): Promise<ActionResult<string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: member } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!member) return { success: false, error: 'Sin membresía activa' }
  return { success: true, data: member.consultora_id }
}

/**
 * ¿El usuario puede administrar las librerías base (filas consultora_id NULL)?
 * Espeja la función SQL puede_gestionar_librerias() — la RLS es el firewall real;
 * acá solo evitamos disparar mutaciones que la RLS rechazaría.
 */
async function puedeGestionarLibreriasServer(): Promise<boolean> {
  const role = await getEffectiveRole()
  return role?.puedeGestionarLibrerias ?? false
}

// ============================================================
// CATEGORÍAS (base nacional + de la consultora) con conteo de normas
// ============================================================

export async function getNormativaCategorias(): Promise<ActionResult<NormativaCategoriaConConteo[]>> {
  const supabase = await createClient()

  // RLS ya filtra: consultora_id IS NULL (base) OR consultora del usuario.
  const { data, error } = await supabase
    .from('normativa_categorias')
    .select('id, consultora_id, nombre, ambito, orden, normativa_normas(count)')
    .order('orden', { ascending: true, nullsFirst: false })
    .order('nombre', { ascending: true })

  if (error) return { success: false, error: error.message }

  const categorias: NormativaCategoriaConConteo[] = (data ?? []).map((c) => {
    // Supabase devuelve el conteo embebido como [{ count: number }]
    const rel = c.normativa_normas as unknown as { count: number }[] | null
    const normas_count = Array.isArray(rel) && rel.length > 0 ? rel[0].count : 0
    return {
      id: c.id,
      consultora_id: c.consultora_id,
      nombre: c.nombre,
      ambito: c.ambito as NormativaAmbito,
      orden: c.orden,
      normas_count,
    }
  })

  return { success: true, data: categorias }
}

// ============================================================
// TIPOS DE ESTABLECIMIENTO (para el filtro de aplicabilidad)
// ============================================================

export async function getTiposEstablecimiento(): Promise<ActionResult<TipoEstablecimientoOption[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('establecimientos_tipos')
    .select('id, codigo, nombre')
    .order('nombre', { ascending: true })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as TipoEstablecimientoOption[] }
}

// ============================================================
// NORMAS (base + consultora) con filtros + conteo de requisitos
// ============================================================

/**
 * Decide si un filtro multi-select debe aplicarse: solo cuando la selección NO
 * está vacía Y NO contiene todas las opciones disponibles. En cualquier otro
 * caso (vacío o "todas") se considera "sin filtro".
 */
function shouldFilter(selected: string[] | undefined, totalOptions: number): selected is string[] {
  return Array.isArray(selected) && selected.length > 0 && selected.length < totalOptions
}

const TOTAL_TIPOS = 8 // NORMATIVA_TIPOS
const TOTAL_AMBITOS = 5 // NORMATIVA_AMBITOS
const TOTAL_ESTADOS = 3 // NORMATIVA_ESTADOS

export async function getNormativaNormas(
  filtros: NormativaFiltros = {},
): Promise<ActionResult<NormativaNormaConConteo[]>> {
  const supabase = await createClient()

  // --- Filtro por tipo de establecimiento -------------------------------
  // Una norma aplica si aplica_a_todos = true OR tiene un join a un tipo
  // seleccionado. Solo filtramos si la selección es un subconjunto propio.
  let normaIdsPorTipoEst: string[] | null = null
  if (filtros.tiposEstablecimiento && filtros.tiposEstablecimiento.length > 0) {
    const { count: totalTiposEst } = await supabase
      .from('establecimientos_tipos')
      .select('id', { count: 'exact', head: true })

    const total = totalTiposEst ?? 0
    if (total === 0 || filtros.tiposEstablecimiento.length < total) {
      // Normas con join a alguno de los tipos seleccionados.
      const { data: joinRows, error: joinErr } = await supabase
        .from('normativa_normas_tipos_establecimiento')
        .select('norma_id')
        .in('tipo_establecimiento_id', filtros.tiposEstablecimiento)

      if (joinErr) return { success: false, error: joinErr.message }

      // Normas que aplican a todos (siempre matchean cualquier tipo).
      const { data: todosRows, error: todosErr } = await supabase
        .from('normativa_normas')
        .select('id')
        .eq('aplica_a_todos', true)

      if (todosErr) return { success: false, error: todosErr.message }

      const ids = new Set<string>()
      for (const r of joinRows ?? []) ids.add((r as { norma_id: string }).norma_id)
      for (const r of todosRows ?? []) ids.add((r as { id: string }).id)
      normaIdsPorTipoEst = [...ids]

      // Sin coincidencias → devolvemos vacío sin disparar la query principal.
      if (normaIdsPorTipoEst.length === 0) return { success: true, data: [] }
    }
  }

  let query = supabase
    .from('normativa_normas')
    .select(
      'id, consultora_id, categoria_id, tipo, numero, anio, titulo, nombre_completo, organismo, ambito, url_oficial, pdf_path, estado, modificaciones, descripcion, aplica_a_todos, airtable_id, orden, normativa_requisitos(count), normativa_normas_tipos_establecimiento(establecimientos_tipos(codigo, nombre))',
    )

  if (filtros.categoria_id) query = query.eq('categoria_id', filtros.categoria_id)
  if (shouldFilter(filtros.tipos, TOTAL_TIPOS)) query = query.in('tipo', filtros.tipos)
  if (shouldFilter(filtros.ambitos, TOTAL_AMBITOS)) query = query.in('ambito', filtros.ambitos)
  if (shouldFilter(filtros.estados, TOTAL_ESTADOS)) query = query.in('estado', filtros.estados)
  if (normaIdsPorTipoEst) query = query.in('id', normaIdsPorTipoEst)

  const search = filtros.search?.trim()
  if (search) {
    // Escapamos comas/paréntesis que romperían el filtro `or` de PostgREST.
    const safe = search.replace(/[,()]/g, ' ')
    query = query.or(
      `titulo.ilike.%${safe}%,numero.ilike.%${safe}%,nombre_completo.ilike.%${safe}%,organismo.ilike.%${safe}%`,
    )
  }

  const { data, error } = await query
    .order('anio', { ascending: false, nullsFirst: false })
    .order('numero', { ascending: false, nullsFirst: false })

  if (error) return { success: false, error: error.message }

  const normas: NormativaNormaConConteo[] = (data ?? []).map((n) => {
    const rel = n.normativa_requisitos as unknown as { count: number }[] | null
    const requisitos_count = Array.isArray(rel) && rel.length > 0 ? rel[0].count : 0
    const tipoRel = n.normativa_normas_tipos_establecimiento as unknown as
      | { establecimientos_tipos: TipoEstablecimientoRef | null }[]
      | null
    const tipos: TipoEstablecimientoRef[] = Array.isArray(tipoRel)
      ? tipoRel
          .map((t) => t.establecimientos_tipos)
          .filter((t): t is TipoEstablecimientoRef => Boolean(t))
      : []
    return {
      id: n.id,
      consultora_id: n.consultora_id,
      categoria_id: n.categoria_id,
      tipo: n.tipo as NormativaTipo,
      numero: n.numero,
      anio: n.anio,
      titulo: n.titulo,
      nombre_completo: n.nombre_completo,
      organismo: n.organismo,
      ambito: n.ambito as NormativaAmbito,
      url_oficial: n.url_oficial,
      pdf_path: (n as { pdf_path?: string | null }).pdf_path ?? null,
      estado: n.estado as NormativaEstado,
      modificaciones: n.modificaciones,
      descripcion: n.descripcion,
      aplica_a_todos: n.aplica_a_todos,
      airtable_id: n.airtable_id,
      orden: n.orden,
      requisitos_count,
      tipos,
    }
  })

  return { success: true, data: normas }
}

// ============================================================
// REQUISITOS de una norma (ordenados por `orden`)
// ============================================================

export async function getRequisitosByNorma(
  normaId: string,
): Promise<ActionResult<NormativaRequisito[]>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('normativa_requisitos')
    .select('id, norma_id, articulo, descripcion_corta, descripcion_oficial, code, orden')
    .eq('norma_id', normaId)
    .order('orden', { ascending: true, nullsFirst: false })

  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []) as NormativaRequisito[] }
}

// ============================================================
// MUTACIONES
// - Normativa propia de la consultora: full_access (RLS por membresía).
// - Normativa base (consultora_id NULL): solo quien puede_gestionar_librerias()
//   (admin.main / developer). La RLS es el firewall; acá ramificamos para no
//   forzar el scope de consultora cuando la fila es base.
// ============================================================

interface NormativaInput {
  categoria_id: string | null
  tipo: NormativaTipo
  numero: string | null
  anio: number | null
  titulo: string
  nombre_completo: string | null
  organismo: string | null
  ambito: NormativaAmbito
  url_oficial: string | null
  estado: NormativaEstado
  modificaciones: string | null
}

function parseNormativaForm(formData: FormData): { ok: true; value: NormativaInput } | { ok: false; error: string } {
  const titulo = (formData.get('titulo') as string)?.trim()
  const tipo = formData.get('tipo') as NormativaTipo
  const ambito = formData.get('ambito') as NormativaAmbito
  const estado = (formData.get('estado') as NormativaEstado) || 'Vigente'

  if (!titulo) return { ok: false, error: 'El título es obligatorio' }
  if (!tipo) return { ok: false, error: 'El tipo es obligatorio' }
  if (!ambito) return { ok: false, error: 'El ámbito es obligatorio' }

  const anioRaw = (formData.get('anio') as string)?.trim()
  const anio = anioRaw ? Number.parseInt(anioRaw, 10) : null
  if (anioRaw && Number.isNaN(anio as number)) return { ok: false, error: 'El año debe ser un número' }

  const categoriaRaw = (formData.get('categoria_id') as string)?.trim()

  return {
    ok: true,
    value: {
      categoria_id: categoriaRaw || null,
      tipo,
      numero: ((formData.get('numero') as string)?.trim()) || null,
      anio,
      titulo,
      nombre_completo: ((formData.get('nombre_completo') as string)?.trim()) || null,
      organismo: ((formData.get('organismo') as string)?.trim()) || null,
      ambito,
      url_oficial: ((formData.get('url_oficial') as string)?.trim()) || null,
      estado,
      modificaciones: ((formData.get('modificaciones') as string)?.trim()) || null,
    },
  }
}

export async function createNormativa(formData: FormData): Promise<ActionResult<NormativaNorma>> {
  const supabase = await createClient()

  const parsed = parseNormativaForm(formData)
  if (!parsed.ok) return { success: false, error: parsed.error }

  // Validar que haya al menos URL o PDF.
  const pdfFile = formData.get('pdf')
  const hasPdf = pdfFile instanceof File && pdfFile.size > 0
  const hasUrl = Boolean(parsed.value.url_oficial)
  if (!hasUrl && !hasPdf) {
    return { success: false, error: 'Cargá una URL y/o un PDF (al menos uno).' }
  }

  // `as_base` = crear una norma de la librería base (consultora_id NULL).
  // Solo lo permite quien puede gestionar librerías; el resto crea normas propias.
  const asBase = formData.get('as_base') === 'true'

  let consultoraId: string | null
  if (asBase) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la normativa base' }
    }
    consultoraId = null
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    consultoraId = cId.data
  }

  // Insertar la norma primero para obtener el id (necesario para el path del PDF).
  const { data: insertData, error: insertError } = await supabase
    .from('normativa_normas')
    .insert({ ...parsed.value, consultora_id: consultoraId })
    .select('id, consultora_id, categoria_id, tipo, numero, anio, titulo, nombre_completo, organismo, ambito, url_oficial, pdf_path, estado, modificaciones, descripcion, aplica_a_todos, airtable_id, orden')
    .single()

  if (insertError) return { success: false, error: insertError.message }

  // Si viene PDF, subirlo y actualizar pdf_path.
  if (hasPdf) {
    // Para normas base (consultora_id NULL) usamos 'base' como segmento de consultora
    // ya que uploadAsset requiere un string no vacío y las normas base no pertenecen
    // a ninguna consultora. El path resultante es 'base/normativa/{id}/texto.pdf'.
    const uploadConsultoraId = consultoraId ?? 'base'
    const uploadResult = await uploadAsset({
      bucket: 'normativa',
      consultoraId: uploadConsultoraId,
      entityType: 'normativa',
      entityId: insertData.id,
      kind: 'texto',
      file: pdfFile,
    })

    if (!uploadResult.ok) {
      // El insert ya ocurrió; devolvemos la norma igual pero avisamos del error de PDF.
      return { success: false, error: `Normativa creada pero el PDF no se pudo subir: ${uploadResult.error}` }
    }

    const { error: updateError } = await supabase
      .from('normativa_normas')
      .update({ pdf_path: uploadResult.path })
      .eq('id', insertData.id)

    if (!updateError) {
      insertData.pdf_path = uploadResult.path
    }
  }

  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: insertData as NormativaNorma }
}

export async function updateNormativa(
  id: string,
  formData: FormData,
): Promise<ActionResult<NormativaNorma>> {
  const supabase = await createClient()

  const parsed = parseNormativaForm(formData)
  if (!parsed.ok) return { success: false, error: parsed.error }

  // Averiguamos si la fila es base (consultora_id NULL) o propia, y el pdf_path actual.
  const { data: target } = await supabase
    .from('normativa_normas')
    .select('consultora_id, pdf_path')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró la normativa o no es editable' }

  // Validar que haya al menos URL o PDF (nuevo o existente).
  const pdfFile = formData.get('pdf')
  const hasPdfNuevo = pdfFile instanceof File && pdfFile.size > 0
  const hasUrl = Boolean(parsed.value.url_oficial)
  const hasPdfExistente = Boolean((target as { pdf_path?: string | null }).pdf_path)
  if (!hasUrl && !hasPdfNuevo && !hasPdfExistente) {
    return { success: false, error: 'Cargá una URL y/o un PDF (al menos uno).' }
  }

  let consultoraId: string | null = null

  if (target.consultora_id === null) {
    // Fila base: solo quien puede gestionar librerías. La RLS confirma el permiso.
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la normativa base' }
    }
  } else {
    // Fila propia: acotamos al scope de la consultora del usuario.
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    consultoraId = cId.data
  }

  // Si viene PDF nuevo, subirlo antes del update para incluir el path en un solo UPDATE.
  let newPdfPath: string | undefined
  if (hasPdfNuevo) {
    const uploadConsultoraId = target.consultora_id ?? 'base'
    const uploadResult = await uploadAsset({
      bucket: 'normativa',
      consultoraId: uploadConsultoraId,
      entityType: 'normativa',
      entityId: id,
      kind: 'texto',
      file: pdfFile,
    })
    if (!uploadResult.ok) {
      return { success: false, error: `El PDF no se pudo subir: ${uploadResult.error}` }
    }
    newPdfPath = uploadResult.path
  }

  const updatePayload = {
    ...parsed.value,
    ...(newPdfPath !== undefined ? { pdf_path: newPdfPath } : {}),
  }

  let query = supabase.from('normativa_normas').update(updatePayload).eq('id', id)
  if (consultoraId) {
    query = query.eq('consultora_id', consultoraId)
  }

  const { data, error } = await query
    .select('id, consultora_id, categoria_id, tipo, numero, anio, titulo, nombre_completo, organismo, ambito, url_oficial, pdf_path, estado, modificaciones, descripcion, aplica_a_todos, airtable_id, orden')
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'No se encontró la normativa o no es editable' }
  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: data as NormativaNorma }
}

export async function deleteNormativa(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()

  const { data: target } = await supabase
    .from('normativa_normas')
    .select('consultora_id')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró la normativa o no es eliminable' }

  let query = supabase.from('normativa_normas').delete().eq('id', id)

  if (target.consultora_id === null) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la normativa base' }
    }
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    query = query.eq('consultora_id', cId.data)
  }

  const { error } = await query

  if (error) return { success: false, error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: null }
}

// ============================================================
// REQUISITOS — MUTACIONES
// La autorización se deriva de la norma padre:
//   - Norma base (consultora_id NULL): exige puedeGestionarLibrerias
//   - Norma propia: exige membresía activa en la consultora (full_access).
// La RLS es el firewall definitivo; acá pre-validamos para devolver mensajes
// claros sin esperar el error de Supabase.
// ============================================================

interface RequisitoInput {
  articulo: string | null
  descripcion_corta: string | null
  descripcion_oficial: string | null
  code: string | null
  orden: number | null
}

function parseRequisitoForm(formData: FormData): { ok: true; value: RequisitoInput } | { ok: false; error: string } {
  const articuloRaw = (formData.get('articulo') as string)?.trim()
  const descripcionCortaRaw = (formData.get('descripcion_corta') as string)?.trim()
  const descripcionOficialRaw = (formData.get('descripcion_oficial') as string)?.trim()
  const codeRaw = (formData.get('code') as string)?.trim()
  const ordenRaw = (formData.get('orden') as string)?.trim()

  // Al menos uno de los campos descriptivos debe tener contenido.
  if (!articuloRaw && !descripcionCortaRaw && !descripcionOficialRaw) {
    return { ok: false, error: 'Completá al menos el artículo o una descripción' }
  }

  const orden = ordenRaw ? Number.parseInt(ordenRaw, 10) : null
  if (ordenRaw && Number.isNaN(orden as number)) {
    return { ok: false, error: 'El orden debe ser un número' }
  }

  return {
    ok: true,
    value: {
      articulo: articuloRaw || null,
      descripcion_corta: descripcionCortaRaw || null,
      descripcion_oficial: descripcionOficialRaw || null,
      code: codeRaw || null,
      orden,
    },
  }
}

/**
 * Resuelve la consultora_id de la norma padre de un requisito.
 * Devuelve null si la norma es base (consultora_id NULL) o error si no existe.
 */
async function getConsultoraIdDeNorma(
  supabase: Awaited<ReturnType<typeof createClient>>,
  normaId: string,
): Promise<ActionResult<string | null>> {
  const { data: norma } = await supabase
    .from('normativa_normas')
    .select('consultora_id')
    .eq('id', normaId)
    .maybeSingle()

  if (!norma) return { success: false, error: 'No se encontró la norma asociada al requisito' }
  return { success: true, data: norma.consultora_id }
}

export async function createRequisito(
  normaId: string,
  formData: FormData,
): Promise<ActionResult<NormativaRequisito>> {
  const supabase = await createClient()

  const parsed = parseRequisitoForm(formData)
  if (!parsed.ok) return { success: false, error: parsed.error }

  const normaRes = await getConsultoraIdDeNorma(supabase, normaId)
  if (!normaRes.success) return normaRes

  // Norma base: solo quien gestiona librerías.
  if (normaRes.data === null) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar requisitos de la normativa base' }
    }
  } else {
    // Norma propia: verificamos membresía activa (RLS confirma el scope de consultora).
    const cId = await getConsultoraId()
    if (!cId.success) return cId
  }

  const { data, error } = await supabase
    .from('normativa_requisitos')
    .insert({ ...parsed.value, norma_id: normaId })
    .select('id, norma_id, articulo, descripcion_corta, descripcion_oficial, code, orden')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: data as NormativaRequisito }
}

export async function updateRequisito(
  id: string,
  formData: FormData,
): Promise<ActionResult<NormativaRequisito>> {
  const supabase = await createClient()

  const parsed = parseRequisitoForm(formData)
  if (!parsed.ok) return { success: false, error: parsed.error }

  // Leemos la norma padre a través del requisito.
  const { data: req } = await supabase
    .from('normativa_requisitos')
    .select('norma_id')
    .eq('id', id)
    .maybeSingle()

  if (!req) return { success: false, error: 'No se encontró el requisito o no es editable' }

  const normaRes = await getConsultoraIdDeNorma(supabase, req.norma_id)
  if (!normaRes.success) return normaRes

  if (normaRes.data === null) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar requisitos de la normativa base' }
    }
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
  }

  const { data, error } = await supabase
    .from('normativa_requisitos')
    .update(parsed.value)
    .eq('id', id)
    .select('id, norma_id, articulo, descripcion_corta, descripcion_oficial, code, orden')
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'No se encontró el requisito o no es editable' }
  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: data as NormativaRequisito }
}

export async function deleteRequisito(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()

  const { data: req } = await supabase
    .from('normativa_requisitos')
    .select('norma_id')
    .eq('id', id)
    .maybeSingle()

  if (!req) return { success: false, error: 'No se encontró el requisito o no es eliminable' }

  const normaRes = await getConsultoraIdDeNorma(supabase, req.norma_id)
  if (!normaRes.success) return normaRes

  if (normaRes.data === null) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar requisitos de la normativa base' }
    }
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
  }

  const { error } = await supabase.from('normativa_requisitos').delete().eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: null }
}
