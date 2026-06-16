'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { consultoraIdFromEstablecimiento, consultoraIdFromEmpresa, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'
import { calcularFechaVencimiento } from '@/lib/documentos/calcular-vencimiento'

export async function createDocumento(
  empresaId: string,
  establecimientoId: string | null,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const tipo_id = formData.get('document_type_id') as string
  if (!tipo_id) return { success: false, error: 'El tipo de documento es obligatorio' }

  // Upload SERVER-SIDE: el cliente NO conoce el consultora_id, así que manda el
  // File en FormData y acá resolvemos el tenant y subimos al bucket privado
  // `documentos` con path prefijado por consultora (ver lib/storage/tenant-path.ts).
  // Persistimos el PATH relativo (no URL); se deriva on-read con resolveAssetUrl.
  let archivoPath: string | null = null
  const file = formData.get('archivo') as File | null
  if (file && file.size > 0) {
    const consultoraId = establecimientoId
      ? await consultoraIdFromEstablecimiento(supabase, establecimientoId)
      : await consultoraIdFromEmpresa(supabase, empresaId)
    if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del documento' }

    const entityId = establecimientoId ?? empresaId
    const ext = file.name.split('.').pop() ?? 'bin'
    const path = tenantStoragePath(consultoraId, 'documentos', entityId, `${Date.now()}.${ext}`)
    const { data: upload, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
        cacheControl: '3600',
      })
    if (uploadError) return { success: false, error: 'Error al subir archivo: ' + uploadError.message }
    archivoPath = upload.path
  }

  const fechaEmision = (formData.get('fecha_emision') as string) || null
  const fechaVencimientoManual = (formData.get('fecha_vencimiento') as string) || null

  // Auto-calcular fecha_vencimiento cuando el tipo es periódico y el usuario
  // no ingresó una fecha de vencimiento manual.
  let fechaVencimiento = fechaVencimientoManual
  if (!fechaVencimiento && fechaEmision) {
    const { data: tipoDoc } = await supabase
      .from('documentos_tipos')
      .select('vigencia_tipo, periodicidad')
      .eq('id', tipo_id)
      .single()
    if (tipoDoc?.vigencia_tipo === 'periodica' && tipoDoc.periodicidad) {
      fechaVencimiento = calcularFechaVencimiento(tipoDoc.periodicidad, fechaEmision)
    }
  }

  const commonFields = {
    // archivo_url almacena el PATH relativo del objeto (bucket `documentos`).
    tipo_id,
    archivo_url: archivoPath,
    fecha_emision: fechaEmision,
    fecha_vencimiento: fechaVencimiento,
    subido_por: user.id,
  }

  let error: { message: string } | null = null

  if (establecimientoId) {
    const result = await supabase
      .from('establecimientos_documentos')
      .insert({ ...commonFields, establecimiento_id: establecimientoId })
    error = result.error
  } else {
    const result = await supabase
      .from('empresas_documentos')
      .insert({ ...commonFields, empresa_id: empresaId })
    error = result.error
  }

  if (error) return { success: false, error: error.message }

  if (establecimientoId) {
    revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  } else {
    revalidatePath(`/dashboard/empresas/${empresaId}`)
  }

  return { success: true, data: null }
}
