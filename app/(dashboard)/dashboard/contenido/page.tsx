import { redirect } from 'next/navigation'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { canAccessContenido } from '@/lib/contenido/access'
import { getContenidoCatalogos, getPublicaciones } from '@/lib/queries/contenido'
import { createClient } from '@/lib/supabase/server'
import { ContenidoClient } from '@/components/contenido/contenido-client'

export const dynamic = 'force-dynamic'

export default async function ContenidoPage() {
  // Gate server-side espejo del sidebar y de la RLS (contenido_can_manage):
  // solo admins full_access de la consultora. Defensa en profundidad.
  const eff = await getEffectiveRole()
  if (!eff) redirect('/login')
  if (!canAccessContenido(eff.effectiveUserRole, eff.effectiveSystemRole)) redirect('/dashboard')
  if (!eff.consultoraId) redirect('/onboarding')

  const supabase = await createClient()
  const [catalogos, publicaciones, consultoraResult] = await Promise.all([
    getContenidoCatalogos(),
    getPublicaciones(eff.consultoraId),
    supabase
      .from('consultoras')
      .select('social_links')
      .eq('id', eff.consultoraId)
      .single(),
  ])

  const socialLinks = (consultoraResult.data?.social_links ?? null) as Record<string, string> | null

  return (
    <div className="mx-auto max-w-7xl p-4 md:p-6">
      <ContenidoClient
        catalogos={catalogos}
        publicaciones={publicaciones}
        consultoraNombre={eff.consultoraNombre ?? 'Tu consultora'}
        socialLinks={socialLinks}
      />
    </div>
  )
}
