import 'server-only'
import { randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export interface EjecutarInvitacionParams {
  consultoraId: string
  invitedByUserId: string
  email: string
  nombre: string
  apellido: string
  role: string
  /** Persona del directorio existente a linkear (ej. Viewer de Observaciones). */
  personaId?: string | null
}

const TIPO_PROFESIONAL_HYS = 'Profesional H y S'

/** Contraseña temporal legible (sin caracteres ambiguos) para compartir y resetear. */
function generarPasswordTemporal(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = randomBytes(12)
  let out = ''
  for (let i = 0; i < 12; i++) out += chars[bytes[i] % chars.length]
  return out
}

/**
 * Crea el acceso de un miembro: usuario YA con contraseña temporal + email
 * confirmado, profile, membresía y persona del directorio (nombre/apellido
 * separados + tipo "Profesional H y S").
 *
 * El admin comparte email + contraseña temporal (WhatsApp, etc.); al primer
 * ingreso el middleware lo manda a /cambiar-password (must_change_password)
 * para que defina la suya. Reusa el patrón probado del alta de trabajadores.
 * NO depende de emails (Resend) ni de magic-links que vencen / caen en /login.
 *
 * Corre EN PROCESO (sin fetch HTTP a una ruta API).
 */
export async function ejecutarInvitacion(
  p: EjecutarInvitacionParams,
): Promise<{ email: string; tempPassword: string } | { error: string }> {
  const admin = createAdminClient()
  const email = p.email.toLowerCase().trim()
  const nombre = p.nombre.trim()
  const apellido = p.apellido.trim()
  const fullName = `${nombre} ${apellido}`.trim()
  const tempPassword = generarPasswordTemporal()

  // 1) Crear el usuario con contraseña temporal + email confirmado.
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: fullName, must_change_password: true },
  })
  if (createError) {
    const yaExiste = /already|registered|exists/i.test(createError.message)
    return { error: yaExiste ? 'Ese email ya tiene una cuenta en Sigmetría.' : createError.message }
  }
  const invitedUser = created.user
  if (!invitedUser) return { error: 'No se pudo crear el usuario' }

  // 2) profiles
  const { error: profileError } = await admin.from('profiles').upsert(
    { id: invitedUser.id, full_name: fullName || email, system_role: 'user' },
    { onConflict: 'id' },
  )
  if (profileError) console.error('[ejecutarInvitacion] upsert profiles falló:', profileError)

  // 3) membresía
  const { error: memberError } = await admin.from('consultoras_members').insert({
    consultora_id: p.consultoraId,
    user_id: invitedUser.id,
    role: p.role,
    invited_by: p.invitedByUserId,
  })
  if (memberError) {
    // Rollback del usuario huérfano (quedó sin membresía).
    await admin.auth.admin.deleteUser(invitedUser.id).catch(() => {})
    return { error: memberError.message }
  }

  // 4) Persona del directorio (nombre/apellido separados + tipo "Profesional H y S").
  //    Secundario: si falla NO aborta el alta.
  try {
    if (p.personaId) {
      await admin.from('personas_directorio')
        .update({ user_id: invitedUser.id, email })
        .eq('id', p.personaId)
    } else {
      const { data: existingByEmail } = await admin
        .from('personas_directorio').select('id').eq('email', email).maybeSingle()

      if (existingByEmail) {
        await admin.from('personas_directorio')
          .update({ user_id: invitedUser.id, nombre, apellido })
          .eq('id', existingByEmail.id)
      } else {
        let tipoId: string | undefined
        const { data: tipo } = await admin
          .from('personas_tipos').select('id').eq('nombre', TIPO_PROFESIONAL_HYS).maybeSingle()
        tipoId = tipo?.id
        if (!tipoId) {
          const { data: nuevoTipo } = await admin
            .from('personas_tipos')
            .insert({ nombre: TIPO_PROFESIONAL_HYS, solo_via_cuenta: true })
            .select('id').single()
          tipoId = nuevoTipo?.id
        }
        if (tipoId) {
          await admin.from('personas_directorio').insert({
            tipo_id: tipoId,
            nombre,
            apellido,
            email,
            user_id: invitedUser.id,
            is_active: true,
            created_in_consultora_id: p.consultoraId,
          })
        }
      }
    }
  } catch (e) {
    console.error('[ejecutarInvitacion] persona_directorio falló (no crítico):', e)
  }

  return { email, tempPassword }
}
