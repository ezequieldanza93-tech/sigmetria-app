import { Resend } from 'resend'

const FROM = 'Sigmetría Seguridad <seguridad@sigmetria.com.ar>'

export async function sendEmailChangeCode({
  email,
  code,
  userName,
}: {
  email: string
  code: string
  userName: string
}) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[EmailChange] RESEND_API_KEY no configurado — email omitido')
    return
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const digits = code.split('').join(' ')

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
      <h2 style="color:#111827;font-size:20px;margin:0 0 8px">
        Confirmá tu nuevo email
      </h2>
      <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
        Hola ${userName}, el administrador de tu consultora solicitó cambiar el email de tu cuenta de Sigmetría
        a esta dirección. Ingresá este código para confirmar que el correo es tuyo.
      </p>

      <div style="background:#f3f4f6;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
        <p style="color:#111827;font-size:36px;font-weight:700;letter-spacing:12px;margin:0;font-family:monospace">
          ${digits}
        </p>
        <p style="color:#9ca3af;font-size:12px;margin:12px 0 0">
          Válido por 15 minutos
        </p>
      </div>

      <p style="color:#6b7280;font-size:13px;margin:0 0 4px">
        Si no esperabas este cambio, ignorá este email y avisale al administrador de tu consultora.
      </p>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0 16px">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        Sigmetría HyS · Verificación de cambio de email
      </p>
    </div>
  `

  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `${code} es tu código para confirmar tu email en Sigmetría`,
    html,
  })
}
