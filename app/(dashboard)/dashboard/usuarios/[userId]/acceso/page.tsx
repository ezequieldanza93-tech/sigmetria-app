import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { canManageUsers, UserRole } from '@/lib/types'
import { AccessAssignment } from '@/components/access-assignment'
import type { Empresa, Establecimiento } from '@/lib/types'

interface Props {
  params: Promise<{ userId: string }>
}

interface EmpresaConEstablecimientos extends Empresa {
  establecimientos: Establecimiento[]
}

export default async function UserAccesoPage({ params }: Props) {
  const { userId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role, consultora_id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
  ])

  if (!canManageUsers(membership?.role as UserRole ?? null, profile?.system_role ?? 'user')) {
    redirect('/dashboard')
  }

  const consultoraId = membership?.consultora_id

  // Get target user profile
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .single()

  if (!targetProfile) notFound()

  // Get current access for this user
  let accessQuery = supabase
    .from('user_access')
    .select('empresa_id, establecimiento_id')
    .eq('user_id', userId)
    .eq('is_active', true)

  if (consultoraId) {
    accessQuery = accessQuery.eq('consultora_id', consultoraId)
  }

  const { data: currentAccess } = await accessQuery

  // Get all empresas with establecimientos
  let empresasQuery = supabase
    .from('empresas')
    .select('*, establecimientos(*, localidades(nombre))')
    .eq('is_active', true)
    .order('razon_social')

  if (consultoraId) {
    empresasQuery = empresasQuery.eq('consultora_id', consultoraId)
  }

  const { data: empresasRaw } = await empresasQuery

  const empresas: EmpresaConEstablecimientos[] = (empresasRaw ?? []).map(e => ({
    ...e,
    establecimientos: ((e.establecimientos ?? []) as Establecimiento[]).filter(est => est.status !== 'cancelled'),
  }))

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
          <Link href="/dashboard/usuarios" className="hover:text-gray-900">Usuarios</Link>
          <span>/</span>
          <span className="text-gray-900">Accesos de {targetProfile.full_name}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Gestionar Accesos</h1>
        <p className="text-gray-500 text-sm mt-1">
          Configurar a qué empresas y establecimientos puede acceder <strong>{targetProfile.full_name}</strong>
        </p>
      </div>

      <div className="bg-sig-50 border border-sig-100 rounded-xl p-4 mb-6 text-sm text-sig-700">
        <p className="font-medium mb-1">Modos de asignación:</p>
        <ul className="space-y-1 text-xs">
          <li>• <strong>Empresa entera</strong>: el usuario accede a todos los establecimientos de esa empresa, incluyendo los futuros</li>
          <li>• <strong>Establecimientos específicos</strong>: expandir la empresa y marcar cada establecimiento individualmente</li>
          <li>• <strong>Combinado</strong>: podés tener empresa entera en una y establecimientos específicos en otra</li>
        </ul>
      </div>

      <AccessAssignment
        targetUserId={userId}
        empresas={empresas}
        currentAccess={currentAccess ?? []}
      />
    </div>
  )
}
