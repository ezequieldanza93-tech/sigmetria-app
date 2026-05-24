import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updatePlan } from '@/lib/actions/admin/plan'
import { PlanForm } from '../../plan-form'

export default async function EditarPlanPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

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

  const [planResult, featuresResult] = await Promise.all([
    admin.from('plans').select('*').eq('id', id).single(),
    admin.from('plan_features').select('*').eq('plan_id', id),
  ])

  if (!planResult.data) notFound()

  const plan = planResult.data
  const planFeatures = featuresResult.data ?? []

  async function editAction(prev: { success: boolean; error: string } | null, formData: FormData) {
    'use server'
    return updatePlan(id, prev, formData)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-tertiary mb-1">
        <Link href="/dashboard/admin" className="hover:text-text-primary transition-colors">Admin</Link>
        <span>/</span>
        <Link href="/dashboard/admin/planes" className="hover:text-text-primary transition-colors">Planes</Link>
        <span>/</span>
        <Link href={`/dashboard/admin/planes/${id}`} className="hover:text-text-primary transition-colors">{plan.nombre}</Link>
        <span>/</span>
        <span className="text-text-primary">Editar</span>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">Editar: {plan.nombre}</h1>
      <PlanForm
        mode="edit"
        plan={plan}
        planFeatures={planFeatures}
        action={editAction}
      />
    </div>
  )
}
