// Supabase Edge Function — Generación diaria de alertas SRT 48/2025 Art. 4.9
//
// Deployment:
//   supabase functions deploy generar-alertas --no-verify-jwt
//
// Schedule (via Supabase Dashboard > Edge Functions > Triggers):
//   Schedule: 0 6 * * * (todos los días a las 6 AM)
//
// Security: protegido por CRON_SECRET (requerido)
// El caller debe enviar: Authorization: Bearer <CRON_SECRET>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

const TIPO_LABELS: Record<string, string> = {
  documento_por_vencer: 'Documento por vencer',
  documento_vencido: 'Documento vencido',
  siniestro_sin_investigar: 'Incidente sin investigar',
  siniestro_sin_cerrar: 'Incidente sin cerrar',
  capacitacion_no_realizada: 'Capacitación no realizada',
  riesgo_critico_activo: 'Riesgo crítico activo',
}

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  const authHeader = req.headers.get('authorization')

  if (!cronSecret) {
    console.error('CRON_SECRET no configurado')
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL') ?? 'https://app.sigmetria.com.ar'

  const supabase = createClient(supabaseUrl, supabaseKey)

  const { data: consultoras, error: consErr } = await supabase
    .from('consultoras')
    .select('id, nombre, email')
    .eq('is_active', true)

  if (consErr || !consultoras) {
    return new Response(JSON.stringify({ error: 'No se pudo obtener consultoras', detail: consErr?.message }), { status: 500 })
  }

  let totalAlertas = 0
  let emailsEnviados = 0

  for (const consultora of consultoras) {
    // Genera alertas vía función SECURITY DEFINER
    const { data: count, error: genErr } = await supabase
      .rpc('generar_alertas_consultora', { p_consultora_id: consultora.id })

    if (genErr) {
      console.error(`Error generando alertas para ${consultora.id}:`, genErr.message)
      continue
    }

    totalAlertas += count ?? 0

    // Enviar email para alertas críticas si hay Resend configurado
    if (!resendKey) continue

    const { data: criticas } = await supabase
      .from('alertas')
      .select('id, tipo, mensaje, empresas(nombre)')
      .eq('consultora_id', consultora.id)
      .eq('severidad', 'critical')
      .eq('resuelta', false)

    if (!criticas || criticas.length === 0) continue

    // Obtener emails de full_access_main
    const { data: admins } = await supabase
      .from('consultoras_members')
      .select('profiles(email:auth_users(email))')
      .eq('consultora_id', consultora.id)
      .eq('role', 'full_access_main')
      .eq('is_active', true)

    // Obtener emails del auth directamente
    const { data: adminProfiles } = await supabase
      .from('consultoras_members')
      .select('user_id')
      .eq('consultora_id', consultora.id)
      .eq('role', 'full_access_main')
      .eq('is_active', true)

    if (!adminProfiles || adminProfiles.length === 0) {
      void admins
      continue
    }

    const emailList: string[] = []
    for (const ap of adminProfiles) {
      const { data: userData } = await supabase.auth.admin.getUserById(ap.user_id)
      if (userData?.user?.email) emailList.push(userData.user.email)
    }

    if (emailList.length === 0) continue

    const htmlItems = criticas
      .map(a => {
        const empresa = (a.empresas as { nombre: string } | null)?.nombre ?? 'N/A'
        return `<li><strong>${TIPO_LABELS[a.tipo] ?? a.tipo}</strong>: ${a.mensaje} <span style="color:#888">(${empresa})</span></li>`
      })
      .join('')

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#dc2626">⚠️ ${criticas.length} alerta${criticas.length !== 1 ? 's' : ''} crítica${criticas.length !== 1 ? 's' : ''} en ${consultora.nombre}</h2>
        <p>Se detectaron las siguientes situaciones que requieren atención inmediata:</p>
        <ul style="line-height:1.8">${htmlItems}</ul>
        <p>
          <a href="${appUrl}/dashboard/alertas"
             style="display:inline-block;background:#2563eb;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">
            Ver todas las alertas →
          </a>
        </p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0">
        <p style="color:#9ca3af;font-size:12px">
          Generado automáticamente por Sigmetría · Res. SRT 48/2025 Art. 4.9<br>
          Para dejar de recibir estos correos, contactá al administrador de tu cuenta.
        </p>
      </div>
    `

    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Sigmetría Alertas <alertas@sigmetria.com.ar>',
          to: emailList,
          subject: `[Sigmetría] ${criticas.length} alerta${criticas.length !== 1 ? 's' : ''} crítica${criticas.length !== 1 ? 's' : ''} en ${consultora.nombre}`,
          html,
        }),
      })
      emailsEnviados++
    } catch (emailErr) {
      console.error(`Error enviando email para ${consultora.nombre}:`, emailErr)
    }
  }

  return new Response(
    JSON.stringify({ consultoras: consultoras.length, totalAlertas, emailsEnviados }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
