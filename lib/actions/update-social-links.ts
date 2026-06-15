'use server'

import { createClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/types'
import { revalidatePath } from 'next/cache'

export async function updateSocialLinks(
  links: Record<string, string>,
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) return { success: false, error: 'No pertenecés a ninguna consultora' }

  if (membership.role !== 'full_access_main') {
    return {
      success: false,
      error: 'Solo el Admin Principal puede editar los links de redes sociales',
    }
  }

  const filtered = Object.fromEntries(
    Object.entries(links).filter(([, v]) => v.trim() !== ''),
  )

  const { error } = await supabase
    .from('consultoras')
    .update({ social_links: filtered, updated_at: new Date().toISOString() })
    .eq('id', membership.consultora_id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/contenido')
  revalidatePath('/dashboard/configuracion/consultora')
  return { success: true, data: null }
}
