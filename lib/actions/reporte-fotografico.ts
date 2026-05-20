'use server'
import { createClient } from '@/lib/supabase/server'
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
    .eq('nombre', 'Reportes Fotográficos del Sitio')
    .maybeSingle()

  if (!gestion) return { success: false, error: 'No se encontró la gestión "Reportes Fotográficos del Sitio" en el catálogo' }

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
  const path = `reportes-fotograficos/${establecimientoId}/${Date.now()}.${ext}`
  const { data: upload, error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(path, file, { upsert: false })
  if (uploadError) return { success: false, error: 'Error al subir imagen: ' + uploadError.message }

  const { data: { publicUrl } } = supabase.storage.from('documentos').getPublicUrl(upload.path)

  const { data: reg, error: registroError } = await supabase.from('gestiones_registros').insert({
    gestion_establecimiento_id: geId,
    fecha_planificada: today,
    fecha_ejecutada: today,
    evidencia_url: publicUrl,
    notas: comentario,
  }).select('id').single()
  if (registroError) return { success: false, error: registroError.message }

  if (observacionesRaw) {
    try {
      const observaciones: Array<{ descripcion: string; clasificacion_id: string; responsable_id: string; fecha_subsanacion: string }> = JSON.parse(observacionesRaw)
      const validas = observaciones.filter(o => o.descripcion?.trim())
      if (validas.length > 0) {
        const rows = validas.map(o => ({
          registro_gestion_id: reg.id,
          descripcion: o.descripcion.trim(),
          clasificacion_id: o.clasificacion_id || null,
          responsable_id: o.responsable_id || null,
          fecha_planificada: o.fecha_subsanacion || null,
        }))
        await supabase.from('gestiones_observaciones').insert(rows)
      }
    } catch { }
  }

  return { success: true, data: null }
}
