import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getFinanzasAccess, getFinConfig } from '@/lib/finanzas/access'
import { listarInversiones, recuperoInversion } from '@/lib/queries/finanzas'
import { InversionesCliente, type InstrumentoOpcion } from '@/components/finanzas/inversiones-cliente'

export const dynamic = 'force-dynamic'

/**
 * Trae los instrumentos de medición activos para el selector "Desde un
 * instrumento". Shape mínimo (marca = nombre, tipo = subcategoría) para etiquetar
 * cada opción. No hay query reutilizable con este shape, por eso va inline acá.
 */
async function listarInstrumentosOpciones(): Promise<InstrumentoOpcion[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('mediciones_instrumentos')
    .select('id, modelo, numero_serie, productos_componentes(nombre), organizaciones_externas(nombre)')
    .eq('is_active', true)
    .order('modelo', { ascending: true })
    .range(0, 199)

  return (data ?? []).map((i) => {
    const tipoRaw = i.productos_componentes as { nombre?: string } | { nombre?: string }[] | null
    const tipo = Array.isArray(tipoRaw) ? tipoRaw[0] : tipoRaw
    const marcaRaw = i.organizaciones_externas as { nombre?: string } | { nombre?: string }[] | null
    const marca = Array.isArray(marcaRaw) ? marcaRaw[0] : marcaRaw
    return {
      id: i.id as string,
      modelo: (i.modelo as string | null) ?? null,
      numero_serie: (i.numero_serie as string | null) ?? null,
      marca: marca?.nombre ?? null,
      tipo: tipo?.nombre ?? null,
    }
  })
}

export default async function InversionesPage() {
  // Gate: rol full_access (o developer) + plan con 'finanzas' habilitado.
  const acc = await getFinanzasAccess()
  if (!acc.consultoraId) redirect('/login')
  if (!acc.hasAccess) redirect('/dashboard')

  const [inversiones, config, instrumentos] = await Promise.all([
    listarInversiones(acc.consultoraId),
    getFinConfig(acc.consultoraId),
    listarInstrumentosOpciones(),
  ])

  // Recupero precalculado en server solo para las inversiones con instrumento
  // vinculado (evita un waterfall de N llamadas desde el cliente).
  const conInstrumento = inversiones.filter((inv) => inv.instrumento_id != null)
  const recuperos = await Promise.all(conInstrumento.map((inv) => recuperoInversion(inv.id)))
  const recuperoPorInversion: Record<string, number> = {}
  for (let idx = 0; idx < conInstrumento.length; idx++) {
    recuperoPorInversion[conInstrumento[idx].id] = recuperos[idx].medicionesRealizadas
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <InversionesCliente
        inversiones={inversiones}
        recuperoPorInversion={recuperoPorInversion}
        instrumentos={instrumentos}
        moneda={config.moneda}
        locale={config.locale}
        vidaUtilDefault={config.vida_util_meses_def}
      />
    </div>
  )
}
