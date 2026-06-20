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

    // ── 2. Grilla de mediciones (hoja 2). FILA_VACIA es idéntica ×11; replace
    // reemplaza solo la 1ra ocurrencia → llena de arriba hacia abajo. ────────────
    const filas = d.filas ?? []
    for (const f of filas) {
      out = out.replace(FILA_VACIA, filaLlena(f))
    }

    return out
  },
}
