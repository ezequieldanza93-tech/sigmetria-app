'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult, AnswerValue } from '@/lib/types'

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

  // Save item responses
  const { error: deleteError } = await supabase
    .from('formulario_item_respuestas')
    .delete()
    .eq('respuesta_id', respuestaId)

  if (deleteError) return { success: false, error: 'Error al limpiar respuestas: ' + deleteError.message }

  const { error: insertError } = await supabase
    .from('formulario_item_respuestas')
    .insert(
      itemResponses.map(ir => ({
        respuesta_id: respuestaId,
        item_id: ir.item_id,
        answer: ir.answer,
        comment: ir.comment,
      }))
    )

  if (insertError) return { success: false, error: 'Error al guardar respuestas: ' + insertError.message }

  // Mark formulario_respuesta as completed
  const { error: respUpdateError } = await supabase
    .from('formulario_respuestas')
    .update({ status: 'completed', executed_at: new Date().toISOString() })
    .eq('id', respuestaId)

  if (respUpdateError) return { success: false, error: 'Error al finalizar formulario: ' + respUpdateError.message }

  // Upload PDF to storage if provided
  let evidenciaUrl: string | null = null
  if (evidenciaB64) {
    const base64Data = evidenciaB64.replace(/^data:application\/pdf;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')
    const path = `formularios/${registroId}/${Date.now()}.pdf`

    const { data: upload, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, buffer, {
        contentType: 'application/pdf',
        upsert: false,
      })

    if (uploadError) return { success: false, error: 'Error al subir PDF: ' + uploadError.message }
    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(upload.path)
    evidenciaUrl = publicUrl
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
  if (evidenciaUrl) {
    updates.evidencia_url = evidenciaUrl
  }

  const { error: regError } = await supabase
    .from('registro_gestiones')
    .update(updates)
    .eq('id', registroId)

  if (regError) return { success: false, error: 'Error al actualizar registro: ' + regError.message }

  return { success: true, data: { evidencia_url: evidenciaUrl ?? '' } }
}

export async function getFormularioData(gestionId: string) {
  const supabase = await createClient()

  const { data: secciones, error } = await supabase
    .from('formulario_secciones')
    .select('*, formulario_items(*)')
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
    .from('formulario_respuestas')
    .select('id, status')
    .eq('gestion_id', gestionId)
    .eq('establecimiento_id', establecimientoId)
    .eq('status', 'in_progress')
    .maybeSingle()

  if (existing) return { success: true, data: existing }

  const { data: nueva, error } = await supabase
    .from('formulario_respuestas')
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
