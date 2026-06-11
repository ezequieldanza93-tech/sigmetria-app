/**
 * Email de aviso "tu export está listo" con el SIGNED URL temporal
 * (Res. SRT 48/2025 — portabilidad, entrega del paquete por link).
 *
 * Best-effort: si RESEND_API_KEY no está, se omite el envío (no rompe el flujo).
 */

import { Resend } from 'resend'

const FROM = 'Sigmetría Seguridad <seguridad@sigmetria.com.ar>'

export interface ExportListoEmailInput {
  email: string
  /** Nombre de quien recibe (para el saludo). */
  userName?: string | null
  empresaNombre: string | null
  signedUrl: string
  /** Validez del link en horas (para el copy). */
  ttlHoras: number
  /** Resumen del alcance (ej. "Completo" o "Parcial: 2026-01-01 a 2026-12-31"). */
  alcance: string
}

export async function sendExportListoEmail(input: ExportListoEmailInput): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Export] RESEND_API_KEY no configurado — email de export omitido')
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const empresa = input.empresaNombre ?? 'tu empresa'
  const saludo = input.userName ? `Hola ${input.userName},` : 'Hola,'

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-size:20px;margin:0 0 8px">
        Tu exportación de datos está lista
      </h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 16px">
        ${saludo} ya generamos el paquete de datos de <strong>${empresa}</strong>.
      </p>
      <p style="color:#6b7280;font-size:13px;margin:0 0 24px">
        Alcance: ${input.alcance}.
      </p>

      <div style="text-align:center;margin-bottom:24px">
        <a href="${input.signedUrl}"
           style="display:inline-block;background:#111827;color:#fff;text-decoration:none;
                  font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px">
          Descargar paquete (.zip)
        </a>
      </div>

      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px">
        El enlace es temporal y vence en ${input.ttlHoras} ${input.ttlHoras === 1 ? 'hora' : 'horas'}.
        Si vence, generá la exportación de nuevo desde la app.
      </p>
      <p style="color:#9ca3af;font-size:12px;margin:0 0 16px">
        El paquete incluye tus datos en CSV y JSON, los archivos originales y un
        manifest con verificación de integridad (SHA-256).
      </p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        Sigmetría HyS · Portabilidad de datos (Res. SRT 48/2025)
      </p>
    </div>
  `

  await resend.emails.send({
    from: FROM,
    to: input.email,
    subject: `Tu exportación de datos de ${empresa} está lista`,
    html,
  })
}
