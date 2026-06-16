'use server'

import { createClient } from '@/lib/supabase/server'
import { uploadAsset } from '@/lib/storage/upload'
import { revalidatePath } from 'next/cache'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import type { ActionResult } from '@/lib/types'

// Prefijo de storage para productos genéricos (consultora_id NULL en DB).
// El bucket productos-epp es público: el path no porta datos sensibles.
const GENERIC_STORAGE_PREFIX = '_sigmetria'

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
// CREATE
// ============================================================

export async function createProducto(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const esGenerico = formData.get('es_generico') === 'true'

  if (esGenerico) {
    // ── Flujo GENÉRICO: solo quien puede gestionar librerías base ──
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para crear productos de la librería base' }
    }

    const nombre = (formData.get('nombre') as string)?.trim()
    const categoriaId = formData.get('categoria_id') as string

    if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
    if (!categoriaId) return { success: false, error: 'La categoría es obligatoria' }

    const tamanoStr = formData.get('tamano') as string
    const tamano = tamanoStr ? parseFloat(tamanoStr) : null

    const { data: inserted, error } = await supabase.from('productos').insert({
      nombre,
      descripcion: (formData.get('descripcion') as string) || null,
      marca_id: (formData.get('marca_id') as string) || null,
      categoria_id: categoriaId,
      componente_id: (formData.get('componente_id') as string) || null,
      tamano: tamano && !isNaN(tamano) ? tamano : null,
      unidad_id: (formData.get('unidad_id') as string) || null,
      consultora_id: null, // genérico: propiedad de Sigmetría
    }).select('id').single()

    if (error) return { success: false, error: error.message }

    const fotoFile = formData.get('foto') as File | null
    if (fotoFile && fotoFile.size > 0) {
      const uploadResult = await uploadAsset({
        bucket: 'productos-epp',
        consultoraId: GENERIC_STORAGE_PREFIX,
        entityType: 'producto',
        entityId: inserted.id,
        kind: 'foto',
        file: fotoFile,
      })
      if (uploadResult.ok) {
        await supabase
          .from('productos')
          .update({ foto_url: uploadResult.path })
          .eq('id', inserted.id)
      }
    }

    revalidatePath('/dashboard/productos')
    return { success: true, data: null }
  }

  // ── Flujo PROPIO: comportamiento original, exige membresía activa ──
  const { data: member } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!member) return { success: false, error: 'Sin membresía activa' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const categoriaId = formData.get('categoria_id') as string

  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  if (!categoriaId) return { success: false, error: 'La categoría es obligatoria' }

  const tamanoStr = formData.get('tamano') as string
  const tamano = tamanoStr ? parseFloat(tamanoStr) : null

  // Primero insertamos para obtener el id del producto, luego subimos la foto si existe.
  const { data: inserted, error } = await supabase.from('productos').insert({
    nombre,
    descripcion: (formData.get('descripcion') as string) || null,
    marca_id: (formData.get('marca_id') as string) || null,
    categoria_id: categoriaId,
    componente_id: (formData.get('componente_id') as string) || null,
    tamano: tamano && !isNaN(tamano) ? tamano : null,
    unidad_id: (formData.get('unidad_id') as string) || null,
    consultora_id: member.consultora_id,
  }).select('id').single()

  if (error) return { success: false, error: error.message }

  // Subir foto si vino en el form
  const fotoFile = formData.get('foto') as File | null
  if (fotoFile && fotoFile.size > 0) {
    const uploadResult = await uploadAsset({
      bucket: 'productos-epp',
      consultoraId: member.consultora_id,
      entityType: 'producto',
      entityId: inserted.id,
      kind: 'foto',
      file: fotoFile,
    })
    if (uploadResult.ok) {
      await supabase
        .from('productos')
        .update({ foto_url: uploadResult.path })
        .eq('id', inserted.id)
    }
    // Si la foto falla no cortamos el flujo: el producto se creó igual.
  }

  revalidatePath('/dashboard/productos')
  return { success: true, data: null }
}

export async function updateProductoFoto(
  productoId: string,
  fotoFile: File,
  consultoraId: string,
): Promise<ActionResult<{ path: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const uploadResult = await uploadAsset({
    bucket: 'productos-epp',
    consultoraId,
    entityType: 'producto',
    entityId: productoId,
    kind: 'foto',
    file: fotoFile,
  })
  if (!uploadResult.ok) return { success: false, error: uploadResult.error }

  const { error } = await supabase
    .from('productos')
    .update({ foto_url: uploadResult.path })
    .eq('id', productoId)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/productos')
  return { success: true, data: { path: uploadResult.path } }
}

export async function updateProducto(id: string, formData: FormData): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }

  const categoriaId = formData.get('categoria_id') as string
  if (!categoriaId) return { success: false, error: 'La categoría es obligatoria' }

  const tamanoStr = formData.get('tamano') as string
  const tamano = tamanoStr ? parseFloat(tamanoStr) : null

  // Leemos el target para saber si es base (consultora_id NULL) o propio.
  const { data: target } = await supabase
    .from('productos')
    .select('consultora_id')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró el producto o no es editable' }

  let query = supabase.from('productos').update({
    nombre,
    descripcion: (formData.get('descripcion') as string) || null,
    marca_id: (formData.get('marca_id') as string) || null,
    categoria_id: categoriaId,
    componente_id: (formData.get('componente_id') as string) || null,
    tamano: tamano && !isNaN(tamano) ? tamano : null,
    unidad_id: (formData.get('unidad_id') as string) || null,
  }).eq('id', id)

  if (target.consultora_id === null) {
    // Producto base: solo quien puede gestionar librerías. La RLS confirma el permiso.
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para editar productos de la librería base' }
    }
    // No agregamos filtro de consultora_id; operamos solo por id.
  } else {
    // Producto propio: acotamos al scope de la consultora del usuario.
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    query = query.eq('consultora_id', cId.data)
  }

  const { error } = await query
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/productos')
  return { success: true, data: null }
}

export async function deleteProducto(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Leemos el target para saber si es base (consultora_id NULL) o propio.
  const { data: target } = await supabase
    .from('productos')
    .select('consultora_id')
    .eq('id', id)
    .maybeSingle()

  if (!target) return { success: false, error: 'No se encontró el producto o no es eliminable' }

  let query = supabase.from('productos').delete().eq('id', id)

  if (target.consultora_id === null) {
    // Producto base: solo quien puede gestionar librerías.
    if (!(await puedeGestionarLibreriasServer())) {
      return { success: false, error: 'Sin permiso para eliminar productos de la librería base' }
    }
    // No agregamos filtro de consultora_id; operamos solo por id.
  } else {
    // Producto propio: acotamos al scope de la consultora del usuario.
    const cId = await getConsultoraId()
    if (!cId.success) return cId
    query = query.eq('consultora_id', cId.data)
  }

  const { error } = await query
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/productos')
  return { success: true, data: null }
}
