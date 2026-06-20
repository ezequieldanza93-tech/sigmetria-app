'use server'

/**
 * reporte-protocolo-carga-fuego.ts — Server Action: genera el PDF del INFORME DE
 * CÁLCULO DE CARGA DE FUEGO (Dec. 351/79, Anexo VII).
 *
 * Réplica del patrón de reporte-protocolo-iluminacion.ts / reporte-protocolo-ruido.ts,
 * adaptado a que la Carga de Fuego es una MEMORIA DE CÁLCULO data-driven:
 *   1. Lee el cálculo completo (getCalculoCargaFuego) — cabecera + establecimiento +
 *      empresa + sectores (flujo nuevo) y/o materiales legacy.
 *   2. Lee la firma del profesional (getFirmasEntidad('calculo_carga_fuego', id)).
 *   3. Resuelve logos (empresa + consultora) → data URLs base64 para Chromium serverless.
 *   4. Query extra mínima: localidad/provincia del establecimiento + logo de consultora
 *      (igual que iluminación: el join no sube a consultora ni resuelve la localidad).
 *   5. Mapea cabecera + sectores + materiales a DatosProtocoloCargaFuego y llama
 *      renderProtocolo(CARGA_FUEGO_DESCRIPTOR, datos).
 *
 * DECISIONES DE DISEÑO (espejan iluminación/ruido):
 *   - Folio determinístico: `SIG-{AÑO}-{primeros 6 hex del calculoId}`.
 *   - Vencimiento: created_at del cálculo + 1 año (no hay fecha_medicion; el cálculo no
 *     "vence" como una medición, pero mantenemos la convención de las carátulas).
 *   - El firmante es el texto libre `calculo_carga_fuego.firmante`.
 *   - NO se recalcula nada: qf_kg_m2 / riesgo / f_exigido / potencial_extintor_a·b ya
 *     vienen persistidos por sector. calculos.ts solo se usa para derivar el equiv. de
 *     madera de un material si la fila no lo trae (equiv = peso · C; C = coefEquiv(PCI)).
 *   - Multi-sector: usa calculo_carga_fuego_sectores → calculo_carga_fuego_sector_materiales.
 *     Legacy (sin sectores): trata la cabecera como 1 sector implícito + sus materiales
 *     de calculo_carga_fuego_materiales.
 */

import { getCalculoCargaFuego } from '@/lib/actions/calculo-carga-fuego'
import { getFirmasEntidad } from '@/lib/actions/firmas'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import { renderProtocolo } from '@/lib/pdf/protocolo-engine'
import {
  CARGA_FUEGO_DESCRIPTOR,
  type DatosProtocoloCargaFuego,
  type SectorCargaFuego,
  type MaterialCargaFuego,
} from '@/lib/pdf/descriptors/carga-fuego'
import { coefEquiv, equivMadera } from '@/lib/calculo-carga-fuego/calculos'
import type { ActionResult } from '@/lib/types'

// ─── Labels de enums → texto legible ────────────────────────────────────────────

const RIESGO_LABEL: Record<string, string> = {
  R1: 'R1 · Explosivos',
  R2: 'R2 · Inflamables',
  R3: 'R3 · Muy combustibles',
  R4: 'R4 · Combustibles',
  R5: 'R5 · Poco combustibles',
  R6: 'R6 · Incombustibles',
  R7: 'R7 · Refractarios',
}

const ESTADO_LABEL: Record<string, string> = {
  solido: 'Sólido',
  liquido: 'Líquido',
  gaseoso: 'Gaseoso',
  gas: 'Gaseoso',
}

// ─── Helpers de formateo ────────────────────────────────────────────────────────

/** Formatea una fecha ISO (YYYY-MM-DD[...]) a DD/MM/YYYY. */
function formatFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [datePart] = iso.split('T')
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${y}`
}

/** Suma 1 año a una fecha ISO (YYYY-MM-DD[...]) → DD/MM/YYYY. */
function sumarUnAnio(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [datePart] = iso.split('T')
  const [y, m, d] = datePart.split('-')
  if (!y || !m || !d) return '—'
  return `${d}/${m}/${Number(y) + 1}`
}

/** Genera el folio determinístico del informe. */
function generarFolio(calculoId: string, fecha: string | null | undefined): string {
  const anio = fecha ? fecha.slice(0, 4) : new Date().getFullYear().toString()
  const hex = calculoId.replace(/-/g, '').slice(0, 6).toUpperCase()
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

/** Convierte cualquier valor de DB a número finito, o null. */
function toNum(v: unknown): number | null {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Formatea un número con separador de miles es-AR (coma decimal), o '—'. */
function fmtNum(n: number | null, decimales = 0): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  })
}

/** Formatea un peso en kg con miles, o '—'. */
function fmtPeso(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${fmtNum(n, 0)} kg`
}

/** Formatea una superficie en m², o '—'. */
function fmtSuperficie(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${fmtNum(n, 0)} m²`
}

/** Estado físico → label legible (acepta enum normalizado o texto libre). */
function estadoLabel(raw: unknown): string {
  if (raw == null || raw === '') return '—'
  const s = String(raw)
  return ESTADO_LABEL[s.toLowerCase()] ?? s
}

/** Riesgo Rx → label legible (acepta 'R3' o ya formateado). */
function riesgoLabel(raw: unknown): string {
  if (raw == null || raw === '') return '—'
  const s = String(raw).toUpperCase()
  return RIESGO_LABEL[s] ?? String(raw)
}

/** Potencial extintor: '3A' / '20B' / vacío → '—'. */
function potencialLabel(raw: unknown): string {
  if (raw == null || String(raw).trim() === '') return '—'
  return String(raw)
}

// ─── Mapeo de materiales ──────────────────────────────────────────────────────

/**
 * Mapea una fila de material de DB (sea de sector_materiales o legacy materiales) a
 * MaterialCargaFuego. Deriva coef. C / equiv. madera SOLO si faltan, usando calculos.ts.
 * Devuelve también el equivalente en madera numérico para el total Σ del sector.
 */
function mapMaterial(raw: Record<string, unknown>): { mat: MaterialCargaFuego; equivNum: number } {
  const peso = toNum(raw.peso_kg)
  const pci = toNum(raw.pci_kcal)
  let coef = toNum(raw.coef_c)
  // Si no vino el coeficiente C pero sí el PCI, lo derivamos (C = PCI / 4400).
  if (coef == null && pci != null) coef = coefEquiv(pci)

  let equivNum = toNum(raw.equiv_madera_kg)
  // Si no vino el equivalente pero tenemos peso + C, lo derivamos (equiv = peso · C).
  if (equivNum == null && peso != null && coef != null) equivNum = equivMadera(peso, coef)

  const mat: MaterialCargaFuego = {
    descripcion: (raw.descripcion as string) ?? '—',
    estado: estadoLabel(raw.estado),
    peso: fmtPeso(peso),
    pci: fmtNum(pci, 0),
    coefC: coef != null ? coef.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—',
    equivMadera: fmtPeso(equivNum),
  }
  return { mat, equivNum: equivNum ?? 0 }
}

/** Ordena filas por `orden` (fallback al orden del array). */
function porOrden(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0))
}

// ─── FUNCIÓN PRINCIPAL ──────────────────────────────────────────────────────────

/**
 * Genera el PDF del Informe de Cálculo de Carga de Fuego (Dec. 351/79, Anexo VII)
 * para un cálculo real guardado en `calculo_carga_fuego`.
 *
 * @param id - UUID del cálculo en tabla `calculo_carga_fuego`
 * @returns { success: true, data: Buffer } con el PDF, o { success: false, error }
 */
export async function generarReporteProtocoloCargaFuego(
  id: string,
): Promise<ActionResult<Buffer>> {
  if (!id) return { success: false, error: 'calculoId requerido' }

  // ── 1. Leer cálculo completo ─────────────────────────────────────────────────
  const calcResult = await getCalculoCargaFuego(id)
  if (!calcResult.success) {
    console.error('[PDF-REPORTE-CF] getCalculoCargaFuego falló', { id, error: calcResult.error })
    return { success: false, error: calcResult.error }
  }

  const c = calcResult.data as Record<string, unknown>

  // ── 2. Subestructuras tipadas ────────────────────────────────────────────────
  const estRaw = single<Record<string, unknown>>(c.establecimientos as EmbedOne<Record<string, unknown>>)
  if (!estRaw) return { success: false, error: 'Establecimiento no encontrado en el join' }

  const empRaw = single<Record<string, unknown>>(estRaw.empresas as EmbedOne<Record<string, unknown>>)
  if (!empRaw) return { success: false, error: 'Empresa no encontrada en el join' }

  const sectoresRaw = (c.calculo_carga_fuego_sectores as Record<string, unknown>[] | null) ?? []
  const materialesLegacyRaw = (c.calculo_carga_fuego_materiales as Record<string, unknown>[] | null) ?? []

  // ── 3. Firma del profesional ─────────────────────────────────────────────────
  let firmaDataUrl: string | undefined
  const firmas = await getFirmasEntidad('calculo_carga_fuego', id)
  const firmaRow = firmas.find((f) => f.rol === 'Profesional') ?? firmas[0] ?? null
  if (firmaRow?.firma_svg_data) {
    firmaDataUrl = firmaRow.firma_svg_data
  }

  // ── 4. Logos → data URLs base64 ──────────────────────────────────────────────
  const consultoraId = c.consultora_id as string | null
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

  // ── 5. Localidad y provincia (query extra; el join no las resuelve) ──────────
  let localidadNombre: string | undefined
  let provinciaNombre: string | undefined

  const establecimientoId = c.establecimiento_id as string | null
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

  // ── 6. Construir los sectores (multi-sector nuevo | legacy 1 sector) ─────────

  /** Deriva el chip de cumplimiento de un sector. Heurística: si no hay potencial
   *  extintor exigido (A y B vacíos) o no hay riesgo, no podemos afirmar cumplimiento
   *  → null (chip "Sin dato"). En el flujo actual el cumplimiento concreto (cantidad
   *  real de matafuegos vs. exigida) no se persiste, así que el informe muestra los
   *  valores EXIGIDOS; el "Cumple" se deja en null salvo que el sector tenga riesgo
   *  y F definidos (caso en que el cálculo está completo). */
  function cumpleSector(riesgo: unknown, fExigido: unknown): boolean | null {
    const tieneRiesgo = riesgo != null && String(riesgo).trim() !== ''
    const tieneF = fExigido != null && String(fExigido).trim() !== ''
    if (tieneRiesgo && tieneF) return true
    return null
  }

  function buildSector(
    nombre: string,
    superficie: number | null,
    materiales: Record<string, unknown>[],
    qf: number | null,
    riesgo: unknown,
    fExigido: unknown,
    potA: unknown,
    potB: unknown,
  ): SectorCargaFuego {
    let equivTotal = 0
    const mats: MaterialCargaFuego[] = porOrden(materiales).map((m) => {
      const { mat, equivNum } = mapMaterial(m)
      equivTotal += equivNum
      return mat
    })
    return {
      nombre,
      superficie: fmtSuperficie(superficie),
      materiales: mats,
      equivTotal: fmtPeso(equivTotal),
      qf: qf != null ? qf.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—',
      riesgo: riesgoLabel(riesgo),
      fExigido: fExigido != null && String(fExigido).trim() !== '' ? String(fExigido) : '—',
      potencialA: potencialLabel(potA),
      potencialB: potencialLabel(potB),
      cumple: cumpleSector(riesgo, fExigido),
    }
  }

  let sectores: SectorCargaFuego[]
  if (sectoresRaw.length > 0) {
    // Flujo multi-sector.
    sectores = porOrden(sectoresRaw).map((s) =>
      buildSector(
        (s.nombre_sector as string) ?? 'Sector',
        toNum(s.superficie_m2),
        (s.calculo_carga_fuego_sector_materiales as Record<string, unknown>[] | null) ?? [],
        toNum(s.qf_kg_m2),
        s.riesgo,
        s.f_exigido,
        s.potencial_extintor_a,
        s.potencial_extintor_b,
      ),
    )
  } else {
    // Flujo legacy: la cabecera ES el único sector implícito.
    sectores = [
      buildSector(
        (c.sector_incendio as string) ?? (estRaw.nombre as string) ?? 'Sector único',
        toNum(c.superficie_m2),
        materialesLegacyRaw,
        toNum(c.qf_kg_m2),
        c.riesgo,
        c.f_exigido,
        c.potencial_extintor_a,
        c.potencial_extintor_b,
      ),
    ]
  }

  // ── 7. Armar DatosProtocoloCargaFuego ────────────────────────────────────────
  const fechaBase = (c.created_at as string | null) ?? null
  const folio = generarFolio(id, fechaBase)
  const hoy = formatFecha(new Date().toISOString().slice(0, 10))

  const datos: DatosProtocoloCargaFuego = {
    // Empresa / Establecimiento
    razonSocial: (empRaw.razon_social as string) ?? undefined,
    cuit: (empRaw.cuit as string) ?? undefined,
    establecimiento: (estRaw.nombre as string) ?? undefined,
    direccion: (estRaw.domicilio as string) ?? undefined,
    localidad: localidadNombre,
    provincia: provinciaNombre,
    cp: (estRaw.codigo_postal as string) ?? undefined,

    // No hay instrumento de medición (cálculo por inventario).
    instrumento: undefined,
    calibracion: undefined,
    fechaMedicion: formatFecha(fechaBase),

    // Profesional firmante (texto libre; matrícula no la trae la cabecera de CF).
    profesional: (c.firmante as string) ?? undefined,
    matricula: undefined,
    firma: firmaDataUrl,

    // Carátula
    numeroProtocolo: folio,
    fechaEmision: hoy,
    fechaVencimiento: sumarUnAnio(fechaBase),
    encomienda: '',

    // Logos
    logoConsultora: logoConsultoraDataUrl,
    logoEmpresa: logoEmpresaDataUrl,

    // Cuerpo data-driven
    sectores,
  }

  // ── 7b. QR de verificación: snapshot público + QR real en la carátula (best-effort) ──
  try {
    const { registrarVerificacion } = await import('@/lib/actions/registrar-verificacion')
    datos.qrVerificacion = await registrarVerificacion({
      folio,
      tipo: 'calculo_carga_fuego',
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
    console.error('[PDF-REPORTE-CF] no se pudo registrar la verificación:', err instanceof Error ? err.message : String(err))
  }

  // ── 8. Generar PDF ───────────────────────────────────────────────────────────
  console.warn('[PDF-REPORTE-CF] datos mapeados, llamando renderProtocolo', {
    folio,
    establecimiento: datos.establecimiento,
    sectores: sectores.length,
  })
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderProtocolo(CARGA_FUEGO_DESCRIPTOR, datos)
  } catch (err) {
    const detalle = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[PDF-REPORTE-CF] renderProtocolo lanzó:', detalle)
    return {
      success: false,
      error: `Error al renderizar el PDF: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  return { success: true, data: pdfBuffer }
}
