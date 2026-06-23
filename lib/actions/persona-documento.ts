'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { calcularFechaVencimiento } from '@/lib/documentos/calcular-vencimiento'
import type { ActionResult } from '@/lib/types'

const MAX_ARCHIVOS = 5

export async function createPersonaDocumento(
  personaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData,
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const tipoId = formData.get('tipo_id') as string
  const fechaEmision = (formData.get('fecha_emision') as string) || null
  const fechaVencimientoManual = (formData.get('fecha_vencimiento') as string) || null

  if (!tipoId) return { success: false, error: 'Seleccioná un tipo de documento' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const consultoraId = membership?.consultora_id
  if (!consultoraId) return { success: false, error: 'Sin consultora asignada' }

  const archivoUrls: string[] = []
  const files: File[] = []

  for (let i = 0; i < MAX_ARCHIVOS; i++) {
    const file = formData.get(`archivo_${i}`) as File | null
    if (file && file.size > 0) files.push(file)
  }
  if (files.length === 0) {
    const singleFile = formData.get('archivo') as File | null
    if (singleFile && singleFile.size > 0) files.push(singleFile)
  }

  for (const file of files) {
    if (archivoUrls.length >= MAX_ARCHIVOS) break
    const ext = file.name.split('.').pop()
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 8)
    const path = `${consultoraId}/personas/${personaId}/${timestamp}_${random}.${ext}`

    const { data: upload, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, file, { upsert: false })

    if (uploadError) continue
    archivoUrls.push(upload.path)
  }

  const { data: tipoDoc } = await supabase
    .from('documentos_tipos')
    .select('vigencia_tipo, periodicidad')
    .eq('id', tipoId)
    .single()

  let fechaVencimiento = fechaVencimientoManual
  if (!fechaVencimiento && fechaEmision) {
    if (tipoDoc?.vigencia_tipo === 'periodica' && tipoDoc.periodicidad) {
      fechaVencimiento = calcularFechaVencimiento(tipoDoc.periodicidad, fechaEmision)
    }
  }

  const { data: docRow, error } = await supabase
    .from('personas_documentos')
    .insert({
      persona_id: personaId,
      tipo_id: tipoId,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      subido_por: user.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  if (archivoUrls.length > 0 && docRow) {
    await supabase
      .from('personas_documentos_archivos')
      .insert(archivoUrls.map(url => ({ documento_id: docRow.id, url })))
  }

  revalidatePath('/dashboard/personas')
  return { success: true, data: null }
}
