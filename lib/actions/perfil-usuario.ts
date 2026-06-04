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

/** Vincula una persona existente del directorio al perfil del usuario. */
export async function vincularPersonaPerfil(personaId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  // Leer nombre y apellido de la persona para sincronizar full_name en profiles.
  const { data: persona, error: fetchError } = await supabase
    .from('personas_directorio')
    .select('nombre, apellido')
    .eq('id', personaId)
    .single()

  if (fetchError || !persona) return { error: 'Persona no encontrada' }

  const full_name = `${persona.nombre} ${persona.apellido}`.trim()

  const { error } = await supabase
    .from('profiles')
    .update({
      persona_id: personaId,
      full_name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { success: true, full_name }
}

/**
 * Crea una nueva persona en el directorio (tipo Profesionales) y la vincula
 * automáticamente al perfil del usuario logueado.
 */
export async function crearYVincularPersona(data: {
  nombre: string
  apellido: string
  dni?: string
  telefono?: string
  email?: string
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const nombre = data.nombre.trim()
  const apellido = data.apellido.trim()
  if (!nombre || !apellido) return { error: 'Nombre y apellido son obligatorios' }

  // Obtener consultora del usuario
  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  // Obtener tipo_id de "Profesionales"
  const { data: tipo } = await supabase
    .from('personas_tipos')
    .select('id')
    .eq('nombre', 'Profesionales')
    .single()

  if (!tipo) return { error: 'Tipo "Profesionales" no encontrado. Contactá al administrador.' }

  // Crear la persona
  const { data: persona, error: insertError } = await supabase
    .from('personas_directorio')
    .insert({
      nombre,
      apellido,
      dni: data.dni?.trim() || null,
      telefono: data.telefono?.trim() || null,
      email: data.email?.trim() || null,
      tipo_id: tipo.id,
      is_active: true,
      created_in_consultora_id: membership?.consultora_id || null,
    })
    .select('id')
    .single()

  if (insertError) return { error: insertError.message }

  // Vincular al perfil
  const full_name = `${nombre} ${apellido}`.trim()
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      persona_id: persona.id,
      full_name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (updateError) return { error: updateError.message }
  revalidatePath('/', 'layout')
  return { success: true, full_name }
}

export async function updatePassword(data: { current: string; next: string }) {
  const supabase = await createClient()

  if (data.next.length < 8) return { error: 'La contraseña debe tener al menos 8 caracteres' }
  if (data.current === data.next) return { error: 'La nueva contraseña debe ser diferente a la actual' }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return { error: 'No autenticado' }

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: data.current,
  })
  if (signInError) return { error: 'Contraseña actual incorrecta' }

  const { error } = await supabase.auth.updateUser({ password: data.next })
  if (error) return { error: error.message }
  return { success: true }
}
