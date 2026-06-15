'use server'
import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromEstablecimiento, tenantStoragePath } from '@/lib/storage/tenant-path'
import { aplicarSelloGeo } from '@/lib/actions/geo-sello'
import type { ActionResult } from '@/lib/types'

/** TTL de la signed URL del PDF que devolvemos para descarga/compartir: 1 hora. */
const PDF_SIGNED_TTL_SECONDS = 60 * 60

/** Decodifica un PDF en data-URI base64 (`data:application/pdf;base64,...`) o
 *  base64 puro a un Buffer. Devuelve null si el string no es válido. */
function pdfBase64ToBuffer(raw: string): Buffer | null {
  if (!raw) return null
  const comma = raw.indexOf(',')
  const b64 = raw.startsWith('data:') && comma >= 0 ? raw.slice(comma + 1) : raw
  if (!b64) return null
  try {
    return Buffer.from(b64, 'base64')
  } catch {
    return null
  }
}

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

  // Fecha local por componentes (sin drift UTC de toISOString, que de noche en
  // AR -3 puede adelantar un día). Sirve además de fallback para fecha_planificada,
  // que es NOT NULL y ningún trigger rellena.
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

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

  // Geo-sello del lugar de la observación. fecha_planificada = today (la misma
  // con la que se insertó el registro). NO-BLOQUEANTE.
  await aplicarSelloGeo(supabase, reg.id as string, today, formData)

  if (observacionesRaw) {
    try {
      const observaciones: Array<{ descripcion: string; categoria_id: string; clasificacion_id: string; responsable_id: string; fecha_subsanacion: string }> = JSON.parse(observacionesRaw)
      const validas = observaciones.filter(o => o.descripcion?.trim() && o.categoria_id)
      if (validas.length > 0) {
        // Todas las observaciones heredan la foto principal del reporte (upload.path),
        // que es la misma que va a evidencia_url, para que se vean en Seguimiento.
        const rows = validas.map(o => ({
          registro_gestion_id: reg.id,
          // rg_fecha_planificada completa la FK compuesta hacia el registro
          // particionado (registro_gestion_id + rg_fecha_planificada) y es NOT NULL.
          // Debe matchear el fecha_planificada con el que se insertó gestiones_registros.
          rg_fecha_planificada: today,
          descripcion: o.descripcion.trim(),
          categoria_id: o.categoria_id,
          clasificacion_id: o.clasificacion_id || null,
          responsable_id: o.responsable_id || null,
          fecha_planificada: o.fecha_subsanacion || today,
          foto_url: upload.path,
        }))
        const { error: obsError } = await supabase.from('gestiones_observaciones').insert(rows)
        if (obsError) {
          console.error('[reporteFotografico] Error al insertar gestiones_observaciones:', obsError.message)
          return { success: false, error: 'El reporte se guardó, pero no se pudieron registrar las observaciones: ' + obsError.message }
        }
      }
    } catch (e) { console.error('[reporteFotografico] Error parseando observaciones:', e) }
  }

  return { success: true, data: null }
}

// ── Observación de UNA foto del paquete (viene del wizard como JSON) ──
interface ObsEjecucionInput {
  foto_index: number
  descripcion: string
  categoria_id: string
  clasificacion_id?: string | null
  responsable_id?: string | null
  fecha_subsanacion?: string | null
}

export interface ReporteEjecucionResult {
  reporteId: string
  /** Signed URL del PDF (TTL 1h) para descarga/compartir. null si no se pudo firmar. */
  pdfSignedUrl: string | null
}

/**
 * EJECUTOR de Reporte Fotográfico (multi-foto) desde una fila planificada.
 *
 * Recibe del FormData:
 *  - registro_id            → gestiones_registros que se está ejecutando (UPDATE).
 *  - establecimiento_id, gestion_establecimiento_id, rg_fecha_planificada
 *  - periodicidad (semanal|mensual|periodico), periodo_desde, periodo_hasta, comentario
 *  - pdf                    → PDF del reporte en base64 (data-URI o puro).
 *  - foto-{i}               → N fotos editadas (PNG, File).
 *  - foto_count             → cantidad de fotos.
 *  - observaciones          → JSON [{ foto_index, descripcion, categoria_id, ... }]
 *
 * Sube PDF + fotos al bucket privado `documentos` con paths tenant-prefijados
 * (path → DB, NO URL), inserta cabecera + fotos + observaciones (pool común
 * gestiones_observaciones para que entren a Seguimiento) y devuelve el id del
 * reporte + una signed URL del PDF.
 */
export async function crearReporteFotograficoEjecucion(
  formData: FormData
): Promise<ActionResult<ReporteEjecucionResult>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const registroId = (formData.get('registro_id') as string) || ''
  const establecimientoId = (formData.get('establecimiento_id') as string) || ''
  const gestionEstablecimientoId = (formData.get('gestion_establecimiento_id') as string) || ''
  const rgFechaPlanificada = (formData.get('rg_fecha_planificada') as string) || null
  const periodicidadRaw = (formData.get('periodicidad') as string) || ''
  const periodoDesde = (formData.get('periodo_desde') as string) || null
  const periodoHasta = (formData.get('periodo_hasta') as string) || null
  const comentario = (formData.get('comentario') as string) || null
  const pdfRaw = (formData.get('pdf') as string) || ''
  const observacionesRaw = (formData.get('observaciones') as string) || null

  if (!registroId) return { success: false, error: 'Registro requerido' }
  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }

  const periodicidad = ['semanal', 'mensual', 'periodico'].includes(periodicidadRaw)
    ? periodicidadRaw
    : null

  // Recolectamos las fotos editadas (foto-0, foto-1, …).
  const fotos: File[] = []
  const fotoCount = Number(formData.get('foto_count') ?? 0)
  for (let i = 0; i < fotoCount; i++) {
    const f = formData.get(`foto-${i}`) as File | null
    if (f && f.size > 0) fotos.push(f)
  }
  if (fotos.length === 0) return { success: false, error: 'Subí al menos una foto al reporte' }

  // El path de un bucket PRIVADO debe empezar con el consultora_id para que la
  // RLS de lectura por tenant matchee (ver lib/storage/tenant-path.ts).
  const consultoraId = await consultoraIdFromEstablecimiento(supabase, establecimientoId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del establecimiento' }

  const ts = Date.now()

  // ── 1. Subir el PDF (si vino) ──────────────────────────────────────
  let pdfPath: string | null = null
  const pdfBuffer = pdfBase64ToBuffer(pdfRaw)
  if (pdfBuffer && pdfBuffer.length > 0) {
    const path = tenantStoragePath(consultoraId, 'reportes-fotograficos', registroId, `${ts}.pdf`)
    const { data: pdfUp, error: pdfErr } = await supabase.storage
      .from('documentos')
      .upload(path, pdfBuffer, { upsert: false, contentType: 'application/pdf' })
    if (pdfErr) return { success: false, error: 'Error al subir el PDF: ' + pdfErr.message }
    pdfPath = pdfUp.path
  }

  // ── 2. Subir cada foto editada → path por foto (orden = índice) ─────
  const fotoPaths: string[] = []
  for (let i = 0; i < fotos.length; i++) {
    const f = fotos[i]
    const ext = f.name.split('.').pop() ?? 'png'
    const path = tenantStoragePath(consultoraId, 'reportes-fotograficos', registroId, `${ts}-${i}.${ext}`)
    const { data: fotoUp, error: fotoErr } = await supabase.storage
      .from('documentos')
      .upload(path, f, { upsert: false })
    if (fotoErr) return { success: false, error: 'Error al subir foto: ' + fotoErr.message }
    fotoPaths.push(fotoUp.path)
  }

  // ── 3. UPDATE del registro planificado (queda Realizado) ───────────
  // Fecha de ejecución = HOY por componentes locales (sin timezone drift).
  const now = new Date()
  const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const { data: regRow, error: regErr } = await supabase
    .from('gestiones_registros')
    .update({
      fecha_ejecutada: hoy,
      evidencia_url: pdfPath,
      notas: comentario,
    })
    .eq('id', registroId)
    .select('fecha_planificada')
    .single()
  if (regErr) return { success: false, error: 'Error al actualizar el registro: ' + regErr.message }

  // Geo-sello del lugar de ejecución. Usamos la fecha_planificada autoritativa del
  // registro (clave de partición). NO-BLOQUEANTE.
  await aplicarSelloGeo(supabase, registroId, regRow.fecha_planificada as string, formData)

  // ── 4. INSERT cabecera del reporte ─────────────────────────────────
  const { data: reporte, error: repErr } = await supabase
    .from('reportes_fotograficos')
    .insert({
      consultora_id: consultoraId,
      establecimiento_id: establecimientoId,
      gestion_establecimiento_id: gestionEstablecimientoId || null,
      registro_gestion_id: registroId,
      rg_fecha_planificada: rgFechaPlanificada,
      periodicidad,
      periodo_desde: periodoDesde,
      periodo_hasta: periodoHasta,
      pdf_url: pdfPath,
      estado: 'evaluado',
      comentario,
      generado_por: user.id,
    })
    .select('id')
    .single()
  if (repErr) return { success: false, error: 'Error al crear el reporte: ' + repErr.message }

  const reporteId = reporte.id as string

  // ── 5. INSERT fotos del paquete (1 fila por foto, orden) ───────────
  const fotoRows = fotoPaths.map((foto_url, orden) => ({
    reporte_id: reporteId,
    foto_url,
    orden,
  }))
  const { error: fotosErr } = await supabase.from('reportes_fotograficos_fotos').insert(fotoRows)
  if (fotosErr) {
    // Las fotos son el contenido principal del reporte: si no se guardan, la cabecera
    // queda inútil. Rollback manual (borramos la cabecera recién creada) y devolvemos
    // error en vez de tragarlo y reportar éxito.
    console.error('[reporteFotograficoEjecucion] Error al insertar fotos:', fotosErr.message)
    await supabase.from('reportes_fotograficos').delete().eq('id', reporteId)
    return { success: false, error: 'Error al guardar las fotos del reporte: ' + fotosErr.message }
  }

  // ── 6. INSERT observaciones (pool común → Seguimiento via actuar-view)
  if (observacionesRaw) {
    try {
      const observaciones: ObsEjecucionInput[] = JSON.parse(observacionesRaw)
      const validas = observaciones.filter(o => o.descripcion?.trim() && o.categoria_id)
      if (validas.length > 0) {
        const obsRows = validas.map(o => {
          const fotoUrl =
            typeof o.foto_index === 'number' && o.foto_index >= 0 && o.foto_index < fotoPaths.length
              ? fotoPaths[o.foto_index]
              : null
          return {
            registro_gestion_id: registroId,
            rg_fecha_planificada: rgFechaPlanificada,
            reporte_id: reporteId,
            descripcion: o.descripcion.trim(),
            categoria_id: o.categoria_id,
            clasificacion_id: o.clasificacion_id || null,
            responsable_id: o.responsable_id || null,
            // fecha_planificada (= fecha de subsanación comprometida) es NOT NULL y
            // NINGÚN trigger la rellena (trg_fill_rg_fecha_planificada solo setea
            // rg_fecha_planificada). Fallback a hoy si el técnico no la cargó, para
            // no perder la observación silenciosamente.
            fecha_planificada: o.fecha_subsanacion || hoy,
            foto_url: fotoUrl,
          }
        })
        const { error: obsErr } = await supabase.from('gestiones_observaciones').insert(obsRows)
        if (obsErr) {
          console.error('[reporteFotograficoEjecucion] Error al insertar observaciones:', obsErr.message)
        }
      }
    } catch (e) {
      console.error('[reporteFotograficoEjecucion] Error parseando observaciones:', e)
    }
  }

  // ── 7. Firmar el PDF (bucket privado) para descarga/compartir ──────
  let pdfSignedUrl: string | null = null
  if (pdfPath) {
    const { data: signed } = await supabase.storage
      .from('documentos')
      .createSignedUrl(pdfPath, PDF_SIGNED_TTL_SECONDS)
    pdfSignedUrl = signed?.signedUrl ?? null
  }

  return { success: true, data: { reporteId, pdfSignedUrl } }
}
