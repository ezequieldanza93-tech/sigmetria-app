'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

export async function createInstrumento(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const modelo = (formData.get('modelo') as string)?.trim()
  const tipoId = formData.get('tipo_id') as string

  if (!modelo) return { success: false, error: 'El modelo es obligatorio' }
  if (!tipoId) return { success: false, error: 'El tipo es obligatorio' }

  const { error } = await supabase.from('instrumentos_medicion').insert({
    tipo_id: tipoId,
    marca_id: (formData.get('marca_id') as string) || null,
    modelo,
    numero_serie: (formData.get('numero_serie') as string) || null,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/instrumentos')
  return { success: true, data: null }
}

export async function deleteInstrumento(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('instrumentos_medicion')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/instrumentos')
  return { success: true, data: null }
}
