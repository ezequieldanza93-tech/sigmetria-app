'use server'
import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromRegistroGestion, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'

export async function createObservacionGestion(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const registroGestionId = formData.get('registro_gestion_id') as string
  const descripcion = (formData.get('descripcion') as string)?.trim()
  const fechaPlanificada = formData.get('fecha_planificada') as string
  const categoriaId = (formData.get('categoria_id') as string)?.trim()

  if (!registroGestionId) return { success: false, error: 'Registro de gestión requerido' }
  if (!descripcion) return { success: false, error: 'Descripción requerida' }
  if (!fechaPlanificada) return { success: false, error: 'Fecha planificada requerida' }
  if (!categoriaId) return { success: false, error: 'Categoría requerida' }

  const { error } = await supabase.from('gestiones_observaciones').insert({
    registro_gestion_id: registroGestionId,
    descripcion,
    fecha_planificada: fechaPlanificada,
    responsable_cierre_id: (formData.get('responsable_cierre_id') as string) || null,
    categoria_id: categoriaId,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function actualizarCategoriaObservacion(
  id: string,
  categoriaId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  if (!categoriaId) return { success: false, error: 'Categoría requerida' }

  const { error } = await supabase
    .from('gestiones_observaciones')
    .update({ categoria_id: categoriaId })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function cerrarObservacion(
  id: string,
  fechaCierre: string,
  responsableCierreId: string | null,
  evidencia: File | null = null
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  let evidenciaCierreUrl: string | null = null

  if (evidencia && evidencia.size > 0) {
    // Resolvemos el registro_gestion_id de la observación para atar el path al
    // tenant DUEÑO del dato (ver lib/storage/tenant-path.ts).
    const { data: obs } = await supabase
      .from('gestiones_observaciones')
      .select('registro_gestion_id')
      .eq('id', id)
      .maybeSingle()
    const registroId = obs?.registro_gestion_id
    if (!registroId) return { success: false, error: 'No se pudo resolver el registro de la observación' }

    const consultoraId = await consultoraIdFromRegistroGestion(supabase, registroId)
    if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del registro' }

    const ext = evidencia.name.split('.').pop()
    const path = tenantStoragePath(consultoraId, 'evidencias', registroId, `${Date.now()}.${ext}`)
    const { data: upload, error: uploadError } = await supabase.storage
      .from('documentos')
      .upload(path, evidencia, { cacheControl: '3600', upsert: false, contentType: evidencia.type || undefined })
    if (uploadError) return { success: false, error: 'Error al subir archivo: ' + uploadError.message }
    // Persistimos el PATH (no la URL). Se deriva on-read con resolveAssetUrl('documentos', path).
    evidenciaCierreUrl = upload.path
  }

  const { error } = await supabase
    .from('gestiones_observaciones')
    .update({
      fecha_cierre: fechaCierre,
      responsable_cierre_id: responsableCierreId,
      evidencia_cierre_url: evidenciaCierreUrl,
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
