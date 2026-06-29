import { createServiceClient } from '@/lib/supabase/service'

export interface SubscriptionUsage {
  empresas: { usado: number; limite: number | null }
  establecimientos: { usado: number; limite: number | null }
  colaboradores: { usado: number; limite: number | null }
  gestiones: { usado: number; limite: number | null }
  plan: { nombre: string; precio_mensual_neto: number | null }
  estado: string
  trialEndsAt: string | null
  pastDueGraceUntil: string | null
}

export async function getSubscriptionUsage(consultoraId: string): Promise<SubscriptionUsage | null> {
  const supabase = createServiceClient()

  const { data: sub } = await supabase
    .from('subscriptions')
    .select(`
      estado,
      trial_ends_at,
      past_due_grace_until,
      plans (
        nombre,
        precio_mensual_neto,
        max_empresas,
        max_establecimientos,
        max_colaboradores,
        max_gestiones_registros
      )
    `)
    .eq('consultora_id', consultoraId)
    .in('estado', ['active', 'trialing', 'past_due'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!sub) return null

  const plan = Array.isArray(sub.plans) ? sub.plans[0] : sub.plans

  // Contar empresas activas
  const { count: empresasCount } = await supabase
    .from('empresas')
    .select('*', { count: 'exact', head: true })
    .eq('consultora_id', consultoraId)
    .is('deleted_at', null)

  // Contar establecimientos: primero IDs de empresas activas, luego establecimientos de esas empresas
  const { data: empresasActivas } = await supabase
    .from('empresas')
    .select('id')
    .eq('consultora_id', consultoraId)
    .is('deleted_at', null)

  const empresaIds = (empresasActivas ?? []).map(e => e.id)

  let establecimientosCount = 0
  if (empresaIds.length > 0) {
    const { count } = await supabase
      .from('establecimientos')
      .select('*', { count: 'exact', head: true })
      .in('empresa_id', empresaIds)
      .is('deleted_at', null)
    establecimientosCount = count ?? 0
  }

  const { count: colaboradoresCount } = await supabase
    .from('consultoras_members')
    .select('*', { count: 'exact', head: true })
    .eq('consultora_id', consultoraId)
    .eq('is_active', true)

  return {
    empresas: {
      usado: (empresasCount ?? 0),
      limite: plan?.max_empresas ?? null,
    },
    establecimientos: {
      usado: establecimientosCount,
      limite: plan?.max_establecimientos ?? null,
    },
    colaboradores: {
      usado: (colaboradoresCount ?? 0),
      limite: plan?.max_colaboradores ?? null,
    },
    gestiones: {
      usado: 0, // calculado on-demand si se necesita en el futuro
      limite: plan?.max_gestiones_registros ?? null,
    },
    plan: {
      nombre: plan?.nombre ?? '',
      precio_mensual_neto: plan?.precio_mensual_neto ?? null,
    },
    estado: sub.estado as string,
    trialEndsAt: sub.trial_ends_at
      ? typeof sub.trial_ends_at === 'string'
        ? sub.trial_ends_at
        : (sub.trial_ends_at as Date).toISOString()
      : null,
    pastDueGraceUntil: sub.past_due_grace_until
      ? typeof sub.past_due_grace_until === 'string'
        ? sub.past_due_grace_until
        : (sub.past_due_grace_until as Date).toISOString()
      : null,
  }
}
