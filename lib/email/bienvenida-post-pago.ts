/**
 * Email de bienvenida post-pago: se envía cuando la suscripción se activa.
 *
 * Best-effort: si RESEND_API_KEY no está, omite el envío sin romper el flujo.
 */

import { Resend } from 'resend'
import { EMAIL_FROM as FROM } from '@/lib/email/from'

export interface BienvenidaPostPagoInput {
  email: string
  nombre: string | null
  planNombre: string
  isFounder: boolean
  appUrl?: string
}

export async function sendBienvenidaPostPagoEmail(input: BienvenidaPostPagoInput): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[BienvenidaPostPago] RESEND_API_KEY no configurado — email omitido')
    return
  }

  const appUrl = input.appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.sigmetria.com.ar'
  const resend = new Resend(process.env.RESEND_API_KEY)

  const saludo = input.nombre ? `Hola, ${input.nombre}` : 'Hola'

  const founderHtml = input.isFounder
    ? `
      <div style="background:#fefce8;border:1px solid #fde68a;border-radius:8px;padding:12px 16px;margin:0 0 20px">
        <p style="color:#92400e;font-size:14px;margin:0;font-weight:600">
          ⭐ Sos parte del grupo Fundador
        </p>
        <p style="color:#92400e;font-size:13px;margin:6px 0 0">
          Tu descuento del 20% está aplicado de por vida en el plan ${input.planNombre}.
          Gracias por confiar en Sigmetría desde el principio.
        </p>
      </div>`
    : ''

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-size:20px;margin:0 0 8px">
        ${saludo}, tu plan ya está activo.
      </h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 20px">
        Tu plan <strong>${input.planNombre}</strong> en Sigmetría HyS está activo
        y listo para usar. Te contamos los primeros pasos para sacarle el máximo provecho.
      </p>

      ${founderHtml}

      <p style="color:#374151;font-size:14px;font-weight:600;margin:0 0 8px">
        Por dónde arrancar:
      </p>
      <ul style="color:#6b7280;font-size:14px;margin:0 0 24px;padding-left:20px;line-height:1.8">
        <li>Cargá tu primera empresa cliente desde el panel</li>
        <li>Creá un establecimiento dentro de esa empresa</li>
        <li>Completá tu primera gestión y exportá el reporte</li>
      </ul>

      <div style="text-align:center;margin-bottom:24px">
        <a href="${appUrl}/dashboard/empresas"
           style="display:inline-block;background:#111827;color:#fff;text-decoration:none;
                  font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px">
          Ir a mi panel
        </a>
      </div>

      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px">
        Si tenés preguntas, respondé este email o escribinos a hola@sigmetria.com.ar.
      </p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        Sigmetría HyS · Gestión de Higiene y Seguridad
      </p>
    </div>
  `

  await resend.emails.send({
    from: FROM,
    to: input.email,
    subject: `Tu plan ${input.planNombre} ya está activo en Sigmetría`,
    html,
  })
}
