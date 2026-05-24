'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

const MAX_ARCHIVOS = 5

export async function createTrabajadorDocumento(
  trabajadorId: string,
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const tipoId = formData.get('tipo_id') as string
  const fechaEmision = formData.get('fecha_emision') as string
  const fechaVencimiento = formData.get('fecha_vencimiento') as string

  if (!tipoId) return { success: false, error: 'Seleccioná un tipo de documento' }

  // Obtener consultora_id del usuario
  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const consultoraId = membership?.consultora_id
  if (!consultoraId) return { success: false, error: 'Sin consultora asignada' }

  // Subir hasta MAX_ARCHIVOS archivos
  const archivoUrls: string[] = []
  const files: File[] = []

  for (let i = 0; i < MAX_ARCHIVOS; i++) {
    const file = formData.get(`archivo_${i}`) as File | null
    if (file && file.size > 0) {
      files.push(file)
    }
  }

  // Si no hay archivos por separado, probar con 'archivo'
  if (files.length === 0) {
    const singleFile = formData.get('archivo') as File | null
    if (singleFile && singleFile.size > 0) {
      files.push(singleFile)
    }
  }

  for (const file of files) {
    if (archivoUrls.length >= MAX_ARCHIVOS) break

    const ext = file.name.split('.').pop()
    const timestamp = Date.now()
    const random = Math.random().toString(36).slice(2, 8)
    const path = `${consultoraId}/personas/${trabajadorId}/${timestamp}_${random}.${ext}`

    const { data: upload, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, file, { upsert: false })

    if (uploadError) continue

    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(upload.path)
    archivoUrls.push(publicUrl)
  }

  // Si es matrícula, también actualizar la tabla matriculas
  const { data: tipoDoc } = await supabase
    .from('documentos_tipos')
    .select('nombre')
    .eq('id', tipoId)
    .single()

  const esMatricula = tipoDoc?.nombre?.toLowerCase().includes('matrícula')

  const { error } = await supabase
    .from('personas_documentos')
    .insert({
      persona_id: trabajadorId,
      tipo_id: tipoId,
      archivo_url: archivoUrls[0] || null,
      archivo_urls: archivoUrls.length > 0 ? archivoUrls : null,
      fecha_emision: fechaEmision || null,
      fecha_vencimiento: fechaVencimiento || null,
      subido_por: user.id,
    })

  if (error) return { success: false, error: error.message }

  // Si es matrícula, sincronizar con tabla matriculas
  if (esMatricula && archivoUrls.length > 0) {
    const { data: docInserted } = await supabase
      .from('personas_documentos')
      .select('id')
      .eq('persona_id', trabajadorId)
      .eq('tipo_id', tipoId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (docInserted) {
      await supabase.from('matriculas').upsert({
        persona_id: trabajadorId,
        numero: formData.get('numero_matricula') as string || '—',
        fecha_emision: fechaEmision || null,
        fecha_vencimiento: fechaVencimiento || null,
        certificado_url: archivoUrls[0],
        activa: true,
      }, { onConflict: 'persona_id,numero', ignoreDuplicates: false })
    }
  }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
