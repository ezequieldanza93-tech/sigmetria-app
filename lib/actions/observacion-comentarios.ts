'use server'
import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromRegistroGestion, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'

async function isViewerRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('consultoras_members')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('role', ['full_viewer', 'colaborador_viewer', 'visualizador_comentarista', 'viewer_observaciones'])
    .limit(1)
    .maybeSingle()
  return data !== null
}

export async function addObservacionComentario(
  observacionId: string,
  contenido: string
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const trimmed = contenido.trim()
  if (!trimmed) return { success: false, error: 'El comentario no puede estar vacío' }
  if (trimmed.length > 2000) return { success: false, error: 'Máximo 2000 caracteres' }

  const esViewer = await isViewerRole(supabase, user.id)

  const { data, error } = await supabase
    .from('observaciones_comentarios')
    .insert({
      observacion_id: observacionId,
      autor_id: user.id,
      es_viewer: esViewer,
      contenido: trimmed,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: { id: data.id } }
}

export async function addObservacionFoto(
  observacionId: string,
  foto: File,
  categoria: string | null = null
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  if (!foto || foto.size === 0) return { success: false, error: 'Foto requerida' }

  // Resolvemos el registro_gestion_id de la observación para atar el path al
  // tenant DUEÑO del dato (ver lib/storage/tenant-path.ts).
  const { data: obs } = await supabase
    .from('gestiones_observaciones')
    .select('registro_gestion_id')
    .eq('id', observacionId)
    .maybeSingle()
  const registroId = obs?.registro_gestion_id
  if (!registroId) return { success: false, error: 'No se pudo resolver el registro de la observación' }

  const consultoraId = await consultoraIdFromRegistroGestion(supabase, registroId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del registro' }

  const ext = foto.name.split('.').pop()
  const path = tenantStoragePath(consultoraId, 'observaciones-cliente', observacionId, `${Date.now()}.${ext}`)
  const { data: upload, error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(path, foto, { cacheControl: '3600', upsert: false, contentType: foto.type || undefined })
  if (uploadError) return { success: false, error: 'Error al subir archivo: ' + uploadError.message }

  // Persistimos el PATH (no la URL). Se deriva on-read con resolveAssetUrl('documentos', path).
  const { data, error } = await supabase
    .from('observaciones_fotos_cliente')
    .insert({
      observacion_id: observacionId,
      autor_id: user.id,
      url: upload.path,
      categoria,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: { id: data.id } }
}

export async function marcarObservacionVista(
  observacionId: string
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase.rpc('marcar_observacion_vista', {
    p_observacion_id: observacionId,
  })

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
