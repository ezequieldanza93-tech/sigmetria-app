'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'

// Foto de perfil + imágenes del DNI de una persona. Se guardan en el bucket privado
// `documentos` con path por tenant {consultora_id}/persona/{persona_id}/{kind}.{ext}
// (la RLS per-tenant de storage ya lo cubre; se firma con useSignedUrls('documentos')).

const MAX_BYTES = 5 * 1024 * 1024
const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}
const CAMPO: Record<string, 'foto_url' | 'dni_frente_url' | 'dni_dorso_url'> = {
  foto: 'foto_url',
  dni_frente: 'dni_frente_url',
  dni_dorso: 'dni_dorso_url',
}
export type ImagenPersonaKind = keyof typeof CAMPO

async function consultoraDelUsuario(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  return (data?.consultora_id as string | undefined) ?? null
}

export async function subirImagenPersona(
  personaId: string,
  kind: ImagenPersonaKind,
  formData: FormData,
): Promise<ActionResult<{ path: string }>> {
  const supabase = await createClient()
  const campo = CAMPO[kind]
  if (!campo) return { success: false, error: 'Tipo de imagen inválido' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { success: false, error: 'Archivo vacío o inválido' }
  if (file.size > MAX_BYTES) return { success: false, error: 'El archivo supera los 5 MB' }
  const ext = MIME_EXT[file.type]
  if (!ext) return { success: false, error: 'Solo PNG, JPG, WEBP o PDF' }

  const consultoraId = await consultoraDelUsuario(supabase)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora' }

  const path = `${consultoraId}/persona/${personaId}/${kind}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('documentos')
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })
  if (upErr) return { success: false, error: upErr.message }

  // Borrar el archivo previo si tenía otra extensión (evita huérfanos).
  const { data: prev } = await supabase
    .from('personas_directorio')
    .select('foto_url, dni_frente_url, dni_dorso_url')
    .eq('id', personaId)
    .single()
  const prevPath = (prev as Record<string, string | null> | null)?.[campo]
  if (prevPath && prevPath !== path) {
    await supabase.storage.from('documentos').remove([prevPath])
  }

  const { error } = await supabase.from('personas_directorio').update({ [campo]: path }).eq('id', personaId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: { path } }
}

export async function quitarImagenPersona(
  personaId: string,
  kind: ImagenPersonaKind,
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const campo = CAMPO[kind]
  if (!campo) return { success: false, error: 'Tipo de imagen inválido' }

  const { data } = await supabase
    .from('personas_directorio')
    .select('foto_url, dni_frente_url, dni_dorso_url')
    .eq('id', personaId)
    .single()
  const path = (data as Record<string, string | null> | null)?.[campo]
  if (path) await supabase.storage.from('documentos').remove([path])

  const { error } = await supabase.from('personas_directorio').update({ [campo]: null }).eq('id', personaId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}
