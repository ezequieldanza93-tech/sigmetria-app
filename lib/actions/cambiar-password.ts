'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Cambio de contraseña del usuario logueado. Usado por el flujo OBLIGATORIO del
 * primer ingreso del trabajador (entró con password=DNI). Al setear la nueva
 * contraseña limpia el flag must_change_password del metadata.
 *
 * Supabase rechaza una contraseña igual a la anterior ("should be different"),
 * así que el trabajador NO puede dejar el DNI como contraseña real.
 */
export async function cambiarPasswordObligatorio(
  _prev: { error?: string; success?: boolean } | undefined,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const password = formData.get('password') as string
  const confirmacion = formData.get('confirm') as string

  if (!password || password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres' }
  }
  if (password !== confirmacion) {
    return { error: 'Las contraseñas no coinciden' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase.auth.updateUser({
    password,
    data: { must_change_password: false },
  })

  if (error) {
    // Caso típico: intentó dejar el DNI (igual a la actual).
    if (/different|same|password/i.test(error.message) && /old|previous|current|anterior/i.test(error.message)) {
      return { error: 'La nueva contraseña debe ser distinta a tu DNI.' }
    }
    return { error: error.message }
  }

  return { success: true }
}
