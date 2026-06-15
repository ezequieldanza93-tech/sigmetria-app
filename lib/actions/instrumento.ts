'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { uploadAsset } from '@/lib/storage/upload'
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

  // Certificado de calibración OPCIONAL al dar de alta. Si vino archivo, ambas fechas
  // son obligatorias; si no vino archivo pero sí fechas, igual se registra la calibración.
  const certFile = formData.get('certificado') as File | null
  const certFechaEmision = (formData.get('cert_fecha_emision') as string) || ''
  const certFechaVencimiento = (formData.get('cert_fecha_vencimiento') as string) || ''
  const tieneCertificado =
    (!!certFile && certFile.size > 0) || !!certFechaEmision || !!certFechaVencimiento

  if (tieneCertificado) {
    if (!certFechaEmision) return { success: false, error: 'Falta la fecha de emisión del certificado.' }
    if (!certFechaVencimiento) return { success: false, error: 'Falta la fecha de vencimiento del certificado.' }
  }

  const { data: inserted, error } = await supabase
    .from('mediciones_instrumentos')
    .insert({
      tipo_id: tipoId,
      marca_id: (formData.get('marca_id') as string) || null,
      modelo,
      numero_serie: (formData.get('numero_serie') as string) || null,
      dueño_id: (formData.get('dueño_id') as string) || null,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    if (error?.code === '23505') {
      return { success: false, error: 'Ya existe un instrumento con ese número de serie.' }
    }
    return { success: false, error: error?.message ?? 'Error al crear el instrumento' }
  }

  if (tieneCertificado) {
    const { data: membership } = await supabase
      .from('consultoras_members')
      .select('consultora_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!membership?.consultora_id) {
      return { success: false, error: 'No pertenecés a ninguna consultora activa' }
    }

    const { data: cert, error: certError } = await supabase
      .from('certificados_calibracion')
      .insert({
        instrumento_id: inserted.id,
        fecha_emision: certFechaEmision,
        fecha_vencimiento: certFechaVencimiento,
        activo: true,
      })
      .select('id')
      .single()

    if (certError || !cert) {
      return { success: false, error: `Certificado: ${certError?.message ?? 'no se pudo registrar'}` }
    }

    if (certFile && certFile.size > 0) {
      const up = await uploadAsset({
        bucket: 'certificados',
        consultoraId: membership.consultora_id,
        entityType: 'certificado_calibracion',
        entityId: cert.id,
        kind: 'certificado',
        file: certFile,
      })
      if (!up.ok) return { success: false, error: `Certificado: ${up.error}` }
      await supabase
        .from('certificados_calibracion')
        .update({ certificado_url: up.path })
        .eq('id', cert.id)
    }
  }

  revalidatePath('/dashboard/instrumentos')
  return { success: true, data: null }
}

export async function updateInstrumento(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const id = formData.get('id') as string
  if (!id) return { success: false, error: 'ID requerido' }

  const modelo = (formData.get('modelo') as string)?.trim()
  const tipoId = formData.get('tipo_id') as string

  if (!modelo) return { success: false, error: 'El modelo es obligatorio' }
  if (!tipoId) return { success: false, error: 'El tipo es obligatorio' }

  const { error } = await supabase
    .from('mediciones_instrumentos')
    .update({
      tipo_id: tipoId,
      marca_id: (formData.get('marca_id') as string) || null,
      modelo,
      numero_serie: (formData.get('numero_serie') as string) || null,
      dueño_id: (formData.get('dueño_id') as string) || null,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Ya existe un instrumento con ese número de serie.' }
    }
    return { success: false, error: error.message }
  }

  revalidatePath('/dashboard/instrumentos')
  return { success: true, data: null }
}

export async function deleteInstrumento(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('mediciones_instrumentos')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/instrumentos')
  return { success: true, data: null }
}
