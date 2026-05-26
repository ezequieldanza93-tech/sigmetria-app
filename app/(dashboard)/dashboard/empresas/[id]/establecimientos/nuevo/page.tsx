import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canWrite, UserRole } from '@/lib/types'
import { EstablecimientoForm } from '@/components/forms/establecimiento-form'
import { createEstablecimiento } from '@/lib/actions/establecimiento'

interface Props {
  params: Promise<{ id: string }>
}

export default async function NuevoEstablecimientoPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }, { data: empresa }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
    supabase.from('empresas').select('razon_social').eq('id', id).single(),
  ])

  if (!empresa) notFound()

  if (!canWrite(membership?.role as UserRole ?? null, profile?.system_role ?? 'user')) {
    redirect(`/dashboard/empresas/${id}`)
  }

  const createAction = createEstablecimiento.bind(null, id)

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
          <Link href="/dashboard/empresas" className="hover:text-text-primary">Empresas</Link>
          <span>/</span>
          <Link href={`/dashboard/empresas/${id}`} className="hover:text-text-primary">{empresa.razon_social}</Link>
          <span>/</span>
          <span className="text-text-primary">Nuevo Establecimiento</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Nuevo Establecimiento</h1>
        <p className="text-text-secondary text-sm mt-1">
          Se crearán automáticamente los 11 sectores predefinidos al guardar.
        </p>
      </div>

      <div className="bg-surface-base rounded-xl border border-border-subtle p-6">
        <EstablecimientoForm action={createAction} submitLabel="Crear Establecimiento" />
      </div>
    </div>
  )
}
