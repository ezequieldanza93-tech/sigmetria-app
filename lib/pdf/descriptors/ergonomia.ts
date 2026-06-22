/**
 * descriptors/ergonomia.ts — Descriptor del Protocolo de Evaluación Ergonómica (TME).
 *
 * Res. SRT 886/2015 (Anexo I) + Disp. SRT 1/2016. Cumple ProtocoloDescriptor<T> del
 * motor genérico (lib/pdf/protocolo-engine.ts). Aporta el HTML legal embebido, los textos
 * de carátula y la función de inyección de datos específica de las 4 planillas.
 *
 * ALCANCE de la inyección (decisión deliberada — ver `notas` del reporte):
 *   - Carátula + cabecera (Planilla 1, 3 y 4): COMPLETA (razón social, CUIT, dirección,
 *     provincia, área/sector, puesto, N° trabajadores, nombre trabajador/es, ubicación
 *     síntoma, SI/NO de capacitación / procedimiento escrito / manifestación temprana).
 *   - Planilla 1 (grilla de factores A–I): COMPLETA — marca tarea 1/2/3 donde el factor
 *     está presente, tiempo de exposición y nivel de riesgo por tarea.
 *   - Planilla 4 (matriz de seguimiento M.C.P.): COMPLETA — filas numeradas 1..N.
 *   - Planilla 2 (20 matrices SI/NO paso1/paso2 de los 9 factores A–I): COMPLETA — se marca
 *     SÍ/NO celda por celda. CRÍTICO: las 20 tablas `.sino` comparten estructura de fila y los
 *     números de fila se REPITEN entre factores, así que NO se puede matchear por `<td class=
 *     "num">N</td>` (colisiona). Se itera BLOQUE POR BLOQUE: el HTML se segmenta por
 *     `<table class="sino">…</table>` en orden de documento; el N-ésimo bloque corresponde a un
 *     (factor, paso, subtipo) FIJO (ver tabla SINO_TABLA_MAP). Dentro de cada bloque se marca
 *     la celda `.sn` (SÍ o NO) según la respuesta. Si el HTML cambia y el orden no coincide,
 *     best-effort: deja el bloque en blanco + console.warn (no rompe).
 *   - Planilla 3 (M.C.P. — tabla `.sino mcp`): COMPLETA — 3 medidas generales (mg1/mg2/mg3 con
 *     SÍ/NO + fecha + observaciones) + filas de medidas específicas (administrativas / de
 *     ingeniería). Se agregan los `ergonomia_medidas` de todas las tareas con semántica OR para
 *     los SÍ/NO generales y concatenando las medidas específicas.
 *
 * NOTA sobre logos/watermark: el HTML legal usa `<section class="hoja">` (sin vert/horiz),
 * que el motor NO matchea para inyectar la banda de logos. Por eso, en `inyectarBody`
 * renombramos esas secciones a `<section class="hoja vert">` para que el motor agregue
 * watermark + logos en cada hoja del protocolo (la clase `hoja` original se conserva).
 */

import { PROTOCOLO_ERGONOMIA_HTML } from '@/lib/pdf/protocolos-html'
import { D, type ProtocoloDescriptor, type DatosProtocoloBase } from '@/lib/pdf/protocolo-engine'
import type {
  FactorErgonomia,
  NivelRiesgoErgonomia,
  RespuestaPaso,
  MedidaEspecifica,
  VibSubtipo,
} from '@/lib/types'

// ─── Labels (reutilizados del viewer) ───────────────────────────────────────

const FACTOR_LABEL: Record<FactorErgonomia, string> = {
  A: 'Levantamiento y descenso',
  B: 'Empuje / arrastre',
  C: 'Transporte',
  D: 'Bipedestación',
  E: 'Movimientos repetitivos',
  F: 'Postura forzada',
  G: 'Vibraciones',
  H: 'Confort térmico',
  I: 'Estrés de contacto',
}

const NIVEL_LABEL: Record<NivelRiesgoErgonomia, string> = {
  tolerable: 'Tolerable',
  no_tolerable: 'No tolerable',
  requiere_evaluacion: 'Requiere evaluación',
}

// ─── Tipos de datos de las grillas (mapeados en el reporte) ──────────────────

/** Una fila de la grilla de factores de la Planilla 1. */
export interface FactorTareaRow {
  factor: FactorErgonomia
  /** En qué tareas (1..3) está presente el factor. */
  tareas: number[]
  tiempoExposicion?: string | null
  nivelRiesgo?: NivelRiesgoErgonomia | null
}

/**
 * Respuestas de un factor para la Planilla 2 (evaluación inicial SÍ/NO).
 * Para el factor G hay dos subtipos (mano_brazo / cuerpo_entero); el `subtipo`
 * decide cuál de las dos secciones del HTML se rellena.
 */
export interface EvalFactorPlanilla2 {
  factor: FactorErgonomia
  subtipo?: VibSubtipo | null
  /** Respuestas del Paso 1 (n = número de fila en la tabla `.sino` del paso 1). */
  paso1: RespuestaPaso[]
  /** Respuestas del Paso 2 (n = número de fila en la tabla `.sino` del paso 2). */
  paso2: RespuestaPaso[]
}

/** Datos agregados de la Planilla 3 (M.C.P.). */
export interface MedidasPlanilla3 {
  // Medidas generales (mg1/mg2/mg3) — SÍ/NO + fecha + observaciones.
  mg1?: boolean | null
  mg1Fecha?: string | null
  mg1Obs?: string | null
  mg2?: boolean | null
  mg2Fecha?: string | null
  mg2Obs?: string | null
  mg3?: boolean | null
  mg3Fecha?: string | null
  mg3Obs?: string | null
  /** Fecha de comprobación de las medidas generales (cabecera de la columna). */
  fechaGeneral?: string | null
  /** Medidas específicas (administrativas / de ingeniería) en orden de carga. */
  especificas: MedidaEspecifica[]
  /** Observaciones libres al pie de la planilla. */
  observaciones?: string | null
}

/** Una fila de la matriz de seguimiento (Planilla 4). */
export interface SeguimientoRow {
  numeroMcp?: number | null
  nombrePuesto?: string | null
  fechaEvaluacion?: string | null
  nivelRiesgo?: string | null
  fechaImplAdmin?: string | null
  fechaImplIngenieria?: string | null
  fechaCierre?: string | null
}

/** Datos del Protocolo de Ergonomía: base compartida + específicos. */
export interface DatosProtocoloErgonomia extends DatosProtocoloBase {
  // Cabecera específica de ergonomía
  ciiu?: string
  areaSector?: string
  puestoTrabajo?: string
  nTrabajadores?: string
  nombreTrabajadores?: string
  ubicacionSintoma?: string
  tareaAnalizada?: string
  // SI/NO de la Planilla 1
  procedimientoEscrito?: boolean | null
  capacitacion?: boolean | null
  manifestacionTemprana?: boolean | null
  // Grilla de factores (Planilla 1)
  factores?: FactorTareaRow[]
  // Evaluación inicial SÍ/NO por factor (Planilla 2)
  evalFactores?: EvalFactorPlanilla2[]
  // Medidas correctivas y preventivas (Planilla 3)
  medidas?: MedidasPlanilla3
  // Matriz de seguimiento (Planilla 4)
  seguimiento?: SeguimientoRow[]
}

/**
 * Orden de las 20 tablas `<table class="sino">` en el HTML legal (Planilla 2),
 * mapeado a (factor, paso, subtipo). Verificado byte-a-byte contra el HTML embebido:
 * cada bloque tiene exactamente la cantidad de filas que define PASO1/PASO2 del modal.
 * El índice del array es el orden de aparición de la tabla en el documento.
 */
const SINO_TABLA_MAP: ReadonlyArray<{
  factor: FactorErgonomia
  paso: 1 | 2
  subtipo?: VibSubtipo
}> = [
  { factor: 'A', paso: 1 }, // 0
  { factor: 'A', paso: 2 }, // 1
  { factor: 'B', paso: 1 }, // 2
  { factor: 'B', paso: 2 }, // 3
  { factor: 'C', paso: 1 }, // 4
  { factor: 'C', paso: 2 }, // 5
  { factor: 'D', paso: 1 }, // 6
  { factor: 'D', paso: 2 }, // 7
  { factor: 'E', paso: 1 }, // 8
  { factor: 'E', paso: 2 }, // 9
  { factor: 'F', paso: 1 }, // 10
  { factor: 'F', paso: 2 }, // 11
  { factor: 'G', paso: 1, subtipo: 'mano_brazo' }, // 12
  { factor: 'G', paso: 2, subtipo: 'mano_brazo' }, // 13
  { factor: 'G', paso: 1, subtipo: 'cuerpo_entero' }, // 14
  { factor: 'G', paso: 2, subtipo: 'cuerpo_entero' }, // 15
  { factor: 'H', paso: 1 }, // 16
  { factor: 'H', paso: 2 }, // 17
  { factor: 'I', paso: 1 }, // 18
  { factor: 'I', paso: 2 }, // 19
]

// ─── Helpers de inyección ────────────────────────────────────────────────────

/** SI/NO/— legible a partir de un boolean nullable. */
function sino(v: boolean | null | undefined): string {
  if (v === true) return 'SÍ'
  if (v === false) return 'NO'
  return '—'
}

/**
 * Inyecta un valor en una celda de cabecera cuyo label vive dentro de <i>…:</i></td>.
 * El motor de iluminación corta en `Label:</td>`; acá el label está en cursiva,
 * así que cortamos en `Label:</i></td>` y dejamos el dato fuera del <i> (no cursiva).
 * `.split().join()` rellena TODAS las ocurrencias (mismo dato en P1/P3/P4).
 */
function campo(body: string, labelConDosPuntos: string, valor: string | undefined | null): string {
  const find = `${labelConDosPuntos}</i></td>`
  const replace = `${labelConDosPuntos}</i> ${D(valor ?? undefined)}</td>`
  return body.split(find).join(replace)
}

/**
 * Inyecta la elección SI/NO de un label inline (ej. "Capacitación: SI / NO</i>").
 * Agrega el resultado resuelto a continuación del texto legal del label.
 */
function campoSiNo(body: string, labelInline: string, valor: boolean | null | undefined): string {
  const find = `${labelInline}</i>`
  const replace = `${labelInline} → ${D(sino(valor))}</i>`
  return body.split(find).join(replace)
}

/** Marca centrada para la celda SÍ/NO elegida de las matrices `.sino`. */
const MARCA_SN = `<td class="sn" style="text-align:center;font-weight:bold">${D('X')}</td>`
const VACIA_SN = '<td class="sn"></td>'

/**
 * Rellena las celdas SÍ/NO de UN bloque `<table class="sino">…</table>` a partir de las
 * respuestas de un paso. Trabaja sobre el string del bloque aislado: por cada fila
 * `<td class="num">N</td>…<td class="sn"></td><td class="sn"></td>` busca la respuesta con
 * `n === N` y marca la 1ra celda `.sn` (SÍ) o la 2da (NO). Las filas sin respuesta cargada
 * quedan en blanco. Devuelve el bloque modificado (no toca el resto del documento).
 */
function rellenarBloqueSino(bloque: string, respuestas: RespuestaPaso[]): string {
  // Cada fila de datos: <tr>…<td class="num">N</td>…<td class="sn"></td><td class="sn"></td></tr>
  return bloque.replace(
    /<tr>(?:(?!<\/tr>).)*?<td class="num">(\d+)<\/td>(?:(?!<\/tr>).)*?<td class="sn"><\/td><td class="sn"><\/td><\/tr>/g,
    (fila, numStr) => {
      const n = Number(numStr)
      const r = respuestas.find((x) => x.n === n)
      if (!r) return fila // sin respuesta → fila en blanco
      // Reemplaza el PAR de celdas .sn vacías de ESTA fila (la última ocurrencia del par).
      const par = `${VACIA_SN}${VACIA_SN}`
      const conMarca = r.respuesta ? `${MARCA_SN}${VACIA_SN}` : `${VACIA_SN}${MARCA_SN}`
      const idx = fila.lastIndexOf(par)
      if (idx < 0) return fila
      return fila.slice(0, idx) + conMarca + fila.slice(idx + par.length)
    },
  )
}

/**
 * Inyecta las respuestas de la Planilla 2 iterando BLOQUE POR BLOQUE sobre las 20 tablas
 * `<table class="sino">`. Se evita por completo el match por número de fila (que colisiona
 * entre factores). El N-ésimo bloque corresponde a SINO_TABLA_MAP[N]. Best-effort: si la
 * cantidad de bloques no coincide con el mapa, se hace console.warn y se deja en blanco.
 */
function inyectarPlanilla2(body: string, evalFactores: EvalFactorPlanilla2[]): string {
  // Índice por (factor|subtipo) → respuestas de cada paso.
  const key = (f: FactorErgonomia, s?: VibSubtipo | null) => `${f}|${s ?? ''}`
  const idx = new Map<string, EvalFactorPlanilla2>()
  for (const ef of evalFactores) idx.set(key(ef.factor, ef.subtipo), ef)

  let tabla = -1
  let mismatched = false
  const out = body.replace(/<table class="sino">[\s\S]*?<\/table>/g, (bloque) => {
    tabla += 1
    const map = SINO_TABLA_MAP[tabla]
    if (!map) {
      mismatched = true
      return bloque // más tablas de las esperadas → dejar como está
    }
    const ef = idx.get(key(map.factor, map.subtipo))
    if (!ef) return bloque // factor no evaluado → en blanco
    const respuestas = map.paso === 1 ? ef.paso1 : ef.paso2
    return rellenarBloqueSino(bloque, respuestas)
  })

  if (tabla + 1 !== SINO_TABLA_MAP.length || mismatched) {
    console.warn(
      `[PDF-ERGO] Planilla 2: se encontraron ${tabla + 1} tablas .sino, se esperaban ${SINO_TABLA_MAP.length}. ` +
        'El orden factor/paso puede no coincidir; algunas matrices quedan en blanco (best-effort).',
    )
  }
  return out
}

/**
 * Inyecta la Planilla 3 (M.C.P.) en la única tabla `<table class="sino mcp">`:
 *   - mg1/mg2/mg3: marca SÍ/NO en sus filas numeradas 1/2/3 + observaciones.
 *   - Fecha general: en la cabecera `Fecha:` de la columna de medidas generales.
 *   - Medidas específicas: rellena las filas en blanco (num/desc/obs), de arriba hacia abajo.
 *   - Observaciones al pie.
 * Best-effort: cada reemplazo verifica que el marcador exista; si no, lo saltea.
 */
function inyectarPlanilla3(body: string, m: MedidasPlanilla3): string {
  let b = body

  // ── 1) Fecha general (cabecera de la columna de medidas generales) ──────────
  if (m.fechaGeneral) {
    const findF = '<span class="r2"><i>Fecha:</i></span>'
    if (b.includes(findF)) {
      b = b.replace(findF, `<span class="r2"><i>Fecha:</i> ${D(m.fechaGeneral)}</span>`)
    }
  }

  // ── 2) Medidas generales mg1/mg2/mg3 (filas 1, 2, 3 con .sn + .obs) ─────────
  const generales: Array<{ n: number; valor: boolean | null | undefined; obs: string | null | undefined }> = [
    { n: 1, valor: m.mg1, obs: m.mg1Obs },
    { n: 2, valor: m.mg2, obs: m.mg2Obs },
    { n: 3, valor: m.mg3, obs: m.mg3Obs },
  ]
  for (const g of generales) {
    // Fila verbatim del HTML: <tr><td class="num">N</td><td class="desc">…</td><td class="sn"></td><td class="sn"></td><td class="obs"></td></tr>
    const re = new RegExp(
      `(<tr><td class="num">${g.n}</td><td class="desc">(?:(?!</td>).)*?</td>)<td class="sn"></td><td class="sn"></td><td class="obs"></td></tr>`,
    )
    const match = b.match(re)
    if (!match) continue
    const sn = g.valor === true ? `${MARCA_SN}${VACIA_SN}` : g.valor === false ? `${VACIA_SN}${MARCA_SN}` : `${VACIA_SN}${VACIA_SN}`
    const obs = g.obs ? `<td class="obs">${D(g.obs)}</td>` : '<td class="obs"></td>'
    b = b.replace(re, `${match[1]}${sn}${obs}</tr>`)
  }

  // ── 3) Medidas específicas: rellenar filas en blanco de arriba hacia abajo ──
  // Fila en blanco verbatim: <tr><td class="num"></td><td class="desc" colspan="3"></td><td class="obs"></td></tr>
  const filaVacia = '<tr><td class="num"></td><td class="desc" colspan="3"></td><td class="obs"></td></tr>'
  let n = 0
  for (const esp of m.especificas) {
    if (!b.includes(filaVacia)) break // no quedan filas → best-effort
    n += 1
    const tipo = esp.tipo === 'ingenieria' ? 'Ingeniería' : 'Administrativa'
    const fecha = esp.fecha ? ` · ${esp.fecha}` : ''
    const descTxt = `${D(esp.descripcion)} <span class="dato">(${tipo}${fecha})</span>`
    const filaLlena =
      `<tr><td class="num">${n}</td><td class="desc" colspan="3">${descTxt}</td>` +
      `<td class="obs">${esp.observaciones ? D(esp.observaciones) : ''}</td></tr>`
    b = b.replace(filaVacia, filaLlena) // .replace = 1ra ocurrencia → de arriba hacia abajo
  }

  // ── 4) Observaciones al pie ─────────────────────────────────────────────────
  if (m.observaciones) {
    const findObs = '<tr><td class="desc" colspan="5"><i>Observaciones:</i></td></tr>'
    if (b.includes(findObs)) {
      b = b.replace(
        findObs,
        `<tr><td class="desc" colspan="5"><i>Observaciones:</i> ${D(m.observaciones)}</td></tr>`,
      )
    }
  }

  return b
}

// ─── Descriptor ────────────────────────────────────────────────────────────

export const ERGONOMIA_DESCRIPTOR: ProtocoloDescriptor<DatosProtocoloErgonomia> = {
  html: PROTOCOLO_ERGONOMIA_HTML,
  titulo: 'Evaluación Ergonómica (TME)',
  norma: 'Res. SRT 886/2015',
  descripcion:
    'Identificación y evaluación inicial de los factores de riesgo ergonómico (Trastornos Musculoesqueléticos) ' +
    'en los puestos de trabajo del establecimiento, conforme a la Res. SRT 886/2015 (Anexo I) y la Disp. SRT 1/2016, ' +
    'incluyendo la matriz de seguimiento de las medidas correctivas y preventivas.',
  equipoTexto: (d) =>
    `Evaluación de carácter observacional según planillas del Anexo I (Res. SRT 886/2015). ` +
    `${d.instrumento ? `Instrumental de apoyo: ${d.instrumento}.` : 'No requiere instrumental de medición específico.'}`,
  // El HTML de ergonomía NO tiene bloque <div class="ac">…</div>; el motor no encontrará
  // este texto y por lo tanto NO hará reemplazo (no rompe). La firma del profesional se
  // inyecta directamente en el bloque <div class="firmas"> dentro de inyectarBody.
  firmaTexto: 'Firma, Aclaración y Registro del Profesional Interviniente',
  ajustesCss: `
  .hoja.vert table.p1cab, .hoja.vert table.cab2, .hoja.vert table.p3cab, .hoja.vert table.p4cab { width: 100%; }
  .hoja.vert .dato { white-space: normal; }
  .firmas .f .dato { display:block; margin-bottom:2px; }
  `,
  inyectarBody: (body, d) => {
    let b = body

    // ── 0) Habilitar watermark+logos del motor: hoja → hoja vert ──────────────
    b = b.split('<section class="hoja">').join('<section class="hoja vert">')

    // ── 1) Cabecera (Planilla 1 / 3 / 4). Mismo dato en todas las ocurrencias. ─
    b = campo(b, 'Razón Social:', d.razonSocial)
    b = campo(b, 'C.U.I.T.:', d.cuit)
    b = campo(b, 'CIIU:', d.ciiu)
    b = campo(b, 'Dirección del establecimiento:', d.direccion)
    b = campo(b, 'Provincia:', d.provincia)
    b = campo(b, 'Área y Sector en estudio:', d.areaSector)
    b = campo(b, 'N° de trabajadores:', d.nTrabajadores)
    // Planilla 1 usa "Puesto de trabajo:", Planilla 3 usa "Puesto de Trabajo:" (T mayúscula).
    b = campo(b, 'Puesto de trabajo:', d.puestoTrabajo)
    b = campo(b, 'Puesto de Trabajo:', d.puestoTrabajo)
    b = campo(b, 'Nombre del trabajador/es:', d.nombreTrabajadores)
    b = campo(b, 'Ubicación del síntoma:', d.ubicacionSintoma)
    b = campo(b, 'Tarea analizada:', d.tareaAnalizada)

    // SI/NO inline de la Planilla 1
    b = campoSiNo(b, 'Procedimiento de trabajo escrito: SI / NO', d.procedimientoEscrito)
    b = campoSiNo(b, 'Capacitación: SI / NO', d.capacitacion)
    b = campoSiNo(b, 'Manifestación temprana: SI / NO', d.manifestacionTemprana)

    // ── 2) Grilla de factores (Planilla 1) ───────────────────────────────────
    // Cada fila vacía es: <td class="pl1-let">X</td><td class="pl1-fac">Label</td>
    //   + 7 <td></td> (tarea1, tarea2, tarea3, tiempo, nivel-t1, nivel-t2, nivel-t3).
    // Se reemplaza solo la fila del factor presente; las demás quedan en blanco.
    for (const f of d.factores ?? []) {
      const label = FACTOR_LABEL[f.factor]
      const findRow = `<tr><td class="pl1-let">${f.factor}</td><td class="pl1-fac">${label}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
      if (!b.includes(findRow)) continue

      const marca = (n: number) => (f.tareas.includes(n) ? D('X') : '')
      const tiempo = D(f.tiempoExposicion ?? undefined)
      // El nivel de riesgo es por tarea: lo mostramos en la columna de la tarea presente.
      const nivelTxt = f.nivelRiesgo ? D(NIVEL_LABEL[f.nivelRiesgo]) : ''
      const nivel = (n: number) => (f.tareas.includes(n) ? nivelTxt : '')

      const filledRow =
        `<tr><td class="pl1-let">${f.factor}</td><td class="pl1-fac">${label}</td>` +
        `<td style="text-align:center">${marca(1)}</td>` +
        `<td style="text-align:center">${marca(2)}</td>` +
        `<td style="text-align:center">${marca(3)}</td>` +
        `<td style="text-align:center">${tiempo}</td>` +
        `<td style="text-align:center">${nivel(1)}</td>` +
        `<td style="text-align:center">${nivel(2)}</td>` +
        `<td style="text-align:center">${nivel(3)}</td></tr>`

      b = b.replace(findRow, filledRow)
    }

    // ── 2b) Planilla 2 — Evaluación inicial SÍ/NO (20 matrices .sino) ─────────
    if (d.evalFactores && d.evalFactores.length > 0) {
      b = inyectarPlanilla2(b, d.evalFactores)
    }

    // ── 2c) Planilla 3 — Medidas Correctivas y Preventivas (.sino mcp) ───────
    if (d.medidas) {
      b = inyectarPlanilla3(b, d.medidas)
    }

    // ── 3) Matriz de seguimiento (Planilla 4) ─────────────────────────────────
    // Filas numeradas: <tr><td class="num">1</td> + 6 <td></td>.
    // .replace() cambia solo la 1ra ocurrencia → llenamos de arriba hacia abajo.
    const seg = d.seguimiento ?? []
    for (let i = 0; i < seg.length && i < 5; i++) {
      const n = i + 1
      const s = seg[i]
      const findRow = `<tr><td class="num">${n}</td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`
      if (!b.includes(findRow)) continue
      const filledRow =
        `<tr><td class="num">${n}</td>` +
        `<td>${D(s.nombrePuesto ?? undefined)}</td>` +
        `<td>${D(s.fechaEvaluacion ?? undefined)}</td>` +
        `<td>${D(s.nivelRiesgo ?? undefined)}</td>` +
        `<td>${D(s.fechaImplAdmin ?? undefined)}</td>` +
        `<td>${D(s.fechaImplIngenieria ?? undefined)}</td>` +
        `<td>${D(s.fechaCierre ?? undefined)}</td></tr>`
      b = b.replace(findRow, filledRow)
    }

    // ── 4) Firma del profesional en el bloque de firmas (slot H&S) ────────────
    // El profesional firmante ergonómico ocupa el rol de "Responsable del Servicio
    // de Higiene y Seguridad". Se inyecta solo en la 1ra hoja (.replace = 1ra ocurrencia).
    if (d.profesional) {
      const findFirma = '<div class="f">Firma del Responsable del Servicio de Higiene y Seguridad</div>'
      const matr = d.matricula ? ` · Mat. ${d.matricula}` : ''
      const replaceFirma = `<div class="f"><b class="dato">${d.profesional}</b>${matr}<br>Firma del Responsable del Servicio de Higiene y Seguridad</div>`
      b = b.replace(findFirma, replaceFirma)
    }

    return b
  },
}
