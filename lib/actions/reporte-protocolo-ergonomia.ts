'use server'

/**
 * reporte-protocolo-ergonomia.ts — Server Action: genera el PDF del Protocolo de
 * Evaluación Ergonómica (TME) — Res. SRT 886/2015 + Disp. SRT 1/2016.
 *
 * Clona el patrón de reporte-protocolo-iluminacion.ts:
 *   1. Lee la evaluación completa (getProtocoloErgonomia) — cabecera + 5 hijas.
 *   2. Resuelve logos (empresa + consultora) → data URLs base64 para Chromium serverless.
 *   3. Query extra de localidad/provincia + logo de empresa + consultora_id/logo
 *      (el join de getProtocoloErgonomia no los trae).
 *   4. Mapea todo a DatosProtocoloErgonomia.
 *   5. Llama renderProtocolo(ERGONOMIA_DESCRIPTOR, datos) → Buffer.
 *
 * DECISIONES:
 *   - Folio determinístico: SIG-{AÑO}-{6 hex del evaluacionId}. Igual que iluminación.
 *   - Vencimiento: fecha_evaluacion + 1 año.
 *   - El firmante es el campo de texto libre `ergonomia_evaluaciones.firmante` (NO el
 *     usuario logueado). Ergonomía NO tiene firma dibujada en la tabla `firmas`
 *     (FirmaEntidadTipo no incluye 'ergonomia'), así que `firma` queda undefined.
 *   - Planilla 2 (9 matrices SI/NO) y Planilla 3 (M.C.P. texto libre) NO se inyectan
 *     celda por celda — ver `notas`. El nivel resultante de la evaluación inicial por
 *     factor se vuelca en la grilla de Planilla 1.
 */

import { getProtocoloErgonomia } from '@/lib/actions/protocolo-ergonomia'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import { renderProtocolo } from '@/lib/pdf/protocolo-engine'
import {
  ERGONOMIA_DESCRIPTOR,
  type DatosProtocoloErgonomia,
  type FactorTareaRow,
  type SeguimientoRow,
} from '@/lib/pdf/descriptors/ergonomia'
import type { ActionResult, ErgonomiaEvaluacionDetalle, FactorErgonomia } from '@/lib/types'

// ─── Helpers de formateo (clonados de iluminación) ──────────────────────────

/** Formatea una fecha ISO (YYYY-MM-DD) a DD/MM/YYYY. */
function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [datePart] = iso.split('T')
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

/** Suma 1 año a una fecha ISO (YYYY-MM-DD) → DD/MM/YYYY. */
function sumarUnAnio(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [datePart] = iso.split('T')
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${Number(y) + 1}`
}

/** Folio determinístico del protocolo. */
function generarFolio(evaluacionId: string, fecha: string | null | undefined): string {
  const anio = fecha ? fecha.slice(0, 4) : new Date().getFullYear().toString()
  const hex = evaluacionId.replace(/-/g, '').slice(0, 6).toUpperCase()
  return `SIG-${anio}-${hex}`
}

/** Descarga una URL y la convierte en data URL base64 (para Chromium serverless). */
async function urlToDataUrl(url: string | null | undefined): Promise<string | undefined> {
  if (!url) return undefined
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const contentType = res.headers.get('content-type') ?? 'image/png'
    const buf = Buffer.from(await res.arrayBuffer())
    return `data:${contentType};base64,${buf.toString('base64')}`
  } catch {
    return undefined
  }
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────

/**
 * Genera el PDF del Protocolo de Evaluación Ergonómica (Res. SRT 886/2015).
 *
 * @param id - UUID de la evaluación en tabla `ergonomia_evaluaciones`
 */
export async function generarReporteProtocoloErgonomia(
  id: string,
): Promise<ActionResult<Buffer>> {
  if (!id) return { success: false, error: 'id de evaluación requerido' }

  // ── 1. Leer evaluación completa (cabecera + 5 hijas + establecimiento + empresa) ──
  const evRes = await getProtocoloErgonomia(id)
  if (!evRes.success) {
    console.error('[PDF-ERGO] getProtocoloErgonomia falló', { id, error: evRes.error })
    return { success: false, error: evRes.error }
  }
  const ev: ErgonomiaEvaluacionDetalle = evRes.data
  const estab = ev.establecimientos ?? null
  const empresa = estab?.empresas ?? null

  // ── 2. Grilla de factores (Planilla 1) ────────────────────────────────────
  // Agrupar los factores presentes por letra: en qué tareas aparecen + tiempo + nivel.
  const presentes = (ev.ergonomia_factores_tarea ?? []).filter((f) => f.presente)
  const porFactor = new Map<FactorErgonomia, FactorTareaRow>()
  for (const f of presentes) {
    const prev = porFactor.get(f.factor)
    if (prev) {
      if (!prev.tareas.includes(f.tarea_numero)) prev.tareas.push(f.tarea_numero)
      if (!prev.tiempoExposicion && f.tiempo_exposicion) prev.tiempoExposicion = f.tiempo_exposicion
      if (!prev.nivelRiesgo && f.nivel_riesgo) prev.nivelRiesgo = f.nivel_riesgo
    } else {
      porFactor.set(f.factor, {
        factor: f.factor,
        tareas: [f.tarea_numero],
        tiempoExposicion: f.tiempo_exposicion,
        nivelRiesgo: f.nivel_riesgo,
      })
    }
  }
  // El nivel resultante de la Planilla 2 (más fiable) pisa el de la grilla si existe.
  for (const efac of ev.ergonomia_evaluacion_factor ?? []) {
    const row = porFactor.get(efac.factor)
    if (row && efac.nivel_resultante) row.nivelRiesgo = efac.nivel_resultante
  }
  const factores: FactorTareaRow[] = [...porFactor.values()]

  // ── 3. Matriz de seguimiento (Planilla 4) ──────────────────────────────────
  const seguimiento: SeguimientoRow[] = [...(ev.ergonomia_seguimiento ?? [])]
    .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
    .map((s) => ({
      numeroMcp: s.numero_mcp,
      nombrePuesto: s.nombre_puesto,
      fechaEvaluacion: formatFecha(s.fecha_evaluacion),
      nivelRiesgo: s.nivel_riesgo,
      fechaImplAdmin: formatFecha(s.fecha_implementacion_admin),
      fechaImplIngenieria: formatFecha(s.fecha_implementacion_ingenieria),
      fechaCierre: formatFecha(s.fecha_cierre),
    }))

  // ── 4. Query extra: localidad/provincia + CP + logo empresa + consultora ───
  // getProtocoloErgonomia no trae localidades, código postal, logo ni consultora.
  let localidadNombre: string | undefined
  let provinciaNombre: string | undefined
  let cpNombre: string | undefined
  let logoEmpresaDataUrl: string | undefined
  let logoConsultoraDataUrl: string | undefined

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  if (ev.establecimiento_id) {
    const { data: estRow } = await supabase
      .from('establecimientos')
      .select('codigo_postal, localidades ( nombre, provincia ), empresas ( logo_destacado_url )')
      .eq('id', ev.establecimiento_id)
      .maybeSingle()

    if (estRow) {
      cpNombre = (estRow.codigo_postal as string | null) ?? undefined
      const loc = estRow.localidades as { nombre?: string; provincia?: string } | { nombre?: string; provincia?: string }[] | null
      const locRow = Array.isArray(loc) ? loc[0] : loc
      localidadNombre = locRow?.nombre ?? undefined
      provinciaNombre = locRow?.provincia ?? undefined

      const emp = estRow.empresas as { logo_destacado_url?: string | null } | { logo_destacado_url?: string | null }[] | null
      const empRow = Array.isArray(emp) ? emp[0] : emp
      const logoEmpresaPath = empRow?.logo_destacado_url ?? null
      if (logoEmpresaPath) {
        const url = await resolveAssetUrl('logos', logoEmpresaPath)
        logoEmpresaDataUrl = await urlToDataUrl(url)
      }
    }
  }

  if (ev.consultora_id) {
    const { data: consultoraRow } = await supabase
      .from('consultoras')
      .select('logo_url')
      .eq('id', ev.consultora_id)
      .maybeSingle()
    if (consultoraRow?.logo_url) {
      const url = await resolveAssetUrl('consultora', consultoraRow.logo_url as string)
      logoConsultoraDataUrl = await urlToDataUrl(url)
    }
  }

  // ── 5. Armar DatosProtocoloErgonomia ───────────────────────────────────────
  const folio = generarFolio(id, ev.fecha_evaluacion)
  const hoy = formatFecha(new Date().toISOString().slice(0, 10))

  const datos: DatosProtocoloErgonomia = {
    // Empresa / establecimiento
    razonSocial: empresa?.razon_social ?? undefined,
    cuit: empresa?.cuit ?? undefined,
    establecimiento: estab?.nombre ?? undefined,
    direccion: estab?.domicilio ?? undefined,
    localidad: localidadNombre,
    provincia: provinciaNombre,
    cp: cpNombre,

    // Cabecera específica de ergonomía
    areaSector: ev.area_sector ?? undefined,
    puestoTrabajo: ev.puesto_de_trabajo ?? undefined,
    nTrabajadores: ev.n_trabajadores != null ? String(ev.n_trabajadores) : undefined,
    nombreTrabajadores: ev.nombre_trabajadores ?? undefined,
    ubicacionSintoma: ev.ubicacion_sintoma ?? undefined,
    procedimientoEscrito: ev.procedimiento_escrito,
    capacitacion: ev.capacitacion,
    manifestacionTemprana: ev.manifestacion_temprana,

    // Profesional firmante (texto libre; ergonomía no tiene firma dibujada)
    profesional: ev.firmante ?? undefined,

    // Carátula
    numeroProtocolo: folio,
    fechaMedicion: formatFecha(ev.fecha_evaluacion),
    fechaEmision: hoy,
    fechaVencimiento: sumarUnAnio(ev.fecha_evaluacion),
    encomienda: '',

    // Logos
    logoEmpresa: logoEmpresaDataUrl,
    logoConsultora: logoConsultoraDataUrl,

    // Grillas
    factores: factores.length > 0 ? factores : undefined,
    seguimiento: seguimiento.length > 0 ? seguimiento : undefined,
  }

  // ── 5b. QR de verificación: snapshot público + QR real en la carátula (best-effort) ──
  try {
    const { registrarVerificacion } = await import('@/lib/actions/registrar-verificacion')
    datos.qrVerificacion = await registrarVerificacion({
      folio,
      tipo: 'protocolo_ergonomia',
      medicionId: id,
      consultoraId: ev.consultora_id ?? null,
      empresa: datos.razonSocial,
      establecimiento: datos.establecimiento,
      profesional: datos.profesional,
      fechaEjecucion: datos.fechaMedicion,
      fechaEmision: datos.fechaEmision,
      fechaVencimiento: datos.fechaVencimiento,
    })
  } catch (err) {
    console.error('[PDF-ERGO] no se pudo registrar la verificación:', err instanceof Error ? err.message : String(err))
  }

  // ── 6. Generar PDF ──────────────────────────────────────────────────────────
  console.warn('[PDF-ERGO] datos mapeados, renderizando', {
    folio,
    establecimiento: datos.establecimiento,
    factores: factores.length,
    seguimiento: seguimiento.length,
  })
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderProtocolo(ERGONOMIA_DESCRIPTOR, datos)
  } catch (err) {
    const detalle = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[PDF-ERGO] renderProtocolo lanzó:', detalle)
    return { success: false, error: `Error al renderizar el PDF: ${err instanceof Error ? err.message : String(err)}` }
  }

  return { success: true, data: pdfBuffer }
}
