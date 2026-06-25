import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { listarPlanesRegalables, listarRegalos } from '@/lib/actions/regalar-plan'
import { RegalarPlanClient } from './regalar-plan-client'

export const dynamic = 'force-dynamic'

export default async function RegalarPlanPage() {
  // ── Gate super-admin (server-side) ────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin) redirect('/dashboard')

  // ── Datos para el cliente ─────────────────────────────────
  const [planesResult, regalosResult] = await Promise.all([
    listarPlanesRegalables(),
    listarRegalos(),
  ])

  const planes = planesResult.success ? planesResult.data : []
  const regalos = regalosResult.success ? regalosResult.data : []

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* ── Breadcrumb + header ── */}
      <div>
        <div className="flex items-center gap-2 text-sm text-text-tertiary mb-1">
          <Link href="/dashboard/admin" className="hover:text-text-primary transition-colors">Admin</Link>
          <span>/</span>
          <span className="text-text-primary">Regalar plan</span>
        </div>
        <h1 className="text-2xl font-bold text-text-primary">Regalar plan</h1>
        <p className="text-sm text-text-tertiary mt-1">
          Otorgá acceso a un plan pago sin cobro. El destinatario recibirá un email de invitación.
        </p>
      </div>

      {/* ── Advertencia si no hay planes disponibles ── */}
      {planes.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No hay planes activos y regalables disponibles. Revisá la configuración de planes.
        </div>
      )}

      {/* ── Componente cliente ── */}
      <RegalarPlanClient planes={planes} regalosIniciales={regalos} />
    </div>
  )
}
