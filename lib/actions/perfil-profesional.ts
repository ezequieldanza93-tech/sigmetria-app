'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { uploadAsset, deleteAsset, storagePath } from '@/lib/storage/upload'
import type { ActionResult } from '@/lib/types'
import type { AssetBucket, EntityType } from '@/lib/storage/upload'

async function processProfesionalAsset(
  consultoraId: string,
  perfilId: string,
  fieldName: string,
  bucket: AssetBucket,
  entityType: EntityType,
  kind: string,
  formData: FormData,
  currentUrl: string | null,
): Promise<{ url?: string | null; error?: string }> {
  const file = formData.get(fieldName) as File | null
  const remove = formData.get(`${fieldName}__remove`) === '1'

  if (file && file.size > 0) {
    const up = await uploadAsset({
      bucket,
      consultoraId,
      entityType,
      entityId: perfilId,
      kind,
      file,
    })
    if (!up.ok) return { error: up.error }
    return { url: up.path }
  }

  if (remove && currentUrl) {
    const path = storagePath(currentUrl, bucket)
    if (path) await deleteAsset(bucket, path)
    return { url: null }
  }

  return {}
}

export async function upsertPerfilProfesional(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const { data: existing } = await supabase
    .from('perfiles_profesionales')
    .select('id, firma_url, logo_small_url, logo_destacado_url')
    .eq('user_id', user.id)
    .maybeSingle()

  const basePayload: Record<string, string | null> = {
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

  const { data: upserted, error } = await supabase
    .from('perfiles_profesionales')
    .upsert(basePayload, { onConflict: 'user_id' })
    .select('id')
    .single()

  if (error || !upserted) return { success: false, error: error?.message ?? 'Error al guardar' }

  const perfilId = upserted.id

  if (membership?.consultora_id) {
    const firma = await processProfesionalAsset(
      membership.consultora_id, perfilId, 'firma', 'firmas', 'profesional', 'firma',
      formData, existing?.firma_url ?? null,
    )
    if (firma.error) return { success: false, error: `Firma: ${firma.error}` }

    const logoSmall = await processProfesionalAsset(
      membership.consultora_id, perfilId, 'logo_small_prof', 'logos', 'profesional', 'small',
      formData, existing?.logo_small_url ?? null,
    )
    if (logoSmall.error) return { success: false, error: `Logo pequeño: ${logoSmall.error}` }

    const logoDest = await processProfesionalAsset(
      membership.consultora_id, perfilId, 'logo_destacado_prof', 'logos', 'profesional', 'destacado',
      formData, existing?.logo_destacado_url ?? null,
    )
    if (logoDest.error) return { success: false, error: `Logo destacado: ${logoDest.error}` }

    const updates: Record<string, string | null> = {}
    if (firma.url !== undefined) updates.firma_url = firma.url
    if (logoSmall.url !== undefined) updates.logo_small_url = logoSmall.url
    if (logoDest.url !== undefined) updates.logo_destacado_url = logoDest.url

    if (Object.keys(updates).length > 0) {
      await supabase.from('perfiles_profesionales').update(updates).eq('id', perfilId)
    }
  }

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
    updates.foto_frente_url = up.path
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
    updates.foto_dorso_url = up.path
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
