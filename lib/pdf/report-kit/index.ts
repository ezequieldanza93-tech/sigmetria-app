/**
 * index.ts — API pública del report-kit
 *
 * Importar desde aquí, no desde los módulos internos:
 *   import { ReportDocument, ReportPage, documentToDataUri } from '@/lib/pdf/report-kit'
 *
 * ── CÓMO COMPONER UN REPORTE ──────────────────────────────────────────────────
 *
 * ```tsx
 * 'use client'
 * import {
 *   ReportDocument,
 *   ReportPage,
 *   ClosingSignature,
 *   PhotoBox,
 *   documentToDataUri,
 *   type ReportContext,
 * } from '@/lib/pdf/report-kit'
 * import { View, Text } from '@react-pdf/renderer'
 *
 * const ctx: ReportContext = {
 *   consultora: { logoUrl: '...', nombre: 'Mi Consultora', cuit: '20-12345678-9' },
 *   empresa: { razonSocial: 'Empresa SA', cuit: '30-98765432-1', logoUrl: '...' },
 *   establecimiento: { nombre: 'Planta Norte', domicilio: 'Calle 123', localidad: 'Rosario' },
 *   profesional: { nombre: 'Juan Pérez', titulo: 'Ing.', matricula: 'COPIME 1234', firmaUrl: '...' },
 *   documento: { titulo: 'Reporte de Inspección', norma: 'Res. SRT 48/2025', fechaEmision: '15/06/2026' },
 * }
 *
 * // Construir el elemento Document (no lo renderices en pantalla)
 * const miDoc = (
 *   <ReportDocument title="Reporte de Inspección" author="Ing. Juan Pérez">
 *     <ReportPage context={ctx}>
 *       <View>
 *         <Text>Contenido del reporte...</Text>
 *       </View>
 *       <PhotoBox src="https://..." fit="cover" width="100%" height={160} caption="Foto 1" />
 *       <ClosingSignature profesional={ctx.profesional} />
 *     </ReportPage>
 *   </ReportDocument>
 * )
 *
 * // Generar el PDF como datauri (compatible con la plomería actual)
 * const pdfDataUri = await documentToDataUri(miDoc)
 *
 * // Enviarlo al server action exactamente como antes
 * const fd = new FormData()
 * fd.set('pdf', pdfDataUri)
 * await miServerAction(fd)
 * ```
 *
 * ── RESTRICCIÓN DE ENTORNO ────────────────────────────────────────────────────
 * Todo lo de este kit corre SOLO en el browser. No importes esto desde
 * server actions ni desde código que se ejecute en el edge/server de Next.js.
 * Usá dynamic import con { ssr: false } si necesitás importarlo en un
 * componente que también tiene lógica de servidor.
 */

// ── Componentes React ─────────────────────────────────────────────────────────
export { ReportDocument } from './ReportDocument'
export { ReportPage, CONTENT_WIDTH } from './ReportPage'
export { ReportHeader } from './ReportHeader'
export { ReportFooter } from './ReportFooter'
export { Watermark } from './Watermark'
export { ClosingSignature } from './ClosingSignature'
export { PhotoBox } from './PhotoBox'

// ── Helpers de render ─────────────────────────────────────────────────────────
export { documentToBlob, documentToDataUri, documentToObjectUrl } from './render'

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type {
  ReportContext,
  BrandingConsultora,
  BrandingEmpresa,
  BrandingEstablecimiento,
  BrandingProfesional,
  BrandingDocumento,
  ReportDocumentProps,
  ReportPageProps,
  PhotoBoxProps,
  ClosingSignatureProps,
  WatermarkProps,
} from './types'

// ── Tokens (para consumers que necesiten extender estilos) ───────────────────
export { COLORS, FONTS, FONT_SIZES, FONT_WEIGHTS, SPACING, PAGE, BANDS } from './tokens'
