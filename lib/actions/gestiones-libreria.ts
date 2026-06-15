'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'
import { LIMITE_GRUPOS, LIMITE_CATEGORIAS } from '@/lib/gestiones/limites'

const LIB_PATH = '/dashboard/libreria-gestiones'

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
// LECTURA — árbol híbrido (base NULL + propios de la consultora, vía RLS)
// ============================================================
export async function getLibreriaGestiones(): Promise<ActionResult<{
  grupos: any[]
  categorias: any[]
  gestiones: any[]
  consultoraId: string
}>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const [g, c, ge] = await Promise.all([
    supabase.from('gestiones_grupos').select('*').order('nombre'),
    supabase.from('gestiones_categorias').select('*').order('nombre'),
    supabase.from('gestiones').select('*').order('nombre'),
  ])

  if (g.error) return { success: false, error: g.error.message }
  if (c.error) return { success: false, error: c.error.message }
  if (ge.error) return { success: false, error: ge.error.message }

  return { success: true, data: { grupos: g.data ?? [], categorias: c.data ?? [], gestiones: ge.data ?? [], consultoraId: cId.data } }
}

// ============================================================
// GRUPOS (máx 4 propios — concepto genérico)
// ============================================================
export async function createGrupoGestion(nombre: string): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }

  const { data, error } = await supabase
    .from('gestiones_grupos')
    .insert({ nombre: n, consultora_id: cId.data })
    .select()
    .single()

  if (error) {
    if (error.message.includes('LIMITE_GRUPOS')) {
      return { success: false, error: `Llegaste al máximo de ${LIMITE_GRUPOS} grupos propios. Te sugerimos usar los grupos base — el tope existe para conservar el orden y que los reportes sean comparables entre consultoras.` }
    }
    if (error.code === '23505') return { success: false, error: 'Ya existe un grupo con ese nombre.' }
    return { success: false, error: error.message }
  }
  revalidatePath(LIB_PATH)
  return { success: true, data }
}

export async function updateGrupoGestion(id: string, nombre: string): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }

  // Solo propios (consultora_id del usuario). Los base (NULL) no se tocan acá.
  const { data, error } = await supabase
    .from('gestiones_grupos')
    .update({ nombre: n })
    .eq('id', id)
    .eq('consultora_id', cId.data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe un grupo con ese nombre.' }
    return { success: false, error: error.message }
  }
  revalidatePath(LIB_PATH)
  return { success: true, data }
}

export async function deleteGrupoGestion(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const { error } = await supabase
    .from('gestiones_grupos')
    .delete()
    .eq('id', id)
    .eq('consultora_id', cId.data)

  if (error) return { success: false, error: error.message }
  revalidatePath(LIB_PATH)
  return { success: true, data: null }
}

// ============================================================
// CATEGORÍAS (máx 14 propias)
// ============================================================
export async function createCategoriaGestion(
  nombre: string,
  grupoId: string,
  descripcion?: string,
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }
  if (!grupoId) return { success: false, error: 'Elegí un grupo' }

  const { data, error } = await supabase
    .from('gestiones_categorias')
    .insert({ nombre: n, grupo_id: grupoId, descripcion: descripcion?.trim() || null, consultora_id: cId.data })
    .select()
    .single()

  if (error) {
    if (error.message.includes('LIMITE_CATEGORIAS')) {
      return { success: false, error: `Llegaste al máximo de ${LIMITE_CATEGORIAS} categorías propias. Te sugerimos usar las categorías base — el tope existe para conservar el orden y que los reportes sean comparables.` }
    }
    if (error.code === '23505') return { success: false, error: 'Ya existe una categoría con ese nombre.' }
    return { success: false, error: error.message }
  }
  revalidatePath(LIB_PATH)
  return { success: true, data }
}

export async function updateCategoriaGestion(
  id: string,
  nombre: string,
  grupoId: string,
  descripcion?: string,
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }

  const { data, error } = await supabase
    .from('gestiones_categorias')
    .update({ nombre: n, grupo_id: grupoId, descripcion: descripcion?.trim() || null })
    .eq('id', id)
    .eq('consultora_id', cId.data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una categoría con ese nombre.' }
    return { success: false, error: error.message }
  }
  revalidatePath(LIB_PATH)
  return { success: true, data }
}

export async function deleteCategoriaGestion(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const { error } = await supabase
    .from('gestiones_categorias')
    .delete()
    .eq('id', id)
    .eq('consultora_id', cId.data)

  if (error) return { success: false, error: error.message }
  revalidatePath(LIB_PATH)
  return { success: true, data: null }
}

// ============================================================
// GESTIONES (sin límite)
// ============================================================
export async function createGestion(
  nombre: string,
  categoriaId: string,
  descripcion?: string,
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }
  if (!categoriaId) return { success: false, error: 'Elegí una categoría' }

  const { data, error } = await supabase
    .from('gestiones')
    .insert({ nombre: n, categoria_id: categoriaId, descripcion: descripcion?.trim() || null, consultora_id: cId.data })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una gestión con ese nombre.' }
    return { success: false, error: error.message }
  }
  revalidatePath(LIB_PATH)
  return { success: true, data }
}

export async function updateGestion(
  id: string,
  nombre: string,
  categoriaId: string,
  descripcion?: string,
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }

  const { data, error } = await supabase
    .from('gestiones')
    .update({ nombre: n, categoria_id: categoriaId, descripcion: descripcion?.trim() || null })
    .eq('id', id)
    .eq('consultora_id', cId.data)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una gestión con ese nombre.' }
    return { success: false, error: error.message }
  }
  revalidatePath(LIB_PATH)
  return { success: true, data }
}

export async function deleteGestion(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const { error } = await supabase
    .from('gestiones')
    .delete()
    .eq('id', id)
    .eq('consultora_id', cId.data)

  if (error) return { success: false, error: error.message }
  revalidatePath(LIB_PATH)
  return { success: true, data: null }
}
