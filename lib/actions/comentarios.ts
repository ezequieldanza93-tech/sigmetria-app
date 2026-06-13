'use server'

import { createClient } from '@/lib/supabase/server'
import { isCrmAdmin } from '@/lib/auth/crm-access'
import { revalidatePath } from 'next/cache'

export async function aprobarComentario(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isCrmAdmin(user.email)) return { success: false, error: 'Sin permisos' }

  const { error } = await supabase
    .from('blog_comments')
    .update({ aprobado: true })
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/crm/comentarios')
  return { success: true }
}

export async function eliminarComentario(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !isCrmAdmin(user.email)) return { success: false, error: 'Sin permisos' }

  const { error } = await supabase
    .from('blog_comments')
    .delete()
    .eq('id', id)

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/crm/comentarios')
  return { success: true }
}
