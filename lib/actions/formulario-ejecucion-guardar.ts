'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export async function guardarBorrador(
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
  const responsableId = (formData.get('responsable_id') as string) || null
  const notas = (formData.get('notas') as string) || null

  if (!registroId || !gestionId || !establecimientoId || !respuestaId || !fechaEjecutada) {
    return { success: false, error: 'Faltan datos requeridos' }
  }

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

  const { error: respUpdateError } = await supabase
    .from('formularios_respuestas')
    .update({ status: 'in_progress' })
    .eq('id', respuestaId)

  if (respUpdateError) return { success: false, error: 'Error al guardar borrador: ' + respUpdateError.message }

  const { error: regError } = await supabase
    .from('gestiones_registros')
    .update({
      fecha_ejecutada: fechaEjecutada,
      notas,
      responsable_id: responsableId,
    })
    .eq('id', registroId)

  if (regError) return { success: false, error: 'Error al actualizar registro: ' + regError.message }

  return { success: true, data: { evidencia_url: '' } }
}
