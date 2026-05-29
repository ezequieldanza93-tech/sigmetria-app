'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { UserRole } from '@/lib/types'

export type SwitchableRole = UserRole | 'developer'

export async function switchRole(newRole: SwitchableRole): Promise<{ error: string } | never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role, is_super_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_super_admin && profile?.system_role !== 'developer') {
    return { error: 'No autorizado' }
  }

  const service = createServiceClient()

  if (newRole === 'developer') {
    const { error } = await service
      .from('profiles')
      .update({ system_role: 'developer' })
      .eq('id', user.id)
    if (error) return { error: error.message }
  } else {
    // Verificar que existe una membresía activa
    const { data: membership } = await supabase
      .from('consultoras_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!membership) {
      return { error: 'No tenés una membresía activa. Pedile al administrador que te asigne a una consultora.' }
    }

    // Si era developer, volver a system_role: 'user' antes de testear el rol
    if (profile?.system_role === 'developer') {
      const { error } = await service
        .from('profiles')
        .update({ system_role: 'user' })
        .eq('id', user.id)
      if (error) return { error: error.message }
    }

    const { error } = await service
      .from('consultoras_members')
      .update({ role: newRole })
      .eq('id', membership.id)
    if (error) return { error: error.message }
  }

  redirect('/dashboard')
}
