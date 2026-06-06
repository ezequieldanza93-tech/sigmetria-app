'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { uploadAsset } from '@/lib/storage/upload'
import type { ActionResult } from '@/lib/types'

export async function createCertificadoCalibracion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const instrumentoId = formData.get('instrumento_id') as string
  const fechaEmision = formData.get('fecha_emision') as string
  const fechaVencimiento = formData.get('fecha_vencimiento') as string

  if (!instrumentoId) return { success: false, error: 'Instrumento requerido' }
  if (!fechaEmision) return { success: false, error: 'Fecha de emisión requerida' }
  if (!fechaVencimiento) return { success: false, error: 'Fecha de vencimiento requerida' }

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
    .from('certificados_calibracion')
    .update({ activo: false })
    .eq('instrumento_id', instrumentoId)
    .eq('activo', true)

  const { data: inserted, error } = await supabase
    .from('certificados_calibracion')
    .insert({
      instrumento_id: instrumentoId,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      organismo_emisor_id: (formData.get('organismo_emisor_id') as string) || null,
      activo: true,
    })
    .select('id')
    .single()

  if (error || !inserted) return { success: false, error: error?.message ?? 'Error al insertar' }

  const certFile = formData.get('certificado') as File | null
  if (certFile && certFile.size > 0) {
    const up = await uploadAsset({
      bucket: 'certificados',
      consultoraId: membership.consultora_id,
      entityType: 'certificado_calibracion',
      entityId: inserted.id,
      kind: 'certificado',
      file: certFile,
    })
    if (!up.ok) return { success: false, error: `Certificado: ${up.error}` }
    await supabase
      .from('certificados_calibracion')
      .update({ certificado_url: up.path })
      .eq('id', inserted.id)
  }

  revalidatePath('/dashboard/instrumentos')
  return { success: true, data: null }
}
