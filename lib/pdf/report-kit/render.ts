/**
 * render.ts — Helpers de generación de PDF (client-side only)
 *
 * Compatibilidad con la plomería existente:
 *   - El campo `pdf` del FormData espera un datauri string base64 (ej.:
 *     "data:application/pdf;base64,JVBERi0x...")
 *   - Esto es lo mismo que jsPDF produce con `pdf.output('datauristring')`
 *
 * IMPORTANTE: estas funciones solo pueden ejecutarse en el BROWSER.
 * No las llames desde server actions ni desde código que corra en el server.
 * El patrón correcto es llamarlas dentro de un event handler (onClick, submit, etc.)
 *
 * NOTA sobre imports:
 * `pdf` es el renderer de react-pdf. Se importa directamente desde
 * '@react-pdf/renderer' — en Next.js 15 funciona porque este módulo solo
 * se importa en client components (o en callbacks de cliente).
 * Si ves un error de SSR, asegurate de que el archivo que lo importa tenga
 * 'use client' o sea importado con next/dynamic + { ssr: false }.
 */

// IMPORTANTE: NO pongas 'use client' aquí — es un módulo TS puro (no un
// componente React). La restricción client-only la impone el caller.
// Para evitar que Next.js lo procese en el server, este módulo DEBE importarse
// solo desde componentes 'use client' o desde dynamic imports con ssr:false.

import type { ReactElement } from 'react'

/**
 * Tipo para el elemento Document de react-pdf.
 *
 * react-pdf usa `export =` (CommonJS namespace), por lo que no puede
 * importarse con `import type X from`. En cambio, tomamos DocumentProps
 * directamente desde el módulo de tipos separado @react-pdf/types.
 *
 * Como alternativa que no rompe el build, usamos un tipo estructural:
 * cualquier ReactElement es aceptable aquí porque pdf() acepta cualquier
 * ReactElement (el tipado estricto falla en ts strict por el `export =`).
 * Para mayor seguridad, añadimos el comentario del contrato esperado.
 */

/**
 * Elemento React que representa un <Document> de react-pdf.
 * El caller es responsable de pasar solo elementos <ReportDocument> o <Document>.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReactPDFDocument = ReactElement<any>

/**
 * Toma un elemento Document de react-pdf y devuelve un Blob del PDF.
 *
 * @param doc - El elemento <Document> (ej.: <ReportDocument>...</ReportDocument>)
 * @returns Promise<Blob> con el PDF generado
 */
export async function documentToBlob(doc: ReactPDFDocument): Promise<Blob> {
  // Import dinámico para que este módulo sea tree-shakeable en el server
  const { pdf } = await import('@react-pdf/renderer')
  const instance = pdf(doc)
  const blob = await instance.toBlob()
  return blob
}

/**
 * Toma un elemento Document de react-pdf y devuelve un datauri base64.
 * Formato: "data:application/pdf;base64,JVBERi0x..."
 *
 * Compatible con el patrón existente de la app:
 *   const pdfB64 = await documentToDataUri(<MiReporte ctx={...} />)
 *   const fd = new FormData()
 *   fd.set('pdf', pdfB64)
 *   await miServerAction(fd)
 *
 * @param doc - El elemento <Document> de react-pdf
 * @returns Promise<string> — datauri base64 del PDF
 */
export async function documentToDataUri(doc: ReactPDFDocument): Promise<string> {
  const blob = await documentToBlob(doc)
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('FileReader no devolvió un string'))
      }
    }
    reader.onerror = () => reject(reader.error ?? new Error('Error en FileReader'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Versión alternativa que usa URL.createObjectURL para previsualización.
 * Devuelve una URL de objeto que debe liberarse con URL.revokeObjectURL()
 * cuando ya no se necesite.
 *
 * @param doc - El elemento <Document> de react-pdf
 * @returns Promise<string> — URL de objeto para <iframe src={url} />
 */
export async function documentToObjectUrl(doc: ReactPDFDocument): Promise<string> {
  const blob = await documentToBlob(doc)
  return URL.createObjectURL(blob)
}
