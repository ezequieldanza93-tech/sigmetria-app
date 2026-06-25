/**
 * Email de bienvenida para destinatario de un plan regalado por super-admin.
 *
 * Best-effort: si RESEND_API_KEY no está, omite el envío sin romper el flujo.
 */

import { Resend } from 'resend'
import { EMAIL_FROM as FROM } from '@/lib/email/from'

export interface RegaloPlanEmailInput {
  email: string
  planNombre: string
  ciclo: 'monthly' | 'annual'
  isFounder: boolean
  nota?: string | null
}

export async function sendRegaloPlanEmail(input: RegaloPlanEmailInput): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[RegaloPlan] RESEND_API_KEY no configurado — email omitido')
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.sigmetria.com.ar'
  const resend = new Resend(process.env.RESEND_API_KEY)

  const cicloLabel = input.ciclo === 'annual' ? 'anual' : 'mensual'
  const founderBadge = input.isFounder
    ? `<p style="color:#6b7280;font-size:13px;margin:0 0 8px">
        🎉 Entraste como <strong>Fundador/a</strong> — descuento del 20% de por vida.
       </p>`
    : ''
  const notaHtml = input.nota
    ? `<p style="color:#6b7280;font-size:13px;margin:0 0 16px;font-style:italic">"${input.nota}"</p>`
    : ''

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-size:20px;margin:0 0 8px">
        ¡Te regalaron un plan en Sigmetría!
      </h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 16px">
        Hola, te escribimos porque el equipo de Sigmetría HyS te regaló acceso al plan
        <strong>${input.planNombre}</strong> (${cicloLabel}).
      </p>
      ${founderBadge}
      ${notaHtml}
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
        Creá tu cuenta para activar el plan. Es gratis, sin tarjeta requerida.
      </p>

      <div style="text-align:center;margin-bottom:24px">
        <a href="${appUrl}/registro"
           style="display:inline-block;background:#111827;color:#fff;text-decoration:none;
                  font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px">
          Activar mi plan
        </a>
      </div>

      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px">
        Al registrarte con este email (${input.email}), el plan quedará activado automáticamente.
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
    subject: `Te regalaron el plan ${input.planNombre} en Sigmetría`,
    html,
  })
}
