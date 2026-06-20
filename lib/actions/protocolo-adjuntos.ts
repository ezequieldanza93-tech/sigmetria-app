'use server'

/**
 * protocolo-adjuntos.ts — Subida MANUAL de adjuntos (encomienda / plano / otro) a
 * un protocolo ejecutado. Estos adjuntos se FUSIONAN al PDF al emitir la evidencia
 * (ver lib/pdf/anexos-manuales.ts).
 *
 * Espeja el patrón de guardarEvidenciaProtocolo: resuelve el tenant por la jerarquía
 * de datos (consultoraIdFromRegistroGestion), sube al bucket privado `documentos`
 * con tenantStoragePath y persiste el PATH (no la URL). La RLS de protocolo_adjuntos
 * filtra por miembro activo de la consultora dueña del registro.
 */

import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromRegistroGestion, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'

export type TipoAdjuntoProtocolo = 'encomienda' | 'plano' | 'otro'

export interface AdjuntoProtocoloItem {
  id: string
  tipo: string
  nombre: string
  mime: string | null
  url: string | null
}

/** Extensión a partir del mime o, en su defecto, del nombre del archivo. */
function deducirExtension(mime: string | null, nombre: string): string {
  const porMime: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/gif': 'gif',
  }
  if (mime && porMime[mime]) return porMime[mime]
  const m = nombre.match(/\.([a-z0-9]+)$/i)
  if (m) return m[1].toLowerCase()
  return 'bin'
}

/** Parsea un dataURL base64 → { mime, buffer }. */
function parseDataUrl(dataUrl: string): { mime: string | null; buffer: Buffer } {
  const comma = dataUrl.indexOf(',')
  if (!dataUrl.startsWith('data:') || comma === -1) {
    // No es un dataURL: lo tratamos como base64 crudo.
    return { mime: null, buffer: Buffer.from(dataUrl, 'base64') }
  }
  const header = dataUrl.slice(5, comma) // entre "data:" y la coma
  const mimeMatch = header.match(/^([^;]+)/)
  const mime = mimeMatch ? mimeMatch[1] || null : null
  const payload = dataUrl.slice(comma + 1)
  return { mime, buffer: Buffer.from(payload, 'base64') }
}

/**
 * Resuelve la `fecha_planificada` autoritativa del registro. El parámetro
 * `rgFechaPlanificada` puede venir vacío (gestiones sin fecha planificada), pero
 * `protocolo_adjuntos.rg_fecha_planificada` es NOT NULL, así que la traemos del
 * registro cuando no viene.
 */
async function resolverFechaPlanificada(
  supabase: Awaited<ReturnType<typeof createClient>>,
  registroId: string,
  rgFechaPlanificada: string,
): Promise<string | null> {
  if (rgFechaPlanificada) return rgFechaPlanificada
  const { data } = await supabase
    .from('gestiones_registros')
    .select('fecha_planificada')
    .eq('id', registroId)
    .order('fecha_planificada', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data?.fecha_planificada as string | null) ?? null
}

/**
 * Sube un adjunto manual al protocolo y lo registra en protocolo_adjuntos.
 * El archivo llega como dataURL base64 (leído en el cliente con FileReader).
 */
export async function subirAdjuntoProtocolo(
  registroId: string,
  rgFechaPlanificada: string,
  tipo: TipoAdjuntoProtocolo,
  dataUrlBase64: string,
  nombre: string,
): Promise<ActionResult<{ id: string }>> {
  if (!registroId) return { success: false, error: 'registroId requerido' }
  if (!dataUrlBase64) return { success: false, error: 'Archivo vacío' }

  const supabase = await createClient()

  const consultoraId = await consultoraIdFromRegistroGestion(supabase, registroId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del registro' }

  const fechaPlanificada = await resolverFechaPlanificada(supabase, registroId, rgFechaPlanificada)
  if (!fechaPlanificada) return { success: false, error: 'No se pudo resolver la fecha planificada del registro' }

  const { mime, buffer } = parseDataUrl(dataUrlBase64)
  if (buffer.length === 0) return { success: false, error: 'El archivo no tiene contenido' }

  const ext = deducirExtension(mime, nombre)
  const path = tenantStoragePath(
    consultoraId,
    'protocolo-adjuntos',
    registroId,
    `${tipo}-${Date.now()}.${ext}`,
  )

  const { data: upload, error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(path, buffer, { contentType: mime ?? 'application/octet-stream', upsert: false })
  if (uploadError) return { success: false, error: 'Error al subir el adjunto: ' + uploadError.message }

  const { data: { user } } = await supabase.auth.getUser()

  const { data: row, error: insError } = await supabase
    .from('protocolo_adjuntos')
    .insert({
      registro_gestion_id: registroId,
      rg_fecha_planificada: fechaPlanificada,
      tipo,
      file_path: upload.path,
      mime,
      nombre,
      created_by: user?.id ?? null,
    })
    .select('id')
    .single()

  if (insError || !row) {
    // Best-effort: limpiamos el objeto subido si la fila no se pudo insertar.
    await supabase.storage.from('documentos').remove([upload.path])
    return { success: false, error: 'Error al registrar el adjunto: ' + (insError?.message ?? 'desconocido') }
  }

  return { success: true, data: { id: row.id as string } }
}

/**
 * Lista los adjuntos del registro con su signed URL (1h) para ver/descargar.
 * Filtra por rg_fecha_planificada solo si viene (gestiones sin fecha → todos).
 */
export async function getAdjuntosProtocolo(
  registroId: string,
  rgFechaPlanificada: string,
): Promise<AdjuntoProtocoloItem[]> {
  if (!registroId) return []

  const supabase = await createClient()

  let query = supabase
    .from('protocolo_adjuntos')
    .select('id, tipo, nombre, mime, file_path')
    .eq('registro_gestion_id', registroId)
    .order('created_at', { ascending: true })
  if (rgFechaPlanificada) query = query.eq('rg_fecha_planificada', rgFechaPlanificada)

  const { data, error } = await query
  if (error || !data) return []

  const rows = data as { id: string; tipo: string; nombre: string | null; mime: string | null; file_path: string }[]

  // Signed URLs en batch (una sola llamada al API de storage).
  const paths = rows.map(r => r.file_path)
  const urlByPath = new Map<string, string | null>()
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage.from('documentos').createSignedUrls(paths, 60 * 60)
    if (signed) {
      for (const s of signed) {
        if (s.path) urlByPath.set(s.path, s.signedUrl ?? null)
      }
    }
  }

  return rows.map(r => ({
    id: r.id,
    tipo: r.tipo,
    nombre: r.nombre ?? '(sin nombre)',
    mime: r.mime,
    url: urlByPath.get(r.file_path) ?? null,
  }))
}

/**
 * Elimina un adjunto: borra la fila y, best-effort, el objeto de storage.
 */
export async function eliminarAdjuntoProtocolo(id: string): Promise<ActionResult> {
  if (!id) return { success: false, error: 'id requerido' }

  const supabase = await createClient()

  // Traemos el path para limpiar el objeto luego de borrar la fila.
  const { data: row } = await supabase
    .from('protocolo_adjuntos')
    .select('file_path')
    .eq('id', id)
    .maybeSingle()

  const { error: delError } = await supabase.from('protocolo_adjuntos').delete().eq('id', id)
  if (delError) return { success: false, error: 'Error al eliminar el adjunto: ' + delError.message }

  const filePath = (row as { file_path?: string } | null)?.file_path
  if (filePath) {
    // Best-effort: si falla el borrado del objeto, la fila ya no existe igual.
    await supabase.storage.from('documentos').remove([filePath])
  }

  return { success: true, data: null }
}
