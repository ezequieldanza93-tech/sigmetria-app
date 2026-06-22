'use server'

/**
 * reporte-protocolo-pat.ts — Server Action: genera el PDF del Protocolo de Puesta a
 * Tierra y Continuidad de las Masas (Res. SRT 900/2015) para una medición real.
 *
 * ARQUITECTURA (clonada de reporte-protocolo-iluminacion.ts, adaptada a PAT):
 *   1. Lee la medición completa con getMedicionPat — join cabecera + tomas + sectores +
 *      establecimiento (→ empresa) + instrumento + certificado.
 *   2. Lee firmas de la entidad (getFirmasEntidad) → firma del profesional.
 *   3. Query extra: localidad/provincia del establecimiento + logo de consultora.
 *   4. Resuelve logos (empresa + consultora) a data URLs base64 para Chromium serverless.
 *   5. Mapea todo al tipo DatosProtocoloPat.
 *   6. Llama renderProtocolo(PAT_DESCRIPTOR, datos) del motor genérico → Buffer.
 *
 * DIFERENCIAS RESPECTO DE ILUMINACIÓN:
 *   - El firmante de PAT es `firmante_persona_id` (FK a personas_directorio), NO un
 *     perfil profesional con matrícula. La matrícula NO está modelada para PAT → queda
 *     vacía (el motor la omite). El texto del firmante usa el campo `firmante` (derivado
 *     de la persona) como fallback de nombre.
 *   - NO hay cálculos: `cumple`/`continuidad`/`capacidad_carga`/`desconexion_automatica`
 *     ya vienen como booleanos desde medicion_pat_tomas.
 *   - El valor exigido (Ω) NO tiene columna propia en el formulario legal: se anexa al
 *     valor medido como referencia ("12 Ω (exig. ≤ 40 Ω)").
 *   - Vencimiento: fecha_medicion + 1 año (PAT es anual per SRT 900/2015).
 */

import { getMedicionPat } from '@/lib/actions/medicion-pat'
import { getFirmasEntidad } from '@/lib/actions/firmas'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import { renderProtocolo } from '@/lib/pdf/protocolo-engine'
import { getFotoYMapaEstablecimiento } from '@/lib/pdf/establecimiento-media'
import { getAnexoCertificadoCalibracion, getAnexoPlano } from '@/lib/pdf/anexo-certificado'
import { generarAnexoObservaciones } from '@/lib/pdf/anexo-observaciones'
import { resolverMatriculaProfesional } from '@/lib/pdf/resolver-matricula'
import {
  PAT_DESCRIPTOR,
  type DatosProtocoloPat,
  type TomaPatRow,
} from '@/lib/pdf/descriptors/pat'
import type { AnexoInput } from '@/lib/pdf/merge-anexos'
import type { ActionResult } from '@/lib/types'

// ─── Helpers de formateo ────────────────────────────────────────────────────

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

/** Descarga una URL y la convierte en data URL base64 (evita requests de red en Chromium). */
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

/** SI / NO / — a partir de un booleano de la base. */
function siNo(v: unknown): string {
  if (v === true) return 'SI'
  if (v === false) return 'NO'
  return '—'
}

// ─── Helpers de tipado para embeds de PostgREST ──────────────────────────────

type EmbedOne<T> = T | T[] | null | undefined

function single<T>(v: EmbedOne<T>): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

/**
 * Genera el PDF del Protocolo de Puesta a Tierra (Res. SRT 900/2015) para una
 * medición real guardada en `medicion_pat`.
 *
 * @param id - UUID de la medición en tabla `medicion_pat`
 * @returns { success: true, data: { pdf: Buffer; anexos: AnexoInput[] } } con el PDF y
 *          los anexos de sistema (vacío en PAT por ahora), o { success: false, error }
 */
export async function generarReporteProtocoloPat(
  id: string,
): Promise<ActionResult<{ pdf: Buffer; anexos: AnexoInput[] }>> {
  if (!id) return { success: false, error: 'id de medición requerido' }

  // ── 1. Leer medición completa (cabecera + tomas + joins) ────────────────────
  const medicionResult = await getMedicionPat(id)
  if (!medicionResult.success) {
    console.error('[PDF-REPORTE-PAT] getMedicionPat falló', { id, error: medicionResult.error })
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

  const tomasRaw = (m.medicion_pat_tomas as Record<string, unknown>[] | null) ?? []

  // ── 3. Firma del profesional (tabla `firmas`, rol Profesional o la primera) ──
  let firmaDataUrl: string | undefined
  const firmas = await getFirmasEntidad('medicion_pat', id)
  const firmaRow = firmas.find((f) => f.rol === 'Profesional') ?? firmas[0] ?? null
  if (firmaRow?.firma_svg_data) {
    firmaDataUrl = firmaRow.firma_svg_data
  }

  // ── 4. Instrumento (telurímetro) ─────────────────────────────────────────────
  let instrumentoStr: string | undefined
  if (instrRaw) {
    const tipoRaw = single<Record<string, unknown>>(instrRaw.productos_componentes as EmbedOne<Record<string, unknown>>)
    const marcaRaw = single<Record<string, unknown>>(instrRaw.organizaciones_externas as EmbedOne<Record<string, unknown>>)
    const tipo = (tipoRaw?.nombre as string) ?? ''
    const marca = (marcaRaw?.nombre as string) ?? ''
    const modelo = (instrRaw.modelo as string) ?? ''
    const serie = instrRaw.numero_serie ? `· N° ${instrRaw.numero_serie as string}` : ''
    instrumentoStr = [tipo, marca, modelo].filter(Boolean).join(' ') + (serie ? ` ${serie}` : '') || undefined
  }

  // ── 5. Calibración: fecha de emisión del certificado (MM/YYYY) ───────────────
  const certFecha = certRaw?.fecha_emision as string | null
  let calibracionStr: string | undefined
  if (certFecha) {
    const [cy, cm] = certFecha.split('T')[0].split('-')
    calibracionStr = cm && cy ? `${cm}/${cy}` : undefined
  }

  // ── 6. Logos → data URLs base64 ──────────────────────────────────────────────
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

  // ── 7. Localidad y provincia (getMedicionPat no las trae) ────────────────────
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

  // ── 8. Grilla de tomas → filas legibles ──────────────────────────────────────
  const tomas: TomaPatRow[] = tomasRaw
    .slice()
    .sort((a, b) => Number(a.orden ?? a.numero_toma ?? 0) - Number(b.orden ?? b.numero_toma ?? 0))
    .slice(0, 11) // el formulario legal tiene 11 filas
    .map((t, idx) => {
      const sectorRaw = single<Record<string, unknown>>(t.establecimientos_sectores as EmbedOne<Record<string, unknown>>)
      const sectorNombre = (sectorRaw?.nombre as string) ?? (t.seccion as string) ?? '—'

      // Valor exigido sin columna propia → se anexa como referencia al valor medido.
      const medido = t.valor_medido_ohm != null ? `${t.valor_medido_ohm as number} Ω` : '—'
      const exigido = t.valor_exigido_ohm != null ? ` (exig. ≤ ${t.valor_exigido_ohm as number} Ω)` : ''

      return {
        numeroToma: (t.numero_toma as number) ?? idx + 1,
        sector: sectorNombre,
        condicionTerreno: (t.condicion_terreno as string) ?? '—',
        usoPat: (t.uso_pat as string) ?? '—',
        esquema: (t.ect as string) ?? '—',
        valorMedidoOhm: medido + exigido,
        cumple: siNo(t.cumple),
        continuidad: siNo(t.continuidad),
        capacidadCarga: siNo(t.capacidad_carga),
        proteccion: (t.proteccion as string) ?? '—',
        desconexionAutomatica: siNo(t.desconexion_automatica),
      }
    })

  // ── 8b. Información adicional (campo 33): consolida las observaciones por toma ─
  // El formulario legal SRT tiene UNA celda de "Información adicional" para toda la
  // hoja, pero el ejecutor carga observaciones POR toma (TomaState.observaciones →
  // medicion_pat_tomas.observaciones). Las unimos prefijando el N° de toma, omitiendo
  // las vacías. Si ninguna tiene texto, queda vacío (el descriptor no toca la celda).
  const infoAdicional = tomasRaw
    .slice()
    .sort((a, b) => Number(a.orden ?? a.numero_toma ?? 0) - Number(b.orden ?? b.numero_toma ?? 0))
    .map((t, idx) => {
      const obs = (t.observaciones as string | null)?.trim()
      if (!obs) return null
      return `Toma ${(t.numero_toma as number) ?? idx + 1}: ${obs}`
    })
    .filter((s): s is string => s != null)
    .join(' · ')

  // ── 9. Armar DatosProtocoloPat ───────────────────────────────────────────────
  const fechaMedicion = m.fecha_medicion as string | null
  const folio = generarFolio(id, fechaMedicion)
  const hoy = formatFecha(new Date().toISOString().slice(0, 10))

  const datos: DatosProtocoloPat = {
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

    // Profesional firmante (PAT: campo `firmante` derivado de la persona).
    // La matrícula se resuelve del responsable que EJECUTA (auth → perfil → matrícula
    // activa) vía resolverMatriculaProfesional(); null si no hay (el motor tiene fallback).
    profesional: (m.firmante as string) ?? undefined,
    matricula: (await resolverMatriculaProfesional()) ?? undefined,
    firma: firmaDataUrl,

    // Carátula
    numeroProtocolo: folio,
    fechaEmision: hoy,
    fechaVencimiento: sumarUnAnio(fechaMedicion),
    encomienda: '',

    // Logos (data URLs para Chromium serverless)
    logoConsultora: logoConsultoraDataUrl,
    logoEmpresa: logoEmpresaDataUrl,

    // Campos PAT-específicos
    metodologia: (m.metodologia as string) ?? undefined,
    observaciones: (m.observaciones as string) ?? undefined,
    infoAdicional: infoAdicional || undefined,
    conclusiones: (m.conclusiones as string) ?? undefined,
    recomendaciones: (m.recomendaciones as string) ?? undefined,
    tomas: tomas.length > 0 ? tomas : undefined,
  }

  // ── 9b. QR de verificación: snapshot público + QR real en la carátula (best-effort) ──
  try {
    const { registrarVerificacion } = await import('@/lib/actions/registrar-verificacion')
    datos.qrVerificacion = await registrarVerificacion({
      folio,
      tipo: 'medicion_pat',
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
    console.error('[PDF-REPORTE-PAT] no se pudo registrar la verificación:', err instanceof Error ? err.message : String(err))
  }

  // ── 9c. Foto + mapa del establecimiento para la carátula (best-effort) ────────
  const media = await getFotoYMapaEstablecimiento(establecimientoId)
  datos.fotoEstablecimiento = media.fotoEstablecimiento
  datos.mapaEstablecimiento = media.mapaEstablecimiento

  // ── 10. Generar PDF con el motor genérico ────────────────────────────────────
  console.warn('[PDF-REPORTE-PAT] datos mapeados, llamando renderProtocolo', {
    folio,
    establecimiento: datos.establecimiento,
    tomas: tomas.length,
  })
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderProtocolo(PAT_DESCRIPTOR, datos)
  } catch (err) {
    const detalle = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[PDF-REPORTE-PAT] renderProtocolo lanzó:', detalle)
    return { success: false, error: `Error al renderizar el PDF: ${err instanceof Error ? err.message : String(err)}` }
  }

  // Anexo de sistema: certificado de calibración del telurímetro (best-effort).
  const anexosSistema: AnexoInput[] = []
  const certAnexo = await getAnexoCertificadoCalibracion(
    (m.certificado_id as string | null) ?? null,
    (instrRaw?.id as string | undefined) ?? null,
  )
  if (certAnexo) anexosSistema.push(certAnexo)

  // Anexo de sistema: plano / croquis de las tomas cargado en la Hoja 1 (best-effort).
  const planoAnexo = await getAnexoPlano((m.plano_url as string | null) ?? null)
  if (planoAnexo) anexosSistema.push(planoAnexo)

  // Anexo de sistema: observaciones de seguimiento cargadas en el último paso del
  // protocolo. Viven en el pool común `gestiones_observaciones`, ligadas al registro
  // ejecutado por (registro_gestion_id + rg_fecha_planificada). Se renderizan como UNA
  // hoja PDF estilo Sigmetría (con sus fotos del bucket privado `documentos`) — DESPUÉS
  // de cert + plano. Best-effort: si algo falla, el PDF sale igual con cert+plano.
  try {
    const registroId = m.registro_gestion_id as string | null
    const rgFecha = m.rg_fecha_planificada as string | null
    if (registroId) {
      const { createClient } = await import('@/lib/supabase/server')
      const supabase = await createClient()
      const obsBuffer = await generarAnexoObservaciones(supabase, registroId, rgFecha)
      if (obsBuffer) {
        anexosSistema.push({ titulo: 'Observaciones de Seguimiento', buffer: obsBuffer, mime: 'application/pdf', clave: 'observaciones' })
      }
    }
  } catch (err) {
    console.error('[PDF-REPORTE-PAT] anexo observaciones falló:', err instanceof Error ? err.message : String(err))
  }

  return { success: true, data: { pdf: pdfBuffer, anexos: anexosSistema } }
}
