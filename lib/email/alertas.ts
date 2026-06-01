import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = 'Sigmetría Alertas <alertas@sigmetria.com.ar>'

const TIPO_LABELS: Record<string, string> = {
  documento_vencido: 'Documento vencido',
  siniestro_sin_cerrar: 'Incidente sin cerrar',
  riesgo_critico_activo: 'Riesgo crítico activo',
  documento_por_vencer: 'Documento por vencer',
  siniestro_sin_investigar: 'Incidente sin investigar',
  capacitacion_no_realizada: 'Capacitación no realizada',
}

interface AlertaEmail {
  tipo: string
  mensaje: string
  empresa_nombre: string
}

export async function sendAlertasCriticalEmail({
  consultoraNombre,
  emails,
  alertas,
}: {
  consultoraNombre: string
  emails: string[]
  alertas: AlertaEmail[]
}) {
  if (!emails.length || !alertas.length) return
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurado — email omitido')
    return
  }

  const count = alertas.length
  const subject = `[Sigmetría] ${count} alerta${count !== 1 ? 's' : ''} crítica${count !== 1 ? 's' : ''} en ${consultoraNombre}`

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.sigmetria.com.ar'

  const htmlItems = alertas
    .map(a =>
      `<li style="margin-bottom:8px">
        <strong style="color:#dc2626">${TIPO_LABELS[a.tipo] ?? a.tipo}</strong>: ${a.mensaje}
        <span style="color:#9ca3af"> (${a.empresa_nombre})</span>
      </li>`
    )
    .join('')

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px">
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px 20px;margin-bottom:24px">
        <h2 style="color:#dc2626;margin:0 0 4px">⚠️ ${count} alerta${count !== 1 ? 's' : ''} crítica${count !== 1 ? 's' : ''}</h2>
        <p style="color:#7f1d1d;margin:0;font-size:14px">${consultoraNombre}</p>
      </div>

      <p style="color:#374151">Se detectaron las siguientes situaciones que requieren atención inmediata:</p>

      <ul style="color:#374151;line-height:1.8;padding-left:20px">
        ${htmlItems}
      </ul>

      <div style="margin-top:24px">
        <a
          href="${appUrl}/dashboard/alertas"
          style="display:inline-block;background:#2563eb;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;font-size:14px"
        >
          Ver todas las alertas →
        </a>
      </div>

      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px">
      <p style="color:#9ca3af;font-size:12px;margin:0">
        Generado automáticamente por Sigmetría · Res. SRT 48/2025 Art. 4.9<br>
        Para dejar de recibir estos correos, contactá al administrador de tu cuenta.
      </p>
    </div>
  `

  await resend.emails.send({ from: FROM, to: emails, subject, html })
}
