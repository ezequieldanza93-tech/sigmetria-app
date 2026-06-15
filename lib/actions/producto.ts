'use server'

import { createClient } from '@/lib/supabase/server'
import { uploadAsset } from '@/lib/storage/upload'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

// Prefijo de storage para productos genéricos (consultora_id NULL en DB).
// El bucket productos-epp es público: el path no porta datos sensibles.
const GENERIC_STORAGE_PREFIX = '_sigmetria'

export async function createProducto(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const esGenerico = formData.get('es_generico') === 'true'

  if (esGenerico) {
    // ── Flujo GENÉRICO: solo staff developer puede crear productos base Sigmetría ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('system_role')
      .eq('id', user.id)
      .maybeSingle()

    if (profile?.system_role !== 'developer') {
      return { success: false, error: 'Solo el staff de Sigmetría puede crear productos genéricos' }
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
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }

  const categoriaId = formData.get('categoria_id') as string
  if (!categoriaId) return { success: false, error: 'La categoría es obligatoria' }

  const tamanoStr = formData.get('tamano') as string
  const tamano = tamanoStr ? parseFloat(tamanoStr) : null

  const { error } = await supabase.from('productos').update({
    nombre,
    descripcion: (formData.get('descripcion') as string) || null,
    marca_id: (formData.get('marca_id') as string) || null,
    categoria_id: categoriaId,
    componente_id: (formData.get('componente_id') as string) || null,
    tamano: tamano && !isNaN(tamano) ? tamano : null,
    unidad_id: (formData.get('unidad_id') as string) || null,
  }).eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/productos')
  return { success: true, data: null }
}

export async function deleteProducto(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase.from('productos').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/productos')
  return { success: true, data: null }
}
