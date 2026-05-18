'use server'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

export async function createRegistroGestion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const gestionEstablecimientoId = formData.get('gestion_establecimiento_id') as string
  const fechaPlanificada = formData.get('fecha_planificada') as string
  const responsableId = formData.get('responsable_id') as string

  if (!gestionEstablecimientoId) return { success: false, error: 'Gestión requerida' }
  if (!fechaPlanificada) return { success: false, error: 'Fecha planificada requerida' }

  const { error } = await supabase.from('registro_gestiones').insert({
    gestion_establecimiento_id: gestionEstablecimientoId,
    fecha_planificada: fechaPlanificada,
    responsable_id: responsableId || null,
    notas: (formData.get('notas') as string) || null,
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

  const registroId = formData.get('registro_id') as string
  const fechaEjecutada = formData.get('fecha_ejecutada') as string
  const indexStr = formData.get('index') as string
  const notas = (formData.get('notas') as string) || null
  const responsableId = (formData.get('responsable_id') as string) || null
  const file = formData.get('evidencia') as File | null

  if (!registroId) return { success: false, error: 'Registro requerido' }
  if (!fechaEjecutada) return { success: false, error: 'Fecha de ejecución requerida' }

  const updates: Record<string, unknown> = {
    fecha_ejecutada: fechaEjecutada,
    notas,
    responsable_id: responsableId,
  }
  if (indexStr && !isNaN(Number(indexStr))) {
    updates.index = Number(indexStr)
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
    .from('registro_gestiones')
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

  const { error } = await supabase.from('observaciones_gestiones').insert(rows)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
