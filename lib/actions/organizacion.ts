'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createOrganizacion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = (formData.get('nombre') as string)?.trim()
  const tipoId = formData.get('tipo_id') as string

  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }
  if (!tipoId) return { success: false, error: 'El tipo es obligatorio' }

  const { error } = await supabase.from('organizaciones').insert({
    nombre,
    tipo_id: tipoId,
    email: (formData.get('email') as string) || null,
    telefono: (formData.get('telefono') as string) || null,
    notas: (formData.get('notas') as string) || null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/organizaciones')
  return { success: true, data: null }
}

export async function deleteOrganizacion(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase.from('organizaciones').delete().eq('id', id)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/organizaciones')
  return { success: true, data: null }
}
