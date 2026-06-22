/**
 * carga-termica.ts — Descriptor del Protocolo de Estrés Térmico por Calor (Res. SRT 30/2023).
 *
 * Cumple ProtocoloDescriptor<DatosProtocoloCargaTermica> del motor genérico
 * (lib/pdf/protocolo-engine.ts). Aporta:
 *   - el HTML legal embebido (PROTOCOLO_CARGA_TERMICA_HTML de protocolos-html.ts),
 *   - los textos de carátula (título / norma / descripción / equipo),
 *   - el texto EXACTO de la firma,
 *   - y la inyección específica de campos de cabecera + grilla (Planilla A y B).
 *
 * GOTCHA CLAVE (descubierto al estudiar el HTML embebido):
 *   El HTML de carga térmica usa `<section class="hoja land">` / `<section class="hoja port">`
 *   (NO los marcadores `hoja vert` / `hoja horiz` que el motor busca para inyectar watermark,
 *   banda de logos y firma). Por eso inyectarBody, ADEMÁS de los datos, RENOMBRA las secciones
 *   a los marcadores del motor (land→horiz, port→vert) y reescribe el bloque de firma `.firma1`
 *   para que contenga `<div class="ac">…</div>` (lo que el motor busca para estampar el firmante).
 *   Sin esta normalización, el motor no estamparía logos/watermark/firma en estas hojas.
 *
 * PLANILLA B (grilla anidada puesto → período → tarea) — REPETIBLE POR PUESTO:
 *   La grilla legal tiene 7 filas vacías y 15 columnas. El modelo de datos es anidado
 *   (un protocolo tiene N puestos, cada puesto N períodos, cada período N tareas). El HTML
 *   embebido solo trae UNA Planilla B. Para mostrar TODOS los puestos, CLONAMOS la sección
 *   completa de la Planilla B (cabecera del puesto + grilla) una vez por puesto, inyectando
 *   en cada clon su cabecera (nombre/ambiente/fuente/trabajador/GHE/info adicional) y su grilla
 *   propia. Si un puesto tiene más de 7 filas, generamos filas vacías extra clonando
 *   GRID_ROW_VACIA antes de llenarlas; si tiene menos, quedan las vacías que correspondan.
 *
 *   El clonado se hace por MANIPULACIÓN DE STRING sobre marcadores VERBATIM verificados leyendo
 *   el HTML embebido real (PLANILLA_B_SECTION). Es best-effort: si el ancla no matchea (HTML
 *   regenerado con otra forma), se deja la Planilla B original intacta (no se rompe el PDF).
 *
 *   Compatibilidad: si `datos.puestos` no viene, se sintetiza un único puesto desde los campos
 *   planos legacy (nombrePuesto/.../grilla) para no romper llamadores viejos.
 */

import {
  D,
  type DatosProtocoloBase,
  type ProtocoloDescriptor,
} from '@/lib/pdf/protocolo-engine'
import { PROTOCOLO_CARGA_TERMICA_HTML } from '@/lib/pdf/protocolos-html'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS DE DATOS ESPECÍFICOS
// ─────────────────────────────────────────────────────────────────────────────

/** Fila aplanada de la Planilla B (una por tarea; valores de período se repiten). */
export interface FilaGrillaCargaTermica {
  periodo: string
  horaInicio: string
  nTarea: string
  tareaRealizada: string
  tiempoTarea: string
  tmTarea: string
  tmPonderada: string
  tgbh: string
  tgbhPonderado: string
  var: string
  varPonderado: string
  tgbhef: string
  vlpNoAclimatado: string
  vlaNoAclimatado: string
  vlpAclimatado: string
}

/**
 * Un puesto de la Planilla B: cabecera del puesto + su grilla de tareas (aplanada).
 * El protocolo tiene N de estos; cada uno genera UNA sección "Planilla B" en el PDF.
 */
export interface PuestoCargaTermica {
  // Cabecera del puesto
  nombrePuesto?: string
  ambienteHomogeneo?: string
  alturaMedicion?: string
  tipoFuente?: string
  trabajadorPuesto?: string
  ghe?: string
  infoAdicional?: string
  // Grilla de tareas (aplanada) propia de este puesto
  grilla: FilaGrillaCargaTermica[]
}

export interface DatosProtocoloCargaTermica extends DatosProtocoloBase {
  // Planilla A — datos generales
  turnos?: string
  // Condiciones atmosféricas (Planilla A, fila de datos)
  atmTempMax?: string
  atmTempMin?: string
  atmHumedad?: string
  atmPresion?: string
  atmViento?: string
  condicionesPuesto?: string
  // Representantes
  representanteTrabajadores?: string
  representanteEmpresa?: string
  // Planilla B — TODOS los puestos (cada uno con su cabecera + grilla).
  // El descriptor clona la sección Planilla B una vez por elemento de este array.
  puestos?: PuestoCargaTermica[]
  // ── Campos planos LEGACY (compatibilidad) ──
  // Si `puestos` no viene, el descriptor sintetiza un único puesto con estos campos.
  // Planilla B — cabecera del puesto (primer puesto del protocolo)
  nombrePuesto?: string
  ambienteHomogeneo?: string
  alturaMedicion?: string
  tipoFuente?: string
  trabajadorPuesto?: string
  ghe?: string
  infoAdicional?: string
  // Planilla B — grilla de tareas (aplanada)
  grilla?: FilaGrillaCargaTermica[]
  // Planilla C — conclusiones / recomendaciones
  conclusionesAclimatado?: string
  conclusionesNoAclimatado?: string
  recomendaciones?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTES DEL HTML (extraídas EXACTO del source embebido)
// ─────────────────────────────────────────────────────────────────────────────

/** Texto EXACTO dentro del bloque de firma legal de este protocolo. */
const FIRMA_TEXTO = 'Firma, aclaración y registro<br>Profesional de Higiene y Seguridad'

/** Bloque de firma EXACTO tal como viene en el HTML embebido (clase .firma1). */
const FIRMA1_BLOCK =
  '<div class="firma1"><div class="ln">…….................………</div>Firma, aclaración y registro<br>Profesional de Higiene y Seguridad</div>'

/** Fila vacía EXACTA de la grilla de la Planilla B (15 celdas). */
const GRID_ROW_VACIA =
  '<tr><td class="cell" style="text-align:center"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'

/** Primera fila de datos vacía de las condiciones atmosféricas (8 celdas). */
const ATM_ROW_VACIA =
  '<tr><td style="height:6mm"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'

// ── Marcadores VERBATIM para localizar la sección de la Planilla B en el body ──
// Verificados leyendo el HTML embebido REAL (PROTOCOLO_CARGA_TERMICA_HTML, runtime).
// El cuerpo embebido usa `<section class="hoja land">` (el descriptor lo renombra a
// `horiz` al final). La sección de la Planilla B abre en el `<section class="hoja land">`
// que precede a su barra `tbar`, y cierra en el `</section>` previo a la Planilla C.

/** Apertura de hoja apaisada (antes del renombrado land→horiz). */
const SECTION_LAND_OPEN = '<section class="hoja land">'
/** Barra de título que marca el inicio del contenido de la Planilla B. */
const PLANILLA_B_TBAR = '<div class="tbar">PLANILLA B: DATOS DEL ESTUDIO</div>'
/** Barra de título de la Planilla C (sirve para acotar el fin de la Planilla B). */
const PLANILLA_C_TBAR = '<div class="tbar">PLANILLA C: CONCLUSIONES</div>'
/** Cierre de sección. */
const SECTION_CLOSE = '</section>'

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE RENDER DE FILAS
// ─────────────────────────────────────────────────────────────────────────────

/** Celda de dato con la tipografía de la app, centrada. */
function cd(v: string | undefined): string {
  return `<td style="text-align:center">${D(v ?? '')}</td>`
}

/** Fila de grilla llena (15 celdas). Mantiene la 1ra celda centrada (estilo legal). */
function filaGrillaLlena(f: FilaGrillaCargaTermica): string {
  const cols = [
    f.periodo,
    f.horaInicio,
    f.nTarea,
    f.tareaRealizada,
    f.tiempoTarea,
    f.tmTarea,
    f.tmPonderada,
    f.tgbh,
    f.tgbhPonderado,
    f.var,
    f.varPonderado,
    f.tgbhef,
    f.vlpNoAclimatado,
    f.vlaNoAclimatado,
    f.vlpAclimatado,
  ]
  return '<tr>' + cols.map(c => cd(c)).join('') + '</tr>'
}

/** Fila de datos atmosféricos llena (8 celdas: fecha/horaIni/horaFin/tmax/tmin/hum/pres/viento). */
function filaAtmLlena(d: DatosProtocoloCargaTermica): string {
  const cols = [
    d.fechaMedicion,
    d.horaInicio,
    d.horaFin,
    d.atmTempMax,
    d.atmTempMin,
    d.atmHumedad,
    d.atmPresion,
    d.atmViento,
  ]
  // La 1ra celda conserva la altura legal (height:6mm) para no romper la grilla.
  return (
    `<tr><td style="height:6mm;text-align:center">${D(cols[0] ?? '')}</td>` +
    cols.slice(1).map(c => `<td style="text-align:center">${D(c ?? '')}</td>`).join('') +
    '</tr>'
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INYECCIÓN DE CAMPOS DE TEXTO POR LABEL
// ─────────────────────────────────────────────────────────────────────────────

function inyectarCampos(body: string, d: DatosProtocoloCargaTermica): string {
  // Cada par: [label EXACTO del HTML, label + dato envuelto en D()].
  // Los labels salen del HTML embebido (verificados uno a uno).
  const campos: Array<[string, string]> = [
    // Planilla A — datos de empresa
    ['Razón Social</span>:', `Razón Social</span>: ${D(d.razonSocial)}`],
    ['CUIT:</span>', `CUIT:</span> ${D(d.cuit)}`],
    ['Dirección</span>:', `Dirección</span>: ${D(d.direccion)}`],
    ['Localidad</span>:', `Localidad</span>: ${D(d.localidad)}`],
    ['Provincia:</span>', `Provincia:</span> ${D(d.provincia)}`],
    ['C.P.:</span>', `C.P.:</span> ${D(d.cp)}`],
    [
      'Horarios/Turnos Habituales de Trabajo</span>:',
      `Horarios/Turnos Habituales de Trabajo</span>: ${D(d.turnos)}`,
    ],
    // Planilla A — descripción de condiciones de trabajo
    [
      'Describir las condiciones de trabajo informadas como normales y habituales de trabajo en el puesto</span>:',
      `Describir las condiciones de trabajo informadas como normales y habituales de trabajo en el puesto</span>: ${D(d.condicionesPuesto)}`,
    ],
    // Planilla A — instrumental
    [
      'Descripción de instrumental utilizado:',
      `Descripción de instrumental utilizado: ${D(d.instrumento)}`,
    ],
    [
      'Fecha de Calibración en Laboratorio del instrumental utilizado:',
      `Fecha de Calibración en Laboratorio del instrumental utilizado: ${D(d.calibracion)}`,
    ],
    // Planilla A — representantes
    [
      'Por trabajadores: Apellido Nombre:',
      `Por trabajadores: Apellido Nombre: ${D(d.representanteTrabajadores)}`,
    ],
    [
      'Por la empresa: Apellido Nombre:',
      `Por la empresa: Apellido Nombre: ${D(d.representanteEmpresa)}`,
    ],
    // NOTA: los campos de cabecera de la Planilla B (Nombre del puesto, Ambiente,
    // Tipo de Fuente, Trabajador, GHE, Información adicional) NO se inyectan acá:
    // viven dentro de cada SECCIÓN de Planilla B y se inyectan por puesto en
    // inyectarCabeceraPuesto() para que cada clon muestre su propio puesto.
  ]

  let out = body
  for (const [find, replace] of campos) {
    out = out.split(find).join(replace)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// PLANILLA B — CABECERA Y GRILLA POR PUESTO (sobre UNA sección clonada)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Inyecta los campos de cabecera de un puesto DENTRO de una única sección de Planilla B.
 * Opera solo sobre el string de la sección (no sobre el body completo), de modo que cada
 * clon recibe los datos de SU puesto. Labels EXACTOS del HTML embebido (verificados).
 */
function inyectarCabeceraPuesto(seccion: string, p: PuestoCargaTermica): string {
  const campos: Array<[string, string]> = [
    ['Nombre del puesto:</span>', `Nombre del puesto:</span> ${D(p.nombrePuesto)}`],
    [
      'Ambiente Homogéneo:</span>&nbsp;&nbsp;: Altura de la medición:',
      `Ambiente Homogéneo:</span> ${D(p.ambienteHomogeneo)} &nbsp;: Altura de la medición: ${D(p.alturaMedicion)}`,
    ],
    ['Tipo de Fuente:</span>', `Tipo de Fuente:</span> ${D(p.tipoFuente)}`],
    [
      'Trabajador del puesto estudiado:</span> Nombre/Apellido:',
      `Trabajador del puesto estudiado:</span> Nombre/Apellido: ${D(p.trabajadorPuesto)}`,
    ],
    ['<b>GHE:</b>', `<b>GHE:</b> ${D(p.ghe)}`],
    ['Información adicional:</span>', `Información adicional:</span> ${D(p.infoAdicional)}`],
  ]
  let out = seccion
  for (const [find, replace] of campos) {
    out = out.split(find).join(replace)
  }
  return out
}

/**
 * Inyecta la grilla de un puesto en SU sección de Planilla B.
 * El template trae 7 filas vacías (GRID_ROW_VACIA). Si el puesto tiene MÁS de 7 filas,
 * agregamos filas vacías extra (clonando GRID_ROW_VACIA dentro del <tbody>) antes de
 * llenarlas; si tiene menos, dejamos las vacías sobrantes del legal. Luego llenamos
 * las primeras N filas vacías (de arriba hacia abajo) con los datos.
 */
function inyectarGrillaPuesto(seccion: string, filas: FilaGrillaCargaTermica[]): string {
  let out = seccion

  // 1) Asegurar que haya al menos `filas.length` filas vacías. El template trae 7.
  //    Si necesitamos más, agregamos las que faltan ANTES de </tbody>.
  const VACIAS_BASE = 7
  const faltan = filas.length - VACIAS_BASE
  if (faltan > 0) {
    const extra = GRID_ROW_VACIA.repeat(faltan)
    // Insertamos las filas extra justo antes del cierre del tbody de ESTA sección.
    // El template termina el cuerpo de la grilla con: ...GRID_ROW_VACIA + '\r\n</tbody>'.
    // Anclamos en '</tbody>' (única en la sección de Planilla B).
    const idxTbodyClose = out.indexOf('</tbody>')
    if (idxTbodyClose !== -1) {
      out = out.slice(0, idxTbodyClose) + extra + out.slice(idxTbodyClose)
    } else {
      // Best-effort: si no hay </tbody> (HTML regenerado raro), apilamos al final de
      // la última fila vacía conocida. Si tampoco existe, no hacemos nada (no rompemos).
      const lastVacia = out.lastIndexOf(GRID_ROW_VACIA)
      if (lastVacia !== -1) {
        const insertAt = lastVacia + GRID_ROW_VACIA.length
        out = out.slice(0, insertAt) + extra + out.slice(insertAt)
      }
    }
  }

  // 2) Llenar las primeras N filas vacías con los datos (1ra ocurrencia por iteración).
  for (const f of filas) {
    out = out.replace(GRID_ROW_VACIA, filaGrillaLlena(f))
  }
  return out
}

/**
 * Localiza la sección de la Planilla B dentro del body y devuelve sus límites [inicio, fin)
 * (índices sobre el string). `inicio` apunta al `<section class="hoja land">` que abre la
 * Planilla B; `fin` apunta justo DESPUÉS del `</section>` que la cierra (antes de la Planilla C).
 * Devuelve null si los marcadores no matchean (HTML regenerado con otra forma) → best-effort.
 */
function localizarSeccionPlanillaB(body: string): { start: number; end: number } | null {
  const tbarB = body.indexOf(PLANILLA_B_TBAR)
  if (tbarB === -1) return null
  // Apertura de la sección: el <section land> inmediatamente anterior a la barra de B.
  const start = body.lastIndexOf(SECTION_LAND_OPEN, tbarB)
  if (start === -1) return null
  // Fin de la sección: el </section> previo a la barra de la Planilla C (si existe);
  // si no hay Planilla C, el primer </section> después de la barra de B.
  const tbarC = body.indexOf(PLANILLA_C_TBAR)
  let close: number
  if (tbarC !== -1) {
    close = body.lastIndexOf(SECTION_CLOSE, tbarC)
  } else {
    close = body.indexOf(SECTION_CLOSE, tbarB)
  }
  if (close === -1 || close < start) return null
  const end = close + SECTION_CLOSE.length
  return { start, end }
}

/**
 * Reemplaza la ÚNICA sección de Planilla B del body por N secciones, una por puesto.
 * Cada sección clon recibe la cabecera + grilla de su puesto. Best-effort: si no se puede
 * localizar la sección, devuelve el body sin tocar (la Planilla B original queda intacta).
 */
function clonarPlanillaBPorPuesto(
  body: string,
  puestos: PuestoCargaTermica[],
): string {
  if (puestos.length === 0) return body
  const loc = localizarSeccionPlanillaB(body)
  if (!loc) {
    // Ancla no encontrada: no rompemos. La Planilla B legal queda en blanco (mejor que romper).
    console.warn('[carga-termica] no se localizó la sección de la Planilla B; se deja intacta (best-effort)')
    return body
  }

  const template = body.slice(loc.start, loc.end)
  const secciones = puestos
    .map(p => inyectarGrillaPuesto(inyectarCabeceraPuesto(template, p), p.grilla))
    .join('')

  return body.slice(0, loc.start) + secciones + body.slice(loc.end)
}

// ─────────────────────────────────────────────────────────────────────────────
// DESCRIPTOR
// ─────────────────────────────────────────────────────────────────────────────

export const CARGA_TERMICA_DESCRIPTOR: ProtocoloDescriptor<DatosProtocoloCargaTermica> = {
  html: PROTOCOLO_CARGA_TERMICA_HTML,
  titulo: 'Estrés Térmico por Calor',
  norma: 'Res. SRT 30/2023',
  descripcion:
    'Evaluación de la carga térmica por calor en los puestos de trabajo del establecimiento, ' +
    'conforme a la Res. SRT 30/2023, mediante el índice TGBH efectivo (TGBHef) y su comparación ' +
    'con los valores límite permisibles (VLP) y de acción (VLA) para personal aclimatado y no aclimatado.',
  equipoTexto: d =>
    `${D(d.instrumento)} (Monitor de Estrés Térmico). <b>Último certificado de calibración:</b> ${D(d.calibracion)} (vigente, se adjunta como anexo).`,
  firmaTexto: FIRMA_TEXTO,
  ajustesCss: `
    /* Ajustes de presentación del protocolo de carga térmica (no tocan el HTML legal). */
    .hoja.horiz table.grid td.cell { height: 5.6mm; }
    .hoja.horiz .dato, .hoja.vert .dato { font-size: 7.5pt; }
    .hoja.horiz table.f .dato { font-size: 8pt; }
  `,

  inyectarBody: (body, d) => {
    let out = body

    // 1) Campos de texto por label SOLO de la Planilla A (empresa, instrumental, representantes).
    //    La cabecera de cada puesto (Planilla B) se inyecta por sección en el paso 3.
    out = inyectarCampos(out, d)

    // 2) Fila de condiciones atmosféricas: llenamos SOLO la primera fila de datos vacía
    //    (replace cambia la 1ra ocurrencia → la 2da queda como fila en blanco del legal).
    out = out.replace(ATM_ROW_VACIA, filaAtmLlena(d))

    // 3) Planilla B REPETIBLE POR PUESTO: clonamos la sección de la Planilla B una vez por
    //    puesto. Cada clon lleva su cabecera (nombre/ambiente/fuente/trabajador/GHE/info) y
    //    su grilla propia (expandiendo filas vacías si tiene más de 7).
    //    Compatibilidad: si no vino `puestos`, sintetizamos uno desde los campos planos legacy.
    const puestos: PuestoCargaTermica[] =
      d.puestos && d.puestos.length > 0
        ? d.puestos
        : [
            {
              nombrePuesto: d.nombrePuesto,
              ambienteHomogeneo: d.ambienteHomogeneo,
              alturaMedicion: d.alturaMedicion,
              tipoFuente: d.tipoFuente,
              trabajadorPuesto: d.trabajadorPuesto,
              ghe: d.ghe,
              infoAdicional: d.infoAdicional,
              grilla: d.grilla ?? [],
            },
          ]
    out = clonarPlanillaBPorPuesto(out, puestos)

    // 4) Conclusiones / recomendaciones (Planilla C): inyectamos como anotación al final del
    //    encabezado de cada columna. El layout legal son líneas de checklist; agregamos el texto
    //    libre del ejecutor debajo del título de cada bloque.
    if (d.recomendaciones) {
      out = out.replace(
        '<div class="chead">RECOMENDACIONES</div>',
        `<div class="chead">RECOMENDACIONES</div><div class="cline">${D(d.recomendaciones)}</div>`,
      )
    }
    if (d.conclusionesNoAclimatado) {
      out = out.replace(
        '<div class="csub">PERSONAL NO ACLIMATADO</div>',
        `<div class="csub">PERSONAL NO ACLIMATADO</div><div class="cline">${D(d.conclusionesNoAclimatado)}</div>`,
      )
    }
    if (d.conclusionesAclimatado) {
      out = out.replace(
        '<div class="csub">PERSONAL ACLIMITADO</div>',
        `<div class="csub">PERSONAL ACLIMITADO</div><div class="cline">${D(d.conclusionesAclimatado)}</div>`,
      )
    }

    // 5) NORMALIZACIÓN DE MARCADORES para que el motor estampe watermark/logos/firma:
    //    el HTML legal usa hoja land/port; el motor busca hoja horiz/vert.
    out = out.split('<section class="hoja land">').join('<section class="hoja horiz">')
    out = out.split('<section class="hoja port">').join('<section class="hoja vert">')

    // 6) Reescritura del bloque de firma .firma1 → contiene <div class="ac">…</div>
    //    (lo que el motor busca para estampar nombre/matrícula del firmante).
    const firma1Reescrito =
      '<div class="firma1"><div class="ln">…….................………</div><div class="ac">' +
      FIRMA_TEXTO +
      '</div></div>'
    out = out.split(FIRMA1_BLOCK).join(firma1Reescrito)

    return out
  },
}
