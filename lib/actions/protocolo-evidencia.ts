'use server'

import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromRegistroGestion, tenantStoragePath } from '@/lib/storage/tenant-path'

/**
 * Guarda el PDF de un protocolo ejecutado como EVIDENCIA ADJUNTA de la gestión.
 *
 * Recibe el PDF como dataURI base64 (pdf.output('datauristring')), lo sube al
 * bucket privado `documentos` con path multi-tenant y persiste el PATH en
 * gestiones_registros.evidencia_url. Espeja el patrón de finalizarFormulario.
 * Genérico: cualquier protocolo (iluminación, ruido, etc.) puede usarlo.
 */
export async function guardarEvidenciaProtocolo(
  registroId: string,
  pdfBase64: string,
  entityType = 'protocolos',
): Promise<{ success: true; path: string } | { success: false; error: string }> {
  const supabase = await createClient()

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

  return { success: true, path: upload.path }
}
