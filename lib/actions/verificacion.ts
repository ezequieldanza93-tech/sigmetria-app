'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function regenerarTokenEstablecimiento(
  establecimientoId: string,
  empresaId: string,
): Promise<{ success: boolean; error?: string; token?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase.rpc('regenerar_token', {
    p_establecimiento_id: establecimientoId,
  })

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, token: data as string }
}
