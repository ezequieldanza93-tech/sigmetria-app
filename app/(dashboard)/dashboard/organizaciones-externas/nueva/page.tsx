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
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Organizaciones Externas
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Nueva Organización Externa</h1>
        <p className="text-sm text-gray-500 mt-1">
          Seleccioná el tipo para ver los campos que corresponden.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <OrganizacionExternaForm action={createOrganizacionExterna} />
      </div>
    </div>
  )
}
