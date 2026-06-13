import { createClient } from '@/lib/supabase/server'
import {
  getInconsistencias, getEstadoCumplimiento, getUmbralesAlerta, getCronRuns,
} from '@/lib/actions/autocontrol'
import { CumplimientoPanel } from '@/components/cumplimiento/cumplimiento-panel'

export const dynamic = 'force-dynamic'

/**
 * Panel de Estado de Cumplimiento y Autocontrol (Res. SRT 48/2025 Art. 4.9).
 * Consolida inconsistencias, vencimientos, avance ISO 45001 y — para super
 * admins — la bitácora de supervisión del cron.
 */
export default async function CumplimientoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let isSuperAdmin = false
  let canEditUmbrales = false
  if (user) {
    const [{ data: profile }, { data: membership }] = await Promise.all([
      supabase.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle(),
      supabase
        .from('consultoras_members')
        .select('role')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle(),
    ])
    isSuperAdmin = profile?.is_super_admin === true
    // Editar umbrales: Admin Principal de su consultora o super admin.
    canEditUmbrales = isSuperAdmin || membership?.role === 'full_access_main'
  }

  const [inconsistencias, cumplimiento, umbrales, cronRuns] = await Promise.all([
    getInconsistencias(),
    getEstadoCumplimiento(),
    getUmbralesAlerta(),
    isSuperAdmin ? getCronRuns() : Promise.resolve([]),
  ])

  return (
    <CumplimientoPanel
      inconsistencias={inconsistencias}
      cumplimiento={cumplimiento}
      umbrales={umbrales}
      cronRuns={cronRuns}
      isSuperAdmin={isSuperAdmin}
      canEditUmbrales={canEditUmbrales}
    />
  )
}
