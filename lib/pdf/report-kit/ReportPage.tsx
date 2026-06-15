'use client'

/**
 * ReportPage.tsx — Página A4 del reporte
 *
 * Wrapper de <Page> de react-pdf que ya incluye:
 *   - Márgenes correctos (26mm sup, 20mm inf, 18mm laterales)
 *   - Header fijo (ReportHeader) — aparece en TODAS las páginas
 *   - Footer fijo (ReportFooter) — aparece en TODAS las páginas
 *   - Marca de agua Sigmetría (fija, detrás del contenido)
 *
 * Los children son el CONTENIDO del reporte. react-pdf se encarga de
 * paginar automáticamente si el contenido supera una página.
 *
 * GOTCHA react-pdf: los componentes con `fixed` en react-pdf deben ser
 * hijos DIRECTOS de <Page>, no de un View contenedor. Por eso ReportPage
 * renderiza directamente en la Page y no envuelve en un View raíz.
 */

import { Page } from '@react-pdf/renderer'
import type { ReportPageProps } from './types'
import { PAGE, PAGE as P } from './tokens'
import { ReportHeader } from './ReportHeader'
import { ReportFooter } from './ReportFooter'
import { Watermark } from './Watermark'

export function ReportPage({ context, children }: ReportPageProps) {
  return (
    <Page
      size="A4"
      style={{
        paddingTop: P.margin.top,
        paddingBottom: P.margin.bottom,
        paddingLeft: P.margin.left,
        paddingRight: P.margin.right,
        backgroundColor: '#FFFFFF',
        fontFamily: 'OpenSans', // fuente base para text nodes sueltos
      }}
    >
      {/* Marca de agua — se renderiza PRIMERO para quedar "abajo" */}
      <Watermark opacity={0.05} />

      {/* Header fijo */}
      <ReportHeader context={context} />

      {/* Footer fijo */}
      <ReportFooter context={context} />

      {/* Contenido del reporte */}
      {children}
    </Page>
  )
}

// Re-exportamos PAGE para que los consumers puedan calcular el ancho disponible
export const CONTENT_WIDTH = PAGE.width - PAGE.margin.left - PAGE.margin.right
