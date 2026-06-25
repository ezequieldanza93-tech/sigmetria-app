import 'server-only'
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

/**
 * Crea la invitación de un miembro: genera el action_link (SIN enviar email),
 * crea profile + membresía, y linkea/crea la persona del directorio con
 * nombre/apellido separados y tipo "Profesional H y S".
 *
 * Corre EN PROCESO (no vía fetch HTTP a una ruta API). El patrón anterior
 * (server action -> fetch a /api/admin/invite-user) fallaba en prod: el fetch
 * interno no llevaba cookies y la URL armada a mano (NEXT_PUBLIC_APP_URL/host)
 * podía devolver HTML 200 (protección de deployment de Vercel / dominio
 * equivocado) -> response.json() reventaba -> "No se pudo generar el link".
 */
export async function ejecutarInvitacion(
  p: EjecutarInvitacionParams,
): Promise<{ link: string } | { error: string }> {
  const admin = createAdminClient()
  const email = p.email.toLowerCase().trim()
  const nombre = p.nombre.trim()
  const apellido = p.apellido.trim()
  const fullName = `${nombre} ${apellido}`.trim()

  // 1) Link de invitación SIN enviar email. El admin comparte el action_link;
  //    el invitado lo abre, define contraseña y queda activo.
  const { data: invited, error: inviteError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name: fullName } },
  })
  if (inviteError) return { error: inviteError.message }

  const invitedUser = invited.user
  const actionLink = invited.properties?.action_link
  if (!invitedUser || !actionLink) {
    return { error: 'No se pudo generar el link de invitación' }
  }

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
  if (memberError) return { error: memberError.message }

  // 4) Persona del directorio (nombre/apellido separados + tipo "Profesional H y S").
  //    Secundario: si falla NO aborta la invitación (el link ya existe).
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

  return { link: actionLink }
}
