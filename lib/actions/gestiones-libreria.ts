'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { getEffectiveRole } from '@/lib/auth/effective-role'
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
// LECTURA — árbol híbrido (base NULL + propios de la consultora, vía RLS)
// ============================================================
export async function getLibreriaGestiones(): Promise<ActionResult<{
  grupos: any[]
  categorias: any[]
  gestiones: any[]
  checklistCategorias: any[]
  consultoraId: string
}>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const [g, c, ge, cc] = await Promise.all([
    supabase.from('gestiones_grupos').select('*').order('nombre'),
    supabase.from('gestiones_categorias').select('*').order('nombre'),
    supabase.from('gestiones').select('*').order('nombre'),
    supabase.from('gestiones_checklist_categorias').select('*').order('nombre'),
  ])

  if (g.error) return { success: false, error: g.error.message }
  if (c.error) return { success: false, error: c.error.message }
  if (ge.error) return { success: false, error: ge.error.message }
  if (cc.error) return { success: false, error: cc.error.message }

  return {
    success: true,
    data: {
      grupos: g.data ?? [],
      categorias: c.data ?? [],
      gestiones: ge.data ?? [],
      checklistCategorias: cc.data ?? [],
      consultoraId: cId.data,
    },
  }
}

// ============================================================
// GRUPOS
// - Propios (consultora_id = cId): full_access. Límite LIMITE_GRUPOS.
// - Base (consultora_id NULL): solo puedeGestionarLibrerias. Sin límite de consultora.
// Las filas BASE no cuentan contra el límite — el trigger SQL solo contabiliza
// filas con consultora_id NOT NULL.
// ============================================================
export async function createGrupoGestion(
  nombre: string,
  asBase = false,
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }

  let consultoraId: string | null
  if (asBase) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
    consultoraId = null
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    consultoraId = cId.data
  }

  const { data, error } = await supabase
    .from('gestiones_grupos')
    .insert({ nombre: n, consultora_id: consultoraId })
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
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }

  // Leemos el consultora_id del target para decidir cómo scopear la query.
  const { data: target } = await supabase
    .from('gestiones_grupos')
    .select('consultora_id')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró el grupo o no es editable' }

  let query = supabase.from('gestiones_grupos').update({ nombre: n }).eq('id', id)

  if (target.consultora_id === null) {
    // Fila base: solo quien puede gestionar librerías. RLS confirma el permiso.
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
  } else {
    // Fila propia: acotamos al scope de la consultora del usuario.
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    query = query.eq('consultora_id', cId.data)
  }

  const { data, error } = await query.select().maybeSingle()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe un grupo con ese nombre.' }
    return { success: false, error: error.message }
  }
  if (!data) return { success: false, error: 'No se encontró el grupo o no es editable' }
  revalidatePath(LIB_PATH)
  return { success: true, data }
}

export async function deleteGrupoGestion(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()

  const { data: target } = await supabase
    .from('gestiones_grupos')
    .select('consultora_id')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró el grupo o no es eliminable' }

  let query = supabase.from('gestiones_grupos').delete().eq('id', id)

  if (target.consultora_id === null) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    query = query.eq('consultora_id', cId.data)
  }

  const { error } = await query

  if (error) return { success: false, error: error.message }
  revalidatePath(LIB_PATH)
  return { success: true, data: null }
}

// ============================================================
// CATEGORÍAS
// - Propias: full_access. Límite LIMITE_CATEGORIAS (solo cuenta consultora_id NOT NULL).
// - Base: solo puedeGestionarLibrerias. Sin límite de consultora.
// ============================================================
export async function createCategoriaGestion(
  nombre: string,
  grupoId: string,
  descripcion?: string,
  asBase = false,
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }
  if (!grupoId) return { success: false, error: 'Elegí un grupo' }

  let consultoraId: string | null
  if (asBase) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
    consultoraId = null
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    consultoraId = cId.data
  }

  const { data, error } = await supabase
    .from('gestiones_categorias')
    .insert({ nombre: n, grupo_id: grupoId, descripcion: descripcion?.trim() || null, consultora_id: consultoraId })
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
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }

  const { data: target } = await supabase
    .from('gestiones_categorias')
    .select('consultora_id')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró la categoría o no es editable' }

  let query = supabase
    .from('gestiones_categorias')
    .update({ nombre: n, grupo_id: grupoId, descripcion: descripcion?.trim() || null })
    .eq('id', id)

  if (target.consultora_id === null) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    query = query.eq('consultora_id', cId.data)
  }

  const { data, error } = await query.select().maybeSingle()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una categoría con ese nombre.' }
    return { success: false, error: error.message }
  }
  if (!data) return { success: false, error: 'No se encontró la categoría o no es editable' }
  revalidatePath(LIB_PATH)
  return { success: true, data }
}

export async function deleteCategoriaGestion(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()

  const { data: target } = await supabase
    .from('gestiones_categorias')
    .select('consultora_id')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró la categoría o no es eliminable' }

  let query = supabase.from('gestiones_categorias').delete().eq('id', id)

  if (target.consultora_id === null) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    query = query.eq('consultora_id', cId.data)
  }

  const { error } = await query

  if (error) return { success: false, error: error.message }
  revalidatePath(LIB_PATH)
  return { success: true, data: null }
}

// ============================================================
// GESTIONES (sin límite)
// - Propias: full_access.
// - Base: solo puedeGestionarLibrerias.
// ============================================================
export async function createGestion(
  nombre: string,
  categoriaId: string,
  descripcion?: string,
  asBase = false,
  checklistCategoriaId?: string | null,
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }
  if (!categoriaId) return { success: false, error: 'Elegí una categoría' }

  let consultoraId: string | null
  if (asBase) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
    consultoraId = null
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    consultoraId = cId.data
  }

  const { data, error } = await supabase
    .from('gestiones')
    .insert({
      nombre: n,
      categoria_id: categoriaId,
      descripcion: descripcion?.trim() || null,
      consultora_id: consultoraId,
      checklist_categoria_id: checklistCategoriaId ?? null,
    })
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
  checklistCategoriaId?: string | null,
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }

  const { data: target } = await supabase
    .from('gestiones')
    .select('consultora_id')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró la gestión o no es editable' }

  let query = supabase
    .from('gestiones')
    .update({
      nombre: n,
      categoria_id: categoriaId,
      descripcion: descripcion?.trim() || null,
      checklist_categoria_id: checklistCategoriaId !== undefined ? checklistCategoriaId : undefined,
    })
    .eq('id', id)

  if (target.consultora_id === null) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    query = query.eq('consultora_id', cId.data)
  }

  const { data, error } = await query.select().maybeSingle()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una gestión con ese nombre.' }
    return { success: false, error: error.message }
  }
  if (!data) return { success: false, error: 'No se encontró la gestión o no es editable' }
  revalidatePath(LIB_PATH)
  return { success: true, data }
}

export async function deleteGestion(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()

  const { data: target } = await supabase
    .from('gestiones')
    .select('consultora_id')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró la gestión o no es eliminable' }

  let query = supabase.from('gestiones').delete().eq('id', id)

  if (target.consultora_id === null) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    query = query.eq('consultora_id', cId.data)
  }

  const { error } = await query

  if (error) return { success: false, error: error.message }
  revalidatePath(LIB_PATH)
  return { success: true, data: null }
}

// ============================================================
// CATEGORÍAS CHECKLIST (4to nivel, solo bajo categorías con sub-niveles)
// - Base (consultora_id NULL): solo puedeGestionarLibrerias.
// - Propias: full_access.
// ============================================================
export async function createChecklistCategoria(
  nombre: string,
  categoriaId: string,
  descripcion?: string,
  asBase = false,
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }
  if (!categoriaId) return { success: false, error: 'Elegí una categoría' }

  let consultoraId: string | null
  if (asBase) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
    consultoraId = null
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    consultoraId = cId.data
  }

  const { data, error } = await supabase
    .from('gestiones_checklist_categorias')
    .insert({ nombre: n, categoria_id: categoriaId, descripcion: descripcion?.trim() || null, consultora_id: consultoraId })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una categoría checklist con ese nombre.' }
    return { success: false, error: error.message }
  }
  revalidatePath(LIB_PATH)
  return { success: true, data }
}

export async function updateChecklistCategoria(
  id: string,
  nombre: string,
  descripcion?: string,
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }

  const { data: target } = await supabase
    .from('gestiones_checklist_categorias')
    .select('consultora_id')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró la categoría checklist o no es editable' }

  let query = supabase
    .from('gestiones_checklist_categorias')
    .update({ nombre: n, descripcion: descripcion?.trim() || null })
    .eq('id', id)

  if (target.consultora_id === null) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    query = query.eq('consultora_id', cId.data)
  }

  const { data, error } = await query.select().maybeSingle()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una categoría checklist con ese nombre.' }
    return { success: false, error: error.message }
  }
  if (!data) return { success: false, error: 'No se encontró la categoría checklist o no es editable' }
  revalidatePath(LIB_PATH)
  return { success: true, data }
}

export async function deleteChecklistCategoria(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()

  const { data: target } = await supabase
    .from('gestiones_checklist_categorias')
    .select('consultora_id')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró la categoría checklist o no es eliminable' }

  let query = supabase.from('gestiones_checklist_categorias').delete().eq('id', id)

  if (target.consultora_id === null) {
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para gestionar la librería base' }
    }
  } else {
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    query = query.eq('consultora_id', cId.data)
  }

  const { error } = await query

  if (error) return { success: false, error: error.message }
  revalidatePath(LIB_PATH)
  return { success: true, data: null }
}
