'use server'

import { createClient } from '@/lib/supabase/server'

export async function resolverAlerta(alertaId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autorizado')

  const { error } = await supabase.rpc('resolver_alerta', { p_alerta_id: alertaId })
  if (error) throw new Error(error.message)
}
