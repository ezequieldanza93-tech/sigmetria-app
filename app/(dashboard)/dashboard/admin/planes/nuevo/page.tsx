import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createPlan } from '@/lib/actions/admin/plan'
import { PlanForm } from '../plan-form'

export default async function NuevoPlanPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) redirect('/dashboard')

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-sm text-text-tertiary mb-1">
        <Link href="/dashboard/admin" className="hover:text-text-primary transition-colors">Admin</Link>
        <span>/</span>
        <Link href="/dashboard/admin/planes" className="hover:text-text-primary transition-colors">Planes</Link>
        <span>/</span>
        <span className="text-text-primary">Nuevo</span>
      </div>
      <h1 className="text-2xl font-bold text-text-primary">Nuevo Plan</h1>
      <PlanForm mode="create" action={createPlan} />
    </div>
  )
}
