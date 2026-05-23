import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { notFound } from 'next/navigation'
import { DenunciaDetailClient } from './detail-client'

export default async function DenunciaDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: denuncia } = await supabase
    .from('denuncias')
    .select('*, empresas(razon_social), establecimientos(nombre), profiles_responsable!responsable_asignado_id(full_name), denuncias_fotos(*)')
    .eq('id', id)
    .single()

  if (!denuncia) notFound()

  return <DenunciaDetailClient denuncia={denuncia} />
}
