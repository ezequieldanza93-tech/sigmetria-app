import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import type { UserRole, SystemRole } from '@/lib/types'
import type { FinConfig } from '@/lib/finanzas/types'
import { FIN_LOCALE_DEFAULT, FIN_MONEDA_DEFAULT } from '@/lib/finanzas/format'

/**
 * Roles con acceso al módulo Finanzas. Solo el admin main de la consultora
 * (full_access_main) — ni siquiera full_access_branch. developer/super_admin
 * bypassean (ver canAccessFinanzas / getFinanzasAccess).
 */
export const FINANZAS_ROLES: UserRole[] = ['full_access_main']

const FINANZAS_FEATURE_KEY = 'finanzas'

export function canAccessFinanzas(
  role: UserRole | null | undefined,
  systemRole?: SystemRole | null,
): boolean {
  if (systemRole === 'developer') return true
  return role != null && FINANZAS_ROLES.includes(role)
}

export interface FinanzasAccess {
  userId: string | null
  consultoraId: string | null
  role: UserRole | null
  systemRole: SystemRole
  /** true solo si pasa el gate de rol Y el plan tiene 'finanzas' habilitado. */
  hasAccess: boolean
}

/**
 * Resuelve el acceso al módulo Finanzas en server:
 *  1. consultoraId + rol efectivo (vía getEffectiveRole)
 *  2. gate de rol full_access (o developer)
 *  3. gate de plan: subscriptions(plan_id) → plan_features('finanzas', habilitado)
 *
 * developer y super_admin bypassean el gate de plan (siguen necesitando
 * consultoraId para el scope; si no lo tienen, hasAccess = false).
 */
export async function getFinanzasAccess(): Promise<FinanzasAccess> {
  const eff = await getEffectiveRole()
  if (!eff) {
    return { userId: null, consultoraId: null, role: null, systemRole: 'user', hasAccess: false }
  }

  const base: FinanzasAccess = {
    userId: eff.userId,
    consultoraId: eff.consultoraId,
    role: eff.effectiveUserRole,
    systemRole: eff.effectiveSystemRole,
    hasAccess: false,
  }

  // Gate de rol.
  if (!canAccessFinanzas(eff.effectiveUserRole, eff.effectiveSystemRole)) {
    return base
  }
  if (!eff.consultoraId) return base

  // developer / super_admin: bypass del gate de plan.
  if (eff.effectiveSystemRole === 'developer' || eff.isSuperAdmin) {
    return { ...base, hasAccess: true }
  }

  // Gate de plan: la suscripción de la consultora debe tener 'finanzas' habilitado.
  const supabase = await createClient()
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan_id')
    .eq('consultora_id', eff.consultoraId)
    .maybeSingle()

  if (!sub?.plan_id) return base

  const { data: feature } = await supabase
    .from('plan_features')
    .select('habilitado')
    .eq('plan_id', sub.plan_id)
    .eq('feature_key', FINANZAS_FEATURE_KEY)
    .maybeSingle()

  return { ...base, hasAccess: feature?.habilitado === true }
}

/**
 * Trae la fila fin_config de la consultora. Si no existe, devuelve defaults
 * (es-AR / ARS / IVA 21) sin tocar la base — la creación real la hace
 * upsertFinConfig.
 */
export async function getFinConfig(consultoraId: string): Promise<FinConfig> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fin_config')
    .select(
      'consultora_id, pais, locale, moneda, iva_tasa, costo_km, costo_hora, vida_util_meses_def, updated_at',
    )
    .eq('consultora_id', consultoraId)
    .maybeSingle()

  if (data) return data as unknown as FinConfig

  return {
    consultora_id: consultoraId,
    pais: 'AR',
    locale: FIN_LOCALE_DEFAULT,
    moneda: FIN_MONEDA_DEFAULT,
    iva_tasa: 21,
    costo_km: null,
    costo_hora: null,
    vida_util_meses_def: 36,
    updated_at: new Date().toISOString(),
  }
}
