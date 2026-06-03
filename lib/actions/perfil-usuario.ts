'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updatePerfil(data: { full_name: string }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const name = data.full_name.trim()
  if (!name) return { error: 'El nombre no puede estar vacío' }

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: name, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function updatePassword(data: { current: string; next: string }) {
  const supabase = await createClient()

  if (data.next.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres' }
  if (data.current === data.next) return { error: 'La nueva contraseña debe ser diferente a la actual' }

  // Supabase valida la contraseña actual al re-autenticar.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'No autenticado' }

  // Re-auth con contraseña actual para verificarla antes de cambiar.
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: data.current,
  })
  if (signInError) return { error: 'Contraseña actual incorrecta' }

  const { error } = await supabase.auth.updateUser({ password: data.next })
  if (error) return { error: error.message }
  return { success: true }
}
