'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export async function upsertPerfilProfesional(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const payload: Record<string, string | null> = {
    user_id: user.id,
    telefono: formData.get('telefono') as string || null,
    fecha_nacimiento: formData.get('fecha_nacimiento') as string || null,
    provincia_residencia_id: formData.get('provincia_residencia_id') as string || null,
    provincia_matricula_id: formData.get('provincia_matricula_id') as string || null,
    canal_captacion: formData.get('canal_captacion') as string || null,
    tipo_identidad_impositiva: formData.get('tipo_identidad_impositiva') as string || null,
    cuit: formData.get('cuit') as string || null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('perfiles_profesionales')
    .upsert(payload, { onConflict: 'user_id' })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/equipo')
  return { success: true, data: null }
}

export async function addMatriculaProfesional(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const perfilId = formData.get('perfil_id') as string
  if (!perfilId) return { success: false, error: 'Falta perfil_id' }

  const emisor = formData.get('emisor') as string
  const numero = formData.get('numero') as string
  if (!emisor || !numero) return { success: false, error: 'Emisor y número son requeridos' }

  // Deactivate previous active matrícula from the same emisor (renewal pattern)
  await supabase
    .from('matriculas_profesionales')
    .update({ activa: false })
    .eq('perfil_id', perfilId)
    .eq('emisor', emisor)
    .eq('activa', true)

  const { error } = await supabase.from('matriculas_profesionales').insert({
    perfil_id: perfilId,
    emisor,
    numero,
    fecha_emision: formData.get('fecha_emision') as string || null,
    fecha_vencimiento: formData.get('fecha_vencimiento') as string || null,
    foto_frente_url: formData.get('foto_frente_url') as string || null,
    foto_dorso_url: formData.get('foto_dorso_url') as string || null,
    activa: true,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/equipo')
  return { success: true, data: null }
}
