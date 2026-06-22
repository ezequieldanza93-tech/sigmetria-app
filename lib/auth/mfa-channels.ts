import { sendMfaCode } from '@/lib/email/mfa'

// ── Canal de MFA enchufable ───────────────────────────────────────────────────
// HOY: email (gratis, ya integrado con Resend). El trabajador tiene email cargado
// en el directorio, así que el segundo factor le llega por mail.
//
// MAÑANA (WhatsApp, sin tocar el resto del código): definí en el entorno
//   WHATSAPP_MFA_ENABLED=true
//   WHATSAPP_PHONE_ID=<phone number id de Meta>
//   WHATSAPP_TOKEN=<token permanente de Meta Business>
//   WHATSAPP_MFA_TEMPLATE=<nombre de la plantilla de autenticación aprobada>  (opcional)
// y el resolver empieza a mandar por WhatsApp a quien tenga teléfono. Es un
// canal pago (Meta cobra por mensaje de autenticación), por eso queda OFF por defecto.

export type MfaChannel = 'email' | 'whatsapp'

export function resolveMfaChannel(opts?: { hasPhone?: boolean }): MfaChannel {
  const whatsappReady =
    process.env.WHATSAPP_MFA_ENABLED === 'true' &&
    !!process.env.WHATSAPP_PHONE_ID &&
    !!process.env.WHATSAPP_TOKEN
  if (whatsappReady && opts?.hasPhone) return 'whatsapp'
  return 'email'
}

export async function sendMfaCodeVia(params: {
  channel: MfaChannel
  code: string
  userName: string
  email?: string | null
  phone?: string | null
}): Promise<void> {
  const { channel, code, userName, email, phone } = params

  if (channel === 'whatsapp') {
    if (!phone) throw new Error('No hay teléfono cargado para enviar el código por WhatsApp')
    await sendMfaWhatsApp({ phone, code, userName })
    return
  }

  if (!email) throw new Error('No hay email para enviar el código de verificación')
  await sendMfaCode({ email, code, userName })
}

// Meta WhatsApp Cloud API. Solo corre si el entorno está configurado; si no,
// falla con un mensaje claro (y el resolver nunca lo elige hasta que esté listo).
async function sendMfaWhatsApp({
  phone,
  code,
}: {
  phone: string
  code: string
  userName: string
}): Promise<void> {
  const phoneId = process.env.WHATSAPP_PHONE_ID
  const token = process.env.WHATSAPP_TOKEN
  const template = process.env.WHATSAPP_MFA_TEMPLATE
  if (!phoneId || !token) {
    throw new Error('WhatsApp MFA no está configurado (falta WHATSAPP_PHONE_ID / WHATSAPP_TOKEN).')
  }

  const to = phone.replace(/\D/g, '')
  const body = template
    ? {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: template,
          language: { code: 'es' },
          components: [
            { type: 'body', parameters: [{ type: 'text', text: code }] },
            { type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: code }] },
          ],
        },
      }
    : {
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: `${code} es tu código de verificación de Sigmetría. Válido por 10 minutos.` },
      }

  const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`WhatsApp Cloud API rechazó el envío (${res.status}): ${detail}`)
  }
}
