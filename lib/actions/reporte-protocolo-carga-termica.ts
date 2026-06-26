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
 * PLANILLA B — TODOS LOS PUESTOS:
 *   El modelo es anidado (N puestos → N períodos → N tareas). Construimos un arreglo
 *   `puestos`, uno por puesto, cada uno con su cabecera (nombre/ambiente/fuente/
 *   trabajador/GHE/info adicional) y su grilla aplanada (períodos → tareas). El descriptor
 *   CLONA la sección de la Planilla B una vez por puesto y expande las filas de la grilla
 *   si un puesto supera las 7 filas del template legal. Ya NO se trunca a 7 filas ni se
 *   descarta del 2do puesto en adelante.
 */

import { getMedicionCargaTermica } from '@/lib/actions/medicion-carga-termica'
import { getFirmasEntidad } from '@/lib/actions/firmas'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import { renderProtocolo } from '@/lib/pdf/protocolo-engine'
import { getBrandColorConsultora } from '@/lib/pdf/brand-color-server'
import {
  CARGA_TERMICA_DESCRIPTOR,
  type DatosProtocoloCargaTermica,
  type FilaGrillaCargaTermica,
  type PuestoCargaTermica,
} from '@/lib/pdf/descriptors/carga-termica'
import { getFotoYMapaEstablecimiento } from '@/lib/pdf/establecimiento-media'
import { getAnexoCertificadoCalibracion, getAnexoPlano } from '@/lib/pdf/anexo-certificado'
import { generarAnexoObservaciones } from '@/lib/pdf/anexo-observaciones'
import { resolverMatriculaProfesional } from '@/lib/pdf/resolver-matricula'
import type { AnexoInput } from '@/lib/pdf/merge-anexos'
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

/**
 * Aplana la grilla de UN puesto: períodos → tareas → filas de la Planilla B.
 * Columnas legales de la grilla (15):
 *   (22)Período (23)Hora inicio (24)N°tarea (25)Tarea (26)Tiempo (27)TM tarea
 *   (28)TM ponderada (29)TGBH (30)TGBH ponderado (31)VAR (32)VAR ponderado
 *   (33)TGBHef ponderado (34a)VLP no-aclim (34b)VLA no-aclim (34c)VLP aclim
 * Cols de TAREA (24-27,29,31) van por tarea; cols de PERÍODO (22,23,28,30,32,33,34*)
 * se muestran SOLO en la 1ra tarea del período (evita repetición ruidosa).
 * Devuelve la grilla aplanada + la info_adicional del primer período que la tenga.
 */
function aplanarGrillaPuesto(puesto: Record<string, unknown>): {
  grilla: FilaGrillaCargaTermica[]
  infoAdicional: string
} {
  const grilla: FilaGrillaCargaTermica[] = []
  let infoAdicional = ''

  const periodosRaw = (puesto.medicion_carga_termica_periodos as Record<string, unknown>[] | null) ?? []
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
    // Persistimos supera_vlp / supera_vla / supera_vlp_aclimatado; mapeamos:
    //   VLP no-aclimatado  → supera_vlp
    //   VLA no-aclimatado  → supera_vla
    //   VLP aclimatado     → supera_vlp_aclimatado (flag propio: umbral del personal
    //                        aclimatado, NO el de supera_vlp que es del no-aclimatado).
    //                        Fallback a supera_vlp para períodos viejos (columna NULL).
    const vlpNoAclim = fmtSupera(per.supera_vlp)
    const vlaNoAclim = fmtSupera(per.supera_vla)
    const vlpAclim = fmtSupera(per.supera_vlp_aclimatado ?? per.supera_vlp)

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

  return { grilla, infoAdicional }
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
): Promise<ActionResult<{ pdf: Buffer; anexos: AnexoInput[] }>> {
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

  // ── 7. TODOS los puestos (cabecera de Planilla B + aplanado de grilla por puesto) ──
  // Ordenamos los puestos por `orden` (fallback al orden del array).
  const puestosOrdenados = [...puestosRaw].sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0))

  // Un PuestoCargaTermica por cada puesto: su cabecera + su grilla aplanada (períodos→tareas).
  // El descriptor clona la sección de la Planilla B una por puesto y expande las filas si supera 7.
  const puestos: PuestoCargaTermica[] = puestosOrdenados.map((puesto) => {
    const { grilla, infoAdicional } = aplanarGrillaPuesto(puesto)
    return {
      nombrePuesto: str(puesto.nombre_puesto) || undefined,
      ambienteHomogeneo: fmtBool(puesto.ambiente_homogeneo) || undefined,
      alturaMedicion: fmtNum(puesto.altura_medicion, 2) || undefined,
      tipoFuente: str(puesto.tipo_fuente) || undefined,
      trabajadorPuesto: str(puesto.trabajador) || undefined,
      ghe: fmtBool(puesto.ghe) || undefined,
      infoAdicional: infoAdicional || undefined,
      grilla,
    }
  })

  // ── 8. Condiciones atmosféricas / turnos / representantes (cabecera) ─────────
  const atmTempMax = fmtNum(m.atm_temp_max, 1)
  const atmTempMin = fmtNum(m.atm_temp_min, 1)
  const atmHumedad = fmtNum(m.atm_humedad, 0)
  const atmPresion = fmtNum(m.atm_presion, 0)
  const atmViento = str(m.atm_viento)

  // ── 8b. Matrícula del profesional que EJECUTA la gestión (carátula/firma) ────
  // La cabecera de carga térmica NO trae matrícula. La resolvemos best-effort desde el
  // usuario autenticado vía el helper compartido (auth → perfiles_profesionales →
  // matriculas_profesionales activa → "emisor numero"). CT no tiene un dato explícito
  // previo (no hay bloque 4a como iluminación), así que lo usamos directo; si no se
  // puede resolver, queda undefined (el motor del PDF ya tiene fallback).
  const matriculaResuelta = await resolverMatriculaProfesional()

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

    // Planilla B — TODOS los puestos (cada uno con su cabecera + grilla).
    puestos: puestos.length > 0 ? puestos : undefined,

    // Planilla C — conclusiones / recomendaciones
    conclusionesAclimatado: (m.conclusiones_aclimatado as string) ?? undefined,
    conclusionesNoAclimatado: (m.conclusiones_no_aclimatado as string) ?? undefined,
    recomendaciones: (m.recomendaciones as string) ?? undefined,

    // Profesional firmante (texto libre; la matrícula se resuelve del usuario que ejecuta)
    profesional: (m.firmante as string) ?? undefined,
    matricula: matriculaResuelta ?? undefined,
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

  // ── 9b. QR de verificación: snapshot público + QR real en la carátula (best-effort) ──
  try {
    const { registrarVerificacion } = await import('@/lib/actions/registrar-verificacion')
    datos.qrVerificacion = await registrarVerificacion({
      folio,
      tipo: 'medicion_carga_termica',
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
    console.error('[PDF-REPORTE-CT] no se pudo registrar la verificación:', err instanceof Error ? err.message : String(err))
  }

  // ── 9c. Foto + mapa del establecimiento (carátula compartida) ────────────────
  const media = await getFotoYMapaEstablecimiento(establecimientoId)
  datos.fotoEstablecimiento = media.fotoEstablecimiento
  datos.mapaEstablecimiento = media.mapaEstablecimiento

  // ── 10. Generar PDF ──────────────────────────────────────────────────────────
  console.warn('[PDF-REPORTE-CT] datos mapeados, llamando renderProtocolo', {
    folio,
    establecimiento: datos.establecimiento,
    puestos: puestos.length,
    filasGrillaTotal: puestos.reduce((acc, p) => acc + p.grilla.length, 0),
  })
  const brandMarca = await getBrandColorConsultora(consultoraId)
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderProtocolo(CARGA_TERMICA_DESCRIPTOR, datos, brandMarca)
  } catch (err) {
    const detalle = err instanceof Error ? (err.stack ?? err.message) : String(err)
    console.error('[PDF-REPORTE-CT] renderProtocolo lanzó:', detalle)
    return {
      success: false,
      error: `Error al renderizar el PDF: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  // Anexo de sistema: certificado de calibración del medidor de estrés térmico (best-effort).
  const anexosSistema: AnexoInput[] = []
  const certAnexo = await getAnexoCertificadoCalibracion(
    (m.certificado_id as string | null) ?? null,
    (instrRaw?.id as string | undefined) ?? null,
  )
  if (certAnexo) anexosSistema.push(certAnexo)

  // Anexo de sistema: plano / croquis de mediciones (cargado en la hoja 1, persistido
  // en medicion_carga_termica.plano_url; bucket privado 'documentos'). Best-effort.
  const planoAnexo = await getAnexoPlano((m.plano_url as string | null) ?? null)
  if (planoAnexo) anexosSistema.push(planoAnexo)

  // Anexo de sistema: observaciones de seguimiento cargadas en el último paso del
  // protocolo. Viven en el pool común `gestiones_observaciones`, ligadas al registro
  // ejecutado por (registro_gestion_id + rg_fecha_planificada). Se renderizan como UNA
  // hoja HTML estilo Sigmetría (con sus fotos del bucket privado `documentos`) y se
  // anexan DESPUÉS de certificado + plano. Best-effort: si algo falla, el PDF sale igual
  // con cert+plano; no rompemos la emisión.
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
    console.error('[PDF-REPORTE-CT] anexo observaciones falló:', err instanceof Error ? err.message : String(err))
  }

  return { success: true, data: { pdf: pdfBuffer, anexos: anexosSistema } }
}
