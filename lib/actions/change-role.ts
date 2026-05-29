'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { UserRole } from '@/lib/types'

export type SwitchableRole = UserRole | 'developer'

export async function switchRole(newRole: SwitchableRole) {
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
    await service.from('profiles').update({ system_role: 'developer' }).eq('id', user.id)
  } else {
    await service.from('profiles').update({ system_role: 'user' }).eq('id', user.id)
    await service.from('consultoras_members')
      .update({ role: newRole })
      .eq('user_id', user.id)
      .eq('is_active', true)
  }

  redirect('/dashboard')
}
