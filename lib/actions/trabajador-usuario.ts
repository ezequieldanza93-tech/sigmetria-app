'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import type { UserRole, SystemRole, ActionResult } from '@/lib/types'
import { canCreateTrabajadores } from '@/lib/types'

/**
 * Crea la CUENTA de un trabajador a partir de una persona del directorio.
 *
 * Reglas (decididas con Ezequiel):
 *  - La persona debe ser tipo "Trabajadores" y tener EMAIL + DNI cargados.
 *  - Login: email. Contraseña inicial = DNI (sin puntos) → token de enrolamiento.
 *  - must_change_password=true en user_metadata → el middleware fuerza el cambio
 *    en el primer ingreso (el DNI deja de ser la credencial real).
 *  - Rol 'trabajador' (no consume seat). Lo crea cualquier PROFESIONAL de la
 *    consultora (admin o colaborador), no solo el Admin Principal.
 */
export async function crearUsuarioTrabajador(
  personaId: string,
): Promise<ActionResult<{ email: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase
      .from('consultoras_members')
      .select('role, consultora_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle(),
  ])

  const systemRole = (profile?.system_role ?? 'user') as SystemRole
  const myRole = (membership?.role as UserRole | undefined) ?? null
  const consultoraId = membership?.consultora_id
  if (!consultoraId) return { success: false, error: 'No estás asociado a una consultora activa' }
  if (!canCreateTrabajadores(myRole, systemRole)) {
    return { success: false, error: 'No tenés permiso para crear usuarios trabajadores' }
  }

  const admin = createAdminClient()

  const { data: persona, error: personaErr } = await admin
    .from('personas_directorio')
    .select('id, nombre, apellido, dni, email, user_id, personas_tipos(nombre)')
    .eq('id', personaId)
    .single()

  if (personaErr || !persona) return { success: false, error: 'No se encontró la persona en el directorio' }
  if (persona.user_id) return { success: false, error: 'Esta persona ya tiene un usuario asociado' }

  const tipoNombre = (persona as { personas_tipos?: { nombre?: string } | null }).personas_tipos?.nombre
  if (tipoNombre !== 'Trabajadores') {
    return { success: false, error: 'Solo se puede crear usuario para personas de tipo "Trabajadores"' }
  }

  const email = persona.email?.trim()
  if (!email) {
    return { success: false, error: 'La persona no tiene email cargado. Completá el email en el directorio antes de crear el usuario.' }
  }

  const dniClean = (persona.dni ?? '').replace(/\D/g, '')
  if (dniClean.length < 6) {
    return { success: false, error: 'La persona necesita un DNI válido (mínimo 6 dígitos) — es la contraseña inicial.' }
  }

  const fullName = `${persona.nombre ?? ''} ${persona.apellido ?? ''}`.trim() || email

  // 1) Crear la cuenta con password=DNI y el flag de cambio obligatorio.
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: dniClean,
    email_confirm: true, // el operario no verifica mail; la identidad fuerte la da el MFA
    user_metadata: { full_name: fullName, must_change_password: true },
  })

  if (createErr || !created?.user) {
    const msg = createErr?.message ?? 'No se pudo crear la cuenta'
    return {
      success: false,
      error: /already|registered|exists/i.test(msg) ? 'Ya existe una cuenta con ese email' : msg,
    }
  }

  const newUserId = created.user.id

  // 2) Perfil.
  await admin
    .from('profiles')
    .upsert({ id: newUserId, full_name: fullName, system_role: 'user' }, { onConflict: 'id' })

  // 3) Identidad normalizada: linkear la persona del directorio a la cuenta.
  const { error: linkErr } = await admin
    .from('personas_directorio')
    .update({ user_id: newUserId })
    .eq('id', personaId)
  if (linkErr) {
    return { success: false, error: `Cuenta creada pero no se pudo linkear la persona: ${linkErr.message}` }
  }

  // 4) Alta como miembro de la consultora con rol trabajador (no consume seat).
  const { error: memberErr } = await admin.from('consultoras_members').insert({
    consultora_id: consultoraId,
    user_id: newUserId,
    role: 'trabajador',
    is_active: true,
    invited_by: user.id,
  })
  if (memberErr) {
    return { success: false, error: `Cuenta creada pero falló el alta como miembro: ${memberErr.message}` }
  }

  revalidatePath('/dashboard/personas')
  return { success: true, data: { email } }
}
