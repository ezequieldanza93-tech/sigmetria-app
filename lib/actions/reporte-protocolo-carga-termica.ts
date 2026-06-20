'use server'

/**
 * reporte-protocolo-carga-termica.ts — Server Action: genera el PDF del Protocolo
 * de Estrés Térmico por Calor (Res. SRT 30/2023).
 *
 * Réplica del patrón de reporte-protocolo-ruido.ts / -iluminacion.ts adaptado a la
 * estructura ANIDADA de carga térmica:
 *   1. Lee la medición completa (getMedicionCargaTermica) — join cabecera +
 *      establecimiento + empresa + instrumento + certificado + puestos → períodos → tareas.
 *   2. Lee la firma del profesional (getFirmasEntidad('medicion_carga_termica', id)).
 *   3. Resuelve logos (empresa + consultora) → data URLs base64 para Chromium serverless.
 *   4. Query extra mínima: localidad/provincia del establecimiento + logo de consultora
 *      (el join de getMedicionCargaTermica no sube a consultora ni resuelve la localidad).
 *   5. Mapea todo a DatosProtocoloCargaTermica y llama
 *      renderProtocolo(CARGA_TERMICA_DESCRIPTOR, datos).
 *
 * DECISIONES DE DISEÑO (espejan ruido/iluminación):
 *   - Folio determinístico: `SIG-{AÑO}-{primeros 6 hex del medicionId}`.
 *   - Vencimiento: fecha_medicion + 1 año.
 *   - El firmante es el texto libre `medicion_carga_termica.firmante` (no el usuario logueado).
 *   - Los cálculos (TGBHef, TGBH/VAR ponderados, VLP/VLA, supera SI/NO) YA vienen
 *     calculados y persistidos en períodos/tareas — NO se recalculan acá.
 *
 * LIMITACIÓN CONOCIDA (Planilla B):
 *   El HTML legal embebido trae UNA sola Planilla B con 7 filas de grilla. El modelo
 *   es anidado (N puestos → N períodos → N tareas). Aplanamos los períodos/tareas del
 *   PRIMER puesto en esas 7 filas. La cabecera del puesto (nombre/ambiente/fuente/
 *   trabajador/GHE) también es la del primer puesto. Si hay más puestos, no entran en
 *   esta versión del HTML embebido (mejor parcial que roto).
 */

import { getMedicionCargaTermica } from '@/lib/actions/medicion-carga-termica'
import { getFirmasEntidad } from '@/lib/actions/firmas'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import { renderProtocolo } from '@/lib/pdf/protocolo-engine'
import {
  CARGA_TERMICA_DESCRIPTOR,
  type DatosProtocoloCargaTermica,
  type FilaGrillaCargaTermica,
} from '@/lib/pdf/descriptors/carga-termica'
import type { ActionResult } from '@/lib/types'

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

/** Formatea un número (de string/number) con hasta `decimales` decimales, sin ceros colgando. */
function fmtNum(v: unknown, decimales = 1): string {
  if (v == null) return ''
  const n = Number(v)
  if (!Number.isFinite(n)) return ''
  return Number(n.toFixed(decimales)).toString()
}

/** Booleano → 'Sí' / 'No' / '' (texto libre vacío si null). */
function fmtBool(v: unknown): string {
  if (v === true) return 'Sí'
  if (v === false) return 'No'
  return ''
}

/** Booleano supera → 'SI' / 'NO' / '' (estilo de la columna legal "Supera SI/NO"). */
function fmtSupera(v: unknown): string {
  if (v === true) return 'SI'
  if (v === false) return 'NO'
  return ''
}

/** Texto plano desde unknown (string/number) → string seguro. */
function str(v: unknown): string {
  if (v == null) return ''
  return String(v)
}

// ─── FUNCIÓN PRINCIPAL ──────────────────────────────────────────────────────────

/**
 * Genera el PDF del Protocolo de Estrés Térmico por Calor (Res. SRT 30/2023) para una
 * medición real guardada en `medicion_carga_termica`.
 *
 * @param id - UUID de la medición en tabla `medicion_carga_termica`
 * @returns { success: true, data: Buffer } con el PDF, o { success: false, error }
 */
export async function generarReporteProtocoloCargaTermica(
  id: string,
): Promise<ActionResult<Buffer>> {
  if (!id) return { success: false, error: 'medicionId requerido' }

  // ── 1. Leer medición completa ───────────────────────────────────────────────
  const medicionResult = await getMedicionCargaTermica(id)
  if (!medicionResult.success) {
    console.error('[PDF-REPORTE-CT] getMedicionCargaTermica falló', { id, error: medicionResult.error })
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
  const puestosRaw = (m.medicion_carga_termica_puestos as Record<string, unknown>[] | null) ?? []

  // ── 3. Firma del profesional ─────────────────────────────────────────────────
  let firmaDataUrl: string | undefined
  const firmas = await getFirmasEntidad('medicion_carga_termica', id)
  const firmaRow = firmas.find((f) => f.rol === 'Profesional') ?? firmas[0] ?? null
  if (firmaRow?.firma_svg_data) {
    firmaDataUrl = firmaRow.firma_svg_data
  }

  // ── 4. Instrumento (tipo, marca, modelo, serie) ──────────────────────────────
  let instrumentoStr: string | undefined
  if (instrRaw) {
    const tipoRaw = single<Record<string, unknown>>(instrRaw.mediciones_instrumentos_tipos as EmbedOne<Record<string, unknown>>)
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

  // ── 7. Primer puesto (cabecera de Planilla B) + aplanado de grilla ───────────
  // Ordenamos los puestos por `orden` (fallback al orden del array).
  const puestosOrdenados = [...puestosRaw].sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0))
  const primerPuesto = puestosOrdenados[0] as Record<string, unknown> | undefined

  // Cabecera del primer puesto
  const nombrePuesto = primerPuesto ? str(primerPuesto.nombre_puesto) : ''
  const ambienteHomogeneo = primerPuesto ? fmtBool(primerPuesto.ambiente_homogeneo) : ''
  const alturaMedicion = primerPuesto ? fmtNum(primerPuesto.altura_medicion, 2) : ''
  const tipoFuente = primerPuesto ? str(primerPuesto.tipo_fuente) : ''
  const trabajadorPuesto = primerPuesto ? str(primerPuesto.trabajador) : ''
  const ghe = primerPuesto ? fmtBool(primerPuesto.ghe) : ''

  // Aplanado: períodos del primer puesto → cada período expande sus tareas en filas.
  // Columnas legales de la grilla (15):
  //   (22)Período (23)Hora inicio (24)N°tarea (25)Tarea (26)Tiempo (27)TM tarea
  //   (28)TM ponderada (29)TGBH (30)TGBH ponderado (31)VAR (32)VAR ponderado
  //   (33)TGBHef ponderado (34a)VLP no-aclim (34b)VLA no-aclim (34c)VLP aclim
  // Cols de TAREA (24-27,29,31) van por tarea; cols de PERÍODO (22,23,28,30,32,33,34*)
  // se repiten en cada fila del período (mejor legibilidad de la planilla aplanada).
  const grilla: FilaGrillaCargaTermica[] = []
  let infoAdicional = ''

  if (primerPuesto) {
    const periodosRaw = (primerPuesto.medicion_carga_termica_periodos as Record<string, unknown>[] | null) ?? []
    const periodosOrd = [...periodosRaw].sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0))

    // info_adicional: tomamos la del primer período que la tenga (campo legal (35)).
    const infoPer = periodosOrd.find((p) => str(p.info_adicional).trim() !== '')
    if (infoPer) infoAdicional = str(infoPer.info_adicional)

    for (const per of periodosOrd) {
      const periodoNum = str(per.numero ?? '')
      const horaInicio = formatHora(per.hora_inicio as string | null)
      const tmPonderada = fmtNum(per.tm_ponderado, 1)
      const tgbhPonderado = fmtNum(per.tgbh_ponderado, 1)
      const varPonderado = fmtNum(per.var_ponderado, 1)
      const tgbhef = fmtNum(per.tgbhef, 1)
      // Supera SI/NO. El HTML separa VLP no-aclim, VLA no-aclim y VLP aclim.
      // Persistimos supera_vlp / supera_vla; mapeamos:
      //   VLP no-aclimatado  → supera_vlp
      //   VLA no-aclimatado  → supera_vla
      //   VLP aclimatado     → supera_vlp (mismo flag; el detalle aclimatado/no se
      //                        documenta en Planilla C). Mejor parcial que en blanco.
      const vlpNoAclim = fmtSupera(per.supera_vlp)
      const vlaNoAclim = fmtSupera(per.supera_vla)
      const vlpAclim = fmtSupera(per.supera_vlp)

      const tareasRaw = (per.medicion_carga_termica_tareas as Record<string, unknown>[] | null) ?? []
      const tareasOrd = [...tareasRaw].sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0))

      if (tareasOrd.length === 0) {
        // Período sin tareas: una fila con los datos de período.
        grilla.push({
          periodo: periodoNum,
          horaInicio,
          nTarea: '',
          tareaRealizada: '',
          tiempoTarea: '',
          tmTarea: '',
          tmPonderada,
          tgbh: '',
          tgbhPonderado,
          var: '',
          varPonderado,
          tgbhef,
          vlpNoAclimatado: vlpNoAclim,
          vlaNoAclimatado: vlaNoAclim,
          vlpAclimatado: vlpAclim,
        })
      } else {
        tareasOrd.forEach((t, ti) => {
          // Cols de período se muestran SOLO en la 1ra tarea del período (evita repetición ruidosa).
          const esPrimera = ti === 0
          grilla.push({
            periodo: esPrimera ? periodoNum : '',
            horaInicio: esPrimera ? horaInicio : '',
            nTarea: str(t.numero ?? ''),
            tareaRealizada: str(t.descripcion ?? ''),
            tiempoTarea: fmtNum(t.tiempo_min, 0),
            tmTarea: fmtNum(t.tm_w, 0),
            tmPonderada: esPrimera ? tmPonderada : '',
            tgbh: fmtNum(t.tgbh, 1),
            tgbhPonderado: esPrimera ? tgbhPonderado : '',
            var: fmtNum(t.var, 1),
            varPonderado: esPrimera ? varPonderado : '',
            tgbhef: esPrimera ? tgbhef : '',
            vlpNoAclimatado: esPrimera ? vlpNoAclim : '',
            vlaNoAclimatado: esPrimera ? vlaNoAclim : '',
            vlpAclimatado: esPrimera ? vlpAclim : '',
          })
        })
      }
    }
  }

  // El HTML embebido trae 7 filas de grilla → si hay más, las truncamos (limitación conocida).
  const grillaRecortada = grilla.slice(0, 7)

  // ── 8. Condiciones atmosféricas / turnos / representantes (cabecera) ─────────
  const atmTempMax = fmtNum(m.atm_temp_max, 1)
  const atmTempMin = fmtNum(m.atm_temp_min, 1)
  const atmHumedad = fmtNum(m.atm_humedad, 0)
  const atmPresion = fmtNum(m.atm_presion, 0)
  const atmViento = str(m.atm_viento)

  // ── 9. Armar DatosProtocoloCargaTermica ──────────────────────────────────────
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

  const datos: DatosProtocoloCargaTermica = {
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

    // Planilla A — condiciones atmosféricas + descripción de condiciones de trabajo
    atmTempMax: atmTempMax || undefined,
    atmTempMin: atmTempMin || undefined,
    atmHumedad: atmHumedad || undefined,
    atmPresion: atmPresion || undefined,
    atmViento: atmViento || undefined,
    condicionesPuesto: (m.condiciones_puesto as string) ?? undefined,

    // Representantes
    representanteTrabajadores: (m.representante_trabajadores as string) ?? undefined,
    representanteEmpresa: (m.representante_empresa as string) ?? undefined,

    // Planilla B — cabecera del primer puesto + grilla
    nombrePuesto: nombrePuesto || undefined,
    ambienteHomogeneo: ambienteHomogeneo || undefined,
    alturaMedicion: alturaMedicion || undefined,
    tipoFuente: tipoFuente || undefined,
    trabajadorPuesto: trabajadorPuesto || undefined,
    ghe: ghe || undefined,
    infoAdicional: infoAdicional || undefined,
    grilla: grillaRecortada.length > 0 ? grillaRecortada : undefined,

    // Planilla C — conclusiones / recomendaciones
    conclusionesAclimatado: (m.conclusiones_aclimatado as string) ?? undefined,
    conclusionesNoAclimatado: (m.conclusiones_no_aclimatado as string) ?? undefined,
    recomendaciones: (m.recomendaciones as string) ?? undefined,

    // Profesional firmante (texto libre; matrícula no la trae la cabecera de CT)
    profesional: (m.firmante as string) ?? undefined,
    matricula: undefined,
    firma: firmaDataUrl,

    // Carátula
    numeroProtocolo: folio,
    fechaEmision: hoy,
    fechaVencimiento: sumarUnAnio(fechaMedicion),
    encomienda: '',

    // Logos
    logoConsultora: logoConsultoraDataUrl,
    logoEmpresa: logoEmpresaDataUrl,
  }

  // ── 10. Generar PDF ──────────────────────────────────────────────────────────
  console.warn('[PDF-REPORTE-CT] datos mapeados, llamando renderProtocolo', {
    folio,
    establecimiento: datos.establecimiento,
    puestos: puestosOrdenados.length,
    filasGrilla: grillaRecortada.length,
  })
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderProtocolo(CARGA_TERMICA_DESCRIPTOR, datos)
  } catch (err) {
    const detalle = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[PDF-REPORTE-CT] renderProtocolo lanzó:', detalle)
    return {
      success: false,
      error: `Error al renderizar el PDF: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  return { success: true, data: pdfBuffer }
}
