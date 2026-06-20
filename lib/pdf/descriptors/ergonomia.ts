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
 *   - Planilla 2 (9 matrices SI/NO paso1/paso2) y Planilla 3 (M.C.P. texto libre):
 *     NO se inyectan celda por celda (estructura demasiado densa: 9 secciones × 2 matrices).
 *     Quedan como formulario en blanco; el resumen de la evaluación inicial por factor se
 *     muestra resumido en la grilla de Planilla 1 (nivel resultante).
 *
 * NOTA sobre logos/watermark: el HTML legal usa `<section class="hoja">` (sin vert/horiz),
 * que el motor NO matchea para inyectar la banda de logos. Por eso, en `inyectarBody`
 * renombramos esas secciones a `<section class="hoja vert">` para que el motor agregue
 * watermark + logos en cada hoja del protocolo (la clase `hoja` original se conserva).
 */

import { PROTOCOLO_ERGONOMIA_HTML } from '@/lib/pdf/protocolos-html'
import { D, type ProtocoloDescriptor, type DatosProtocoloBase } from '@/lib/pdf/protocolo-engine'
import type { FactorErgonomia, NivelRiesgoErgonomia } from '@/lib/types'

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
  // Matriz de seguimiento (Planilla 4)
  seguimiento?: SeguimientoRow[]
}

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
