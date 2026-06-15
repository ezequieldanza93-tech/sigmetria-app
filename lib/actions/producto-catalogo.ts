'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult, ProductoClase, ProductoComponente, CategoriaProducto } from '@/lib/types'

const CATALOGO_PATH = '/dashboard/productos'

// ============================================================
// Helpers de identidad
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

async function isDeveloper(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .maybeSingle()
  return profile?.system_role === 'developer'
}

// Resuelve el consultora_id objetivo según el flag genérico.
// - Genérico (consultora_id NULL): solo staff developer.
// - Propio: consultora_id del miembro activo.
async function resolveOwnerConsultoraId(
  esGenerico: boolean
): Promise<ActionResult<string | null>> {
  if (esGenerico) {
    if (!(await isDeveloper())) {
      return { success: false, error: 'Solo el staff de Sigmetría puede editar el catálogo genérico' }
    }
    return { success: true, data: null }
  }
  const cId = await getConsultoraId()
  if (!cId.success) return cId
  return { success: true, data: cId.data }
}

// Filtro de pertenencia para update/delete: las propias se acotan por consultora_id;
// las genéricas (NULL) no pueden filtrarse por igualdad → se filtra con IS NULL.
// La RLS ya garantiza que solo developer toque las genéricas.

// ============================================================
// LECTURA — árbol híbrido clase → categoría → componente
// (base NULL + propios de la consultora, vía RLS)
// ============================================================
export async function getCatalogoArbol(): Promise<ActionResult<{
  clases: ProductoClase[]
  categorias: CategoriaProducto[]
  componentes: ProductoComponente[]
  consultoraId: string
}>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const [cl, ca, co] = await Promise.all([
    supabase.from('productos_clases').select('*').order('nombre'),
    supabase.from('productos_categorias').select('*').order('nombre'),
    supabase.from('productos_componentes').select('*').order('nombre'),
  ])

  if (cl.error) return { success: false, error: cl.error.message }
  if (ca.error) return { success: false, error: ca.error.message }
  if (co.error) return { success: false, error: co.error.message }

  return {
    success: true,
    data: {
      clases: (cl.data ?? []) as ProductoClase[],
      categorias: (ca.data ?? []) as CategoriaProducto[],
      componentes: (co.data ?? []) as ProductoComponente[],
      consultoraId: cId.data,
    },
  }
}

// ============================================================
// CLASES (nivel 1)
// ============================================================
export async function createClase(
  nombre: string,
  esGenerico = false,
  descripcion?: string,
): Promise<ActionResult<ProductoClase>> {
  const supabase = await createClient()
  const owner = await resolveOwnerConsultoraId(esGenerico)
  if (!owner.success) return owner

  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }

  const { data, error } = await supabase
    .from('productos_clases')
    .insert({ nombre: n, descripcion: descripcion?.trim() || null, consultora_id: owner.data })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una clase con ese nombre.' }
    return { success: false, error: error.message }
  }
  revalidatePath(CATALOGO_PATH)
  return { success: true, data: data as ProductoClase }
}

export async function updateClase(
  id: string,
  nombre: string,
  esGenerico = false,
  descripcion?: string,
): Promise<ActionResult<ProductoClase>> {
  const supabase = await createClient()
  const owner = await resolveOwnerConsultoraId(esGenerico)
  if (!owner.success) return owner

  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }

  let q = supabase
    .from('productos_clases')
    .update({ nombre: n, descripcion: descripcion?.trim() || null })
    .eq('id', id)
  q = owner.data === null ? q.is('consultora_id', null) : q.eq('consultora_id', owner.data)

  const { data, error } = await q.select().single()
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una clase con ese nombre.' }
    return { success: false, error: error.message }
  }
  revalidatePath(CATALOGO_PATH)
  return { success: true, data: data as ProductoClase }
}

export async function deleteClase(
  id: string,
  esGenerico = false,
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const owner = await resolveOwnerConsultoraId(esGenerico)
  if (!owner.success) return owner

  let q = supabase.from('productos_clases').delete().eq('id', id)
  q = owner.data === null ? q.is('consultora_id', null) : q.eq('consultora_id', owner.data)

  const { error } = await q
  if (error) {
    // RESTRICT en categorias.clase_id → no se puede borrar una clase con categorías colgando.
    if (error.code === '23503') return { success: false, error: 'No se puede borrar: hay categorías que dependen de esta clase.' }
    return { success: false, error: error.message }
  }
  revalidatePath(CATALOGO_PATH)
  return { success: true, data: null }
}

// ============================================================
// CATEGORÍAS (nivel 2) — tabla productos_categorias (+clase_id)
// ============================================================
export async function createCategoria(
  nombre: string,
  claseId: string,
  esGenerico = false,
  descripcion?: string,
): Promise<ActionResult<CategoriaProducto>> {
  const supabase = await createClient()
  const owner = await resolveOwnerConsultoraId(esGenerico)
  if (!owner.success) return owner

  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }
  if (!claseId) return { success: false, error: 'Elegí una clase' }

  const { data, error } = await supabase
    .from('productos_categorias')
    .insert({ nombre: n, clase_id: claseId, descripcion: descripcion?.trim() || null, consultora_id: owner.data })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una categoría con ese nombre.' }
    return { success: false, error: error.message }
  }
  revalidatePath(CATALOGO_PATH)
  return { success: true, data: data as CategoriaProducto }
}

export async function updateCategoria(
  id: string,
  nombre: string,
  claseId: string,
  esGenerico = false,
  descripcion?: string,
): Promise<ActionResult<CategoriaProducto>> {
  const supabase = await createClient()
  const owner = await resolveOwnerConsultoraId(esGenerico)
  if (!owner.success) return owner

  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }
  if (!claseId) return { success: false, error: 'Elegí una clase' }

  let q = supabase
    .from('productos_categorias')
    .update({ nombre: n, clase_id: claseId, descripcion: descripcion?.trim() || null })
    .eq('id', id)
  q = owner.data === null ? q.is('consultora_id', null) : q.eq('consultora_id', owner.data)

  const { data, error } = await q.select().single()
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe una categoría con ese nombre.' }
    return { success: false, error: error.message }
  }
  revalidatePath(CATALOGO_PATH)
  return { success: true, data: data as CategoriaProducto }
}

export async function deleteCategoria(
  id: string,
  esGenerico = false,
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const owner = await resolveOwnerConsultoraId(esGenerico)
  if (!owner.success) return owner

  let q = supabase.from('productos_categorias').delete().eq('id', id)
  q = owner.data === null ? q.is('consultora_id', null) : q.eq('consultora_id', owner.data)

  const { error } = await q
  if (error) {
    if (error.code === '23503') return { success: false, error: 'No se puede borrar: hay productos o componentes en esta categoría.' }
    return { success: false, error: error.message }
  }
  revalidatePath(CATALOGO_PATH)
  return { success: true, data: null }
}

// ============================================================
// COMPONENTES (nivel intermedio) — productos_componentes
// ============================================================
export async function createComponente(
  nombre: string,
  categoriaId: string,
  esGenerico = false,
  descripcion?: string,
): Promise<ActionResult<ProductoComponente>> {
  const supabase = await createClient()
  const owner = await resolveOwnerConsultoraId(esGenerico)
  if (!owner.success) return owner

  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }
  if (!categoriaId) return { success: false, error: 'Elegí una categoría' }

  const { data, error } = await supabase
    .from('productos_componentes')
    .insert({ nombre: n, categoria_id: categoriaId, descripcion: descripcion?.trim() || null, consultora_id: owner.data })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe un componente con ese nombre en esta categoría.' }
    return { success: false, error: error.message }
  }
  revalidatePath(CATALOGO_PATH)
  return { success: true, data: data as ProductoComponente }
}

export async function updateComponente(
  id: string,
  nombre: string,
  categoriaId: string,
  esGenerico = false,
  descripcion?: string,
): Promise<ActionResult<ProductoComponente>> {
  const supabase = await createClient()
  const owner = await resolveOwnerConsultoraId(esGenerico)
  if (!owner.success) return owner

  const n = nombre.trim()
  if (!n) return { success: false, error: 'El nombre es obligatorio' }
  if (!categoriaId) return { success: false, error: 'Elegí una categoría' }

  let q = supabase
    .from('productos_componentes')
    .update({ nombre: n, categoria_id: categoriaId, descripcion: descripcion?.trim() || null })
    .eq('id', id)
  q = owner.data === null ? q.is('consultora_id', null) : q.eq('consultora_id', owner.data)

  const { data, error } = await q.select().single()
  if (error) {
    if (error.code === '23505') return { success: false, error: 'Ya existe un componente con ese nombre en esta categoría.' }
    return { success: false, error: error.message }
  }
  revalidatePath(CATALOGO_PATH)
  return { success: true, data: data as ProductoComponente }
}

export async function deleteComponente(
  id: string,
  esGenerico = false,
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const owner = await resolveOwnerConsultoraId(esGenerico)
  if (!owner.success) return owner

  let q = supabase.from('productos_componentes').delete().eq('id', id)
  q = owner.data === null ? q.is('consultora_id', null) : q.eq('consultora_id', owner.data)

  const { error } = await q
  if (error) return { success: false, error: error.message }
  revalidatePath(CATALOGO_PATH)
  return { success: true, data: null }
}
