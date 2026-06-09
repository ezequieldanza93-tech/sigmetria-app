'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
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
  estado: NormativaEstado
  modificaciones: string | null
  airtable_id: string | null
  orden: number | null
}

export interface NormativaNormaConConteo extends NormativaNorma {
  requisitos_count: number
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

export interface NormativaFiltros {
  categoria_id?: string | null
  tipo?: NormativaTipo | null
  ambito?: NormativaAmbito | null
  estado?: NormativaEstado | null
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
// NORMAS (base + consultora) con filtros + conteo de requisitos
// ============================================================

export async function getNormativaNormas(
  filtros: NormativaFiltros = {},
): Promise<ActionResult<NormativaNormaConConteo[]>> {
  const supabase = await createClient()

  let query = supabase
    .from('normativa_normas')
    .select(
      'id, consultora_id, categoria_id, tipo, numero, anio, titulo, nombre_completo, organismo, ambito, url_oficial, estado, modificaciones, airtable_id, orden, normativa_requisitos(count)',
    )

  if (filtros.categoria_id) query = query.eq('categoria_id', filtros.categoria_id)
  if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
  if (filtros.ambito) query = query.eq('ambito', filtros.ambito)
  if (filtros.estado) query = query.eq('estado', filtros.estado)

  const search = filtros.search?.trim()
  if (search) {
    // Escapamos comas/paréntesis que romperían el filtro `or` de PostgREST.
    const safe = search.replace(/[,()]/g, ' ')
    query = query.or(
      `titulo.ilike.%${safe}%,numero.ilike.%${safe}%,nombre_completo.ilike.%${safe}%,organismo.ilike.%${safe}%`,
    )
  }

  const { data, error } = await query
    .order('orden', { ascending: true, nullsFirst: false })
    .order('anio', { ascending: false, nullsFirst: false })
    .order('numero', { ascending: true })

  if (error) return { success: false, error: error.message }

  const normas: NormativaNormaConConteo[] = (data ?? []).map((n) => {
    const rel = n.normativa_requisitos as unknown as { count: number }[] | null
    const requisitos_count = Array.isArray(rel) && rel.length > 0 ? rel[0].count : 0
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
      estado: n.estado as NormativaEstado,
      modificaciones: n.modificaciones,
      airtable_id: n.airtable_id,
      orden: n.orden,
      requisitos_count,
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
// MUTACIONES — SOLO para normativa propia de la consultora.
// Las filas base (consultora_id NULL) son read-only (RLS exige is_developer()).
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
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const parsed = parseNormativaForm(formData)
  if (!parsed.ok) return { success: false, error: parsed.error }

  const { data, error } = await supabase
    .from('normativa_normas')
    .insert({ ...parsed.value, consultora_id: cId.data })
    .select('id, consultora_id, categoria_id, tipo, numero, anio, titulo, nombre_completo, organismo, ambito, url_oficial, estado, modificaciones, airtable_id, orden')
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: data as NormativaNorma }
}

export async function updateNormativa(
  id: string,
  formData: FormData,
): Promise<ActionResult<NormativaNorma>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const parsed = parseNormativaForm(formData)
  if (!parsed.ok) return { success: false, error: parsed.error }

  // El filtro por consultora_id + RLS garantizan que no se toquen filas base.
  const { data, error } = await supabase
    .from('normativa_normas')
    .update(parsed.value)
    .eq('id', id)
    .eq('consultora_id', cId.data)
    .select('id, consultora_id, categoria_id, tipo, numero, anio, titulo, nombre_completo, organismo, ambito, url_oficial, estado, modificaciones, airtable_id, orden')
    .single()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'No se encontró la normativa o no es editable' }
  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: data as NormativaNorma }
}

export async function deleteNormativa(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const { error } = await supabase
    .from('normativa_normas')
    .delete()
    .eq('id', id)
    .eq('consultora_id', cId.data)

  if (error) return { success: false, error: error.message }
  revalidatePath(REVALIDATE_PATH)
  return { success: true, data: null }
}
