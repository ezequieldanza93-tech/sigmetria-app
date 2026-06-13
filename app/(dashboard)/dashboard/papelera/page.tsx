import { redirect } from 'next/navigation'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { PapeleraView } from '@/components/papelera/papelera-view'

export default async function PapeleraPage() {
  const eff = await getEffectiveRole()
  if (!eff) redirect('/login')
  // Solo el admin principal de la consultora (o super admin) accede a la papelera.
  if (eff.effectiveUserRole !== 'full_access_main' && !eff.isSuperAdmin) redirect('/dashboard')

  return (
    <div className="p-6 max-w-4xl">
      <PapeleraView />
    </div>
  )
}
