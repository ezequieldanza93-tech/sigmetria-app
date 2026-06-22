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
  type FilaExtintor,
  type FilaCondiciones,
  type ConclusionesCargaFuego,
} from '@/lib/pdf/descriptors/carga-fuego'
import {
  coefEquiv,
  equivMadera,
  dimensionarExtintores,
  type MaterialClase,
  type CumplimientoExtintor,
} from '@/lib/calculo-carga-fuego/calculos'
import { getFotoYMapaEstablecimiento } from '@/lib/pdf/establecimiento-media'
import { getAnexoPlano } from '@/lib/pdf/anexo-certificado'
import { generarAnexoObservaciones } from '@/lib/pdf/anexo-observaciones'
import { resolverMatriculaProfesional } from '@/lib/pdf/resolver-matricula'
import type { AnexoInput } from '@/lib/pdf/merge-anexos'
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
 * Devuelve también: equivalente en madera numérico (total Σ), calor generado numérico
 * (Σ calor), y el estado físico crudo (para inferir la clase de fuego del sector).
 */
function mapMaterial(raw: Record<string, unknown>): {
  mat: MaterialCargaFuego
  equivNum: number
  calorNum: number
  estadoRaw: string | null
} {
  const peso = toNum(raw.peso_kg)
  const pci = toNum(raw.pci_kcal)
  let coef = toNum(raw.coef_c)
  // Si no vino el coeficiente C pero sí el PCI, lo derivamos (C = PCI / 4400).
  if (coef == null && pci != null) coef = coefEquiv(pci)

  let equivNum = toNum(raw.equiv_madera_kg)
  // Si no vino el equivalente pero tenemos peso + C, lo derivamos (equiv = peso · C).
  if (equivNum == null && peso != null && coef != null) equivNum = equivMadera(peso, coef)

  // Calor generado (Kcal) = peso · PCI. Solo si tenemos ambos datos.
  const calorNum = peso != null && pci != null ? peso * pci : null

  const mat: MaterialCargaFuego = {
    descripcion: (raw.descripcion as string) ?? '—',
    estado: estadoLabel(raw.estado),
    peso: fmtPeso(peso),
    pci: fmtNum(pci, 0),
    calorGenerado: fmtNum(calorNum, 0),
    coefC: coef != null ? coef.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—',
    equivMadera: fmtPeso(equivNum),
  }
  return {
    mat,
    equivNum: equivNum ?? 0,
    calorNum: calorNum ?? 0,
    estadoRaw: raw.estado != null ? String(raw.estado) : null,
  }
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
): Promise<ActionResult<{ pdf: Buffer; anexos: AnexoInput[] }>> {
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

  // ── 5b. Matrícula del profesional que EJECUTA la gestión ─────────────────────
  // La cabecera de CF no trae perfil_profesional ni matrícula (a diferencia de
  // iluminación), así que la resolvemos directo desde el usuario autenticado con el
  // helper compartido (auth.getUser() → perfiles_profesionales → matriculas_profesionales
  // activa → "emisor numero"). Best-effort: si no hay, queda vacío (el motor del PDF
  // tiene fallback).
  const matriculaStr = (await resolverMatriculaProfesional()) ?? undefined

  // ── 6. Construir los sectores (multi-sector nuevo | legacy 1 sector) ─────────

  /** Estado del sector para el chip. El cumplimiento real (matafuegos instalados vs.
   *  potencial extintor exigido) NO se persiste, así que NUNCA se afirma "Cumple":
   *  un sector con riesgo + F definidos (cálculo completo) devuelve true y el chip lo
   *  muestra como "Verificar"; si falta riesgo o F → null → "Sin dato". */
  function cumpleSector(riesgo: unknown, fExigido: unknown): boolean | null {
    const tieneRiesgo = riesgo != null && String(riesgo).trim() !== ''
    const tieneF = fExigido != null && String(fExigido).trim() !== ''
    if (tieneRiesgo && tieneF) return true
    return null
  }

  /** Datos crudos de un sector que necesitan las tablas de dimensionamiento y condiciones
   *  (no formateados): superficie numérica, raw qf/riesgo/F/potencial y estados físicos. */
  interface SectorRaw {
    nombre: string
    superficie: number | null
    qf: number | null
    riesgoLabel: string
    fExigido: string | null
    potA: string | null
    potB: string | null
    materialesClase: MaterialClase[]
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
  ): { sector: SectorCargaFuego; raw: SectorRaw } {
    let equivTotal = 0
    let calorTotal = 0
    const materialesClase: MaterialClase[] = []
    const mats: MaterialCargaFuego[] = porOrden(materiales).map((m) => {
      const { mat, equivNum, calorNum, estadoRaw } = mapMaterial(m)
      equivTotal += equivNum
      calorTotal += calorNum
      materialesClase.push({ estado: estadoRaw })
      return mat
    })
    const fStr = fExigido != null && String(fExigido).trim() !== '' ? String(fExigido) : null
    const potAStr = potA != null && String(potA).trim() !== '' ? String(potA) : null
    const potBStr = potB != null && String(potB).trim() !== '' ? String(potB) : null

    // Clase de fuego predominante (de los estados de los materiales).
    const clase = dimensionarExtintores({
      superficie,
      materiales: materialesClase,
      potencialA: potAStr,
      potencialB: potBStr,
    }).clase

    const sector: SectorCargaFuego = {
      nombre,
      superficie: fmtSuperficie(superficie),
      materiales: mats,
      equivTotal: fmtPeso(equivTotal),
      calorTotal: fmtNum(calorTotal, 0),
      claseFuego: clase,
      qf: qf != null ? qf.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—',
      riesgo: riesgoLabel(riesgo),
      fExigido: fStr ?? '—',
      potencialA: potencialLabel(potA),
      potencialB: potencialLabel(potB),
      cumple: cumpleSector(riesgo, fExigido),
    }
    const raw: SectorRaw = {
      nombre,
      superficie,
      qf,
      riesgoLabel: riesgoLabel(riesgo),
      fExigido: fStr,
      potA: potAStr,
      potB: potBStr,
      materialesClase,
    }
    return { sector, raw }
  }

  let built: { sector: SectorCargaFuego; raw: SectorRaw }[]
  if (sectoresRaw.length > 0) {
    // Flujo multi-sector.
    built = porOrden(sectoresRaw).map((s) =>
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
    built = [
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

  const sectores: SectorCargaFuego[] = built.map((b) => b.sector)

  // ── 6b. AUTO-CÁLCULO del dimensionamiento de extintores (en vivo, NO se persiste) ──
  // Para cada sector: clase de fuego, potencial mínimo exigido (ya persistido, Tablas
  // I/II), cantidad mínima por superficie (Art. 176) y tipo recomendado. Ver
  // lib/calculo-carga-fuego/calculos.ts → dimensionarExtintores para los supuestos.
  const cumpleLabel: Record<CumplimientoExtintor, string> = {
    cumple: 'Cumple',
    excede: 'Excede',
    verificar: 'Verificar',
    sin_dato: 'Sin dato',
  }

  const extintores: FilaExtintor[] = built.map((b) => {
    const dim = dimensionarExtintores({
      superficie: b.raw.superficie,
      materiales: b.raw.materialesClase,
      potencialA: b.raw.potA,
      potencialB: b.raw.potB,
    })
    return {
      sector: b.raw.nombre,
      superficie: fmtSuperficie(b.raw.superficie),
      cargaA: dim.potencialA,
      cargaB: dim.potencialB,
      tipo: dim.tipo,
      cantidad: dim.cantidad != null ? String(dim.cantidad) : '—',
      cumple: cumpleLabel[dim.cumplimiento],
      recomendaciones: dim.recomendaciones,
    }
  })

  // ── 6c. CONDICIONES de situación/construcción/extinción ───────────────────────
  // El modal NO captura estos campos hoy. Dejamos la estructura con los datos que SÍ
  // existen (sector + resistencia al fuego del sector) y guion en lo no relevado. NO se
  // inventan condiciones: situación/construcción/extinción quedan en '—'.
  const condiciones: FilaCondiciones[] = built.map((b) => ({
    sector: b.raw.nombre,
    situacion: '—',
    construccion: '—',
    extincion: '—',
    resistencia: b.raw.fExigido ?? '—',
  }))

  // ── 6d. CONCLUSIONES estructuradas (derivadas) + texto libre del modal ─────────
  // Extintores: si TODOS los sectores con dato exigen ≤ potencial estándar → "Cumple";
  // si alguno exige más → "Verificar"; si ninguno tiene potencial exigido → "Sin dato".
  // Condiciones (situación/construcción/extinción): el modal no las releva → "No se relevó".
  const estadosExt = extintores.map((e) => e.cumple.toLowerCase())
  const conDato = estadosExt.filter((s) => s !== 'sin dato')
  let conclExtintores: string
  if (conDato.length === 0) conclExtintores = 'Sin dato'
  else if (conDato.some((s) => s === 'verificar')) conclExtintores = 'Verificar'
  else conclExtintores = 'Cumple'

  const conclusiones: ConclusionesCargaFuego = {
    extintores: conclExtintores,
    situacion: 'No se relevó',
    construccion: 'No se relevó',
    extincion: 'No se relevó',
    textoConclusiones: (c.conclusiones as string | null) ?? undefined,
    textoRecomendaciones: (c.recomendaciones as string | null) ?? undefined,
  }

  // Clasificación de riesgo del establecimiento: el mayor (más crítico) entre los sectores
  // con riesgo definido. R1 es el más crítico (explosivos) y R7 el menos. Tomamos el menor
  // número Rx presente (criterio conservador).
  let clasificacionRiesgo: string | undefined
  const riesgosNum = built
    .map((b) => {
      const m = b.raw.riesgoLabel.match(/R(\d)/)
      return m ? Number(m[1]) : null
    })
    .filter((n): n is number => n != null)
  if (riesgosNum.length > 0) {
    const peor = Math.min(...riesgosNum)
    clasificacionRiesgo = riesgoLabel(`R${peor}`)
  }

  // Superficie cubierta total = suma de las superficies de los sectores con dato.
  const supNums = built.map((b) => b.raw.superficie).filter((s): s is number => s != null)
  const superficieCubierta = supNums.length > 0
    ? fmtSuperficie(supNums.reduce((a, s) => a + s, 0))
    : undefined

  // Actividad del establecimiento: el modal no la captura como campo dedicado; usamos las
  // observaciones de cabecera si las hay (texto libre), si no queda en '—' en el informe.
  const actividad = (c.observaciones as string | null)?.trim() || undefined

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

    // Profesional firmante (texto libre). La matrícula se resuelve del usuario que
    // ejecuta la gestión (helper compartido; la cabecera de CF no la trae).
    profesional: (c.firmante as string) ?? undefined,
    matricula: matriculaStr,
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
    actividad,
    superficieCubierta,
    clasificacionRiesgo,
    extintores,
    condiciones,
    conclusiones,
  }

  // ── 7a. Foto + mapa del establecimiento para la carátula (best-effort) ───────
  const media = await getFotoYMapaEstablecimiento(establecimientoId)
  datos.fotoEstablecimiento = media.fotoEstablecimiento
  datos.mapaEstablecimiento = media.mapaEstablecimiento

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

  // ── 9. Anexos de sistema: plano/croquis + observaciones de seguimiento ───────
  // El plano/croquis cargado en la hoja 1 se anexa al reporte (mismo patrón que
  // iluminación: el croquis NO se pide de nuevo en el paso "revisar", sale de
  // calculo_carga_fuego.plano_url). NO se fusionan acá: se devuelven como lista (con
  // su clave de orden canónico) para que el bridge los una con los adjuntos manuales
  // en armarPdfFinalConAnexos. Best-effort: si algo falla, la lista sale parcial.
  const anexosSistema: AnexoInput[] = []
  const planoAnexo = await getAnexoPlano((c.plano_url as string | null) ?? null)
  if (planoAnexo) anexosSistema.push(planoAnexo)

  // Observaciones de seguimiento cargadas en el último paso del protocolo. Viven en el
  // pool común `gestiones_observaciones`, ligadas al registro ejecutado por
  // (registro_gestion_id + rg_fecha_planificada). Se renderizan como UNA hoja PDF estilo
  // Sigmetría (con sus fotos) y se anexan DESPUÉS del plano. Best-effort: si algo falla,
  // el PDF sale igual con el plano; no rompemos la emisión.
  try {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const registroId = c.registro_gestion_id as string | null
    const rgFecha = c.rg_fecha_planificada as string | null
    if (registroId) {
      const obsBuffer = await generarAnexoObservaciones(supabase, registroId, rgFecha)
      if (obsBuffer) {
        anexosSistema.push({ titulo: 'Observaciones de Seguimiento', buffer: obsBuffer, mime: 'application/pdf', clave: 'observaciones' })
      }
    }
  } catch (err) {
    console.error('[PDF-REPORTE-CF] anexo observaciones falló:', err instanceof Error ? err.message : String(err))
  }

  return { success: true, data: { pdf: pdfBuffer, anexos: anexosSistema } }
}
