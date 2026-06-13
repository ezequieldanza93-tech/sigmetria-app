'use server'

/**
 * Reporte de Observaciones de Campo — emisión por período (diario / semanal / mensual).
 *
 * NO reimplementa la carga ni el marcado de observaciones (eso vive en el ejecutor
 * de reporte fotográfico y en gestiones_observaciones). Acá solo:
 *   1. obtenerDatosReporteObservacionesCampo → consolida las observaciones de un
 *      establecimiento cuya RECORRIDA (gestiones_registros.fecha_ejecutada) cae en
 *      el rango elegido, arma encabezado y resumen.
 *   2. emitirReporteObservacionesCampo → sube el PDF (generado client-side) al
 *      bucket privado `documentos`, lo firma para compartir y, si hay
 *      destinatarios, lo envía por email (Resend, adjunto + link).
 *
 * Decisión de FECHA DE FILTRO (confirmada con el dueño): el período se aplica sobre
 * `gestiones_registros.fecha_ejecutada` (la fecha real de campo), NO sobre
 * `gestiones_observaciones.fecha_planificada`, que es el PLAZO de subsanación.
 */

import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromEstablecimiento, consultoraIdFromEmpresa, tenantStoragePath } from '@/lib/storage/tenant-path'
import { sendReporteObservacionesCampoEmail } from '@/lib/email/reporte-observaciones-campo'
import {
  construirResumenObservaciones,
  type EstadoObservacion,
  type ReporteObsCampoData,
  type ReporteObsCampoEncabezado,
  type ReporteObsCampoItem,
} from '@/lib/reportes/observaciones-campo-tipos'
import type { ActionResult } from '@/lib/types'

const PDF_SIGNED_TTL_SECONDS = 60 * 60

/** Estado de la observación según hoy (mismo criterio que ActuarView). */
function calcularEstado(fechaPlanificada: string, fechaCierre: string | null, hoyStr: string): EstadoObservacion {
  if (fechaCierre) return 'Cerrado'
  // Comparación lexicográfica de YYYY-MM-DD = comparación cronológica.
  return fechaPlanificada < hoyStr ? 'Vencido' : 'Planificado'
}

function nombrePersona(p: { nombre: string; apellido: string } | null | undefined): string | null {
  if (!p) return null
  return `${p.apellido}, ${p.nombre}`
}

/**
 * Consolida las observaciones de campo de un establecimiento dentro del rango
 * [desde, hasta] (inclusivo), filtrando por la fecha de ejecución de la recorrida.
 */
type SupaClient = Awaited<ReturnType<typeof createClient>>

function hoyStrLocal(): string {
  const hoy = new Date()
  return `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
}

function fechaEmisionLocal(): string {
  const hoy = new Date()
  return `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`
}

/**
 * Consulta + mapea las observaciones de UNA O VARIAS establecimientos cuya
 * recorrida (gestiones_registros) se ejecutó dentro del rango [desde, hasta].
 * Reutilizable por el reporte de establecimiento y el de empresa.
 *
 * Trae además: quién relevó (responsable del registro) y el nombre del
 * establecimiento (clave para el consolidado de empresa). Lanza Error si la
 * consulta falla (el caller lo envuelve en ActionResult).
 */
async function consultarItemsObservaciones(
  supabase: SupaClient,
  estIds: string[],
  desde: string,
  hasta: string,
  hoyStr: string,
): Promise<ReporteObsCampoItem[]> {
  if (estIds.length === 0) return []

  const { data: rgData, error: rgError } = await supabase
    .from('gestiones_registros')
    .select(`
      id,
      fecha_ejecutada,
      responsable:personas_directorio!responsable_id(nombre, apellido),
      gestiones_establecimientos!inner(
        establecimiento_id,
        establecimientos(nombre),
        gestiones(nombre)
      )
    `)
    .in('gestiones_establecimientos.establecimiento_id', estIds)
    .not('fecha_ejecutada', 'is', null)
    .gte('fecha_ejecutada', desde)
    .lte('fecha_ejecutada', hasta)
    .order('fecha_ejecutada', { ascending: true })

  if (rgError) throw new Error(rgError.message)

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const registros = (rgData ?? []) as any[]
  if (registros.length === 0) return []

  const rgMap = new Map<string, any>(registros.map(rg => [rg.id, rg]))
  const rgIds = registros.map(rg => rg.id)

  const { data: obsData, error: obsError } = await supabase
    .from('gestiones_observaciones')
    .select(`
      id, registro_gestion_id, descripcion, fecha_planificada, fecha_cierre,
      categoria_id, responsable_id, responsable_cierre_id,
      evidencia_cierre_url, foto_url, sector_id, puesto_id,
      personas_directorio!responsable_id(nombre, apellido),
      responsable_cierre:personas_directorio!responsable_cierre_id(nombre, apellido),
      observaciones_clasificaciones(nombre),
      observaciones_categorias(nombre, nivel, color),
      establecimientos_sectores!sector_id(nombre),
      puestos_de_trabajo!puesto_id(nombre)
    `)
    .in('registro_gestion_id', rgIds)
    .order('fecha_planificada', { ascending: true })

  if (obsError) throw new Error(obsError.message)

  const items: ReporteObsCampoItem[] = ((obsData ?? []) as any[]).map(o => {
    const rg = rgMap.get(o.registro_gestion_id)
    const ge = rg?.gestiones_establecimientos
    const geRow = Array.isArray(ge) ? ge[0] : ge
    const estRel = geRow?.establecimientos
    const estRow = Array.isArray(estRel) ? estRel[0] : estRel
    const gestRel = geRow?.gestiones
    const gestRow = Array.isArray(gestRel) ? gestRel[0] : gestRel
    const categoria = o.observaciones_categorias as { nombre: string; nivel: number; color: string } | null
    const clasificacion = o.observaciones_clasificaciones as { nombre: string } | null
    const sector = o.establecimientos_sectores as { nombre: string } | null
    const puesto = o.puestos_de_trabajo as { nombre: string } | null
    const estado = calcularEstado(o.fecha_planificada, o.fecha_cierre, hoyStr)
    return {
      id: o.id,
      descripcion: o.descripcion,
      categoriaNombre: categoria?.nombre ?? null,
      categoriaNivel: categoria?.nivel ?? null,
      categoriaColor: categoria?.color ?? null,
      clasificacionNombre: clasificacion?.nombre ?? null,
      responsable: nombrePersona(o.personas_directorio),
      fechaPlazo: o.fecha_planificada,
      fechaEjecutada: rg?.fecha_ejecutada ?? null,
      estado,
      fechaCierre: o.fecha_cierre ?? null,
      responsableCierre: nombrePersona(o.responsable_cierre),
      sectorNombre: sector?.nombre ?? null,
      puestoNombre: puesto?.nombre ?? null,
      gestionNombre: gestRow?.nombre ?? null,
      establecimientoNombre: estRow?.nombre ?? null,
      relevadoPor: nombrePersona(rg?.responsable),
      fotoPath: o.foto_url ?? null,
      evidenciaCierrePath: o.evidencia_cierre_url ?? null,
    }
  })
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Orden de presentación: por severidad (crítica → oportunidad), luego por fecha de plazo.
  items.sort((a, b) => (b.categoriaNivel ?? 0) - (a.categoriaNivel ?? 0) || a.fechaPlazo.localeCompare(b.fechaPlazo))
  return items
}

/**
 * Consolida las observaciones de UN establecimiento dentro del rango, filtrando
 * por la fecha de ejecución de la recorrida.
 */
export async function obtenerDatosReporteObservacionesCampo(
  establecimientoId: string,
  desde: string,
  hasta: string,
): Promise<ActionResult<ReporteObsCampoData>> {
  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }
  if (!desde || !hasta) return { success: false, error: 'Rango de fechas requerido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const [{ data: estData }, { data: profileData }] = await Promise.all([
    supabase.from('establecimientos').select('nombre, empresas(razon_social)').eq('id', establecimientoId).maybeSingle(),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])
  if (!estData) return { success: false, error: 'No se encontró el establecimiento' }
  const empresa = estData.empresas as { razon_social: string } | { razon_social: string }[] | null
  const empresaRow = Array.isArray(empresa) ? empresa[0] : empresa

  const encabezado: ReporteObsCampoEncabezado = {
    cliente: empresaRow?.razon_social ?? '—',
    establecimiento: estData.nombre ?? '—',
    profesional: profileData?.full_name ?? user.email ?? '—',
    fechaEmision: fechaEmisionLocal(),
  }

  try {
    const items = await consultarItemsObservaciones(supabase, [establecimientoId], desde, hasta, hoyStrLocal())
    return { success: true, data: { encabezado, items, resumen: construirResumenObservaciones(items) } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al consultar observaciones' }
  }
}

/**
 * Consolida las observaciones de TODOS los establecimientos de una empresa dentro
 * del rango (mismo criterio: fecha de ejecución de la recorrida).
 */
export async function obtenerDatosReporteObservacionesEmpresa(
  empresaId: string,
  desde: string,
  hasta: string,
): Promise<ActionResult<ReporteObsCampoData>> {
  if (!empresaId) return { success: false, error: 'Empresa requerida' }
  if (!desde || !hasta) return { success: false, error: 'Rango de fechas requerido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const [{ data: empresaData }, { data: estList }, { data: profileData }] = await Promise.all([
    supabase.from('empresas').select('razon_social').eq('id', empresaId).maybeSingle(),
    supabase.from('establecimientos').select('id').eq('empresa_id', empresaId).neq('status', 'cancelled'),
    supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
  ])
  if (!empresaData) return { success: false, error: 'No se encontró la empresa' }

  const estIds = ((estList ?? []) as { id: string }[]).map(e => e.id)

  const encabezado: ReporteObsCampoEncabezado = {
    cliente: empresaData.razon_social ?? '—',
    establecimiento: `Todos los establecimientos (${estIds.length})`,
    profesional: profileData?.full_name ?? user.email ?? '—',
    fechaEmision: fechaEmisionLocal(),
  }

  try {
    const items = await consultarItemsObservaciones(supabase, estIds, desde, hasta, hoyStrLocal())
    return { success: true, data: { encabezado, items, resumen: construirResumenObservaciones(items) } }
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Error al consultar observaciones' }
  }
}

export interface EmitirReporteResult {
  /** Signed URL (TTL 1h) del PDF subido, para descarga/compartir. */
  pdfSignedUrl: string | null
  /** true si se intentó (y configuró) el envío por email. */
  emailEnviado: boolean
}

/**
 * Sube el PDF (base64) al bucket privado, lo firma y opcionalmente lo envía por email.
 *
 * FormData esperado:
 *  - establecimiento_id
 *  - pdf            → data-URI base64 o base64 puro del PDF
 *  - filename       → nombre del archivo (ej. "reporte-observaciones-campo.pdf")
 *  - periodo_label  → etiqueta del período (para asunto/cuerpo del email)
 *  - destinatarios  → emails separados por coma (opcional; si vacío, no envía)
 *  - comentario     → texto opcional para el email
 */
export async function emitirReporteObservacionesCampo(
  formData: FormData,
): Promise<ActionResult<EmitirReporteResult>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const establecimientoId = (formData.get('establecimiento_id') as string) || ''
  const empresaId = (formData.get('empresa_id') as string) || ''
  const pdfFile = formData.get('pdf') as File | null
  const filename = ((formData.get('filename') as string) || 'reporte-observaciones-campo.pdf').replace(/[^\w.\-]+/g, '_')
  const periodoLabel = (formData.get('periodo_label') as string) || ''
  const destinatariosRaw = (formData.get('destinatarios') as string) || ''
  const comentario = (formData.get('comentario') as string) || ''
  const clienteNombre = (formData.get('cliente') as string) || ''
  const establecimientoNombre = (formData.get('establecimiento') as string) || ''

  if (!establecimientoId && !empresaId) return { success: false, error: 'Establecimiento o empresa requerido' }
  if (!pdfFile || pdfFile.size === 0) return { success: false, error: 'PDF vacío' }

  // El cliente sube el PDF como Blob BINARIO (no base64) para no inflar el body
  // del server action ~33%. Lo leemos directo a Buffer.
  const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer())
  if (pdfBuffer.length === 0) return { success: false, error: 'PDF vacío' }

  // Tenant del path: del establecimiento (reporte por establecimiento) o de la
  // empresa (consolidado de empresa). El primer segmento {consultora_id} hace
  // matchear la RLS de lectura del bucket privado.
  const consultoraId = establecimientoId
    ? await consultoraIdFromEstablecimiento(supabase, establecimientoId)
    : await consultoraIdFromEmpresa(supabase, empresaId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora' }

  const entityId = establecimientoId || empresaId
  const ts = Date.now()
  const path = tenantStoragePath(consultoraId, 'reportes-observaciones-campo', entityId, `${ts}.pdf`)
  const { data: upload, error: uploadError } = await supabase.storage
    .from('documentos')
    .upload(path, pdfBuffer, { upsert: false, contentType: 'application/pdf' })
  if (uploadError) return { success: false, error: 'Error al subir el PDF: ' + uploadError.message }

  const { data: signed } = await supabase.storage
    .from('documentos')
    .createSignedUrl(upload.path, PDF_SIGNED_TTL_SECONDS)
  const pdfSignedUrl = signed?.signedUrl ?? null

  // ── Envío por email (opcional) ──────────────────────────────────────────────
  const destinatarios = destinatariosRaw
    .split(/[,;\s]+/)
    .map(e => e.trim())
    .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))

  let emailEnviado = false
  if (destinatarios.length > 0) {
    try {
      await sendReporteObservacionesCampoEmail({
        to: destinatarios,
        cliente: clienteNombre,
        establecimiento: establecimientoNombre,
        periodoLabel,
        comentario,
        // Resend requiere base64; lo derivamos del buffer en el server (no del cliente).
        pdfBase64: pdfBuffer.toString('base64'),
        pdfFilename: filename,
        pdfUrl: pdfSignedUrl,
      })
      emailEnviado = true
    } catch (e) {
      // No abortamos: el PDF ya quedó subido y firmado. Reportamos el fallo del email.
      const msg = e instanceof Error ? e.message : 'error desconocido'
      return { success: false, error: `El PDF se generó pero el email falló: ${msg}` }
    }
  }

  return { success: true, data: { pdfSignedUrl, emailEnviado } }
}
