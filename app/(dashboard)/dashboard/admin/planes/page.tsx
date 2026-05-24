import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PlanListClient } from './plan-list-client'

export const dynamic = 'force-dynamic'

export default async function AdminPlanesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) redirect('/dashboard')

  const admin = createAdminClient()

  const [plansResult, featuresResult, subsResult] = await Promise.all([
    admin.from('plans').select('*').order('sort_order', { ascending: true }),
    admin.from('plan_features').select('*'),
    admin.from('subscriptions').select('plan_id, id, estado').eq('estado', 'active'),
  ])

  const plans = plansResult.data ?? []
  const features = featuresResult.data ?? []
  const activeSubs = subsResult.data ?? []

  const featuresByPlan = new Map<string, typeof features>()
  for (const f of features) {
    const existing = featuresByPlan.get(f.plan_id) ?? []
    existing.push(f)
    featuresByPlan.set(f.plan_id, existing)
  }

  const subCountByPlan = new Map<string, number>()
  for (const s of activeSubs) {
    subCountByPlan.set(s.plan_id, (subCountByPlan.get(s.plan_id) ?? 0) + 1)
  }

  const plansWithMeta = plans.map(p => ({
    ...p,
    plan_features: featuresByPlan.get(p.id) ?? [],
    subscriber_count: subCountByPlan.get(p.id) ?? 0,
  }))

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-tertiary mb-1">
            <Link href="/dashboard/admin" className="hover:text-text-primary transition-colors">Admin</Link>
            <span>/</span>
            <span className="text-text-primary">Planes</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Gestión de Planes</h1>
          <p className="text-sm text-text-tertiary mt-1">{plans.length} planes en total</p>
        </div>
        <Link
          href="/dashboard/admin/planes/nuevo"
          className="px-4 py-2 bg-brand-primary text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          + Nuevo Plan
        </Link>
      </div>

      <PlanListClient plans={plansWithMeta} />
    </div>
  )
}
