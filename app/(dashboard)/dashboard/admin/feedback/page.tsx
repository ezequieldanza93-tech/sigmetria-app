import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MessageSquare } from 'lucide-react'
import { AdminNpsStats } from '@/components/feedback/admin-nps-stats'
import { AdminNpsTrendChart } from '@/components/feedback/admin-nps-trend-chart'
import { AdminFeedbackTabs } from '@/components/feedback/admin-feedback-tabs'

export default async function AdminFeedbackPage() {
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
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <MessageSquare size={24} className="text-brand-primary" />
        <div>
          <h1 className="text-xl font-bold text-text-primary">Feedback — Admin</h1>
          <p className="text-sm text-text-secondary">
            Gestioná los feedbacks y respuestas NPS de los usuarios
          </p>
        </div>
      </div>

      {/* KPIs */}
      <AdminNpsStats />

      {/* Trend chart */}
      <AdminNpsTrendChart />

      {/* Tabs con tablas */}
      <AdminFeedbackTabs />
    </div>
  )
}
