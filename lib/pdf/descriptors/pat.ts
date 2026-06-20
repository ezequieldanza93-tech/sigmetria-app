/**
 * descriptors/pat.ts — Descriptor del Protocolo de Puesta a Tierra y Continuidad
 * de las Masas (Res. SRT 900/2015) para el motor genérico de PDFs (protocolo-engine.ts).
 *
 * Replica la receta de iluminación pero declarativa: aporta el HTML legal embebido
 * (PROTOCOLO_PAT_HTML), los textos de carátula y la función de inyección de campos
 * de cabecera + filas de la grilla de tomas. NO toca archivos compartidos.
 *
 * Particularidades de ESTE protocolo respecto de iluminación:
 *  - Las 3 hojas repiten los campos de cabecera (Razón Social, CUIT, Dirección,
 *    Localidad, CP, Provincia). split/join los rellena en TODAS las hojas de una vez,
 *    que es lo deseado (los datos son los mismos en cada hoja).
 *  - Conclusiones y Recomendaciones NO son campos con label inline, sino el contenido
 *    de dos celdas vacías (<td class="col-an"></td>) bajo sus encabezados; se inyectan
 *    por orden de aparición (la 1ra = Conclusiones, la 2da = Recomendaciones).
 *  - La grilla de tomas tiene 11 columnas; el valor exigido (Ω) NO tiene columna
 *    propia en el formulario legal SRT, así que se anexa al texto del valor medido.
 *  - NO hay cálculos: `cumple` / `continuidad` / `capacidad_carga` /
 *    `desconexion_automatica` ya vienen como booleanos desde la base.
 */
import { D, type DatosProtocoloBase, type ProtocoloDescriptor } from '@/lib/pdf/protocolo-engine'
import { PROTOCOLO_PAT_HTML } from '@/lib/pdf/protocolos-html'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS
// ─────────────────────────────────────────────────────────────────────────────

/** Una fila de la grilla de tomas (medicion_pat_tomas), ya mapeada a texto legible. */
export interface TomaPatRow {
  /** (22) Número de toma de tierra. */
  numeroToma: number
  /** (23) Sector. */
  sector: string
  /** (24) Condición del terreno al momento de la medición. */
  condicionTerreno: string
  /** (25) Uso de la puesta a tierra. */
  usoPat: string
  /** (26) Esquema de conexión a tierra (TT / TN-S / TN-C / TN-C-S / IT). */
  esquema: string
  /** (27) Valor obtenido en ohm (Ω). Puede incluir el valor exigido como referencia. */
  valorMedidoOhm: string
  /** (28) ¿Cumple? SI / NO. */
  cumple: string
  /** (29) ¿El circuito es continuo y permanente? SI / NO. */
  continuidad: string
  /** (30) ¿Tiene capacidad de carga y resistencia apropiada? SI / NO. */
  capacidadCarga: string
  /** (31) Protección contra contactos indirectos (DD / IA / Fus). */
  proteccion: string
  /** (32) ¿Desconexión automática de la alimentación? SI / NO. */
  desconexionAutomatica: string
}

/** Datos completos del protocolo PAT: base compartida + campos/grilla específicos. */
export interface DatosProtocoloPat extends DatosProtocoloBase {
  /** (12) Metodología utilizada. */
  metodologia?: string
  /** (13) Observaciones de la medición. */
  observaciones?: string
  /** (40) Conclusiones. */
  conclusiones?: string
  /** (41) Recomendaciones para la adecuación a la legislación vigente. */
  recomendaciones?: string
  /** Filas de la grilla de tomas (hasta 11). */
  tomas?: TomaPatRow[]
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE INYECCIÓN
// ─────────────────────────────────────────────────────────────────────────────

/** Fila vacía EXACTA de la grilla de tomas (tal cual aparece en el HTML embebido). */
const FILA_VACIA =
  '<tr><td class="fila"></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'

/** Arma una fila llena de la grilla a partir de una toma. Orden de columnas (22)→(32). */
function filaToma(t: TomaPatRow): string {
  return (
    `<tr><td class="fila">${D(t.numeroToma)}</td>` +
    `<td>${D(t.sector)}</td>` +
    `<td>${D(t.condicionTerreno)}</td>` +
    `<td>${D(t.usoPat)}</td>` +
    `<td>${D(t.esquema)}</td>` +
    `<td>${D(t.valorMedidoOhm)}</td>` +
    `<td>${D(t.cumple)}</td>` +
    `<td>${D(t.continuidad)}</td>` +
    `<td>${D(t.capacidadCarga)}</td>` +
    `<td>${D(t.proteccion)}</td>` +
    `<td>${D(t.desconexionAutomatica)}</td></tr>`
  )
}

/**
 * Inyecta el contenido de las dos celdas de análisis (Conclusiones / Recomendaciones).
 * En el HTML son `<td class="col-an"></td>` vacías, en orden: 1ra=Conclusiones,
 * 2da=Recomendaciones. Reemplazamos de a una con replace (primera ocurrencia).
 */
function inyectarColAnalisis(body: string, conclusiones?: string, recomendaciones?: string): string {
  const CELDA_VACIA = '<td class="col-an"></td>'
  let out = body
  out = out.replace(CELDA_VACIA, `<td class="col-an">${D(conclusiones ?? '')}</td>`)
  out = out.replace(CELDA_VACIA, `<td class="col-an">${D(recomendaciones ?? '')}</td>`)
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// DESCRIPTOR
// ─────────────────────────────────────────────────────────────────────────────

export const PAT_DESCRIPTOR: ProtocoloDescriptor<DatosProtocoloPat> = {
  html: PROTOCOLO_PAT_HTML,
  titulo: 'Puesta a Tierra y Continuidad<br>de las Masas',
  norma: 'Res. SRT 900/2015',
  descripcion:
    'Medición de la resistencia de puesta a tierra y verificación de la continuidad de las masas ' +
    'en el establecimiento, conforme a la Res. SRT 900/2015, para verificar la protección contra ' +
    'contactos indirectos y el cumplimiento de los valores exigidos por la reglamentación vigente.',
  // Interpola instrumento + calibración (mismo formato que iluminación).
  equipoTexto: (d) =>
    `${d.instrumento ?? '—'} (telurímetro). <b>Último certificado de calibración:</b> ` +
    `${d.calibracion ?? '—'} (vigente, se adjunta como anexo).`,
  // Texto EXACTO dentro de <div class="ac">...</div> del HTML embebido.
  firmaTexto: 'Firma, Aclaración y Registro del Profesional Interviniente',
  // Ajustes de presentación: reducir las alturas grandes del formulario vertical y dar
  // alto a la grilla/celdas de análisis, sin tocar el HTML legal.
  ajustesCss: `
  .hoja.vert table.form { width: 96%; margin: 0 auto; }
  .hoja.vert td[style*="height:40mm"] { height: 24mm !important; }
  .hoja.vert td[style*="height:32mm"] { height: 20mm !important; }
  .hoja.vert td[style*="height:20mm"] { height: 14mm !important; }
  .hoja.vert td[style*="height:16mm"] { height: 12mm !important; }
  .hoja.horiz table.med { width: 96%; margin: 0 auto; }
  .hoja.horiz table.med td.fila { height: 7mm; }
  .hoja.horiz table.med .info-ad { height: 24mm; }
  .hoja.horiz table.analisis .col-an { height: 120mm; }
  .hoja.horiz .anexo, .hoja.horiz .titulo, .hoja.horiz table.form,
  .hoja.horiz table.med, .hoja.horiz table.analisis, .hoja.horiz .hoja-num,
  .hoja.horiz .proto-logos { width:96%; margin-left:auto; margin-right:auto; }
  .hoja.vert .anexo, .hoja.vert .titulo, .hoja.vert .hoja-num, .hoja.vert .proto-logos { width:96%; margin-left:auto; margin-right:auto; }
  `,
  inyectarBody: (body, d) => {
    let out = body

    // ── 1. Campos de cabecera (se repiten en las 3 hojas → split/join llena todas) ──
    // Labels EXACTOS leídos del HTML embebido (mayúsculas/acentos/puntos tal cual).
    const campos: [string, string | undefined][] = [
      ['Razón Social:</td>', d.razonSocial],
      ['Dirección:</td>', d.direccion],
      ['Localidad:</td>', d.localidad],
      ['Provincia:</td>', d.provincia],
      ['CP:</td>', d.cp],
      ['C.U.I.T.:</td>', d.cuit],
    ]
    for (const [find, valor] of campos) {
      const label = find.replace('</td>', '')
      out = out.split(find).join(`${label} ${D(valor)}</td>`)
    }

    // ── 2. Campos de la 1ra hoja (ocurrencia única) ──
    const camposUnicos: [string, string | undefined][] = [
      ['del instrumento utilizado:</td>', d.instrumento],
      ['Calibración del Instrumental utilizado:</td>', d.calibracion],
      ['Fecha de la medición:</td>', d.fechaMedicion],
      ['Hora de inicio:</td>', d.horaInicio],
      ['Hora finalización:</td>', d.horaFin],
      ['Metodologia utilizada</td>', d.metodologia],
      ['Observaciones:</td>', d.observaciones],
    ]
    for (const [find, valor] of camposUnicos) {
      const label = find.replace('</td>', '')
      out = out.split(find).join(`${label} ${D(valor)}</td>`)
    }

    // ── 3. Grilla de tomas (replace cambia solo la 1ra ocurrencia → llena top-down) ──
    for (const toma of d.tomas ?? []) {
      out = out.replace(FILA_VACIA, filaToma(toma))
    }

    // ── 4. Celdas de análisis (Conclusiones / Recomendaciones) ──
    out = inyectarColAnalisis(out, d.conclusiones, d.recomendaciones)

    return out
  },
}
