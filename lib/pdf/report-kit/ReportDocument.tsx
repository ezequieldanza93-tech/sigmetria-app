'use client'

/**
 * ReportDocument.tsx — Wrapper raíz del documento PDF
 *
 * Envuelve <Document> de react-pdf con:
 *   - Registro de fuentes (registerFonts) — se llama antes del primer render
 *   - Meta-datos del documento (title, author)
 *
 * IMPORTANTE SSR / Next.js 15:
 * react-pdf NO puede ejecutarse en el server (usa APIs de browser y fontkit).
 * Este componente debe importarse con dynamic import + ssr:false, o usarse
 * exclusivamente dentro de callbacks de cliente (onClick, etc.) que llamen
 * al helper `documentToDataUri` de render.ts.
 *
 * NO montes este componente en el árbol de React para renderizado en pantalla.
 * Su único propósito es ser pasado a pdf(<ReportDocument />) para generación.
 */

import { Document } from '@react-pdf/renderer'
import { registerFonts } from './fonts'
import type { ReportDocumentProps } from './types'

// Registrar fuentes una sola vez al importar el módulo
registerFonts()

export function ReportDocument({
  title = 'Reporte Sigmetría HyS',
  author = 'Sigmetría HyS',
  children,
}: ReportDocumentProps) {
  return (
    <Document
      title={title}
      author={author}
      creator="Sigmetría HyS — report-kit"
      producer="@react-pdf/renderer"
      language="es-AR"
    >
      {children}
    </Document>
  )
}
