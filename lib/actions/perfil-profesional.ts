'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { uploadAsset } from '@/lib/storage/upload'
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

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership?.consultora_id) {
    return { success: false, error: 'No pertenecés a ninguna consultora activa' }
  }

  await supabase
    .from('matriculas_profesionales')
    .update({ activa: false })
    .eq('perfil_id', perfilId)
    .eq('emisor', emisor)
    .eq('activa', true)

  const { data: inserted, error } = await supabase
    .from('matriculas_profesionales')
    .insert({
      perfil_id: perfilId,
      emisor,
      numero,
      fecha_emision: formData.get('fecha_emision') as string || null,
      fecha_vencimiento: formData.get('fecha_vencimiento') as string || null,
      activa: true,
    })
    .select('id')
    .single()

  if (error || !inserted) return { success: false, error: error?.message ?? 'Error al insertar' }

  const matriculaId = inserted.id
  const updates: { foto_frente_url?: string; foto_dorso_url?: string } = {}

  const frenteFile = formData.get('foto_frente') as File | null
  if (frenteFile && frenteFile.size > 0) {
    const up = await uploadAsset({
      bucket: 'matriculas',
      consultoraId: membership.consultora_id,
      entityType: 'matricula_prof',
      entityId: matriculaId,
      kind: 'frente',
      file: frenteFile,
    })
    if (!up.ok) return { success: false, error: `Foto frente: ${up.error}` }
    updates.foto_frente_url = up.url
  }

  const dorsoFile = formData.get('foto_dorso') as File | null
  if (dorsoFile && dorsoFile.size > 0) {
    const up = await uploadAsset({
      bucket: 'matriculas',
      consultoraId: membership.consultora_id,
      entityType: 'matricula_prof',
      entityId: matriculaId,
      kind: 'dorso',
      file: dorsoFile,
    })
    if (!up.ok) return { success: false, error: `Foto dorso: ${up.error}` }
    updates.foto_dorso_url = up.url
  }

  if (Object.keys(updates).length > 0) {
    await supabase
      .from('matriculas_profesionales')
      .update(updates)
      .eq('id', matriculaId)
  }

  revalidatePath('/dashboard/equipo')
  return { success: true, data: null }
}
