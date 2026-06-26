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
import { getBrandColorConsultora } from '@/lib/pdf/brand-color-server'
import { getFotoYMapaEstablecimiento } from '@/lib/pdf/establecimiento-media'
import { generarAnexoObservaciones } from '@/lib/pdf/anexo-observaciones'
import { resolverMatriculaProfesional } from '@/lib/pdf/resolver-matricula'
import {
  ERGONOMIA_DESCRIPTOR,
  type DatosProtocoloErgonomia,
  type FactorTareaRow,
  type SeguimientoRow,
  type EvalFactorPlanilla2,
  type MedidasPlanilla3,
} from '@/lib/pdf/descriptors/ergonomia'
import type { AnexoInput } from '@/lib/pdf/merge-anexos'
import type {
  ActionResult,
  ErgonomiaEvaluacionDetalle,
  FactorErgonomia,
  RespuestaPaso,
  MedidaEspecifica,
  VibSubtipo,
} from '@/lib/types'

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

/**
 * Combina respuestas de un mismo paso con semántica OR: el factor en el PUESTO se considera
 * "SÍ" en la pregunta N si CUALQUIER tarea respondió SÍ. La Planilla 2 del PDF es por factor
 * (una sola matriz), pero los datos se cargan por (factor, tarea). Mantenemos el número de
 * pregunta `n` (mapea a la fila de la tabla `.sino`).
 */
function mergeRespuestas(acc: RespuestaPaso[], nuevas: RespuestaPaso[]): RespuestaPaso[] {
  const out = new Map<number, boolean>()
  for (const r of acc) out.set(r.n, r.respuesta)
  for (const r of nuevas) out.set(r.n, (out.get(r.n) ?? false) || r.respuesta)
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map(([n, respuesta]) => ({ n, respuesta }))
}

// ─── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────

/**
 * Genera el PDF del Protocolo de Evaluación Ergonómica (Res. SRT 886/2015).
 *
 * @param id - UUID de la evaluación en tabla `ergonomia_evaluaciones`
 * @param registroId - registro_gestion_id del registro ejecutado (para el anexo de
 *   observaciones de seguimiento). Si no se pasa, no se genera el anexo de observaciones.
 * @param rgFecha - rg_fecha_planificada del registro (segunda mitad de la FK suelta del
 *   pool de observaciones); puede ser null (el helper no filtra por fecha si es null).
 */
export async function generarReporteProtocoloErgonomia(
  id: string,
  registroId: string | null = null,
  rgFecha: string | null = null,
): Promise<ActionResult<{ pdf: Buffer; anexos: AnexoInput[] }>> {
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

  // ── 3b. Planilla 2 — Evaluación inicial SÍ/NO por (factor, subtipo) ─────────
  // Los datos vienen por (factor, tarea[, subtipo de vibración]); la Planilla 2 del PDF
  // es por factor (una matriz por factor — G tiene dos: mano-brazo y cuerpo entero).
  // Agrupamos por factor+subtipo combinando las respuestas de las tareas con OR.
  const porEvalFactor = new Map<string, EvalFactorPlanilla2>()
  for (const efac of ev.ergonomia_evaluacion_factor ?? []) {
    const subtipo: VibSubtipo | null = efac.vibracion_subtipo ?? null
    const k = `${efac.factor}|${subtipo ?? ''}`
    const prev = porEvalFactor.get(k)
    if (prev) {
      prev.paso1 = mergeRespuestas(prev.paso1, efac.paso1_respuestas ?? [])
      prev.paso2 = mergeRespuestas(prev.paso2, efac.paso2_respuestas ?? [])
    } else {
      porEvalFactor.set(k, {
        factor: efac.factor,
        subtipo,
        paso1: [...(efac.paso1_respuestas ?? [])],
        paso2: [...(efac.paso2_respuestas ?? [])],
      })
    }
  }
  const evalFactores: EvalFactorPlanilla2[] = [...porEvalFactor.values()]

  // ── 3c. Planilla 3 — Medidas Correctivas y Preventivas (agregadas) ─────────
  // `ergonomia_medidas` es un registro por tarea (o uno genérico). La Planilla 3 del PDF
  // tiene una sola tabla, así que agregamos: mg1/mg2/mg3 con OR (cualquier tarea que diga
  // SÍ → SÍ), fechas/observaciones con la 1ra no vacía, y concatenamos las medidas
  // específicas de todas las tareas. Las medidas con fecha ISO se formatean a DD/MM/YYYY.
  const medRows = ev.ergonomia_medidas ?? []
  let medidas: MedidasPlanilla3 | undefined
  if (medRows.length > 0) {
    // OR sobre un boolean nullable: true si alguno es true; false si alguno es false y ninguno true; null si todos null.
    const orBool = (sel: (m: (typeof medRows)[number]) => boolean | null): boolean | null => {
      let vistoFalse = false
      for (const m of medRows) {
        const v = sel(m)
        if (v === true) return true
        if (v === false) vistoFalse = true
      }
      return vistoFalse ? false : null
    }
    const primeraNoVacia = (sel: (m: (typeof medRows)[number]) => string | null): string | null => {
      for (const m of medRows) {
        const v = sel(m)
        if (v && v.trim()) return v
      }
      return null
    }
    const especificas: MedidaEspecifica[] = medRows.flatMap((m) =>
      (m.medidas_especificas ?? []).map((e) => ({
        descripcion: e.descripcion,
        tipo: e.tipo,
        fecha: formatFecha(e.fecha) === '—' ? (e.fecha ?? null) : formatFecha(e.fecha),
        observaciones: e.observaciones ?? null,
      })),
    )
    const fechaGeneral = primeraNoVacia((m) => m.mg1_fecha) ?? primeraNoVacia((m) => m.mg2_fecha) ?? primeraNoVacia((m) => m.mg3_fecha)
    medidas = {
      mg1: orBool((m) => m.mg1_informado),
      mg1Obs: primeraNoVacia((m) => m.mg1_observaciones),
      mg2: orBool((m) => m.mg2_capacitado_sintomas),
      mg2Obs: primeraNoVacia((m) => m.mg2_observaciones),
      mg3: orBool((m) => m.mg3_capacitado_medidas),
      mg3Obs: primeraNoVacia((m) => m.mg3_observaciones),
      fechaGeneral: fechaGeneral ? (formatFecha(fechaGeneral) === '—' ? fechaGeneral : formatFecha(fechaGeneral)) : null,
      especificas,
      observaciones: primeraNoVacia((m) => m.observaciones),
    }
  }

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

  // ── 4d. Matrícula del profesional que ejecuta la gestión ───────────────────
  // Ergonomía NO tiene perfil_profesional en la cabecera (no hay bloque 4a inline como
  // iluminación), así que resolvemos directo desde el responsable autenticado. El helper
  // hace auth.getUser() → perfiles_profesionales → matriculas_profesionales activa. Best-
  // effort: si no hay, queda undefined (el motor/descriptor ya omite la matrícula en la firma).
  const matriculaStr = (await resolverMatriculaProfesional()) ?? undefined

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
    matricula: matriculaStr,

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
    evalFactores: evalFactores.length > 0 ? evalFactores : undefined,
    medidas,
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

  // ── 5c. Foto + mapa del establecimiento para la carátula (best-effort) ───────
  if (ev.establecimiento_id) {
    const media = await getFotoYMapaEstablecimiento(ev.establecimiento_id)
    datos.fotoEstablecimiento = media.fotoEstablecimiento
    datos.mapaEstablecimiento = media.mapaEstablecimiento
  }

  // ── 6. Generar PDF ──────────────────────────────────────────────────────────
  console.warn('[PDF-ERGO] datos mapeados, renderizando', {
    folio,
    establecimiento: datos.establecimiento,
    factores: factores.length,
    evalFactores: evalFactores.length,
    medidasEspecificas: medidas?.especificas.length ?? 0,
    seguimiento: seguimiento.length,
  })
  const brandMarca = await getBrandColorConsultora(ev.consultora_id ?? null)
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderProtocolo(ERGONOMIA_DESCRIPTOR, datos, brandMarca)
  } catch (err) {
    const detalle = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[PDF-ERGO] renderProtocolo lanzó:', detalle)
    return { success: false, error: `Error al renderizar el PDF: ${err instanceof Error ? err.message : String(err)}` }
  }

  // ── 7. Anexos de sistema: observaciones de seguimiento (best-effort) ─────────
  // Las observaciones cargadas en el último paso del protocolo viven en el pool común
  // `gestiones_observaciones`, ligadas al registro ejecutado por (registro_gestion_id +
  // rg_fecha_planificada). Las renderizamos como UNA hoja PDF estilo Sigmetría con el
  // helper compartido y las devolvemos con clave canónica 'observaciones' para que el
  // bridge (emitir-evidencia) las una con los adjuntos manuales en armarPdfFinalConAnexos.
  // Best-effort: si algo falla, el PDF sale igual sin el anexo; no rompemos la emisión.
  // `supabase` es el client server ya creado para los logos/localidad/consultora.
  const anexosSistema: AnexoInput[] = []
  try {
    if (registroId) {
      const obsBuffer = await generarAnexoObservaciones(supabase, registroId, rgFecha, brandMarca)
      if (obsBuffer) {
        anexosSistema.push({
          titulo: 'Observaciones de Seguimiento',
          buffer: obsBuffer,
          mime: 'application/pdf',
          clave: 'observaciones',
        })
      }
    }
  } catch (err) {
    console.error('[PDF-ERGO] anexo observaciones falló:', err instanceof Error ? err.message : String(err))
  }

  return { success: true, data: { pdf: pdfBuffer, anexos: anexosSistema } }
}
