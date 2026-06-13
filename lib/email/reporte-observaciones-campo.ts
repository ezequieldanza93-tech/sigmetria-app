import { Resend } from 'resend'
import { EMAIL_FROM as FROM } from '@/lib/email/from'

interface ReporteObsCampoEmailInput {
  to: string[]
  cliente: string
  establecimiento: string
  periodoLabel: string
  comentario?: string
  /** PDF en base64 PURO (sin el prefijo data:). */
  pdfBase64: string
  pdfFilename: string
  /** Signed URL del PDF para verlo online (opcional, se incluye como botón). */
  pdfUrl: string | null
}

/**
 * Envía el Reporte de Observaciones de Campo por email (Resend) con el PDF adjunto
 * y, si está disponible, un botón al link firmado.
 *
 * Mismo patrón defensivo que sendAlertasCriticalEmail: si falta RESEND_API_KEY se
 * omite el envío (no rompe el build ni el flujo). El cliente de Resend se instancia
 * DENTRO del handler — nunca a nivel de módulo (rompería `next build`).
 */
export async function sendReporteObservacionesCampoEmail({
  to,
  cliente,
  establecimiento,
  periodoLabel,
  comentario,
  pdfBase64,
  pdfFilename,
  pdfUrl,
}: ReporteObsCampoEmailInput): Promise<void> {
  if (!to.length) return
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado — email de reporte de observaciones omitido')
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  const subject = `[Sigmetría] Reporte de observaciones de campo — ${establecimiento} (${periodoLabel})`

  const linkBtn = pdfUrl
    ? `<div style="margin-top:24px">
         <a href="${pdfUrl}"
            style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
           Ver el reporte en línea →
         </a>
       </div>`
    : ''

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="border:1px solid #e5e7eb;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <h2 style="color:#111827;margin:0 0 4px">Reporte de observaciones de campo</h2>
        <p style="color:#374151;margin:0;font-size:14px"><strong>${cliente}</strong> · ${establecimiento}</p>
        <p style="color:#6b7280;margin:4px 0 0;font-size:13px">${periodoLabel}</p>
      </div>

      <p style="color:#374151">Adjuntamos el reporte de observaciones de campo del período indicado en formato PDF.</p>
      ${comentario ? `<p style="color:#374151;background:#f9fafb;border-left:3px solid #d1d5db;padding:8px 12px;font-style:italic">${comentario}</p>` : ''}
      ${linkBtn}

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        Generado por Sigmetría · Sistema de gestión de Higiene y Seguridad.
      </p>
    </div>
  `

  await resend.emails.send({
    from: FROM,
    to,
    subject,
    html,
    attachments: [{ filename: pdfFilename, content: pdfBase64 }],
  })
}
