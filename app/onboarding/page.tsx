import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
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

  // Planes para el selector (catálogo) — service client para no depender de RLS.
  const service = createServiceClient()
  const { data: planes } = await service
    .from('plans')
    .select('id, nombre, slug, tipo, precio_mensual_neto, max_colaboradores, max_empresas, max_establecimientos, descripcion_corta')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true, nullsFirst: true })

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? null
  return <OnboardingWizard userEmail={user.email ?? ''} fullName={fullName} planes={planes ?? []} />
}
