'use server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'

const createRegistroGestionSchema = z.object({
  gestion_establecimiento_id: z.string().min(1, { error: 'Gestión requerida' }),
  fecha_planificada: z.string().min(1, { error: 'Fecha planificada requerida' }),
  responsable_id: z.string().nullable().optional(),
  notas: z.string().nullable().optional(),
})

const ejecutarGestionSchema = z.object({
  registro_id: z.string().min(1, { error: 'Registro requerido' }),
  fecha_ejecutada: z.string().min(1, { error: 'Fecha de ejecución requerida' }),
  index: z.coerce.number().optional(),
  notas: z.string().nullable().optional(),
  responsable_id: z.string().nullable().optional(),
})

export async function createRegistroGestion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(createRegistroGestionSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { gestion_establecimiento_id: gestionEstablecimientoId, fecha_planificada: fechaPlanificada, responsable_id: responsableId, notas } = parsed.data

  const { error } = await supabase.from('gestiones_registros').insert({
    gestion_establecimiento_id: gestionEstablecimientoId,
    fecha_planificada: fechaPlanificada,
    responsable_id: responsableId || null,
    notas: notas || null,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function ejecutarGestion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = validateFormData(ejecutarGestionSchema, formData)
  if (!parsed.success) {
    return { success: false, error: formatZodErrors(parsed.error) }
  }
  const { registro_id: registroId, fecha_ejecutada: fechaEjecutada, index: indexParsed, notas, responsable_id: responsableId } = parsed.data
  const file = formData.get('evidencia') as File | null

  const updates: Record<string, unknown> = {
    fecha_ejecutada: fechaEjecutada,
    notas: notas || null,
    responsable_id: responsableId || null,
  }
  if (indexParsed !== undefined && !isNaN(indexParsed)) {
    updates.index = indexParsed
  }

  if (file && file.size > 0) {
    const ext = file.name.split('.').pop()
    const path = `evidencias/${registroId}/${Date.now()}.${ext}`
    const { data: upload, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, file, { upsert: false })
    if (uploadError) return { success: false, error: 'Error al subir archivo: ' + uploadError.message }
    const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(upload.path)
    updates.evidencia_url = publicUrl
  }

  const { error } = await supabase
    .from('gestiones_registros')
    .update(updates)
    .eq('id', registroId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function crearObservaciones(
  registroId: string,
  observaciones: Array<{
    descripcion: string
    clasificacion_id: string
    responsable_id: string
    fecha_subsanacion: string
  }>
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const rows = observaciones
    .filter(o => o.descripcion.trim())
    .map(o => ({
      registro_gestion_id: registroId,
      descripcion: o.descripcion.trim(),
      clasificacion_id: o.clasificacion_id || null,
      responsable_id: o.responsable_id || null,
      fecha_planificada: o.fecha_subsanacion || null,
    }))

  if (rows.length === 0) return { success: true, data: null }

  const { error } = await supabase.from('gestiones_observaciones').insert(rows)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
