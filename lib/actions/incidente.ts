'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult, SeguimientoEstado, SeguimientoHistorico } from '@/lib/types'
import { canWrite } from '@/lib/types'
import { estadoSiguiente } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'
import { incidenteCreateSchema } from '@/lib/validation/schemas'

export async function createIncidente(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (!membership || !profile) return { success: false, error: 'Sin permisos' }
  if (!canWrite(membership.role, profile.system_role)) return { success: false, error: 'No tenés permisos para crear incidentes' }

  const parsed = validateFormData(incidenteCreateSchema, formData)
  if (!parsed.success) return { success: false, error: formatZodErrors(parsed.error) }

  const data = parsed.data
  const empresaId = data.empresa_id

  const estadoInicial: SeguimientoEstado = 'recibida'
  const historial: SeguimientoHistorico[] = [{
    estado: estadoInicial,
    fecha: new Date().toISOString(),
    usuario_id: user.id,
  }]

  const { error } = await supabase
    .from('incidentes')
    .insert({
      consultora_id: membership.consultora_id,
      empresa_id: empresaId,
      establecimiento_id: data.establecimiento_id || null,
      titulo: data.titulo,
      descripcion: data.descripcion,
      tipo_incidente: data.tipo_incidente,
      severidad: data.severidad,
      fecha_incidente: data.fecha_incidente,
      hora_incidente: data.hora_incidente || null,
      lugar_especifico: data.lugar_especifico || null,
      involucrados: data.involucrados || null,
      testigos: data.testigos || null,
      estado: estadoInicial,
      historial_estados: historial,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/incidentes')
  redirect('/dashboard/incidentes')
}

export async function updateEstadoIncidente(
  incidenteId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  // Get current incidente
  const { data: incidente } = await supabase
    .from('incidentes')
    .select('estado, historial_estados, acciones_tomadas, conclusion')
    .eq('id', incidenteId)
    .single()

  if (!incidente) return { success: false, error: 'Incidente no encontrado' }

  const nextEstado = estadoSiguiente(incidente.estado as SeguimientoEstado)
  if (!nextEstado) return { success: false, error: 'El incidente ya está en el estado final' }

  const accionesTomadas = formData.get('acciones_tomadas') as string | null
  const conclusion = formData.get('conclusion') as string | null
  const esCerrada = nextEstado === 'cerrada'

  const historial = (incidente.historial_estados || []) as SeguimientoHistorico[]
  historial.push({
    estado: nextEstado,
    fecha: new Date().toISOString(),
    usuario_id: user.id,
  })

  const updateData: Record<string, unknown> = {
    estado: nextEstado,
    historial_estados: historial,
  }

  if (accionesTomadas?.trim()) {
    updateData.acciones_tomadas = (incidente.acciones_tomadas || '') + (incidente.acciones_tomadas ? '\n' : '') + `${new Date().toLocaleDateString('es-AR')}: ${accionesTomadas}`
  }

  if (esCerrada) {
    updateData.cerrado_por = user.id
    updateData.fecha_cierre = new Date().toISOString()
    if (conclusion?.trim()) updateData.conclusion = conclusion
  }

  const { error } = await supabase
    .from('incidentes')
    .update(updateData)
    .eq('id', incidenteId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/incidentes/${incidenteId}`)
  revalidatePath('/dashboard/incidentes')
  return { success: true, data: null }
}

export async function subirFotosIncidente(
  incidenteId: string,
  formData: FormData
): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: incidente } = await supabase
    .from('incidentes')
    .select('consultora_id')
    .eq('id', incidenteId)
    .single()

  if (!incidente) return { success: false, error: 'Incidente no encontrado' }

  const files: File[] = []
  for (let i = 0; ; i++) {
    const file = formData.get(`foto_${i}`) as File | null
    if (!file || file.size === 0) break
    files.push(file)
  }

  if (files.length === 0) return { success: false, error: 'No hay fotos para subir' }

  let uploaded = 0
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const path = `${incidente.consultora_id}/incidente/${incidenteId}/${filename}`

    const { error: uploadError } = await supabase.storage
      .from('incidentes')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) continue

    const { data: signed } = await supabase.storage
      .from('incidentes')
      .createSignedUrl(path, 60 * 60 * 24 * 365)

    if (!signed) continue

    const { error: dbError } = await supabase
      .from('incidentes_fotos')
      .insert({
        incidente_id: incidenteId,
        url: signed.signedUrl,
        filename: file.name,
      })

    if (dbError) continue
    uploaded++
  }

  if (uploaded === 0) return { success: false, error: 'No se pudo subir ninguna foto' }

  revalidatePath(`/dashboard/incidentes/${incidenteId}`)
  return { success: true, data: { count: uploaded } }
}

export async function eliminarFotoIncidente(
  fotoId: string,
  _prev: ActionResult<null> | null,
  _formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: foto } = await supabase
    .from('incidentes_fotos')
    .select('url, incidente_id')
    .eq('id', fotoId)
    .single()

  if (!foto) return { success: false, error: 'Foto no encontrada' }

  const path = foto.url.includes('/incidentes/')
    ? foto.url.split('/incidentes/')[1]?.split('?')[0]
    : null

  if (path) {
    await supabase.storage.from('incidentes').remove([path])
  }

  const { error } = await supabase
    .from('incidentes_fotos')
    .delete()
    .eq('id', fotoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/incidentes/${foto.incidente_id}`)
  return { success: true, data: null }
}
