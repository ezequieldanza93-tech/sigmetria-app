'use server'

import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { consultoraIdFromRegistroGestion, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'
import { revalidatePath } from 'next/cache'

/**
 * Cierre de una observación por su responsable (Viewer de Observaciones).
 * La evidencia (foto O adjunto) es OBLIGATORIA. La subida va por service client
 * porque el viewer no tiene permiso de escritura en storage; antes se verifica
 * vía RLS que el usuario realmente puede ver (es responsable de) la observación,
 * y el RPC vuelve a validar responsable + evidencia.
 */
export async function cerrarMiObservacion(
  observacionId: string,
  formData: FormData,
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const evidencia = formData.get('evidencia') as File | null
  if (!evidencia || evidencia.size === 0) {
    return { success: false, error: 'La evidencia de cierre (foto o adjunto) es obligatoria' }
  }

  // El SELECT pasa por RLS: solo devuelve la observación si el usuario es el
  // responsable (política "select responsable"). Sirve de chequeo de acceso.
  const { data: obs } = await supabase
    .from('gestiones_observaciones')
    .select('registro_gestion_id, fecha_cierre')
    .eq('id', observacionId)
    .maybeSingle()
  if (!obs) return { success: false, error: 'Observación no encontrada o sin acceso' }
  if (obs.fecha_cierre) return { success: false, error: 'La observación ya está cerrada' }

  const registroId = obs.registro_gestion_id
  const service = createServiceClient()
  const consultoraId = await consultoraIdFromRegistroGestion(service, registroId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del registro' }

  const ext = evidencia.name.split('.').pop() || 'dat'
  const path = tenantStoragePath(consultoraId, 'evidencias', registroId, `${Date.now()}.${ext}`)
  const { data: upload, error: uploadError } = await service.storage
    .from('documentos')
    .upload(path, evidencia, { cacheControl: '3600', upsert: false, contentType: evidencia.type || undefined })
  if (uploadError) return { success: false, error: 'Error al subir archivo: ' + uploadError.message }

  // Cierre vía RPC SECURITY DEFINER: valida responsable + evidencia y setea fecha_cierre.
  const { error: rpcError } = await supabase.rpc('cerrar_observacion_responsable', {
    p_observacion_id: observacionId,
    p_evidencia_url: upload.path,
  })
  if (rpcError) return { success: false, error: rpcError.message }

  revalidatePath('/dashboard/mis-observaciones')
  return { success: true, data: null }
}
