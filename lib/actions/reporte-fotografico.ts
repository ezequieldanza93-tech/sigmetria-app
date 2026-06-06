'use server'
import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromEstablecimiento, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'

export async function crearReporteFotografico(
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const establecimientoId = formData.get('establecimiento_id') as string
  const comentario = (formData.get('comentario') as string) || null
  const file = formData.get('imagen') as File | null
  const observacionesRaw = formData.get('observaciones') as string | null

  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }
  if (!file || file.size === 0) return { success: false, error: 'Seleccioná al menos una imagen' }

  const today = new Date().toISOString().split('T')[0]

  const { data: gestion } = await supabase
    .from('gestiones')
    .select('id')
    .eq('nombre', 'Observación en recorrida de campo')
    .maybeSingle()

  if (!gestion) return { success: false, error: 'No se encontró la gestión "Observación en recorrida de campo" en el catálogo' }

  // Get or create gestion_establecimiento (single query)
  let geId: string
  const { data: existing } = await supabase
    .from('gestiones_establecimientos')
    .select('id')
    .eq('gestion_id', gestion.id)
    .eq('establecimiento_id', establecimientoId)
    .maybeSingle()

  if (existing) {
    geId = existing.id
  } else {
    const { data: created, error: insertError } = await supabase
      .from('gestiones_establecimientos')
      .insert({ gestion_id: gestion.id, establecimiento_id: establecimientoId })
      .select('id')
      .single()
    if (insertError) return { success: false, error: insertError.message }
    geId = created.id
  }

  const ext = file.name.split('.').pop() ?? 'png'
  // El path de un bucket PRIVADO debe empezar con el consultora_id para que la
  // RLS de lectura por tenant matchee (ver lib/storage/tenant-path.ts).
  const consultoraId = await consultoraIdFromEstablecimiento(supabase, establecimientoId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del establecimiento' }
  const path = tenantStoragePath(consultoraId, 'reportes-fotograficos', establecimientoId, `${Date.now()}.${ext}`)
  const { data: upload, error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(path, file, { upsert: false })
  if (uploadError) return { success: false, error: 'Error al subir imagen: ' + uploadError.message }

  // Persistimos el PATH (no la URL). Se deriva on-read con publicAssetUrl('documentos', path).
  const { data: reg, error: registroError } = await supabase.from('gestiones_registros').insert({
    gestion_establecimiento_id: geId,
    fecha_planificada: today,
    fecha_ejecutada: today,
    evidencia_url: upload.path,
    notas: comentario,
  }).select('id').single()
  if (registroError) return { success: false, error: registroError.message }

  if (observacionesRaw) {
    try {
      const observaciones: Array<{ descripcion: string; categoria_id: string; clasificacion_id: string; responsable_id: string; fecha_subsanacion: string; tiene_foto?: boolean }> = JSON.parse(observacionesRaw)
      const validas = observaciones.filter(o => o.descripcion?.trim() && o.categoria_id)
      if (validas.length > 0) {
        // Subimos las fotos de cada observación server-side, igual que la foto
        // principal: path prefijado por tenant para que la RLS de lectura
        // matchee. Guardamos el PATH relativo (no la URL).
        const rows = await Promise.all(validas.map(async (o, idx) => {
          let foto_url: string | null = null
          if (o.tiene_foto) {
            const obsFile = formData.get(`obs-foto-${idx}`) as File | null
            if (obsFile && obsFile.size > 0) {
              const obsExt = obsFile.name.split('.').pop() ?? 'png'
              const obsPath = tenantStoragePath(consultoraId, 'observaciones-fotos', establecimientoId, `${Date.now()}-${idx}.${obsExt}`)
              const { data: obsUp, error: obsUploadError } = await supabase.storage
                .from('documentos')
                .upload(obsPath, obsFile, { upsert: false })
              if (obsUploadError) {
                console.error('[reporteFotografico] Error al subir foto de observación:', obsUploadError.message)
              } else if (obsUp) {
                foto_url = obsUp.path
              }
            }
          }
          return {
            registro_gestion_id: reg.id,
            descripcion: o.descripcion.trim(),
            categoria_id: o.categoria_id,
            clasificacion_id: o.clasificacion_id || null,
            responsable_id: o.responsable_id || null,
            fecha_planificada: o.fecha_subsanacion || null,
            foto_url,
          }
        }))
        const { error: obsError } = await supabase.from('gestiones_observaciones').insert(rows)
        if (obsError) {
          console.error('[reporteFotografico] Error al insertar gestiones_observaciones:', obsError.message)
        }
      }
    } catch (e) { console.error('[reporteFotografico] Error parseando observaciones:', e) }
  }

  return { success: true, data: null }
}
