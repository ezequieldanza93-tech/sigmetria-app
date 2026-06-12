import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isCrmAdmin } from '@/lib/auth/crm-access'
import { CrmClient } from '@/components/crm/crm-client'
import type { Lead, LeadMagnet, LeadMagnetDescarga, Consentimiento } from '@/lib/crm/types'

export const dynamic = 'force-dynamic'

export default async function CrmPage() {
  const supabase = await createClient()

  // Gate de UI: solo staff de Sigmetría. La RLS (is_crm_admin) refuerza esto en la base,
  // así que aunque alguien evite la página, no puede leer los datos.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (!isCrmAdmin(user.email)) redirect('/dashboard')

  const [leadsRes, magnetsRes, descargasRes, consentRes] = await Promise.all([
    supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(2000),
    supabase.from('lead_magnets').select('*').order('titulo'),
    supabase.from('lead_magnet_descargas').select('*').order('created_at', { ascending: false }).limit(5000),
    supabase.from('consentimientos').select('*').order('created_at', { ascending: false }).limit(5000),
  ])

  // La query principal no debe fallar en silencio: si la RLS o la conexión la rechazan,
  // surfaceamos el error en vez de mostrar un CRM "vacío" engañoso.
  if (leadsRes.error) {
    throw new Error(`No se pudieron cargar los leads del CRM: ${leadsRes.error.message}`)
  }

  const leads = (leadsRes.data ?? []) as Lead[]
  // Datos de enriquecimiento: si fallan, degradamos a vacío (no rompen la vista principal).
  const magnets = (magnetsRes.data ?? []) as LeadMagnet[]
  const descargas = (descargasRes.data ?? []) as LeadMagnetDescarga[]
  const consentimientos = (consentRes.data ?? []) as Consentimiento[]

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <CrmClient leads={leads} magnets={magnets} descargas={descargas} consentimientos={consentimientos} />
    </div>
  )
}
