'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import { consultoraIdFromRegistroGestion, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'

export async function finalizarFormulario(
  _prev: ActionResult<{ evidencia_url: string }> | null,
  formData: FormData
): Promise<ActionResult<{ evidencia_url: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const registroId = formData.get('registro_id') as string
  const gestionId = formData.get('gestion_id') as string
  const establecimientoId = formData.get('establecimiento_id') as string
  const respuestaId = formData.get('respuesta_id') as string
  const fechaEjecutada = formData.get('fecha_ejecutada') as string
  const indexStr = formData.get('index') as string
  const responsableId = (formData.get('responsable_id') as string) || null
  const notas = (formData.get('notas') as string) || null
  const evidenciaB64 = formData.get('evidencia_pdf') as string

  if (!registroId || !gestionId || !establecimientoId || !respuestaId || !fechaEjecutada) {
    return { success: false, error: 'Faltan datos requeridos' }
  }

  // Parse item responses from form data
  const itemResponses: { item_id: string; answer: string; comment: string | null }[] = []
  let idx = 0
  while (true) {
    const itemId = formData.get(`item_${idx}_id`) as string
    if (!itemId) break
    const answer = formData.get(`item_${idx}_answer`) as string
    const comment = (formData.get(`item_${idx}_comment`) as string) || null
    if (answer) {
      itemResponses.push({ item_id: itemId, answer, comment })
    }
    idx++
  }

  if (itemResponses.length === 0) {
    return { success: false, error: 'No hay respuestas para guardar' }
  }

  // Save item responses (upsert: idempotente ante re-envíos del formulario)
  const { error: insertError } = await supabase
    .from('formularios_items_respuestas')
    .upsert(
      itemResponses.map(ir => ({
        respuesta_id: respuestaId,
        item_id: ir.item_id,
        answer: ir.answer,
        comment: ir.comment,
      })),
      { onConflict: 'respuesta_id,item_id' }
    )

  if (insertError) return { success: false, error: 'Error al guardar respuestas: ' + insertError.message }

  // Mark formulario_respuesta as completed
  const { error: respUpdateError } = await supabase
    .from('formularios_respuestas')
    .update({ status: 'completed', executed_at: new Date().toISOString() })
    .eq('id', respuestaId)

  if (respUpdateError) return { success: false, error: 'Error al finalizar formulario: ' + respUpdateError.message }

  // `documentos` es un bucket PRIVADO: el path DEBE empezar con el consultora_id
  // para que la RLS de lectura por tenant matchee (ver lib/storage/tenant-path.ts).
  // Resolvemos el consultora_id una sola vez (lo comparten foto y PDF).
  const fotoEvidencia = formData.get('foto_evidencia') as File | null
  const hayFoto = !!(fotoEvidencia && fotoEvidencia.size > 0)
  let consultoraId: string | null = null
  if (hayFoto || evidenciaB64) {
    consultoraId = await consultoraIdFromRegistroGestion(supabase, registroId)
    if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del registro' }
  }

  // Upload form photo evidence if provided. Persistimos el PATH (no la URL).
  let fotoEvidenciaPath: string | null = null
  if (hayFoto && consultoraId) {
    const ext = fotoEvidencia!.name.split('.').pop() ?? 'png'
    const path = tenantStoragePath(consultoraId, 'formularios-fotos', registroId, `${Date.now()}.${ext}`)
    const { data: fotoUpload, error: fotoUploadError } = await supabase.storage
      .from('documentos')
      .upload(path, fotoEvidencia!, { upsert: false })
    if (!fotoUploadError) {
      fotoEvidenciaPath = fotoUpload.path
    }
  }

  // Upload PDF to storage if provided. Persistimos el PATH; devolvemos una SIGNED
  // URL al cliente para la descarga inmediata (auto-download). `documentos` es un
  // bucket PRIVADO → la URL pública daría 403; firmamos on-read con resolveAssetUrl.
  let evidenciaPath: string | null = null
  let evidenciaSignedUrl: string | null = null
  if (evidenciaB64 && consultoraId) {
    const base64Data = evidenciaB64.replace(/^data:application\/pdf(?:;.*?)?;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const path = tenantStoragePath(consultoraId, 'formularios', registroId, `${Date.now()}.pdf`)

    const { data: upload, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) return { success: false, error: 'Error al subir PDF: ' + uploadError.message }
    evidenciaPath = upload.path
    evidenciaSignedUrl = await resolveAssetUrl('documentos', upload.path)
  }

  // Update registro_gestiones
  const updates: Record<string, unknown> = {
    fecha_ejecutada: fechaEjecutada,
    notas,
    responsable_id: responsableId,
  }
  if (indexStr && !isNaN(Number(indexStr))) {
    updates.index = Number(indexStr)
  }
  if (evidenciaPath) updates.evidencia_url = evidenciaPath
  if (fotoEvidenciaPath) updates.foto_evidencia_url = fotoEvidenciaPath

  const { error: regError } = await supabase
    .from('gestiones_registros')
    .update(updates)
    .eq('id', registroId)

  if (regError) return { success: false, error: 'Error al actualizar registro: ' + regError.message }

  // Devolvemos la SIGNED URL (no el path) para la descarga inmediata en el cliente.
  return { success: true, data: { evidencia_url: evidenciaSignedUrl ?? '' } }
}

export async function getFormularioData(gestionId: string) {
  const supabase = await createClient()

  const { data: secciones, error } = await supabase
    .from('formularios_secciones')
    .select('id, title, order_index, formularios_items(id, gestion_id, numero_item, question, tipo, opciones, order_index, is_active, created_at)')
    .eq('gestion_id', gestionId)
    .order('order_index')

  if (error) return { success: false, error: error.message } as const
  return { success: true, data: secciones } as const
}

export async function getOrCreateRespuesta(
  gestionId: string,
  establecimientoId: string,
  userId: string
): Promise<ActionResult<{ id: string; status: string }>> {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('formularios_respuestas')
    .select('id, status')
    .eq('gestion_id', gestionId)
    .eq('establecimiento_id', establecimientoId)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (existing) return { success: true, data: existing }

  const { data: nueva, error } = await supabase
    .from('formularios_respuestas')
    .insert({
      gestion_id: gestionId,
      establecimiento_id: establecimientoId,
      executed_by: userId,
      status: 'in_progress',
    })
    .select('id, status')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: nueva }
}
