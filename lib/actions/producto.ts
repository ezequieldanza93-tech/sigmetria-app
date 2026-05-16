'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createProducto(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const categoriaId = formData.get('categoria_id') as string

  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  if (!categoriaId) return { success: false, error: 'La categoría es obligatoria' }

  const tamanoStr = formData.get('tamano') as string
  const tamano = tamanoStr ? parseFloat(tamanoStr) : null

  const { error } = await supabase.from('productos').insert({
    nombre,
    descripcion: (formData.get('descripcion') as string) || null,
    marca_id: (formData.get('marca_id') as string) || null,
    categoria_id: categoriaId,
    tamano: tamano && !isNaN(tamano) ? tamano : null,
    unidad: (formData.get('unidad') as string) || null,
  })

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
