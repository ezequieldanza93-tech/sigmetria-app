import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OrganizacionExternaForm } from '@/components/forms/organizacion-externa-form'
import { createOrganizacionExterna } from '@/lib/actions/organizacion'

export default async function NuevaOrganizacionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/dashboard/organizaciones-externas"
          className="text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          ← Organizaciones Externas
        </Link>
        <h1 className="text-2xl font-bold text-text-primary mt-2">Nueva Organización Externa</h1>
        <p className="text-sm text-text-secondary mt-1">
          Seleccioná el tipo para ver los campos que corresponden.
        </p>
      </div>

      <div className="bg-surface-base rounded-xl border border-border-subtle p-6">
        <OrganizacionExternaForm action={createOrganizacionExterna} />
      </div>
    </div>
  )
}
