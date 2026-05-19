import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canWrite, UserRole } from '@/lib/types'
import { EstablecimientoForm } from '@/components/forms/establecimiento-form'
import { updateEstablecimiento } from '@/lib/actions/establecimiento'

interface Props {
  params: Promise<{ id: string; estId: string }>
}

export default async function EditarEstablecimientoPage({ params }: Props) {
  const { id, estId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }, { data: establecimiento }, { data: empresa }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('establecimientos').select('*').eq('id', estId).single(),
    supabase.from('empresas').select('razon_social').eq('id', id).single(),
  ])

  if (!establecimiento || !empresa) notFound()

  if (!canWrite(membership?.role as UserRole ?? null, profile?.system_role ?? 'user')) {
    redirect(`/dashboard/empresas/${id}/establecimientos/${estId}`)
  }

  const updateAction = updateEstablecimiento.bind(null, estId, id)

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/dashboard/empresas" className="hover:text-gray-900">Empresas</Link>
          <span>/</span>
          <Link href={`/dashboard/empresas/${id}`} className="hover:text-gray-900">{empresa.razon_social}</Link>
          <span>/</span>
          <Link href={`/dashboard/empresas/${id}/establecimientos/${estId}`} className="hover:text-gray-900">
            {establecimiento.nombre}
          </Link>
          <span>/</span>
          <span className="text-gray-900">Editar</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Editar Establecimiento</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <EstablecimientoForm
          action={updateAction}
          establecimiento={establecimiento}
          submitLabel="Guardar Cambios"
        />
      </div>
    </div>
  )
}
