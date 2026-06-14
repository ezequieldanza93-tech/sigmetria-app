import { Resend } from 'resend'
import { EMAIL_FROM as FROM } from '@/lib/email/from'

export interface PurgaEmailItem {
  tablaLabel: string
  nombre: string
  contexto: string | null
  diasRestantes: number
}

/**
 * Aviso por email a los admins: estos registros de la papelera se vuelven NO
 * recuperables en ~72hs (cumplen 90 días borrados). Mismo patrón defensivo que
 * sendAlertasCriticalEmail (lazy init de Resend, omite si falta RESEND_API_KEY).
 */
export async function sendPapeleraPurgaEmail({
  consultoraNombre,
  emails,
  items,
}: {
  consultoraNombre: string
  emails: string[]
  items: PurgaEmailItem[]
}): Promise<void> {
  if (!emails.length || !items.length) return
  if (!process.env.RESEND_API_KEY) {
    // Lanzamos (no return silencioso): el caller NO debe marcar purga_aviso_at si
    // el email no salió, para reintentar cuando la key esté configurada.
    throw new Error('RESEND_API_KEY no configurado — no se pudo enviar el aviso de purga')
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.sigmetria.com.ar'
  const n = items.length
  const minDias = Math.min(...items.map(i => i.diasRestantes))
  const plazo = minDias <= 0 ? 'hoy' : `en ${minDias} día${minDias !== 1 ? 's' : ''}`
  const subject = `[Sigmetría] ${n} elemento${n !== 1 ? 's' : ''} de la papelera se ${n !== 1 ? 'eliminan' : 'elimina'} ${plazo}`

  const filas = items
    .map(it =>
      `<li style="margin-bottom:6px">
        <strong>${it.tablaLabel}:</strong> ${it.nombre}
        ${it.contexto ? `<span style="color:#9ca3af"> (${it.contexto})</span>` : ''}
        <span style="color:#dc2626"> — quedan ${it.diasRestantes} día${it.diasRestantes !== 1 ? 's' : ''}</span>
      </li>`,
    )
    .join('')

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <h2 style="color:#b45309;margin:0 0 4px">🗑️ Papelera — eliminación definitiva en 72hs</h2>
        <p style="color:#92400e;margin:0;font-size:14px">${consultoraNombre}</p>
      </div>
      <p style="color:#374151">Los siguientes elementos cumplen 90 días en la papelera y van a dejar de poder restaurarse. Si querés conservarlos, restauralos antes:</p>
      <ul style="color:#374151;line-height:1.7;padding-left:20px">${filas}</ul>
      <div style="margin-top:24px">
        <a href="${appUrl}/dashboard/papelera"
           style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px">
          Ir a la papelera →
        </a>
      </div>
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        Los datos no se borran físicamente (la auditoría se conserva); solo dejan de estar disponibles para restaurar.
      </p>
    </div>
  `

  await resend.emails.send({ from: FROM, to: emails, subject, html })
}
