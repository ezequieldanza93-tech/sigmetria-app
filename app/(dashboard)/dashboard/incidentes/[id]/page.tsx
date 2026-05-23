import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { IncidenteDetailClient } from './detail-client'

export default async function IncidenteDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: incidente } = await supabase
    .from('incidentes')
    .select('*, empresas(razon_social), establecimientos(nombre), profiles_responsable!responsable_asignado_id(full_name), incidentes_fotos(*)')
    .eq('id', id)
    .single()

  if (!incidente) notFound()

  return <IncidenteDetailClient incidente={incidente} />
}
