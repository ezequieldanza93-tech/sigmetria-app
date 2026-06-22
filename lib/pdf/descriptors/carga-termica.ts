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
 * PLANILLA B (grilla anidada puesto → período → tarea):
 *   La grilla legal tiene 7 filas vacías y 15 columnas. El modelo de datos es anidado
 *   (un protocolo tiene N puestos, cada puesto N períodos, cada período N tareas). El HTML
 *   embebido solo trae UNA Planilla B (7 filas), así que aplanamos los períodos/tareas del
 *   PRIMER puesto en esas 7 filas. Cabecera del puesto (nombre/ambiente/fuente/trabajador/GHE)
 *   se inyecta en sus labels. Limitación documentada en `notas` del reporte de la tarea.
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
    // Planilla B — cabecera del puesto
    ['Nombre del puesto:</span>', `Nombre del puesto:</span> ${D(d.nombrePuesto)}`],
    [
      'Ambiente Homogéneo:</span>&nbsp;&nbsp;: Altura de la medición:',
      `Ambiente Homogéneo:</span> ${D(d.ambienteHomogeneo)} &nbsp;: Altura de la medición: ${D(d.alturaMedicion)}`,
    ],
    ['Tipo de Fuente:</span>', `Tipo de Fuente:</span> ${D(d.tipoFuente)}`],
    [
      'Trabajador del puesto estudiado:</span> Nombre/Apellido:',
      `Trabajador del puesto estudiado:</span> Nombre/Apellido: ${D(d.trabajadorPuesto)}`,
    ],
    ['<b>GHE:</b>', `<b>GHE:</b> ${D(d.ghe)}`],
    ['Información adicional:</span>', `Información adicional:</span> ${D(d.infoAdicional)}`],
  ]

  let out = body
  for (const [find, replace] of campos) {
    out = out.split(find).join(replace)
  }
  return out
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

    // 1) Campos de texto por label (cabecera Planilla A + cabecera puesto Planilla B).
    out = inyectarCampos(out, d)

    // 2) Fila de condiciones atmosféricas: llenamos SOLO la primera fila de datos vacía
    //    (replace cambia la 1ra ocurrencia → la 2da queda como fila en blanco del legal).
    out = out.replace(ATM_ROW_VACIA, filaAtmLlena(d))

    // 3) Grilla Planilla B: aplanamos las filas de la grilla (períodos/tareas) en las 7 filas
    //    vacías, de arriba hacia abajo (replace = 1ra ocurrencia).
    const filas = d.grilla ?? []
    for (const f of filas) {
      out = out.replace(GRID_ROW_VACIA, filaGrillaLlena(f))
    }

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
