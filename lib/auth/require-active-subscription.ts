import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export interface SubscriptionGateResult {
  hasActiveSubscription: boolean
  hasGracePeriod: boolean
  estado: string | null
  error?: string
}

/**
 * Verifica que la consultora del usuario tenga una suscripción activa
 * (active o trialing) o esté en grace period (past_due dentro de 7 días).
 */
export async function checkSubscriptionGate(
  consultoraId: string,
): Promise<SubscriptionGateResult> {
  const admin = createAdminClient()

  const { data: sub } = await admin
    .from('subscriptions')
    .select('estado, past_due_grace_until')
    .eq('consultora_id', consultoraId)
    .single()

  if (!sub) {
    return {
      hasActiveSubscription: false,
      hasGracePeriod: false,
      estado: null,
      error: 'No hay suscripción activa',
    }
  }

  const estado = sub.estado
  const hasActive = estado === 'active' || estado === 'trialing'
  const hasGrace = estado === 'past_due' && sub.past_due_grace_until
    ? new Date(sub.past_due_grace_until) > new Date()
    : false

  return {
    hasActiveSubscription: hasActive,
    hasGracePeriod: hasGrace,
    estado,
  }
}

/**
 * Helper para usar en server actions.
 * Lanza error si no hay suscripción activa (ni grace period).
 */
export async function requireActiveSubscription(consultoraId: string): Promise<void> {
  const gate = await checkSubscriptionGate(consultoraId)
  if (!gate.hasActiveSubscription && !gate.hasGracePeriod) {
    throw new Error(gate.error ?? 'No hay suscripción activa')
  }
}

/**
 * Helper para obtener el user y su membership.
 */
export async function getUserAndMembership() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) throw new Error('No pertenecés a ninguna consultora')

  return { user, membership, supabase }
}

/**
 * Verifica que el usuario sea full_access_main o super_admin de la consultora.
 */
export async function requireMainAdmin(consultoraId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (profile?.is_super_admin) return // super_admin bypass

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('role')
    .eq('user_id', user.id)
    .eq('consultora_id', consultoraId)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership || membership.role !== 'full_access_main') {
    throw new Error('Solo el Admin Principal puede realizar esta acción')
  }
}
