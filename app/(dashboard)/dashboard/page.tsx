import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { EmpresasList } from '@/components/empresas-list'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  const consultoraId = membership?.consultora_id ?? null

  let establecimientos: { id: string; nombre: string }[] = []
  if (consultoraId) {
    const { data } = await supabase
      .from('establecimientos')
      .select('id, nombre, empresas!inner(consultora_id)')
      .eq('empresas.consultora_id', consultoraId)
      .neq('status', 'cancelled')
      .order('nombre')
    establecimientos = (data ?? []).map(e => ({ id: e.id, nombre: e.nombre }))
  }

  return (
    <DashboardShell
      consultoraId={consultoraId}
      establecimientos={establecimientos}
      empresasContent={<EmpresasList />}
    />
  )
}
