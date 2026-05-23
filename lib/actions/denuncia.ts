'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import type { ActionResult, SeguimientoEstado, SeguimientoHistorico } from '@/lib/types'
import { canWrite } from '@/lib/types'
import { estadoSiguiente } from '@/lib/types'
import { validateFormData, formatZodErrors } from '@/lib/validation/helpers'
import { denunciaCreateSchema } from '@/lib/validation/schemas'

export async function createDenuncia(
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
  if (!canWrite(membership.role, profile.system_role)) return { success: false, error: 'No tenés permisos para crear denuncias' }

  const parsed = validateFormData(denunciaCreateSchema, formData)
  if (!parsed.success) return { success: false, error: formatZodErrors(parsed.error) }

  const data = parsed.data

  const estadoInicial: SeguimientoEstado = 'recibida'
  const historial: SeguimientoHistorico[] = [{
    estado: estadoInicial,
    fecha: new Date().toISOString(),
    usuario_id: user.id,
  }]

  const { error } = await supabase
    .from('denuncias')
    .insert({
      consultora_id: membership.consultora_id,
      empresa_id: data.empresa_id,
      establecimiento_id: data.establecimiento_id || null,
      titulo: data.titulo,
      descripcion: data.descripcion,
      tipo_denuncia: data.tipo_denuncia,
      denunciante_tipo: data.denunciante_tipo,
      denunciante_nombre: data.denunciante_nombre || null,
      denunciante_dni: data.denunciante_dni || null,
      denunciante_contacto: data.denunciante_contacto || null,
      fecha_denuncia: data.fecha_denuncia,
      involucrados: data.involucrados || null,
      confidencial: data.confidencial ? true : false,
      estado: estadoInicial,
      historial_estados: historial,
    })

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/denuncias')
  redirect('/dashboard/denuncias')
}

export async function updateEstadoDenuncia(
  denunciaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: denuncia } = await supabase
    .from('denuncias')
    .select('estado, historial_estados, acciones_tomadas, conclusion')
    .eq('id', denunciaId)
    .single()

  if (!denuncia) return { success: false, error: 'Denuncia no encontrada' }

  const nextEstado = estadoSiguiente(denuncia.estado as SeguimientoEstado)
  if (!nextEstado) return { success: false, error: 'La denuncia ya está en el estado final' }

  const accionesTomadas = formData.get('acciones_tomadas') as string | null
  const conclusion = formData.get('conclusion') as string | null
  const esCerrada = nextEstado === 'cerrada'

  const historial = (denuncia.historial_estados || []) as SeguimientoHistorico[]
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
    updateData.acciones_tomadas = (denuncia.acciones_tomadas || '') + (denuncia.acciones_tomadas ? '\n' : '') + `${new Date().toLocaleDateString('es-AR')}: ${accionesTomadas}`
  }

  if (esCerrada) {
    updateData.cerrado_por = user.id
    updateData.fecha_cierre = new Date().toISOString()
    if (conclusion?.trim()) updateData.conclusion = conclusion
  }

  const { error } = await supabase
    .from('denuncias')
    .update(updateData)
    .eq('id', denunciaId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/denuncias/${denunciaId}`)
  revalidatePath('/dashboard/denuncias')
  return { success: true, data: null }
}

export async function subirFotosDenuncia(
  denunciaId: string,
  formData: FormData
): Promise<ActionResult<{ count: number }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: denuncia } = await supabase
    .from('denuncias')
    .select('consultora_id')
    .eq('id', denunciaId)
    .single()

  if (!denuncia) return { success: false, error: 'Denuncia no encontrada' }

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
    const path = `${denuncia.consultora_id}/denuncia/${denunciaId}/${filename}`

    const { error: uploadError } = await supabase.storage
      .from('denuncias')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) continue

    const { data: signed } = await supabase.storage
      .from('denuncias')
      .createSignedUrl(path, 60 * 60 * 24 * 365)

    if (!signed) continue

    const { error: dbError } = await supabase
      .from('denuncias_fotos')
      .insert({
        denuncia_id: denunciaId,
        url: signed.signedUrl,
        filename: file.name,
      })

    if (dbError) continue
    uploaded++
  }

  if (uploaded === 0) return { success: false, error: 'No se pudo subir ninguna foto' }

  revalidatePath(`/dashboard/denuncias/${denunciaId}`)
  return { success: true, data: { count: uploaded } }
}

export async function eliminarFotoDenuncia(
  fotoId: string,
  _prev: ActionResult<null> | null,
  _formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: foto } = await supabase
    .from('denuncias_fotos')
    .select('url, denuncia_id')
    .eq('id', fotoId)
    .single()

  if (!foto) return { success: false, error: 'Foto no encontrada' }

  const path = foto.url.includes('/denuncias/')
    ? foto.url.split('/denuncias/')[1]?.split('?')[0]
    : null

  if (path) {
    await supabase.storage.from('denuncias').remove([path])
  }

  const { error } = await supabase
    .from('denuncias_fotos')
    .delete()
    .eq('id', fotoId)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/denuncias/${foto.denuncia_id}`)
  return { success: true, data: null }
}
