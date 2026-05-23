import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { IncidenteForm } from '@/components/forms/incidente-form'
import { createIncidente } from '@/lib/actions/incidente'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default async function NuevoIncidentePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) redirect('/dashboard')

  const { data: empresasData } = await supabase
    .from('empresas')
    .select('id, razon_social')
    .eq('consultora_id', membership.consultora_id)
    .eq('is_active', true)
    .order('razon_social')

  const empresaIds = (empresasData ?? []).map(e => e.id)
  const { data: establecimientosData } = await supabase
    .from('establecimientos')
    .select('id, nombre, empresa_id')
    .in('empresa_id', empresaIds.length > 0 ? empresaIds : [''])
    .neq('status', 'cancelled')
    .order('nombre')

  const empresas = empresasData ?? []
  const establecimientos = establecimientosData ?? []

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-6">
      <Link
        href="/dashboard/incidentes"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={16} />
        Volver a incidentes
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-text-primary">Nuevo Incidente</h1>
        <p className="text-sm text-text-tertiary mt-0.5">
          Registrá un casi-accidente o evento sin lesión
        </p>
      </div>

      <Card padding="lg">
        <IncidenteForm
          action={createIncidente}
          empresas={empresas}
          establecimientos={establecimientos}
        />
      </Card>
    </div>
  )
}
