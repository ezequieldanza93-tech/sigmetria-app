/**
 * Helper REUSABLE para generar PDFs de protocolos oficiales client-side.
 *
 * Toma una lista de nodos HTML (cada uno = una "hoja" del protocolo, ya maquetada
 * con estilos inline / Tailwind) y produce un PDF A4 multipágina donde CADA HOJA
 * OCUPA EXACTAMENTE UNA PÁGINA. Usa html2canvas + jsPDF (ya en package.json).
 *
 * A diferencia del enfoque "una imagen larga cortada por offset" (que parte el
 * contenido feo en los límites de página), acá rasterizamos cada hoja por separado
 * y la escalamos para que entre completa en su página. Esto da páginas prolijas y
 * predecibles, y es el patrón que van a reusar Ruido / PAT / Carga de Fuego /
 * Carga Térmica: solo cambian los nodos de las hojas, no esta lógica.
 *
 * IMPORTANTE: los nodos deben estar montados en el DOM (aunque sea fuera de
 * pantalla con position:fixed + left:-99999px) para que html2canvas pueda medirlos.
 * NO uses display:none ni visibility:hidden (html2canvas mide 0×0).
 */

const A4_WIDTH_MM = 210
const A4_HEIGHT_MM = 297

export interface GenerarProtocoloPdfOptions {
  /** Nodos de cada hoja, en orden. Cada uno se renderiza en su propia página A4. */
  hojas: HTMLElement[]
  /** Margen interno de la página en mm (default 0; las hojas ya traen su padding). */
  margenMm?: number
  /** Escala de rasterizado de html2canvas (default 2 = nitidez retina). */
  escala?: number
}

/**
 * Genera el PDF y devuelve la instancia de jsPDF para que el caller decida qué
 * hacer (descargar, datauristring para subir a storage, etc.).
 */
export async function generarProtocoloPdf({
  hojas,
  margenMm = 0,
  escala = 2,
}: GenerarProtocoloPdfOptions) {
  if (hojas.length === 0) {
    throw new Error('generarProtocoloPdf: no hay hojas para renderizar')
  }

  // Imports dinámicos: estas libs son pesadas y solo corren en cliente al descargar.
  const { default: html2canvas } = await import('html2canvas')
  const { default: jsPDF } = await import('jspdf')

  const pdf = new jsPDF('p', 'mm', 'a4')
  const usableWidth = A4_WIDTH_MM - margenMm * 2
  const usableHeight = A4_HEIGHT_MM - margenMm * 2

  for (let i = 0; i < hojas.length; i++) {
    const canvas = await html2canvas(hojas[i], {
      scale: escala,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    })
    const imgData = canvas.toDataURL('image/jpeg', 0.95)

    // Escalamos la imagen para que entre completa dentro del área útil de la página,
    // preservando el aspect ratio. La hoja se ancla arriba-izquierda del margen.
    const imgRatio = canvas.width / canvas.height
    let drawWidth = usableWidth
    let drawHeight = drawWidth / imgRatio
    if (drawHeight > usableHeight) {
      drawHeight = usableHeight
      drawWidth = drawHeight * imgRatio
    }

    if (i > 0) pdf.addPage()
    pdf.addImage(imgData, 'JPEG', margenMm, margenMm, drawWidth, drawHeight)
  }

  return pdf
}

/**
 * Atajo: genera el PDF y dispara la descarga en el navegador con el nombre dado.
 */
export async function descargarProtocoloPdf(
  options: GenerarProtocoloPdfOptions,
  nombreArchivo: string,
): Promise<void> {
  const pdf = await generarProtocoloPdf(options)
  pdf.save(nombreArchivo)
}
