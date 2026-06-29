/**
 * Email de notificación de pago fallido / suscripción en past_due.
 *
 * Best-effort: si RESEND_API_KEY no está, omite el envío sin romper el flujo.
 */

import { Resend } from 'resend'
import { EMAIL_FROM as FROM } from '@/lib/email/from'

export interface PagoFallidoEmailInput {
  email: string
  nombre: string | null
  graceUntil: string | null
}

export async function sendPagoFallidoEmail(input: PagoFallidoEmailInput): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[PagoFallido] RESEND_API_KEY no configurado — email omitido')
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.sigmetria.com.ar'
  const resend = new Resend(process.env.RESEND_API_KEY)

  const saludo = input.nombre ? `Hola ${input.nombre}` : 'Hola'

  const graceHtml = input.graceUntil
    ? (() => {
        const fecha = new Date(input.graceUntil).toLocaleDateString('es-AR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        return `<p style="color:#6b7280;font-size:14px;margin:0 0 16px">
          Tenés acceso hasta el <strong>${fecha}</strong> para actualizar tu método de pago.
        </p>`
      })()
    : `<p style="color:#6b7280;font-size:14px;margin:0 0 16px">
        Actualizá tu método de pago para no perder el acceso.
      </p>`

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-size:20px;margin:0 0 8px">
        Hubo un problema con tu pago
      </h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 16px">
        ${saludo}, no pudimos procesar tu último pago en Sigmetría HyS.
      </p>
      ${graceHtml}

      <div style="text-align:center;margin-bottom:24px">
        <a href="${appUrl}/dashboard/billing"
           style="display:inline-block;background:#111827;color:#fff;text-decoration:none;
                  font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px">
          Actualizar método de pago
        </a>
      </div>

      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px">
        Si ya actualizaste tu método de pago, podés ignorar este mensaje.
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
    subject: 'Hubo un problema con tu pago en Sigmetría',
    html,
  })
}
