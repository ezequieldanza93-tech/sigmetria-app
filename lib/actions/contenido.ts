'use server'

import { randomUUID } from 'node:crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { canAccessContenido } from '@/lib/contenido/access'
import { uploadAsset, deleteAsset } from '@/lib/storage/upload'
import type { ActionResult } from '@/lib/types'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

/** Slot de media en el orden final que mandó el form. */
type MediaSlot =
  | { type: 'existing'; id: string }
  | { type: 'new'; fileIndex: number }

interface Gate {
  supabase: SupabaseServerClient
  userId: string
  consultoraId: string
}

/**
 * Resuelve sesión + consultora + gate de rol full_access.
 * Espejo del gate de la RLS (contenido_can_manage). Defensa en profundidad:
 * aunque la RLS rechace, devolvemos un error limpio en vez de un fallo opaco.
 */
async function gate(): Promise<Gate | { error: string }> {
  const eff = await getEffectiveRole()
  if (!eff) return { error: 'No autenticado' }
  if (!canAccessContenido(eff.effectiveUserRole, eff.effectiveSystemRole)) {
    return { error: 'No tenés permisos para gestionar contenido' }
  }
  if (!eff.consultoraId) return { error: 'No se pudo resolver la consultora' }
  const supabase = await createClient()
  return { supabase, userId: eff.userId, consultoraId: eff.consultoraId }
}

function isGate(g: Gate | { error: string }): g is Gate {
  return 'supabase' in g
}

// ── Parsing del form ─────────────────────────────────────────

function parseSlots(formData: FormData): MediaSlot[] {
  const raw = formData.get('orden')
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = JSON.parse(raw) as MediaSlot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Normaliza el texto de hashtags a una lista única (sin #, en minúsculas). */
function parseHashtags(formData: FormData): string[] {
  const raw = (formData.get('hashtags') as string | null) ?? ''
  const list = raw
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, '').trim().toLowerCase())
    .filter(Boolean)
  return Array.from(new Set(list))
}

// ── Sincronización de hashtags (find-or-create + junction) ───

async function syncHashtags(
  supabase: SupabaseServerClient,
  publicacionId: string,
  textos: string[],
): Promise<{ error?: string }> {
  // Limpiamos el junction actual (en update puede haber cambios).
  await supabase.from('contenido_publicacion_hashtags').delete().eq('publicacion_id', publicacionId)
  if (textos.length === 0) return {}

  // find-or-create del vocabulario: upsert por `texto` (no-op si ya existe) y
  // recuperamos los ids de todos.
  const { data: rows, error } = await supabase
    .from('contenido_hashtags')
    .upsert(textos.map((texto) => ({ texto })), { onConflict: 'texto' })
    .select('id, texto')
  if (error) return { error: `Error al guardar hashtags: ${error.message}` }

  const ids = (rows ?? []).map((r) => r.id as string)
  if (ids.length === 0) return {}

  const { error: junctionError } = await supabase
    .from('contenido_publicacion_hashtags')
    .insert(ids.map((hashtag_id) => ({ publicacion_id: publicacionId, hashtag_id })))
  if (junctionError) return { error: `Error al asociar hashtags: ${junctionError.message}` }
  return {}
}

// ── Sincronización de media (alta / baja / reordenamiento) ───

async function syncMedia(
  supabase: SupabaseServerClient,
  publicacionId: string,
  consultoraId: string,
  slots: MediaSlot[],
  files: File[],
): Promise<{ error?: string }> {
  // tipo_media_id por slug (imagen/video) — derivado del mime del archivo.
  const { data: tipos } = await supabase.from('contenido_tipos_media').select('id, slug')
  const tipoIdBySlug = new Map<string, number>()
  for (const t of tipos ?? []) tipoIdBySlug.set(t.slug as string, t.id as number)
  const tipoImagen = tipoIdBySlug.get('imagen')
  const tipoVideo = tipoIdBySlug.get('video')
  if (tipoImagen == null || tipoVideo == null) {
    return { error: 'Catálogo de tipos de media incompleto' }
  }

  // Media existente de la publicación.
  const { data: existentes } = await supabase
    .from('contenido_publicacion_media')
    .select('id, storage_path, orden')
    .eq('publicacion_id', publicacionId)
  const existing = existentes ?? []

  const survivorIds = new Set(
    slots.filter((s): s is { type: 'existing'; id: string } => s.type === 'existing').map((s) => s.id),
  )

  // 1. Bajas: media que estaba pero ya no figura en el orden final.
  const removed = existing.filter((m) => !survivorIds.has(m.id as string))
  if (removed.length > 0) {
    const paths = removed.map((m) => m.storage_path as string)
    await Promise.all(paths.map((p) => deleteAsset('contenido', p)))
    await supabase
      .from('contenido_publicacion_media')
      .delete()
      .in('id', removed.map((m) => m.id as string))
  }

  // 2. Fase A: bumpear sobrevivientes a un orden temporal alto y único para
  //    liberar las posiciones finales (esquiva el UNIQUE(publicacion_id, orden)).
  const survivors = existing.filter((m) => survivorIds.has(m.id as string))
  for (let i = 0; i < survivors.length; i++) {
    await supabase
      .from('contenido_publicacion_media')
      .update({ orden: 1000 + i })
      .eq('id', survivors[i].id as string)
  }

  // 3. Fase B: una pasada en el orden final. new → upload + insert; existing → update orden.
  for (let index = 0; index < slots.length; index++) {
    const slot = slots[index]
    if (slot.type === 'existing') {
      const { error } = await supabase
        .from('contenido_publicacion_media')
        .update({ orden: index })
        .eq('id', slot.id)
        .eq('publicacion_id', publicacionId)
      if (error) return { error: `Error al reordenar media: ${error.message}` }
    } else {
      const file = files[slot.fileIndex]
      if (!file || file.size === 0) continue
      const mediaId = randomUUID()
      const result = await uploadAsset({
        bucket: 'contenido',
        consultoraId,
        entityType: 'contenido',
        entityId: publicacionId,
        kind: mediaId,
        file,
      })
      if (!result.ok) return { error: `Error al subir media: ${result.error}` }

      const esVideo = file.type.startsWith('video/')
      const { error } = await supabase.from('contenido_publicacion_media').insert({
        id: mediaId,
        publicacion_id: publicacionId,
        orden: index,
        tipo_media_id: esVideo ? tipoVideo : tipoImagen,
        storage_path: result.path,
        size_bytes: file.size,
        mime: file.type,
      })
      if (error) return { error: `Error al registrar media: ${error.message}` }
    }
  }

  return {}
}

// ── Validación común de campos ───────────────────────────────

interface PubFields {
  titulo: string
  descripcion: string | null
  formato_id: number
  estado_id: number
  fecha_programada: string | null
}

function parseFields(formData: FormData): PubFields | { error: string } {
  const titulo = ((formData.get('titulo') as string) ?? '').trim()
  if (!titulo) return { error: 'El título es obligatorio' }

  const formato_id = Number(formData.get('formato_id'))
  if (!Number.isInteger(formato_id) || formato_id <= 0) return { error: 'Elegí un formato válido' }

  const estado_id = Number(formData.get('estado_id'))
  if (!Number.isInteger(estado_id) || estado_id <= 0) return { error: 'Elegí un estado válido' }

  const descripcion = ((formData.get('descripcion') as string) ?? '').trim() || null
  const fechaRaw = ((formData.get('fecha_programada') as string) ?? '').trim()

  return { titulo, descripcion, formato_id, estado_id, fecha_programada: fechaRaw || null }
}

// ── Server actions públicas ──────────────────────────────────

export async function createPublicacion(
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const g = await gate()
  if (!isGate(g)) return { success: false, error: g.error }

  const fields = parseFields(formData)
  if ('error' in fields) return { success: false, error: fields.error }

  const { data: pub, error } = await g.supabase
    .from('contenido_publicaciones')
    .insert({
      consultora_id: g.consultoraId,
      formato_id: fields.formato_id,
      estado_id: fields.estado_id,
      titulo: fields.titulo,
      descripcion: fields.descripcion,
      fecha_programada: fields.fecha_programada,
      created_by: g.userId,
    })
    .select('id')
    .single()
  if (error || !pub) return { success: false, error: error?.message ?? 'No se pudo crear la publicación' }

  const slots = parseSlots(formData)
  const files = formData.getAll('media').filter((f): f is File => f instanceof File)
  const mediaRes = await syncMedia(g.supabase, pub.id as string, g.consultoraId, slots, files)
  if (mediaRes.error) return { success: false, error: mediaRes.error }

  const hashRes = await syncHashtags(g.supabase, pub.id as string, parseHashtags(formData))
  if (hashRes.error) return { success: false, error: hashRes.error }

  revalidatePath('/dashboard/contenido')
  return { success: true, data: { id: pub.id as string } }
}

export async function updatePublicacion(
  publicacionId: string,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  const g = await gate()
  if (!isGate(g)) return { success: false, error: g.error }

  const fields = parseFields(formData)
  if ('error' in fields) return { success: false, error: fields.error }

  const { error } = await g.supabase
    .from('contenido_publicaciones')
    .update({
      formato_id: fields.formato_id,
      estado_id: fields.estado_id,
      titulo: fields.titulo,
      descripcion: fields.descripcion,
      fecha_programada: fields.fecha_programada,
    })
    .eq('id', publicacionId)
    .eq('consultora_id', g.consultoraId)
  if (error) return { success: false, error: error.message }

  const slots = parseSlots(formData)
  const files = formData.getAll('media').filter((f): f is File => f instanceof File)
  const mediaRes = await syncMedia(g.supabase, publicacionId, g.consultoraId, slots, files)
  if (mediaRes.error) return { success: false, error: mediaRes.error }

  const hashRes = await syncHashtags(g.supabase, publicacionId, parseHashtags(formData))
  if (hashRes.error) return { success: false, error: hashRes.error }

  revalidatePath('/dashboard/contenido')
  return { success: true, data: { id: publicacionId } }
}

export async function deletePublicacion(publicacionId: string): Promise<ActionResult<null>> {
  const g = await gate()
  if (!isGate(g)) return { success: false, error: g.error }

  // Borramos los objetos de Storage antes de la fila (el cascade limpia las
  // filas de media/hashtags, pero no los archivos físicos).
  const { data: media } = await g.supabase
    .from('contenido_publicacion_media')
    .select('storage_path')
    .eq('publicacion_id', publicacionId)
  if (media && media.length > 0) {
    await Promise.all(media.map((m) => deleteAsset('contenido', m.storage_path as string)))
  }

  const { error } = await g.supabase
    .from('contenido_publicaciones')
    .delete()
    .eq('id', publicacionId)
    .eq('consultora_id', g.consultoraId)
  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/contenido')
  return { success: true, data: null }
}
