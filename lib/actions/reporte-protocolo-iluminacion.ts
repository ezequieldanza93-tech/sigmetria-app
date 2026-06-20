'use server'

/**
 * reporte-protocolo-iluminacion.ts — Server Action: genera el PDF del Protocolo SRT 84/2012
 *
 * FASE B: mapeo de datos REALES de una medición de iluminación al motor de PDF.
 *
 * ARQUITECTURA:
 *   1. Lee la medición completa (getMedicionIluminacion) — join cabecera + puntos + celdas.
 *   2. Lee firmas de la entidad (getFirmasEntidad) → firma del profesional.
 *   3. Resuelve logos (consultora + empresa) → data URLs base64 para Chromium serverless.
 *   4. Mapea todos los campos al tipo DatosProtocoloIluminacion.
 *   5. Llama renderProtocoloPdf() → Buffer.
 *
 * DECISIONES DE DISEÑO:
 *   - Folio determinístico: `SIG-{AÑO}-{primeros 6 hex del medicionId}`.
 *     Simple, reproducible, sin colisiones para volúmenes de uso esperado.
 *     Si a futuro se requiere folio numérico secuencial, agregar una columna
 *     `numero_protocolo` con una sequence de Postgres (Fase D).
 *   - Vencimiento: fecha_medicion + 1 año (iluminación es anual per SRT 84/2012).
 *   - El firmante NO es el usuario logueado, sino el campo `medicion_iluminacion.firmante`
 *     (texto libre ingresado en el ejecutor). La firma dibujada viene de tabla `firmas`
 *     (rol 'Profesional' o la primera disponible) como `firma_svg_data` (data URL directa).
 *   - Logos: se resuelven a URL pública/firmada con resolveAssetUrl y luego se convierten
 *     a base64 data URL via fetch + Buffer. Esto evita que Chromium serverless haga
 *     requests de red al renderizar el HTML. Fallo silencioso: si el fetch del logo
 *     falla, se omite (el motor tiene fallback).
 *   - La lógica de cálculo (eMedia, eMinima, cumpleUniformidad, cumpleNivel) viene de
 *     lib/medicion-iluminacion/calculos.ts — módulo compartido con la UI. NO se duplica.
 *
 * FASE C (pendiente): subir el PDF a Supabase y conectar el modal ejecutor.
 * FASE D (pendiente): folio secuencial, encomienda real.
 */

import { getMedicionIluminacion } from '@/lib/actions/medicion-iluminacion'
import { getFirmasEntidad } from '@/lib/actions/firmas'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import {
  renderProtocoloPdf,
  type DatosProtocoloIluminacion,
  type MedicionRow,
} from '@/lib/pdf/render-protocolo'
import {
  eMedia,
  eMinima,
  cumpleUniformidad,
  cumpleNivel,
} from '@/lib/medicion-iluminacion/calculos'
import type { ActionResult } from '@/lib/types'

// ─── Labels de enums → texto legible (mismo mapa que el modal ejecutor) ──────

const TIPO_ILUMINACION_LABEL: Record<string, string> = {
  natural: 'Natural',
  artificial: 'Artificial',
  mixta: 'Mixta',
}

const TIPO_FUENTE_LABEL: Record<string, string> = {
  incandescente: 'Incandescente',
  descarga: 'Descarga',
  mixta: 'Mixta',
}

const TIPO_SISTEMA_LABEL: Record<string, string> = {
  general: 'General',
  localizada: 'Localizada',
  mixta: 'Mixta',
}

// ─── Helpers de formateo ──────────────────────────────────────────────────────

/** Formatea una fecha ISO (YYYY-MM-DD) a DD/MM/YYYY. */
function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  // iso puede venir como "2026-02-28" o "2026-02-28T..."
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

/** Suma 1 año a una fecha ISO (YYYY-MM-DD). */
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

/** Descarga una URL y la convierte en data URL base64. */
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

// ─── HELPERS DE TIPADO PARA LOS EMBEDS DE POSTGREST ──────────────────────────

type EmbedOne<T> = T | T[] | null | undefined

function single<T>(v: EmbedOne<T>): T | null {
  if (v == null) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

// ─── FUNCIÓN PRINCIPAL ────────────────────────────────────────────────────────

/**
 * Genera el PDF del Protocolo de Medición de Iluminación (Res. SRT 84/2012)
 * para una medición real guardada en la base de datos.
 *
 * @param medicionId - UUID de la medición en tabla `medicion_iluminacion`
 * @returns { success: true, data: Buffer } con el PDF, o { success: false, error }
 */
export async function generarReporteProtocoloIluminacion(
  medicionId: string,
): Promise<ActionResult<Buffer>> {
  if (!medicionId) return { success: false, error: 'medicionId requerido' }

  // ── 1. Leer medición completa (join cabecera + establecimiento + empresa + puntos + celdas)
  const medicionResult = await getMedicionIluminacion(medicionId)
  if (!medicionResult.success) {
    console.error('[PDF-REPORTE] getMedicionIluminacion falló', { medicionId, error: medicionResult.error })
    return { success: false, error: medicionResult.error }
  }

  const m = medicionResult.data as Record<string, unknown>

  // ── 2. Extraer subestructuras tipadas ─────────────────────────────────────

  // Establecimiento
  const estRaw = single<Record<string, unknown>>(m.establecimientos as EmbedOne<Record<string, unknown>>)
  if (!estRaw) return { success: false, error: 'Establecimiento no encontrado en el join' }

  // Empresa (dentro del establecimiento)
  const empRaw = single<Record<string, unknown>>(estRaw.empresas as EmbedOne<Record<string, unknown>>)
  if (!empRaw) return { success: false, error: 'Empresa no encontrada en el join' }

  // Instrumento (puede ser null si no se cargó)
  const instrRaw = single<Record<string, unknown>>(m.mediciones_instrumentos as EmbedOne<Record<string, unknown>>)

  // Certificado de calibración
  const certRaw = single<Record<string, unknown>>(m.certificados_calibracion as EmbedOne<Record<string, unknown>>)

  // Perfil profesional (puede ser null — la medición puede no tener perfil_profesional_id)
  const perfilRaw = single<Record<string, unknown>>(m.perfiles_profesionales as EmbedOne<Record<string, unknown>>)

  // Puntos de medición
  const puntosRaw = (m.medicion_iluminacion_puntos as Record<string, unknown>[] | null) ?? []

  // ── 3. Firma del profesional ──────────────────────────────────────────────
  // La firma la busca en la tabla `firmas` (no en el perfil profesional).
  // Toma la de rol 'Profesional', o la primera disponible.
  let firmaDataUrl: string | undefined
  const firmas = await getFirmasEntidad('medicion_iluminacion', medicionId)
  const firmaRow = firmas.find(f => f.rol === 'Profesional') ?? firmas[0] ?? null
  if (firmaRow?.firma_svg_data) {
    // firma_svg_data ya viene como data URL (data:image/png;base64,... o data:image/svg+xml,...)
    firmaDataUrl = firmaRow.firma_svg_data
  }

  // ── 4. Matrícula del profesional ──────────────────────────────────────────
  // Si hay perfiles_profesionales con matriculas_profesionales activa, la usamos.
  // Si no, queda vacío (el motor ya tiene ese fallback).
  let matriculaStr: string | undefined
  if (perfilRaw) {
    const matriculasRaw = perfilRaw.matriculas_profesionales as Record<string, unknown>[] | null ?? []
    const matriculaActiva = matriculasRaw.find(mp => mp.activa === true)
    if (matriculaActiva) {
      const emisor = (matriculaActiva.emisor as string) ?? ''
      const numero = (matriculaActiva.numero as string) ?? ''
      matriculaStr = `${emisor} ${numero}`.trim() || undefined
    }
  }

  // ── 5. Instrumento ────────────────────────────────────────────────────────
  let instrumentoStr: string | undefined
  if (instrRaw) {
    const tipoRaw = single<Record<string, unknown>>(instrRaw.mediciones_instrumentos_tipos as EmbedOne<Record<string, unknown>>)
    const marcaRaw = single<Record<string, unknown>>(instrRaw.organizaciones_externas as EmbedOne<Record<string, unknown>>)
    const tipo = tipoRaw?.nombre ?? ''
    const marca = marcaRaw?.nombre ?? ''
    const modelo = (instrRaw.modelo as string) ?? ''
    const serie = instrRaw.numero_serie ? `· N° ${instrRaw.numero_serie}` : ''
    // Formato: "Luxómetro XLineal · N° 5555678 (Marca)"
    instrumentoStr = [tipo, marca, modelo].filter(Boolean).join(' ') + (serie ? ` ${serie}` : '') || undefined
  }

  // ── 6. Logos → data URLs base64 ───────────────────────────────────────────
  // Buckets 'consultora' y 'logos' son PÚBLICOS → resolveAssetUrl devuelve URL estable.
  // Convertimos a base64 para que Chromium serverless no dependa de red al renderizar.
  // Si falla el fetch, se omite el logo (motor tiene fallback).

  // Para obtener el logo de consultora, necesitamos un query adicional porque el
  // join de getMedicionIluminacion llega hasta empresa, no sube a consultora.
  // Reutilizamos la consultora_id que sí viene en la cabecera de la medición.
  const consultoraId = m.consultora_id as string | null
  let logoConsuloraDataUrl: string | undefined
  let logoEmpresaDataUrl: string | undefined

  // Logo de empresa: empresa.logo_destacado_url (bucket 'logos', público)
  const logoEmpresaPath = empRaw.logo_destacado_url as string | null
  if (logoEmpresaPath) {
    const logoEmpresaUrl = await resolveAssetUrl('logos', logoEmpresaPath)
    logoEmpresaDataUrl = await urlToDataUrl(logoEmpresaUrl)
  }

  // Logo de consultora: necesitamos leerlo — getMedicionIluminacion no trae el join de consultora.
  // Lo obtenemos directamente desde Supabase.
  if (consultoraId) {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: consultoraRow } = await supabase
      .from('consultoras')
      .select('logo_url')
      .eq('id', consultoraId)
      .maybeSingle()

    if (consultoraRow?.logo_url) {
      const logoConsuloraUrl = await resolveAssetUrl('consultora', consultoraRow.logo_url as string)
      logoConsuloraDataUrl = await urlToDataUrl(logoConsuloraUrl)
    }
  }

  // ── 7. Localidad y provincia ──────────────────────────────────────────────
  // getMedicionIluminacion NO incluye el join a localidades.
  // El establecimiento tiene localidad_id → necesitamos la localidad del establecimiento.
  // Hacemos un query adicional mínimo.
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

  // ── 8. Grilla de mediciones ───────────────────────────────────────────────
  // Por cada punto: calcula E media y E mínima con las funciones de calculos.ts.
  // Uniformidad: cumple si E mín >= E media / 2.
  // Nivel: cumple si E media >= valor_requerido_lux.
  const mediciones: MedicionRow[] = puntosRaw.map((punto, idx) => {
    // Celdas del punto
    const celdasRaw = (punto.medicion_iluminacion_celdas as Record<string, unknown>[] | null) ?? []
    const luxValues: number[] = celdasRaw
      .map(c => Number(c.valor_lux))
      .filter(v => Number.isFinite(v) && v >= 0)

    // Cálculos (funciones puras de lib/medicion-iluminacion/calculos.ts)
    const eMed = eMedia(luxValues)
    const eMin = eMinima(luxValues)
    const valorRequerido = punto.valor_requerido_lux != null ? Number(punto.valor_requerido_lux) : null

    const uniformidadOk = luxValues.length > 0 ? cumpleUniformidad(eMin, eMed) : null
    const nivelOk = luxValues.length > 0 && valorRequerido != null ? cumpleNivel(eMed, valorRequerido) : null

    // Sector y puesto desde el join
    const sectorRaw = single<Record<string, unknown>>(punto.establecimientos_sectores as EmbedOne<Record<string, unknown>>)
    const puestoRaw = single<Record<string, unknown>>(punto.puestos_de_trabajo as EmbedOne<Record<string, unknown>>)

    const sectorNombre = (sectorRaw?.nombre as string) ?? '—'
    const puestoNombre = (puestoRaw?.nombre as string) ?? ((punto.turno as string) ?? '—')

    // Enums → labels legibles
    const tipoIluminacion = TIPO_ILUMINACION_LABEL[punto.tipo_iluminacion as string] ?? (punto.tipo_iluminacion as string) ?? '—'
    const tipoFuente = TIPO_FUENTE_LABEL[punto.tipo_fuente as string] ?? (punto.tipo_fuente as string) ?? '—'
    const tipoSistema = TIPO_SISTEMA_LABEL[punto.tipo_sistema as string] ?? (punto.tipo_sistema as string) ?? '—'

    const row: MedicionRow = {
      n: idx + 1,
      hora: (punto.turno as string) ?? '—',
      sector: sectorNombre,
      seccionPuesto: puestoNombre,
      tipoIluminacion,
      tipofuente: tipoFuente,
      iluminacion: tipoSistema,
      uniformidad: uniformidadOk === null ? '—' : uniformidadOk ? 'Cumple' : 'No cumple',
      valorMedido: luxValues.length > 0 ? Math.round(eMed).toString() : '—',
      valorLegal: valorRequerido != null ? valorRequerido.toString() : '—',
    }

    // Anotación interna de cumplimiento (no va al PDF pero útil para debug)
    void nivelOk

    return row
  })

  // ── 9. Armar DatosProtocoloIluminacion ───────────────────────────────────
  const fechaMedicion = m.fecha_medicion as string | null
  const folio = generarFolio(medicionId, fechaMedicion)
  const hoy = formatFecha(new Date().toISOString().slice(0, 10))

  // Calibración: fecha de emisión del certificado (MM/YYYY o DD/MM/YYYY)
  const certFecha = certRaw?.fecha_emision as string | null
  let calibracionStr: string | undefined
  if (certFecha) {
    // Mostrar solo MM/YYYY (estilo de los protocolos SRT)
    const [cy, cm] = certFecha.split('T')[0].split('-')
    calibracionStr = cm && cy ? `${cm}/${cy}` : undefined
  }

  const datos: DatosProtocoloIluminacion = {
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

    // Profesional firmante
    // El firmante es el campo de texto libre `medicion_iluminacion.firmante`,
    // NO el usuario logueado. La firma viene de la tabla `firmas`.
    profesional: (m.firmante as string) ?? undefined,
    matricula: matriculaStr,
    firma: firmaDataUrl,

    // Carátula
    numeroProtocolo: folio,
    fechaEmision: hoy,
    fechaVencimiento: sumarUnAnio(fechaMedicion),
    encomienda: '', // Fase D: encomienda real del colegio profesional

    // Logos (data URLs para Chromium serverless)
    logoConsultora: logoConsuloraDataUrl,
    logoEmpresa: logoEmpresaDataUrl,

    // Grilla
    mediciones: mediciones.length > 0 ? mediciones : undefined,
  }

  // ── 10. Generar PDF ───────────────────────────────────────────────────────
  console.warn('[PDF-REPORTE] datos mapeados, llamando renderProtocoloPdf', { folio, establecimiento: datos.establecimiento, filas: mediciones.length })
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderProtocoloPdf(datos)
  } catch (err) {
    const detalle = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[PDF-REPORTE] renderProtocoloPdf lanzó:', detalle)
    return { success: false, error: `Error al renderizar el PDF: ${err instanceof Error ? err.message : String(err)}` }
  }

  return { success: true, data: pdfBuffer }
}
