import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { canWrite, UserRole } from '@/lib/types'
import { EmpresaForm } from '@/components/forms/empresa-form'
import { createEmpresa } from '@/lib/actions/empresa'
import Link from 'next/link'

export default async function NuevaEmpresaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultora_members').select('role').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
  ])

  if (!canWrite(membership?.role as UserRole ?? null, profile?.system_role ?? 'user')) {
    redirect('/dashboard/empresas')
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/dashboard/empresas" className="hover:text-gray-900">Empresas</Link>
          <span>/</span>
          <span className="text-gray-900">Nueva</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Nueva Empresa</h1>
        <p className="text-gray-500 text-sm mt-1">Completá los datos de la empresa cliente</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <EmpresaForm action={createEmpresa} submitLabel="Crear Empresa" />
      </div>
    </div>
  )
}
