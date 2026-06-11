import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingWizard } from './onboarding-wizard'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Si ya pertenece a una consultora, no necesita onboarding.
  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (membership) redirect('/dashboard/empresas')

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? null
  return <OnboardingWizard userEmail={user.email ?? ''} fullName={fullName} />
}
