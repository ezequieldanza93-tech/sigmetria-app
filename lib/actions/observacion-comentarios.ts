'use server'
import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

async function isViewerRole(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('consultoras_members')
    .select('role')
    .eq('user_id', userId)
    .eq('is_active', true)
    .in('role', ['full_viewer', 'colaborador_viewer', 'visualizador_comentarista'])
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
  url: string,
  categoria: string | null = null
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('observaciones_fotos_cliente')
    .insert({
      observacion_id: observacionId,
      autor_id: user.id,
      url,
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
