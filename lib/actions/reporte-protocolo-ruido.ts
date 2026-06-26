'use server'

/**
 * reporte-protocolo-ruido.ts — Server Action: genera el PDF del Protocolo SRT 85/2012 (Ruido).
 *
 * Réplica del patrón de reporte-protocolo-iluminacion.ts adaptado a Ruido:
 *   1. Lee la medición completa (getMedicionRuido) — join cabecera + establecimiento +
 *      empresa + instrumento + certificado + puntos (sector/puesto/períodos).
 *   2. Lee la firma del profesional (getFirmasEntidad('medicion_ruido', id)).
 *   3. Resuelve logos (empresa + consultora) → data URLs base64 para Chromium serverless.
 *   4. Query extra mínima: localidad/provincia del establecimiento + logo de consultora
 *      (igual que iluminación, porque el join de getMedicionRuido no sube a consultora ni
 *      trae la localidad resuelta).
 *   5. Mapea todo a DatosProtocoloRuido y llama renderProtocolo(RUIDO_DESCRIPTOR, datos).
 *
 * DECISIONES DE DISEÑO (espejan iluminación):
 *   - Folio determinístico: `SIG-{AÑO}-{primeros 6 hex del medicionId}`.
 *   - Vencimiento: fecha_medicion + 1 año.
 *   - El firmante es el texto libre `medicion_ruido.firmante` (no el usuario logueado).
 *     La matrícula NO la trae la cabecera de ruido → queda vacía (el motor tiene fallback).
 *   - La grilla usa los valores guardados en cada punto (dosis_pct / suma_fracciones /
 *     cumple). Si faltan, se recalculan en vivo desde medicion_ruido_periodos con las
 *     funciones puras de lib/medicion-ruido/calculos.ts (dosis/dosisPct/cumpleDosis/cumplePico).
 */

import { getMedicionRuido } from '@/lib/actions/medicion-ruido'
import { getFirmasEntidad } from '@/lib/actions/firmas'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import { renderProtocolo } from '@/lib/pdf/protocolo-engine'
import { getBrandColorConsultora } from '@/lib/pdf/brand-color-server'
import {
  RUIDO_DESCRIPTOR,
  type DatosProtocoloRuido,
  type FilaRuido,
} from '@/lib/pdf/descriptors/ruido'
import {
  dosis,
  dosisPct,
  cumpleDosis,
  cumplePico,
  type PeriodoExposicion,
} from '@/lib/medicion-ruido/calculos'
import { getFotoYMapaEstablecimiento } from '@/lib/pdf/establecimiento-media'
import { getAnexoCertificadoCalibracion, getAnexoPlano } from '@/lib/pdf/anexo-certificado'
import { generarAnexoObservaciones } from '@/lib/pdf/anexo-observaciones'
import { resolverMatriculaProfesional } from '@/lib/pdf/resolver-matricula'
import type { AnexoInput } from '@/lib/pdf/merge-anexos'
import type { ActionResult } from '@/lib/types'

// ─── Labels de enums → texto legible (mismo criterio que el wizard) ─────────────

const CARACTERISTICAS_LABEL: Record<string, string> = {
  continuo: 'Continuo',
  intermitente: 'Intermitente',
  impacto: 'De impacto',
}

const TIPO_PUESTO_LABEL: Record<string, string> = {
  puesto: 'Puesto',
  puesto_tipo: 'Puesto tipo',
  movil: 'Puesto móvil',
}

// ─── Helpers de formateo ────────────────────────────────────────────────────────

/** Formatea una fecha ISO (YYYY-MM-DD) a DD/MM/YYYY. */
function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [datePart] = iso.split('T')
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

/** Formatea hora HH:MM:SS → HH:MM. */
function formatHora(time: string | null | undefined): string {
  if (!time) return '—'
  return time.slice(0, 5)
}

/** Suma 1 año a una fecha ISO (YYYY-MM-DD) → DD/MM/YYYY. */
function sumarUnAnio(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [datePart] = iso.split('T')
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${Number(y) + 1}`
}

/** Genera el folio determinístico del protocolo. */
function generarFolio(medicionId: string, fechaMedicion: string | null | undefined): string {
  const anio = fechaMedicion ? fechaMedicion.slice(0, 4) : new Date().getFullYear().toString()
  const hex = medicionId.replace(/-/g, '').slice(0, 6).toUpperCase()
  return `SIG-${anio}-${hex}`
}

/** Descarga una URL y la convierte en data URL base64. Fallo silencioso → undefined. */
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

// ─── Helpers de tipado para los embeds de PostgREST ─────────────────────────────

type EmbedOne<T> = T | T[] | null | undefined

function single<T>(v: EmbedOne<T>): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

/** Formatea un número con hasta `decimales` decimales, sin ceros colgando. */
function fmtNum(n: number | null | undefined, decimales = 2): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return Number(n.toFixed(decimales)).toString()
}

// ─── FUNCIÓN PRINCIPAL ──────────────────────────────────────────────────────────

/**
 * Genera el PDF del Protocolo de Medición de Ruido (Res. SRT 85/2012) para una
 * medición real guardada en `medicion_ruido`.
 *
 * @param id - UUID de la medición en tabla `medicion_ruido`
 * @returns { success: true, data: Buffer } con el PDF, o { success: false, error }
 */
export async function generarReporteProtocoloRuido(
  id: string,
): Promise<ActionResult<{ pdf: Buffer; anexos: AnexoInput[] }>> {
  if (!id) return { success: false, error: 'medicionId requerido' }

  // ── 1. Leer medición completa ───────────────────────────────────────────────
  const medicionResult = await getMedicionRuido(id)
  if (!medicionResult.success) {
    console.error('[PDF-REPORTE-RUIDO] getMedicionRuido falló', { id, error: medicionResult.error })
    return { success: false, error: medicionResult.error }
  }

  const m = medicionResult.data as Record<string, unknown>

  // ── 2. Subestructuras tipadas ───────────────────────────────────────────────

  const estRaw = single<Record<string, unknown>>(m.establecimientos as EmbedOne<Record<string, unknown>>)
  if (!estRaw) return { success: false, error: 'Establecimiento no encontrado en el join' }

  const empRaw = single<Record<string, unknown>>(estRaw.empresas as EmbedOne<Record<string, unknown>>)
  if (!empRaw) return { success: false, error: 'Empresa no encontrada en el join' }

  const instrRaw = single<Record<string, unknown>>(m.mediciones_instrumentos as EmbedOne<Record<string, unknown>>)
  const certRaw = single<Record<string, unknown>>(m.certificados_calibracion as EmbedOne<Record<string, unknown>>)
  const puntosRaw = (m.medicion_ruido_puntos as Record<string, unknown>[] | null) ?? []

  // ── 3. Firma del profesional ─────────────────────────────────────────────────
  let firmaDataUrl: string | undefined
  const firmas = await getFirmasEntidad('medicion_ruido', id)
  const firmaRow = firmas.find((f) => f.rol === 'Profesional') ?? firmas[0] ?? null
  if (firmaRow?.firma_svg_data) {
    firmaDataUrl = firmaRow.firma_svg_data
  }

  // ── 4. Instrumento (marca, modelo, serie) ────────────────────────────────────
  let instrumentoStr: string | undefined
  if (instrRaw) {
    const tipoRaw = single<Record<string, unknown>>(instrRaw.productos_componentes as EmbedOne<Record<string, unknown>>)
    const marcaRaw = single<Record<string, unknown>>(instrRaw.organizaciones_externas as EmbedOne<Record<string, unknown>>)
    const tipo = (tipoRaw?.nombre as string) ?? ''
    const marca = (marcaRaw?.nombre as string) ?? ''
    const modelo = (instrRaw.modelo as string) ?? ''
    const serie = instrRaw.numero_serie ? `· N° ${instrRaw.numero_serie}` : ''
    instrumentoStr = [tipo, marca, modelo].filter(Boolean).join(' ') + (serie ? ` ${serie}` : '') || undefined
  }

  // ── 5. Logos → data URLs base64 ──────────────────────────────────────────────
  const consultoraId = m.consultora_id as string | null
  let logoConsultoraDataUrl: string | undefined
  let logoEmpresaDataUrl: string | undefined

  const logoEmpresaPath = empRaw.logo_destacado_url as string | null
  if (logoEmpresaPath) {
    const logoEmpresaUrl = await resolveAssetUrl('logos', logoEmpresaPath)
    logoEmpresaDataUrl = await urlToDataUrl(logoEmpresaUrl)
  }

  if (consultoraId) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: consultoraRow } = await supabase
      .from('consultoras')
      .select('logo_url')
      .eq('id', consultoraId)
      .maybeSingle()

    if (consultoraRow?.logo_url) {
      const logoConsultoraUrl = await resolveAssetUrl('consultora', consultoraRow.logo_url as string)
      logoConsultoraDataUrl = await urlToDataUrl(logoConsultoraUrl)
    }
  }

  // ── 6. Localidad y provincia (query extra; el join no las resuelve) ──────────
  let localidadNombre: string | undefined
  let provinciaNombre: string | undefined

  const establecimientoId = m.establecimiento_id as string | null
  if (establecimientoId) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: estLocRow } = await supabase
      .from('establecimientos')
      .select('localidad_id, localidades ( nombre, provincia )')
      .eq('id', establecimientoId)
      .maybeSingle()

    if (estLocRow) {
      const locRow = single<Record<string, unknown>>(estLocRow.localidades as EmbedOne<Record<string, unknown>>)
      localidadNombre = (locRow?.nombre as string) ?? undefined
      provinciaNombre = (locRow?.provincia as string) ?? undefined
    }
  }

  // ── 7. Grilla de mediciones (campos 23-33) ───────────────────────────────────
  // Orden estable por `orden` (fallback al orden del array).
  const puntosOrdenados = [...puntosRaw].sort((a, b) => {
    const oa = Number(a.orden ?? 0)
    const ob = Number(b.orden ?? 0)
    return oa - ob
  })

  const filas: FilaRuido[] = puntosOrdenados.map((punto, idx) => {
    const sectorRaw = single<Record<string, unknown>>(punto.establecimientos_sectores as EmbedOne<Record<string, unknown>>)
    const puestoRaw = single<Record<string, unknown>>(punto.puestos_de_trabajo as EmbedOne<Record<string, unknown>>)

    const sectorNombre = (sectorRaw?.nombre as string) ?? '—'
    const puestoNombre = (puestoRaw?.nombre as string) ?? '—'

    // Períodos del punto (método sonómetro): para recalcular dosis/cumplimiento si hace falta.
    const periodosRaw = (punto.medicion_ruido_periodos as Record<string, unknown>[] | null) ?? []
    const periodos: PeriodoExposicion[] = periodosRaw
      .map((p) => ({
        laeq_dba: Number(p.laeq_dba),
        tiempo_exposicion_horas: Number(p.tiempo_exposicion_horas),
      }))
      .filter((p) => Number.isFinite(p.laeq_dba) && Number.isFinite(p.tiempo_exposicion_horas))

    // lcpico declarado (ruido de impacto). null → no aplica el criterio de pico.
    const lcpicoNum = punto.lcpico_dbc != null ? Number(punto.lcpico_dbc) : null

    // Dosis (%) y suma de fracciones: usamos lo guardado en el punto; si falta, recalculamos.
    const dosisGuardada = punto.dosis_pct != null ? Number(punto.dosis_pct) : null
    const sumaGuardada = punto.suma_fracciones != null ? Number(punto.suma_fracciones) : null

    // D (adimensional) recalculada desde los períodos (suma de fracciones).
    const Dcalc = periodos.length > 0 ? dosis(periodos) : null
    const sumaFracc = sumaGuardada != null && Number.isFinite(sumaGuardada)
      ? sumaGuardada
      : Dcalc
    const dosisPorcentaje = dosisGuardada != null && Number.isFinite(dosisGuardada)
      ? dosisGuardada
      : Dcalc != null
        ? dosisPct(Dcalc)
        : null

    // Cumplimiento: usamos el guardado; si falta, lo derivamos de dosis + pico.
    let cumpleStr = '—'
    if (punto.cumple === true) cumpleStr = 'SI'
    else if (punto.cumple === false) cumpleStr = 'NO'
    else if (Dcalc != null) {
      const ok = cumpleDosis(Dcalc) && cumplePico(lcpicoNum)
      cumpleStr = ok ? 'SI' : 'NO'
    }

    // LAeq de la fila: si hay un solo período lo mostramos; si hay varios, lo dejamos
    // al período guardado en el punto (laeq_dba) o vacío (el detalle va por período).
    const laeqPunto = punto.laeq_dba != null ? Number(punto.laeq_dba) : null
    const laeqStr = laeqPunto != null && Number.isFinite(laeqPunto)
      ? fmtNum(laeqPunto, 1)
      : periodos.length === 1
        ? fmtNum(periodos[0].laeq_dba, 1)
        : '—'

    const caracteristicas = CARACTERISTICAS_LABEL[punto.caracteristicas_ruido as string]
      ?? ((punto.caracteristicas_ruido as string) ?? '—')

    const tipoPuestoLabel = TIPO_PUESTO_LABEL[punto.tipo_puesto as string]
    const puestoCelda = tipoPuestoLabel && puestoNombre !== '—'
      ? `${puestoNombre} (${tipoPuestoLabel})`
      : puestoNombre

    return {
      punto: idx + 1,
      sector: sectorNombre,
      puesto: puestoCelda,
      teHoras: punto.te_horas != null ? fmtNum(Number(punto.te_horas), 2) : '—',
      tiempoIntegracion: (punto.tiempo_integracion as string) ?? '—',
      caracteristicas,
      lcpico: lcpicoNum != null ? fmtNum(lcpicoNum, 1) : '—',
      laeq: laeqStr,
      sumaFracciones: sumaFracc != null ? fmtNum(sumaFracc, 2) : '—',
      dosisPct: dosisPorcentaje != null ? fmtNum(dosisPorcentaje, 1) : '—',
      cumple: cumpleStr,
    }
  })

  // ── 7b. Matrícula del profesional que ejecuta ────────────────────────────────
  // La cabecera de ruido NO trae la matrícula. La resolvemos del usuario autenticado
  // que ejecuta la gestión (auth.getUser() → perfiles_profesionales → matrícula activa)
  // con el helper compartido. Ruido NO tiene bloque 4a (perfilRaw), así que lo llamamos
  // directo. Best-effort: si no hay, queda undefined (el motor del PDF tiene fallback).
  const matriculaStr = (await resolverMatriculaProfesional()) ?? undefined

  // ── 7c. Información adicional consolidada (campo 34, hoja 2) ───────────────────
  // Cada punto puede traer su propia nota; consolidamos las no vacías en un solo bloque.
  const infoAdicionalStr = (() => {
    const notas = puntosOrdenados
      .map((p) => (p.info_adicional as string | null) ?? null)
      .map((s) => (s ? s.trim() : ''))
      .filter((s) => s.length > 0)
    return notas.length > 0 ? notas.join('\n') : undefined
  })()

  // ── 8. Armar DatosProtocoloRuido ─────────────────────────────────────────────
  const fechaMedicion = m.fecha_medicion as string | null
  const folio = generarFolio(id, fechaMedicion)
  const hoy = formatFecha(new Date().toISOString().slice(0, 10))

  // Calibración: fecha de emisión del certificado → MM/YYYY (estilo SRT).
  const certFecha = certRaw?.fecha_emision as string | null
  let calibracionStr: string | undefined
  if (certFecha) {
    const [cy, cm] = certFecha.split('T')[0].split('-')
    calibracionStr = cm && cy ? `${cm}/${cy}` : undefined
  }

  const datos: DatosProtocoloRuido = {
    // Empresa / Establecimiento
    razonSocial: (empRaw.razon_social as string) ?? undefined,
    cuit: (empRaw.cuit as string) ?? undefined,
    establecimiento: (estRaw.nombre as string) ?? undefined,
    direccion: (estRaw.domicilio as string) ?? undefined,
    localidad: localidadNombre,
    provincia: provinciaNombre,
    cp: (estRaw.codigo_postal as string) ?? undefined,

    // Medición
    instrumento: instrumentoStr,
    calibracion: calibracionStr,
    fechaMedicion: formatFecha(fechaMedicion),
    horaInicio: formatHora(m.hora_inicio as string | null),
    horaFin: formatHora(m.hora_fin as string | null),
    turnos: (m.turnos as string) ?? undefined,

    // Condiciones de trabajo (campos 13-14, hoja 1).
    condicionesNormales: (m.condiciones_normales as string) ?? undefined,
    condicionesMedicion: (m.condiciones_medicion as string) ?? undefined,

    // Profesional firmante (texto libre; matrícula del usuario que ejecuta — ver 7b)
    profesional: (m.firmante as string) ?? undefined,
    matricula: matriculaStr,
    firma: firmaDataUrl,

    // Carátula
    numeroProtocolo: folio,
    fechaEmision: hoy,
    fechaVencimiento: sumarUnAnio(fechaMedicion),
    encomienda: '',

    // Logos
    logoConsultora: logoConsultoraDataUrl,
    logoEmpresa: logoEmpresaDataUrl,

    // Grilla
    filas: filas.length > 0 ? filas : undefined,

    // Información adicional (campo 34, hoja 2) + análisis (hoja 3)
    infoAdicional: infoAdicionalStr,
    conclusiones: (m.conclusiones as string) ?? undefined,
    recomendaciones: (m.recomendaciones as string) ?? undefined,
  }

  // ── 8b. QR de verificación: snapshot público + QR real en la carátula (best-effort) ──
  try {
    const { registrarVerificacion } = await import('@/lib/actions/registrar-verificacion')
    datos.qrVerificacion = await registrarVerificacion({
      folio,
      tipo: 'medicion_ruido',
      medicionId: id,
      consultoraId,
      empresa: datos.razonSocial,
      establecimiento: datos.establecimiento,
      profesional: datos.profesional,
      fechaEjecucion: datos.fechaMedicion,
      fechaEmision: datos.fechaEmision,
      fechaVencimiento: datos.fechaVencimiento,
    })
  } catch (err) {
    console.error('[PDF-REPORTE-RUIDO] no se pudo registrar la verificación:', err instanceof Error ? err.message : String(err))
  }

  // ── 8c. Foto + mapa del establecimiento para la carátula (best-effort) ───────
  const media = await getFotoYMapaEstablecimiento(establecimientoId)
  datos.fotoEstablecimiento = media.fotoEstablecimiento
  datos.mapaEstablecimiento = media.mapaEstablecimiento

  // ── 9. Generar PDF ───────────────────────────────────────────────────────────
  console.warn('[PDF-REPORTE-RUIDO] datos mapeados, llamando renderProtocolo', {
    folio,
    establecimiento: datos.establecimiento,
    filas: filas.length,
  })
  const brandMarca = await getBrandColorConsultora(consultoraId)
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderProtocolo(RUIDO_DESCRIPTOR, datos, brandMarca)
  } catch (err) {
    const detalle = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[PDF-REPORTE-RUIDO] renderProtocolo lanzó:', detalle)
    return {
      success: false,
      error: `Error al renderizar el PDF: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Anexos de sistema: certificado de calibración del sonómetro + plano/croquis
  // (best-effort). El plano sale del campo "Plano / croquis" de la hoja 1
  // (medicion_ruido.plano_url) — así NO se duplica con el control de adjuntos, que
  // ahora pide SOLO la encomienda. El resto de adjuntos manuales (encomienda/otro)
  // se suman en emitir-evidencia-ruido.ts.
  const anexosSistema: AnexoInput[] = []
  const certAnexo = await getAnexoCertificadoCalibracion(
    (m.certificado_id as string | null) ?? null,
    (instrRaw?.id as string | undefined) ?? null,
  )
  if (certAnexo) anexosSistema.push(certAnexo)

  const planoAnexo = await getAnexoPlano((m.plano_url as string | null) ?? null)
  if (planoAnexo) anexosSistema.push(planoAnexo)

  // ── Observaciones de seguimiento cargadas en el último paso del protocolo ──
  // Viven en el pool común `gestiones_observaciones`, ligadas al registro ejecutado
  // por (registro_gestion_id + rg_fecha_planificada). Se renderizan como UNA hoja HTML
  // estilo Sigmetría (con sus fotos del bucket privado `documentos`) y se anexan como PDF
  // — DESPUÉS de certificado + plano, con clave canónica 'observaciones' (el bridge ordena).
  // Best-effort: si algo falla, el PDF sale igual con cert+plano; no rompemos la emisión.
  try {
    const registroId = m.registro_gestion_id as string | null
    const rgFecha = m.rg_fecha_planificada as string | null
    if (registroId) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const obsBuffer = await generarAnexoObservaciones(supabase, registroId, rgFecha, brandMarca)
      if (obsBuffer) {
        anexosSistema.push({ titulo: 'Observaciones de Seguimiento', buffer: obsBuffer, mime: 'application/pdf', clave: 'observaciones' })
      }
    }
  } catch (err) {
    console.error('[PDF-REPORTE-RUIDO] anexo observaciones falló:', err instanceof Error ? err.message : String(err))
  }

  return { success: true, data: { pdf: pdfBuffer, anexos: anexosSistema } }
}
