/**
 * descriptors/ruido.ts — Descriptor del Protocolo de Medición de Ruido (Res. SRT 85/2012).
 *
 * Cumple ProtocoloDescriptor<DatosProtocoloRuido> del motor genérico (protocolo-engine.ts):
 *   - html: la constante embebida PROTOCOLO_RUIDO_HTML (protocolos-html.ts).
 *   - titulo/norma/descripcion/equipoTexto/firmaTexto: textos de carátula y firma.
 *   - inyectarBody(body, datos): reemplaza los labels de cabecera (hoja 1) por el dato real
 *     envuelto en D(), y llena la grilla de 11 columnas (hoja 2) fila por fila.
 *
 * NO toca archivos compartidos. El reporte (reporte-protocolo-ruido.ts) mapea los datos
 * reales y llama renderProtocolo(RUIDO_DESCRIPTOR, datos).
 */

import {
  D,
  type DatosProtocoloBase,
  type ProtocoloDescriptor,
} from '@/lib/pdf/protocolo-engine'
import { PROTOCOLO_RUIDO_HTML } from '@/lib/pdf/protocolos-html'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de la grilla de mediciones (hoja 2, 11 columnas, campos 23-33). */
export interface FilaRuido {
  /** (23) Punto de medición (correlativo 1..N). */
  punto: number
  /** (24) Sector. */
  sector: string
  /** (25) Puesto / Puesto tipo / Puesto móvil. */
  puesto: string
  /** (26) Tiempo de exposición del trabajador (Te, en horas). */
  teHoras: string
  /** (27) Tiempo de integración (tiempo de medición). */
  tiempoIntegracion: string
  /** (28) Características del ruido (continuo / intermitente / de impacto). */
  caracteristicas: string
  /** (29) LC pico (dBC) — ruido de impulso o de impacto. */
  lcpico: string
  /** (30) Nivel de presión acústica integrado (LAeq,Te en dBA). */
  laeq: string
  /** (31) Resultado de la suma de las fracciones. */
  sumaFracciones: string
  /** (32) Dosis (en porcentaje %). */
  dosisPct: string
  /** (33) ¿Cumple con los valores de exposición diaria permitidos? (SI / NO). */
  cumple: string
}

/** Datos del Protocolo de Ruido: base compartida + filas de la grilla + textos de análisis. */
export interface DatosProtocoloRuido extends DatosProtocoloBase {
  /** (12) Horarios / turnos habituales de trabajo. */
  turnos?: string
  /** (13) Condiciones normales y/o habituales de trabajo. */
  condicionesNormales?: string
  /** (14) Condiciones de trabajo al momento de la medición. */
  condicionesMedicion?: string
  /** (34) Información adicional consolidada de los puntos (hoja 2). */
  infoAdicional?: string
  /** (41) Conclusiones (hoja 3, celda col-an izquierda). */
  conclusiones?: string
  /** (42) Recomendaciones para adecuar el nivel de ruido (hoja 3, celda col-an derecha). */
  recomendaciones?: string
  /** Filas de la grilla de mediciones (hoja 2). */
  filas?: FilaRuido[]
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE INYECCIÓN
// ─────────────────────────────────────────────────────────────────────────────

/** FILA vacía EXACTA de la grilla (hoja 2). Las 11 filas del HTML son idénticas. */
const FILA_VACIA =
  '<tr><td class="fila"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'

/** Arma una fila llena con los 11 valores envueltos en D(). */
function filaLlena(f: FilaRuido): string {
  const celdas = [
    f.sector,
    f.puesto,
    f.teHoras,
    f.tiempoIntegracion,
    f.caracteristicas,
    f.lcpico,
    f.laeq,
    f.sumaFracciones,
    f.dosisPct,
    f.cumple,
  ]
  return (
    `<tr><td class="fila">${D(f.punto)}</td>` +
    celdas.map((v) => `<td>${D(v)}</td>`).join('') +
    `</tr>`
  )
}

/**
 * Reemplaza un label de campo por "label: <dato>".
 * Los labels del HTML terminan en `</td>` y arrancan con un `<span class="n">(N)</span>`,
 * así que el ancla EXACTA es el texto del label + `:</td>`. split().join() reemplaza
 * TODAS las ocurrencias (la razón social / cuit / dirección se repiten como cabecera en
 * cada hoja → quedan rellenadas en todas).
 */
function inyectarCampo(body: string, label: string, valor: string | undefined): string {
  const find = `${label}:</td>`
  const replace = `${label}: ${D(valor)}</td>`
  return body.split(find).join(replace)
}

/** Escapa texto libre para inyectarlo seguro en el HTML (preserva saltos de línea). */
function escTexto(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
}

/**
 * Inyecta un valor de texto libre como un <span class="dato"> en bloque DEBAJO de un
 * label cuyo <td> termina en `etiquetaCierre` (ej. `trabajo.</td>`). El span se inserta
 * ANTES del `</td>` de cierre, dentro de la misma celda. No-op si el valor es vacío o si
 * el ancla no aparece (best-effort). Mismo patrón que la metodología de iluminación.
 */
function inyectarBloque(body: string, anclaCierre: string, valor: string | undefined): string {
  if (!valor || !valor.trim()) return body
  const span = `<span class="dato" style="display:block;margin-top:2mm;font-weight:400;line-height:1.4">${escTexto(valor)}</span>`
  // anclaCierre termina en `</td>`; insertamos el span justo antes del cierre.
  const find = anclaCierre
  const replace = `${anclaCierre.slice(0, -'</td>'.length)}${span}</td>`
  return body.split(find).join(replace)
}

// ─────────────────────────────────────────────────────────────────────────────
// DESCRIPTOR
// ─────────────────────────────────────────────────────────────────────────────

export const RUIDO_DESCRIPTOR: ProtocoloDescriptor<DatosProtocoloRuido> = {
  html: PROTOCOLO_RUIDO_HTML,
  titulo: 'Medición de Ruido<br>en el Ambiente Laboral',
  norma: 'Res. SRT 85/2012',
  descripcion:
    'Medición de los niveles de ruido en los puestos de trabajo del establecimiento, conforme a la Res. SRT 85/2012 (Res. MTEySS 295/03, Anexo V), para verificar el cumplimiento de los valores límite de exposición diaria permitidos (criterio 85 dBA / tasa de cambio 3 dB y nivel pico ≤ 140 dBC).',
  equipoTexto: (d) =>
    `${d.instrumento ?? '—'}.${
      d.calibracion
        ? ` <b>Último certificado de calibración:</b> ${d.calibracion} (vigente, se adjunta como anexo).`
        : ''
    }`,
  // Texto EXACTO dentro de <div class="ac">…</div> del HTML de ruido (con punto final).
  firmaTexto: 'Firma, aclaración y registro del Profesional interviniente.',
  // Ajustes de presentación: reducimos ~20% TODAS las alturas de fila/celda de las tablas
  // normativas para que cada hoja + su firma entren en 1 página A4 (igual que iluminación).
  // Estas reglas se concatenan DESPUÉS del <style> embebido del protocolo (mismo <style>),
  // así ganan por orden de fuente; las alturas inline de los <td> legales se sobreescriben
  // con !important (no se toca el HTML embebido en protocolos-html.ts).
  ajustesCss: `
    /* Grilla de mediciones (hoja 2). */
    table.med td.fila { height: 6.8mm; }
    .info-ad { height: 25.6mm; }
    /* Análisis de los datos (hoja 3). */
    .col-an { height: 120mm; }
    /* Cabecera vertical (hoja 1): alturas inline de los <td> legales (~20% menos). */
    .hoja.vert table.form td[style*="height:13mm"] { height: 10.4mm !important; }
    .hoja.vert table.form td[style*="height:11mm"] { height: 8.8mm !important; }
    .hoja.vert table.form td[style*="height:15mm"] { height: 12mm !important; }
    .hoja.vert table.form td[style*="height:9mm"] { height: 7.2mm !important; }
    .hoja.vert table.form td[style*="height:22mm"] { height: 17.6mm !important; }
    .hoja.vert table.form td[style*="height:18mm"] { height: 14.4mm !important; }
    .hoja.vert table.form td[style*="height:40mm"] { height: 32mm !important; }
    .hoja.vert table.form td[style*="height:8mm"] { height: 6.4mm !important; }
  `,
  inyectarBody(body, d) {
    // ── 1. Campos de cabecera (hoja 1, vertical) ──────────────────────────────
    // Labels EXACTOS tal como figuran en el HTML del protocolo (mayúsculas/acentos).
    let out = body

    // Datos del establecimiento (campos 1-6). Estos labels se repiten como cabecera
    // en las hojas 2 y 3 con distinta capitalización ("Razón social" vs "Razón Social"),
    // por eso inyectamos ambas variantes para rellenar todas las páginas.
    out = inyectarCampo(out, 'Razón Social', d.razonSocial) // hoja 1
    out = inyectarCampo(out, 'Razón social', d.razonSocial) // hojas 2 y 3
    out = inyectarCampo(out, 'Dirección', d.direccion)
    out = inyectarCampo(out, 'Localidad', d.localidad)
    out = inyectarCampo(out, 'Provincia', d.provincia)
    out = inyectarCampo(out, 'C.P.', d.cp)
    out = inyectarCampo(out, 'C.U.I.T.', d.cuit)

    // Datos para la medición (campos 7-12).
    out = inyectarCampo(out, 'del instrumento utilizado', d.instrumento) // (7)
    out = inyectarCampo(out, 'en la medición', d.calibracion) // (8) fecha del certificado
    out = inyectarCampo(out, 'Fecha de la medición', d.fechaMedicion) // (9)
    out = inyectarCampo(out, 'Hora de inicio', d.horaInicio) // (10)
    out = inyectarCampo(out, 'Hora finalización', d.horaFin) // (11)
    out = inyectarCampo(out, 'Horarios/turnos habituales de trabajo', d.turnos) // (12)

    // Condiciones de trabajo (campos 13-14). Celdas altas (height:40mm) que solo
    // contienen el label terminado en punto; inyectamos el valor (texto libre, puede
    // ser multilínea) como párrafo DEBAJO del label, dentro de la misma celda.
    out = inyectarBloque(out, 'Describa las condiciones normales y/o habituales de trabajo.</td>', d.condicionesNormales) // (13)
    out = inyectarBloque(out, 'Describa las condiciones de trabajo al momento de la medición.</td>', d.condicionesMedicion) // (14)

    // ── 2. Grilla de mediciones (hoja 2). FILA_VACIA es idéntica ×11; replace
    // reemplaza solo la 1ra ocurrencia → llena de arriba hacia abajo. ────────────
    const filas = d.filas ?? []
    for (const f of filas) {
      out = out.replace(FILA_VACIA, filaLlena(f))
    }

    // (34) Información adicional: celda al pie de la grilla (hoja 2). El label termina
    // en `:</td>`; inyectamos el valor consolidado como bloque debajo del label.
    out = inyectarBloque(out, 'Información adicional:</td>', d.infoAdicional) // (34)

    // ── 3. Análisis de los datos (hoja 3): conclusiones (41) y recomendaciones (42). ──
    // Son las DOS celdas `<td class="col-an"></td>` que siguen a los headers (41)/(42).
    // .replace toma la 1ra ocurrencia → primero conclusiones, después recomendaciones
    // (mismo orden e idéntico estilo que iluminación). Se reemplazan AMBAS de forma
    // incondicional (D() rinde "—" si está vacío) para no descalzar las celdas cuando
    // sólo una trae dato: si saltáramos la 1ra, la 2da pisaría la celda equivocada.
    out = out.replace('<td class="col-an"></td>', `<td class="col-an" style="font-size:9.5pt">${D(d.conclusiones)}</td>`)
    out = out.replace('<td class="col-an"></td>', `<td class="col-an" style="font-size:9.5pt">${D(d.recomendaciones)}</td>`)

    return out
  },
}
