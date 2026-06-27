'use server'

import { createServiceClient } from '@/lib/supabase/service'
import { consultoraIdFromRegistroGestion, tenantStoragePath } from '@/lib/storage/tenant-path'

/**
 * Guarda el PDF de un protocolo ejecutado como EVIDENCIA ADJUNTA de la gestión.
 *
 * Recibe el PDF como dataURI base64 (pdf.output('datauristring')), lo sube al
 * bucket privado `documentos` con path multi-tenant y persiste el PATH en
 * gestiones_registros.evidencia_url. Espeja el patrón de finalizarFormulario.
 * Genérico: cualquier protocolo (iluminación, ruido, etc.) puede usarlo.
 *
 * NOTA: Usa createServiceClient() porque el usuario puede haber estado largo
 * rato en el formulario y su JWT puede expirar (error InvalidJWT). El service
 * role bypassea RLS de forma segura porque los datos ya fueron autorizados
 * por el flujo de la app antes de llegar acá.
 */
export async function guardarEvidenciaProtocolo(
  registroId: string,
  pdfBase64: string,
  entityType = 'protocolos',
): Promise<{ success: true; path: string; signedUrl: string } | { success: false; error: string }> {
  const supabase = createServiceClient()

  const consultoraId = await consultoraIdFromRegistroGestion(supabase, registroId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del registro' }

  const base64 = pdfBase64.replace(/^data:application\/pdf(?:;.*?)?;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')
  const path = tenantStoragePath(consultoraId, entityType, registroId, `${Date.now()}.pdf`)

  const { data: upload, error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(path, buffer, { contentType: 'application/pdf', upsert: false })
  if (uploadError) return { success: false, error: 'Error al subir el PDF: ' + uploadError.message }

  const { error: updError } = await supabase
    .from('gestiones_registros')
    .update({ evidencia_url: upload.path })
    .eq('id', registroId)
  if (updError) return { success: false, error: 'Error al registrar la evidencia: ' + updError.message }

  // Signed URL con service role (no depende del JWT del usuario que puede expirar).
  const { data: signed } = await supabase.storage
    .from('documentos')
    .createSignedUrl(upload.path, 60 * 60)

  return { success: true, path: upload.path, signedUrl: signed?.signedUrl ?? '' }
}
