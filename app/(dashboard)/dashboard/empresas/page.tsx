import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { EmpresasList } from '@/components/empresas-list'
import { ConsultoraShell } from '@/components/consultora/consultora-shell'
import { GestionesAggregate } from '@/components/aggregate/gestiones-aggregate'
import { SeguimientoAggregate } from '@/components/aggregate/seguimiento-aggregate'
import { AnalyticsDashboard } from '@/components/analytics/real/analytics-dashboard'
import { getGestionesAggregate, getSeguimientoAggregate } from '@/lib/queries/aggregate'
import { getEffectiveRole } from '@/lib/auth/effective-role'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<{ section?: string }>
}

const SECTIONS = ['empresas', 'gestiones', 'seguimiento', 'dashboard'] as const
type Section = (typeof SECTIONS)[number]

export default async function EmpresasPage({ searchParams }: Props) {
  const { section: raw } = await searchParams
  const section: Section = (SECTIONS as readonly string[]).includes(raw ?? '')
    ? (raw as Section)
    : 'empresas'

  const supabase = await createClient()
  const effective = await getEffectiveRole()
  if (!effective) redirect('/login')

  // Empresas list (with linked establecimientos) — para la sidebar y los aggregators.
  const { data: empresasRaw } = await supabase
    .from('empresas')
    .select('id, razon_social, establecimientos(id, nombre)')
    .order('razon_social')
    .limit(500)

  type EmpresaWithEst = {
    id: string
    razon_social: string
    establecimientos: { id: string; nombre: string }[] | null
  }
  const empresas = (empresasRaw ?? []) as unknown as EmpresaWithEst[]

  const sidebarEmpresas = empresas.map(e => ({ id: e.id, razon_social: e.razon_social }))

  const estContext = empresas.flatMap(e =>
    (e.establecimientos ?? []).map(es => ({
      id: es.id,
      nombre: es.nombre,
      empresa_id: e.id,
      empresa_razon_social: e.razon_social,
    })),
  )

  const gestionesRows = section === 'gestiones' ? await getGestionesAggregate(estContext) : []
  const seguimientoRows = section === 'seguimiento' ? await getSeguimientoAggregate(estContext) : []

  return (
    <Suspense fallback={<div className="lg:pl-14" />}>
    <ConsultoraShell empresas={sidebarEmpresas}>
      {section === 'empresas' && <EmpresasList />}

      {section === 'gestiones' && (
        <GestionesAggregate rows={gestionesRows} showEmpresaFilter showEstablecimientoFilter />
      )}

      {section === 'seguimiento' && (
        <SeguimientoAggregate rows={seguimientoRows} showEmpresaFilter showEstablecimientoFilter />
      )}

      {section === 'dashboard' && (
        <div className="p-6">
          <AnalyticsDashboard
            level="consultora"
            consultoraId={effective.consultoraId ?? undefined}
            establecimientos={estContext.map(e => ({ id: e.id, nombre: e.nombre }))}
          />
        </div>
      )}
    </ConsultoraShell>
    </Suspense>
  )
}
