import { redirect } from 'next/navigation'
import { getFinanzasAccess, getFinConfig } from '@/lib/finanzas/access'
import { listarGastos, listarCategorias } from '@/lib/queries/finanzas'
import { createClient } from '@/lib/supabase/server'
import { GastosCliente } from '@/components/finanzas/gastos-cliente'

export const dynamic = 'force-dynamic'

export default async function GastosPage() {
  // Gate server-side espejo de la RLS de fin_*: solo full_access (o developer)
  // y con el plan 'finanzas' habilitado. Defensa en profundidad.
  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) redirect('/login')
  if (!acc.hasAccess) redirect('/dashboard')

  const supabase = await createClient()
  const [gastos, categorias, config, empresasResult] = await Promise.all([
    listarGastos(acc.consultoraId),
    listarCategorias(acc.consultoraId, 'gasto'),
    getFinConfig(acc.consultoraId),
    supabase
      .from('empresas')
      .select('id, razon_social')
      .eq('consultora_id', acc.consultoraId)
      .eq('is_active', true)
      .order('razon_social'),
  ])

  const empresas = (empresasResult.data ?? []).map((e) => ({
    id: e.id as string,
    razon_social: e.razon_social as string,
  }))

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <GastosCliente
        gastosIniciales={gastos}
        categorias={categorias}
        empresas={empresas}
        moneda={config.moneda}
        locale={config.locale}
      />
    </div>
  )
}
