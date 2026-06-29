import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { FundadoresClient } from './fundadores-client'

export const dynamic = 'force-dynamic'

export default async function FundadoresPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const effective = await getEffectiveRole()
  if (!effective?.consultoraId) redirect('/dashboard')

  const { consultoraId } = effective
  const admin = createAdminClient()

  // Verificar que la sub sea fundadora
  const { data: sub } = await admin
    .from('subscriptions')
    .select('id, is_founder, founder_discount_pct, current_period_end, estado, plans(nombre)')
    .eq('consultora_id', consultoraId)
    .in('estado', ['active', 'trialing'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!sub?.is_founder) redirect('/dashboard/billing')

  const plan = Array.isArray(sub.plans) ? sub.plans[0] : sub.plans

  // Leer bonuses del fundador
  const { data: bonuses } = await admin
    .from('founder_review_bonuses')
    .select('id, tipo, estado, meses_otorgados, url, created_at, verificado_at')
    .eq('subscription_id', sub.id)
    .order('created_at', { ascending: false })

  return (
    <FundadoresClient
      founderDiscountPct={sub.founder_discount_pct ?? 0}
      currentPeriodEnd={
        sub.current_period_end
          ? typeof sub.current_period_end === 'string'
            ? sub.current_period_end
            : (sub.current_period_end as Date).toISOString()
          : null
      }
      planNombre={plan?.nombre ?? null}
      bonuses={(bonuses ?? []).map(b => ({
        id: b.id,
        tipo: b.tipo as 'video' | 'nota',
        estado: b.estado as 'pending' | 'verificado' | 'rechazado',
        mesesOtorgados: b.meses_otorgados,
        url: b.url,
        createdAt: b.created_at,
        verificadoAt: b.verificado_at,
      }))}
    />
  )
}
