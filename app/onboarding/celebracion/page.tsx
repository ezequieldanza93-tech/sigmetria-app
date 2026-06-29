import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { CelebracionClient } from './celebracion-client'

export default async function CelebracionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Obtener membresía activa
  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) redirect('/dashboard/billing')

  const service = createServiceClient()

  // Suscripción activa con datos del plan
  const { data: sub } = await service
    .from('subscriptions')
    .select('estado, plan_id, is_founder, current_period_end')
    .eq('consultora_id', membership.consultora_id)
    .eq('estado', 'active')
    .maybeSingle()

  if (!sub || !sub.plan_id) redirect('/dashboard/billing')

  // Datos del plan
  const { data: plan } = await service
    .from('plans')
    .select('nombre, precio_mensual_neto, max_empresas, max_establecimientos, max_colaboradores')
    .eq('id', sub.plan_id)
    .single()

  if (!plan) redirect('/dashboard/billing')

  // Features habilitadas del plan
  const { data: featuresRows } = await service
    .from('plan_features')
    .select('feature_key')
    .eq('plan_id', sub.plan_id)
    .eq('habilitado', true)

  const features = (featuresRows ?? []).map((r) => r.feature_key)

  const nombre = (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? null

  return (
    <CelebracionClient
      nombre={nombre}
      planNombre={plan.nombre}
      isFounder={sub.is_founder ?? false}
      features={features}
    />
  )
}
