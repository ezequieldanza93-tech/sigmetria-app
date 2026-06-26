import { redirect } from 'next/navigation'
import { getFinanzasAccess } from '@/lib/finanzas/access'
import { createClient } from '@/lib/supabase/server'
import { ContratoGenerador } from '@/components/finanzas/contrato-generador'

export const dynamic = 'force-dynamic'

interface PageProps {
  // Next 15: searchParams es una Promise — hay que await-earla.
  searchParams: Promise<{ empresaId?: string; honorarios?: string }>
}

export default async function ContratosPage({ searchParams }: PageProps) {
  // Gate server-side espejo de la RLS de fin_*: solo full_access_main (o developer)
  // y con el plan 'finanzas' habilitado. Defensa en profundidad.
  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) redirect('/login')
  if (!acc.hasAccess) redirect('/dashboard')

  const supabase = await createClient()
  const { data: empresasData } = await supabase
    .from('empresas')
    .select('id, razon_social')
    .eq('consultora_id', acc.consultoraId)
    .eq('is_active', true)
    .order('razon_social')

  const empresas = (empresasData ?? []).map((e) => ({
    id: e.id as string,
    razon_social: e.razon_social as string,
  }))

  // Prefill desde la conversión de un presupuesto (Presupuestos → Generar contrato).
  const sp = await searchParams
  const empresaInicial = sp.empresaId || undefined
  const honorariosInicial = sp.honorarios || undefined

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <ContratoGenerador
        empresas={empresas}
        empresaInicial={empresaInicial}
        honorariosInicial={honorariosInicial}
      />
    </div>
  )
}
