import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTrialExpiryEmail } from '@/lib/email/trial-expiry'
import { sendPagoFallidoEmail } from '@/lib/email/pago-fallido'

const MOTIVO_TRIAL_EXPIRY_EMAIL = 'cron:trial_expiry_email_sent'
const MOTIVO_PAST_DUE_EMAIL = 'cron:past_due_email_sent'

/**
 * Cron que envía notificaciones de billing:
 * 1. Trial expiry warning (≤3 días restantes)
 * 2. Pago fallido (past_due reciente, primer aviso)
 *
 * NO agregar al dispatcher diario — el orquestador lo conecta manualmente.
 */
export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret) {
    console.error('[notificaciones-billing] CRON_SECRET no configurado')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  const resultados = {
    trial_warnings: { enviados: 0, omitidos: 0, errores: 0 },
    past_due_alerts: { enviados: 0, omitidos: 0, errores: 0 },
  }

  // ─── 1. Trial expiry warning (vence en ≤3 días) ───────────────────────────
  try {
    const { data: trialSubs } = await admin
      .from('subscriptions')
      .select('id, consultora_id, trial_ends_at')
      .eq('estado', 'trialing')
      .not('trial_ends_at', 'is', null)
      .lte('trial_ends_at', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())
      .gte('trial_ends_at', new Date().toISOString())

    for (const sub of trialSubs ?? []) {
      try {
        // Verificar si ya se envió el warning en este ciclo de trial
        const { data: yaEnviado } = await admin
          .from('subscription_audit_log')
          .select('id')
          .eq('subscription_id', sub.id)
          .eq('motivo', MOTIVO_TRIAL_EXPIRY_EMAIL)
          .limit(1)
          .maybeSingle()

        if (yaEnviado) {
          resultados.trial_warnings.omitidos++
          continue
        }

        // Obtener email del admin de la consultora
        const { data: memberRow } = await admin
          .from('consultoras_members')
          .select('user_id')
          .eq('consultora_id', sub.consultora_id)
          .eq('user_role', 'full_access_main')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (!memberRow?.user_id) {
          resultados.trial_warnings.errores++
          continue
        }

        const { data: adminProfile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', memberRow.user_id)
          .single()

        if (!adminProfile?.email) {
          resultados.trial_warnings.errores++
          continue
        }

        const diasRestantes = Math.max(
          1,
          Math.ceil(
            (new Date(sub.trial_ends_at!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          )
        )

        await sendTrialExpiryEmail({
          email: adminProfile.email,
          nombre: adminProfile.full_name,
          diasRestantes,
        })

        // Registrar en audit log para no volver a enviar
        await admin.from('subscription_audit_log').insert({
          subscription_id: sub.id,
          estado_anterior: 'trialing' as any,
          estado_nuevo: 'trialing' as any,
          motivo: MOTIVO_TRIAL_EXPIRY_EMAIL,
        })

        resultados.trial_warnings.enviados++
      } catch (err) {
        console.error(`[notificaciones-billing] trial warning sub ${sub.id}:`, err)
        resultados.trial_warnings.errores++
      }
    }
  } catch (err) {
    console.error('[notificaciones-billing] Error en bloque trial:', err)
  }

  // ─── 2. Pago fallido (past_due recientes, sin email enviado aún) ──────────
  try {
    // Buscar past_due actualizadas en las últimas 24h (webhook reciente)
    const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    const { data: pastDueSubs } = await admin
      .from('subscriptions')
      .select('id, consultora_id, past_due_grace_until')
      .eq('estado', 'past_due')
      .gte('updated_at', hace24h)

    for (const sub of pastDueSubs ?? []) {
      try {
        // Verificar si ya se envió el email de past_due
        const { data: yaEnviado } = await admin
          .from('subscription_audit_log')
          .select('id')
          .eq('subscription_id', sub.id)
          .eq('motivo', MOTIVO_PAST_DUE_EMAIL)
          .limit(1)
          .maybeSingle()

        if (yaEnviado) {
          resultados.past_due_alerts.omitidos++
          continue
        }

        // Obtener el admin de la consultora
        const { data: memberRow } = await admin
          .from('consultoras_members')
          .select('user_id')
          .eq('consultora_id', sub.consultora_id)
          .eq('user_role', 'full_access_main')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (!memberRow?.user_id) {
          resultados.past_due_alerts.errores++
          continue
        }

        const { data: adminProfile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', memberRow.user_id)
          .single()

        if (!adminProfile?.email) {
          resultados.past_due_alerts.errores++
          continue
        }

        await sendPagoFallidoEmail({
          email: adminProfile.email,
          nombre: adminProfile.full_name,
          graceUntil: sub.past_due_grace_until,
        })

        // Registrar en audit log
        await admin.from('subscription_audit_log').insert({
          subscription_id: sub.id,
          estado_anterior: 'past_due' as any,
          estado_nuevo: 'past_due' as any,
          motivo: MOTIVO_PAST_DUE_EMAIL,
        })

        resultados.past_due_alerts.enviados++
      } catch (err) {
        console.error(`[notificaciones-billing] past_due sub ${sub.id}:`, err)
        resultados.past_due_alerts.errores++
      }
    }
  } catch (err) {
    console.error('[notificaciones-billing] Error en bloque past_due:', err)
  }

  return NextResponse.json({ ok: true, resultados })
}
