import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { AdminFundadoresClient } from './admin-fundadores-client'

export const dynamic = 'force-dynamic'

export default async function AdminFundadoresPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) redirect('/dashboard')

  const admin = createAdminClient()

  // Leer todos los bonuses pendientes con JOIN
  const { data: bonuses } = await admin
    .from('founder_review_bonuses')
    .select(`
      id,
      tipo,
      estado,
      meses_otorgados,
      url,
      created_at,
      verificado_at,
      subscription_id,
      subscriptions (
        consultora_id,
        consultoras (
          nombre
        )
      )
    `)
    .eq('estado', 'pending')
    .order('created_at', { ascending: true })

  // Para cada bonus, obtener el email del admin de la consultora
  const bonusesConAdmin = await Promise.all(
    (bonuses ?? []).map(async b => {
      const sub = Array.isArray(b.subscriptions) ? b.subscriptions[0] : b.subscriptions
      const consultora = Array.isArray(sub?.consultoras) ? sub?.consultoras[0] : sub?.consultoras
      const consultoraId = sub?.consultora_id ?? null

      let adminEmail: string | null = null
      let adminNombre: string | null = null

      if (consultoraId) {
        const { data: memberRow } = await admin
          .from('consultoras_members')
          .select('user_id')
          .eq('consultora_id', consultoraId)
          .eq('user_role', 'full_access_main')
          .eq('is_active', true)
          .limit(1)
          .single()

        if (memberRow?.user_id) {
          const { data: p } = await admin
            .from('profiles')
            .select('email, full_name')
            .eq('id', memberRow.user_id)
            .single()
          adminEmail = p?.email ?? null
          adminNombre = p?.full_name ?? null
        }
      }

      return {
        id: b.id,
        tipo: b.tipo as 'video' | 'nota',
        estado: b.estado as 'pending' | 'verificado' | 'rechazado',
        mesesOtorgados: b.meses_otorgados,
        url: b.url,
        createdAt: b.created_at,
        verificadoAt: b.verificado_at,
        subscriptionId: b.subscription_id,
        consultoraNombre: consultora?.nombre ?? null,
        adminEmail,
        adminNombre,
      }
    })
  )

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-text-tertiary mb-1">
            <Link href="/dashboard/admin" className="hover:text-text-primary transition-colors">
              Admin
            </Link>
            <span>/</span>
            <span className="text-text-primary">Fundadores</span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Reseñas Fundadores</h1>
          <p className="text-sm text-text-tertiary mt-1">
            {bonusesConAdmin.length} solicitud{bonusesConAdmin.length !== 1 ? 'es' : ''} pendiente
            {bonusesConAdmin.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <AdminFundadoresClient bonuses={bonusesConAdmin} />
    </div>
  )
}
