'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { uploadAsset } from '@/lib/storage/upload'
import type { ActionResult } from '@/lib/types'
import { calcularFechaVencimiento } from '@/lib/documentos/calcular-vencimiento'

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
  const fechaEmision = (formData.get('fecha_emision') as string) || null
  const fechaVencimientoManual = (formData.get('fecha_vencimiento') as string) || null

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

  // Subir hasta MAX_ARCHIVOS archivos. Persistimos PATHS (no URLs);
  // la URL se deriva on-read con publicAssetUrl('documentos', path).
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

    archivoUrls.push(upload.path)
  }

  // Leer el tipo de documento: necesitamos nombre (matrícula), vigencia_tipo y
  // periodicidad (auto-cálculo de fecha_vencimiento para docs periódicos).
  const { data: tipoDoc } = await supabase
    .from('documentos_tipos')
    .select('nombre, vigencia_tipo, periodicidad')
    .eq('id', tipoId)
    .single()

  const esMatricula = tipoDoc?.nombre?.toLowerCase().includes('matrícula')

  // Auto-calcular fecha_vencimiento cuando el tipo es periódico y el usuario
  // no ingresó una fecha manual.
  let fechaVencimiento = fechaVencimientoManual
  if (!fechaVencimiento && fechaEmision) {
    if (tipoDoc?.vigencia_tipo === 'periodica' && tipoDoc.periodicidad) {
      fechaVencimiento = calcularFechaVencimiento(tipoDoc.periodicidad, fechaEmision)
    }
  }

  const { data: docRow, error } = await supabase
    .from('personas_documentos')
    .insert({
      persona_id: trabajadorId,
      tipo_id: tipoId,
      fecha_emision: fechaEmision,
      fecha_vencimiento: fechaVencimiento,
      subido_por: user.id,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  // Guardar cada archivo en la tabla hija (normalización 1FN).
  if (archivoUrls.length > 0 && docRow) {
    await supabase
      .from('personas_documentos_archivos')
      .insert(archivoUrls.map(url => ({ documento_id: docRow.id, url })))
  }

  // Si es matrícula, sincronizar con tabla matriculas
  if (esMatricula && archivoUrls.length > 0) {
    // matriculas.fecha_emision y fecha_vencimiento son NOT NULL: sin ambas fechas no
    // se puede crear una matrícula válida. Antes el upsert hacía `|| null` -> violaba
    // el NOT NULL y el error se tragaba (misma clase que el bug de fecha_planificada).
    // Si faltan fechas, se omite el sync a matriculas; el documento queda igual en
    // personas_documentos.
    if (docRow && fechaEmision && fechaVencimiento) {
      // El certificado de la matrícula vive en el bucket `certificados` (igual que
      // createMatricula y que la lectura en trabajador-modal: useSignedUrls('certificados')).
      // Antes se guardaba el path del bucket `documentos` -> la signed URL se firmaba
      // contra el bucket equivocado y el archivo no abría. Subimos a `certificados` y
      // guardamos ESE path; si no se puede subir, certificado_url queda null (mejor que
      // un link roto) y el documento sigue disponible vía personas_documentos.
      const { data: mat, error: matErr } = await supabase.from('matriculas').upsert({
        persona_id: trabajadorId,
        numero: formData.get('numero_matricula') as string || '—',
        fecha_emision: fechaEmision,
        fecha_vencimiento: fechaVencimiento,
        activa: true,
      }, { onConflict: 'persona_id,numero', ignoreDuplicates: false })
        .select('id')
        .single()
      if (matErr) return { success: false, error: 'Error al sincronizar la matrícula: ' + matErr.message }

      if (mat && files.length > 0) {
        const up = await uploadAsset({
          bucket: 'certificados',
          consultoraId,
          entityType: 'matricula',
          entityId: mat.id,
          kind: 'certificado',
          file: files[0],
        })
        if (up.ok) {
          await supabase.from('matriculas').update({ certificado_url: up.path }).eq('id', mat.id)
        }
      }
    }
  }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
