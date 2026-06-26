import { redirect } from 'next/navigation'
import { getFinanzasAccess, getFinConfig } from '@/lib/finanzas/access'
import { listarComprobantes } from '@/lib/queries/finanzas'
import { listarFormasPago } from '@/lib/queries/finanzas-formas-pago'
import { createClient } from '@/lib/supabase/server'
import { FacturacionCliente } from '@/components/finanzas/facturacion-cliente'

export const dynamic = 'force-dynamic'

interface PageProps {
  // Next 15: searchParams es una Promise — hay que await-earla.
  searchParams: Promise<{ empresaId?: string; concepto?: string; monto?: string }>
}

export default async function FacturacionPage({ searchParams }: PageProps) {
  // Gate server-side espejo de la RLS de fin_*: solo full_access (o developer)
  // y con el plan 'finanzas' habilitado. Defensa en profundidad.
  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) redirect('/login')
  if (!acc.hasAccess) redirect('/dashboard')

  const supabase = await createClient()
  const [comprobantes, config, formasPago, empresasResult] = await Promise.all([
    listarComprobantes(acc.consultoraId),
    getFinConfig(acc.consultoraId),
    listarFormasPago(acc.consultoraId),
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

  // Prefill desde la conversión de un presupuesto (Presupuestos → Facturar).
  const sp = await searchParams
  const montoNum = sp.monto != null ? Number(sp.monto) : undefined
  const prefill =
    sp.empresaId || sp.concepto || sp.monto
      ? {
          empresaId: sp.empresaId,
          concepto: sp.concepto,
          monto: montoNum != null && Number.isFinite(montoNum) ? montoNum : undefined,
        }
      : undefined

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <FacturacionCliente
        comprobantesIniciales={comprobantes}
        empresas={empresas}
        formasPagoIniciales={formasPago}
        moneda={config.moneda}
        locale={config.locale}
        ivaTasa={config.iva_tasa}
        prefill={prefill}
      />
    </div>
  )
}
