'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getUserAndMembership } from '@/lib/auth/require-active-subscription'
import type { ActionResult } from '@/lib/types'

// ─── Tipos ────────────────────────────────────────────────

export interface EstadoFundador {
  esFounder: boolean
  founderDiscountPct: number | null
  ciclo: string
  bonuses: Array<{
    id: string
    tipo: 'video' | 'nota'
    estado: 'pending' | 'verificado' | 'rechazado'
    mesesOtorgados: number
    url: string | null
    creadoAt: string
  }>
}

// ─── getEstadoFundador ────────────────────────────────────

/**
 * Retorna el estado del Programa Fundadores para la consultora del usuario autenticado.
 */
export async function getEstadoFundador(): Promise<ActionResult<EstadoFundador>> {
  try {
    const { membership } = await getUserAndMembership()
    const admin = createAdminClient()

    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, is_founder, founder_discount_pct, ciclo')
      .eq('consultora_id', membership.consultora_id)
      .in('estado', ['trialing', 'active', 'grace_period'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!sub) {
      return {
        success: true,
        data: {
          esFounder: false,
          founderDiscountPct: null,
          ciclo: 'monthly',
          bonuses: [],
        },
      }
    }

    const { data: bonuses } = await admin
      .from('founder_review_bonuses')
      .select('id, tipo, estado, meses_otorgados, url, created_at')
      .eq('subscription_id', sub.id)
      .order('created_at', { ascending: false })

    return {
      success: true,
      data: {
        esFounder: sub.is_founder,
        founderDiscountPct: sub.founder_discount_pct,
        ciclo: sub.ciclo ?? 'monthly',
        bonuses: (bonuses ?? []).map(b => ({
          id: b.id,
          tipo: b.tipo as 'video' | 'nota',
          estado: b.estado as 'pending' | 'verificado' | 'rechazado',
          mesesOtorgados: b.meses_otorgados,
          url: b.url,
          creadoAt: b.created_at,
        })),
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al obtener estado fundador'
    return { success: false, error: message }
  }
}

// ─── solicitarBonus ───────────────────────────────────────

/**
 * Solicita un bonus por reseña (video +3 meses, nota +1 mes).
 * Validaciones:
 * - El usuario debe tener is_founder = true en su suscripción activa.
 * - No puede tener una solicitud 'pending' del mismo tipo.
 */
export async function solicitarBonus(
  tipo: 'video' | 'nota',
  url: string,
): Promise<ActionResult<{ bonusId: string }>> {
  try {
    const { user, membership } = await getUserAndMembership()
    const admin = createAdminClient()

    // Buscar suscripción activa
    const { data: sub } = await admin
      .from('subscriptions')
      .select('id, is_founder')
      .eq('consultora_id', membership.consultora_id)
      .in('estado', ['trialing', 'active', 'grace_period'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (!sub) {
      return { success: false, error: 'No hay suscripción activa' }
    }

    if (!sub.is_founder) {
      return { success: false, error: 'Esta funcionalidad es exclusiva del Programa Fundadores' }
    }

    // Verificar que no haya una solicitud pending del mismo tipo
    const { data: pendingBonus } = await admin
      .from('founder_review_bonuses')
      .select('id')
      .eq('subscription_id', sub.id)
      .eq('tipo', tipo)
      .eq('estado', 'pending')
      .maybeSingle()

    if (pendingBonus) {
      return {
        success: false,
        error: `Ya tenés una solicitud de ${tipo === 'video' ? 'video reseña' : 'reseña escrita'} pendiente de verificación`,
      }
    }

    const mesesOtorgados = tipo === 'video' ? 3 : 1

    const { data: newBonus } = await admin
      .from('founder_review_bonuses')
      .insert({
        subscription_id: sub.id,
        tipo,
        meses_otorgados: mesesOtorgados,
        estado: 'pending',
        url: url || null,
      })
      .select('id')
      .single()

    if (!newBonus) {
      return { success: false, error: 'Error al registrar la solicitud' }
    }

    // Log audit
    await admin.from('subscription_audit_log').insert({
      subscription_id: sub.id,
      estado_nuevo: 'active' as any,
      motivo: `Bonus por reseña solicitado: ${tipo} (+${mesesOtorgados} meses) por ${user.email}`,
      actor_id: user.id,
    })

    return { success: true, data: { bonusId: newBonus.id } }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al solicitar bonus'
    return { success: false, error: message }
  }
}

// ─── verificarBonus ───────────────────────────────────────

/**
 * ADMIN ONLY: aprueba o rechaza una reseña.
 * Al aprobar: extiende current_period_end (+3 meses para video, +1 mes para nota).
 * Registra en subscription_audit_log.
 */
export async function verificarBonus(
  bonusId: string,
  accion: 'aprobar' | 'rechazar',
): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { success: false, error: 'No autenticado' }

    // Verificar que es super admin (mismo patrón que mercadopago.ts)
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_super_admin) {
      return { success: false, error: 'No autorizado' }
    }

    const admin = createAdminClient()

    // Leer el bonus y su suscripción asociada
    const { data: bonus } = await admin
      .from('founder_review_bonuses')
      .select('id, tipo, meses_otorgados, estado, subscription_id')
      .eq('id', bonusId)
      .single()

    if (!bonus) return { success: false, error: 'Bonus no encontrado' }
    if (bonus.estado !== 'pending') {
      return { success: false, error: `El bonus ya fue ${bonus.estado}` }
    }

    const nuevoEstado = accion === 'aprobar' ? 'verificado' : 'rechazado'

    // Actualizar el bonus
    await admin
      .from('founder_review_bonuses')
      .update({
        estado: nuevoEstado,
        verificado_por: user.id,
        verificado_at: new Date().toISOString(),
      })
      .eq('id', bonusId)

    if (accion === 'aprobar') {
      // Extender current_period_end
      const { data: sub } = await admin
        .from('subscriptions')
        .select('id, current_period_end, estado')
        .eq('id', bonus.subscription_id)
        .single()

      if (sub) {
        const baseDate = sub.current_period_end
          ? new Date(Math.max(Date.now(), new Date(sub.current_period_end).getTime()))
          : new Date()

        const newPeriodEnd = new Date(baseDate)
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + bonus.meses_otorgados)

        await admin
          .from('subscriptions')
          .update({ current_period_end: newPeriodEnd.toISOString() })
          .eq('id', sub.id)

        // Log audit
        await admin.from('subscription_audit_log').insert({
          subscription_id: sub.id,
          estado_anterior: sub.estado,
          estado_nuevo: sub.estado,
          motivo: `Bonus reseña aprobado: ${bonus.tipo} → +${bonus.meses_otorgados} mes(es). Nuevo vencimiento: ${newPeriodEnd.toISOString().split('T')[0]}`,
          actor_id: user.id,
        })
      }
    } else {
      // Rechazado: solo log
      const { data: sub } = await admin
        .from('subscriptions')
        .select('id, estado')
        .eq('id', bonus.subscription_id)
        .single()

      if (sub) {
        await admin.from('subscription_audit_log').insert({
          subscription_id: sub.id,
          estado_anterior: sub.estado,
          estado_nuevo: sub.estado,
          motivo: `Bonus reseña rechazado: ${bonus.tipo}`,
          actor_id: user.id,
        })
      }
    }

    return { success: true, data: undefined }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al verificar bonus'
    return { success: false, error: message }
  }
}
