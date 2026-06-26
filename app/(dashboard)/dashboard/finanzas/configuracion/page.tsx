import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Settings2 } from 'lucide-react'
import { getFinanzasAccess, getFinConfig } from '@/lib/finanzas/access'
import { createClient } from '@/lib/supabase/server'
import { ConfigFinanzasForm } from '@/components/finanzas/config-finanzas-form'

export const dynamic = 'force-dynamic'

export default async function ConfiguracionFinanzasPage() {
  // Gate server-side: rol full_access (o developer) + plan con 'finanzas' habilitado.
  // Espejo de la RLS de las tablas fin_*. Defensa en profundidad.
  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) redirect('/login')
  if (!acc.hasAccess) redirect('/dashboard')

  // ¿Ya guardó su configuración alguna vez? getFinConfig devuelve defaults si no
  // existe, así que consultamos aparte para saber si es la primera vez.
  const supabase = await createClient()
  const [config, { data: existente }] = await Promise.all([
    getFinConfig(acc.consultoraId),
    supabase
      .from('fin_config')
      .select('consultora_id')
      .eq('consultora_id', acc.consultoraId)
      .maybeSingle(),
  ])

  const yaConfigurada = existente != null

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-6">
      {/* Header */}
      <div className="mb-5 flex items-center gap-3">
        <Link
          href="/dashboard/finanzas"
          className="rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-elevated hover:text-text-primary"
          aria-label="Volver a Finanzas"
        >
          <ArrowLeft size={16} />
        </Link>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-muted text-brand-primary">
          <Settings2 size={20} />
        </span>
        <div>
          <h1 className="text-xl font-bold text-text-primary">Configuración de Finanzas</h1>
          <p className="mt-0.5 text-xs text-text-secondary">
            Definí cómo trabaja el módulo financiero de tu consultora.
          </p>
        </div>
      </div>

      {!yaConfigurada && (
        <div className="mb-5 rounded-xl border border-brand-primary/20 bg-brand-muted/40 px-4 py-3">
          <p className="text-sm text-text-primary">
            <span className="font-semibold">¡Bienvenido a Finanzas!</span> Antes de cargar
            tu primer gasto, dejá lista la moneda y los parámetros de cálculo. Después podés
            cambiarlos cuando quieras.
          </p>
        </div>
      )}

      <ConfigFinanzasForm config={config} yaConfigurada={yaConfigurada} />
    </div>
  )
}
