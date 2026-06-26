import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmpresasList } from '@/components/empresas-list'
import { EmpresaCreadaToast } from '@/components/empresas/empresa-creada-toast'
import { GestionesAggregate } from '@/components/aggregate/gestiones-aggregate'
import { SeguimientoAggregate } from '@/components/aggregate/seguimiento-aggregate'
import { AnalyticsDashboard } from '@/components/analytics/real/analytics-dashboard'
import { getGestionesAggregate, getSeguimientoAggregate } from '@/lib/queries/aggregate'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { canWrite, canAuditarGeo, ROLE_LABELS } from '@/lib/types'
import { ConsultoraFichaGlobal } from '@/components/consultora-ficha-global'
import { isCrmAdmin } from '@/lib/auth/crm-access'
import { canAccessContenido } from '@/lib/contenido/access'
import type { Consultora } from '@/lib/types'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ section?: string; success?: string }>
}

const SECTIONS = ['empresas', 'ficha', 'gestiones', 'seguimiento', 'dashboard'] as const
type Section = (typeof SECTIONS)[number]

export default async function EmpresasPage({ searchParams }: Props) {
  const { section: raw } = await searchParams
  const section: Section = (SECTIONS as readonly string[]).includes(raw ?? '')
    ? (raw as Section)
    : 'empresas'

  const supabase = await createClient()
  const effective = await getEffectiveRole()
  if (!effective) redirect('/login')

  // El trabajador no opera sobre empresas: lo mandamos a su espacio (mis EPP).
  // Cubre el aterrizaje en /dashboard tras el cambio de contraseña o nav directa.
  if (effective.effectiveUserRole === 'trabajador') redirect('/dashboard/mis-entregas')

  // Empresas list (with linked establecimientos) — para la sidebar y los aggregators.
  // NOTA: NO filtramos por estado en la fuente. Traemos is_active (empresa) y status
  // (establecimiento) para que la ficha global filtre client-side con su toggle.
  const { data: empresasRaw } = await supabase
    .from('empresas')
    .select('id, razon_social, is_active, establecimientos(id, nombre, status)')
    .order('razon_social')
    .limit(500)

  type EmpresaWithEst = {
    id: string
    razon_social: string
    is_active: boolean
    establecimientos: { id: string; nombre: string; status?: 'active' | 'on_hold' | 'cancelled' }[] | null
  }
  const empresas = (empresasRaw ?? []) as unknown as EmpresaWithEst[]

  const estContext = empresas.flatMap(e =>
    (e.establecimientos ?? []).map(es => ({
      id: es.id,
      nombre: es.nombre,
      empresa_id: e.id,
      empresa_razon_social: e.razon_social,
      // Estado de entidad para el toggle del dashboard de analítica (filtrado client-side).
      // Los agregadores ignoran estos campos extra (solo leen id/nombre/empresa_*).
      status: es.status ?? 'active',
      empresaIsActive: e.is_active,
    })),
  )

  const gestionesRows = section === 'gestiones' ? await getGestionesAggregate(estContext) : []
  const seguimientoRows = section === 'seguimiento' ? await getSeguimientoAggregate(estContext) : []

  // Ficha global: solo traemos el objeto completo de la consultora cuando hace falta.
  let consultora: Consultora | null = null
  let fichaUsuario: { fullName: string; email: string | null; avatarUrl: string | null; rolLabel: string } | null = null
  if (section === 'ficha' && effective.consultoraId) {
    const { data } = await supabase
      .from('consultoras')
      .select('*')
      .eq('id', effective.consultoraId)
      .single()
    consultora = (data as Consultora | null) ?? null

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle()
      fichaUsuario = {
        fullName: (profile?.full_name as string) || (user.email ?? 'Usuario'),
        email: user.email ?? null,
        avatarUrl: (profile?.avatar_url as string | null) ?? null,
        rolLabel: ROLE_LABELS[effective.effectiveUserRole as keyof typeof ROLE_LABELS] ?? effective.effectiveUserRole ?? '—',
      }
    }
  }
  const fichaEmpresas = empresas.map(e => ({
    id: e.id,
    razon_social: e.razon_social,
    is_active: e.is_active,
    establecimientos: (e.establecimientos ?? []).map(es => ({
      id: es.id,
      nombre: es.nombre,
      status: es.status,
    })),
  }))
  const puedeEditar = canWrite(effective.effectiveUserRole, effective.effectiveSystemRole)

  return (
    <>
      <Suspense fallback={null}>
        <EmpresaCreadaToast />
      </Suspense>

      {section === 'empresas' && <EmpresasList />}

      {section === 'ficha' && consultora && (
        <ConsultoraFichaGlobal
          consultora={consultora}
          empresas={fichaEmpresas}
          canWrite={puedeEditar}
          usuario={fichaUsuario}
          userRole={effective.effectiveUserRole}
          isSuperAdmin={effective.isSuperAdmin}
          showContenido={canAccessContenido(effective.effectiveUserRole, effective.effectiveSystemRole)}
          showCrm={isCrmAdmin(effective.email)}
        />
      )}

      {section === 'gestiones' && (
        <GestionesAggregate
          rows={gestionesRows}
          showEmpresaFilter
          showEstablecimientoFilter
          title="Gestiones (globales)"
          canAuditarGeo={canAuditarGeo(effective.effectiveUserRole, effective.effectiveSystemRole)}
        />
      )}

      {section === 'seguimiento' && (
        <SeguimientoAggregate rows={seguimientoRows} showEmpresaFilter showEstablecimientoFilter />
      )}

      {section === 'dashboard' && (
        <div className="p-6">
          <AnalyticsDashboard
            level="consultora"
            consultoraId={effective.consultoraId ?? undefined}
            establecimientos={estContext.map(e => ({
              id: e.id,
              nombre: e.nombre,
              status: e.status,
              empresaIsActive: e.empresaIsActive,
            }))}
          />
        </div>
      )}
    </>
  )
}
