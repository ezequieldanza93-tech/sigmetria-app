import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import {
  canManageUsers,
  canInviteViewers,
  isFreeViewerRole,
  type UserRole,
  type SystemRole,
} from '@/lib/types'
import { AccessAssignment } from '@/components/access-assignment'
import type { Empresa, Establecimiento } from '@/lib/types'

interface Props {
  params: Promise<{ userId: string }>
}

interface EmpresaConEstablecimientos extends Empresa {
  establecimientos: Establecimiento[]
  puedeEmpresaEntera?: boolean
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

  const systemRole = (profile?.system_role ?? 'user') as SystemRole
  const myRole = (membership?.role as UserRole) ?? null
  const isFullAdmin = canManageUsers(myRole, systemRole)

  // Admin gestiona a cualquiera; los colaboradores pueden gestionar viewers.
  if (!isFullAdmin && !canInviteViewers(myRole, systemRole)) {
    redirect('/dashboard')
  }

  const consultoraId = membership?.consultora_id

  const [{ data: targetProfile }, { data: targetMember }] = await Promise.all([
    supabase.from('profiles').select('full_name').eq('id', userId).single(),
    supabase.from('consultoras_members').select('role').eq('user_id', userId).eq('is_active', true).maybeSingle(),
  ])
  if (!targetProfile) notFound()

  const targetRole = (targetMember?.role as UserRole) ?? null

  // Un colaborador solo puede tocar accesos de visualizadores.
  if (!isFullAdmin && !isFreeViewerRole(targetRole)) {
    redirect('/dashboard/usuarios')
  }

  const breadcrumb = (
    <div className="flex items-center gap-2 text-sm text-text-secondary mb-4">
      <Link href="/dashboard/usuarios" className="hover:text-text-primary">Usuarios</Link>
      <span>/</span>
      <span className="text-text-primary">Accesos de {targetProfile.full_name}</span>
    </div>
  )

  // El Viewer de Observaciones NO se asigna por empresa: su alcance es "ser
  // responsable" de la observación. No hay nada que configurar acá.
  if (targetRole === 'viewer_observaciones') {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        {breadcrumb}
        <h1 className="text-2xl font-bold text-text-primary">Gestionar Accesos</h1>
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">Este usuario es un Viewer de Observaciones.</p>
          <p>
            Su acceso no se configura por empresa o establecimiento: ve únicamente las observaciones
            donde figura como <strong>responsable</strong> (según su persona del directorio). Para
            cambiar qué ve, asignale o quitale observaciones desde la gestión correspondiente.
          </p>
        </div>
      </div>
    )
  }

  // Accesos actuales del usuario.
  let accessQuery = supabase
    .from('user_access')
    .select('empresa_id, establecimiento_id')
    .eq('user_id', userId)
    .eq('is_active', true)
  if (consultoraId) accessQuery = accessQuery.eq('consultora_id', consultoraId)
  const { data: currentAccess } = await accessQuery

  // Empresas + establecimientos de la consultora.
  let empresasQuery = supabase
    .from('empresas')
    .select('*, establecimientos(*, localidades(nombre))')
    .eq('is_active', true)
    .order('razon_social')
  if (consultoraId) empresasQuery = empresasQuery.eq('consultora_id', consultoraId)
  const { data: empresasRaw } = await empresasQuery

  let empresas: EmpresaConEstablecimientos[] = (empresasRaw ?? []).map(e => ({
    ...e,
    establecimientos: ((e.establecimientos ?? []) as Establecimiento[]).filter(est => est.status !== 'cancelled'),
    puedeEmpresaEntera: true,
  }))

  // Si el granter es un colaborador granular, solo puede ofrecer SU alcance.
  if (!isFullAdmin && myRole === 'colaborador') {
    const { data: ownAccess } = await supabase
      .from('user_access')
      .select('empresa_id, establecimiento_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
    const own = ownAccess ?? []
    const empresaEntera = new Set(own.filter(a => a.establecimiento_id === null).map(a => a.empresa_id))
    const estByEmpresa = new Map<string, Set<string>>()
    own.filter(a => a.establecimiento_id !== null).forEach(a => {
      if (!estByEmpresa.has(a.empresa_id)) estByEmpresa.set(a.empresa_id, new Set())
      estByEmpresa.get(a.empresa_id)!.add(a.establecimiento_id as string)
    })

    empresas = empresas
      .filter(e => empresaEntera.has(e.id) || estByEmpresa.has(e.id))
      .map(e => {
        if (empresaEntera.has(e.id)) return e
        const allowed = estByEmpresa.get(e.id) ?? new Set<string>()
        return {
          ...e,
          puedeEmpresaEntera: false,
          establecimientos: e.establecimientos.filter(est => allowed.has(est.id)),
        }
      })
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        {breadcrumb}
        <h1 className="text-2xl font-bold text-text-primary">Gestionar Accesos</h1>
        <p className="text-text-secondary text-sm mt-1">
          Configurar a qué empresas y establecimientos puede acceder <strong>{targetProfile.full_name}</strong>
        </p>
      </div>

      <div className="bg-sig-50 border border-sig-100 rounded-xl p-4 mb-6 text-sm text-sig-700">
        <p className="font-medium mb-1">Modos de asignación:</p>
        <ul className="space-y-1 text-xs">
          <li>• <strong>Empresa entera</strong>: el usuario accede a todos los establecimientos de esa empresa, incluyendo los futuros</li>
          <li>• <strong>Establecimientos específicos</strong>: expandir la empresa y marcar cada establecimiento individualmente</li>
          {!isFullAdmin && <li>• Solo podés asignar empresas/establecimientos dentro de tu propio alcance</li>}
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
