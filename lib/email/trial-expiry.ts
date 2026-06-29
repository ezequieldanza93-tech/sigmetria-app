/**
 * Email de aviso de vencimiento de período de prueba.
 *
 * Best-effort: si RESEND_API_KEY no está, omite el envío sin romper el flujo.
 */

import { Resend } from 'resend'
import { EMAIL_FROM as FROM } from '@/lib/email/from'

export interface TrialExpiryEmailInput {
  email: string
  nombre: string | null
  diasRestantes: number
  planRecomendado?: string | null
}

export async function sendTrialExpiryEmail(input: TrialExpiryEmailInput): Promise<void> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[TrialExpiry] RESEND_API_KEY no configurado — email omitido')
    return
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.sigmetria.com.ar'
  const resend = new Resend(process.env.RESEND_API_KEY)

  const saludo = input.nombre ? `Hola ${input.nombre}` : 'Hola'
  const diasLabel =
    input.diasRestantes === 1 ? '1 día' : `${input.diasRestantes} días`

  const planHtml = input.planRecomendado
    ? `<p style="color:#6b7280;font-size:14px;margin:0 0 16px">
        Te recomendamos el plan <strong>${input.planRecomendado}</strong> para continuar sin interrupciones.
       </p>`
    : ''

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-size:20px;margin:0 0 8px">
        Tu período de prueba vence en ${diasLabel}
      </h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 16px">
        ${saludo}, tu período de prueba en Sigmetría HyS vence en ${diasLabel}.
        Para no perder el acceso a tus datos, elegí un plan.
      </p>
      ${planHtml}

      <div style="text-align:center;margin-bottom:24px">
        <a href="${appUrl}/dashboard/billing"
           style="display:inline-block;background:#111827;color:#fff;text-decoration:none;
                  font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px">
          Ver planes
        </a>
      </div>

      <p style="color:#9ca3af;font-size:12px;margin:0 0 4px">
        Si ya elegiste un plan, podés ignorar este mensaje.
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
    subject: `Tu período de prueba vence en ${diasLabel}`,
    html,
  })
}
