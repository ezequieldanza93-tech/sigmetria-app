import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrigin } from '@/lib/csrf'
import type { UserRole, SystemRole } from '@/lib/types'
import { canManageUsers, canInviteViewers, isFreeViewerRole, consumesSeat } from '@/lib/types'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.string().min(1),
  consultora_id: z.string().uuid().optional(),
  // Persona del directorio a la que se linkea la cuenta (ej. Viewer de Observaciones).
  persona_id: z.string().uuid().optional(),
})

export async function POST(request: NextRequest) {
  const originErr = requireOrigin(request)
  if (originErr) return originErr

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from('profiles').select('system_role').eq('id', user.id).single(),
    supabase.from('consultoras_members').select('role, consultora_id').eq('user_id', user.id).eq('is_active', true).maybeSingle(),
  ])

  const systemRole = (profile?.system_role ?? 'user') as SystemRole
  const myRole = (membership?.role as UserRole | undefined) ?? null

  const body = await request.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { email, full_name, role, consultora_id, persona_id } = parsed.data
  const consultoraId = consultora_id ?? membership?.consultora_id
  if (!consultoraId) return NextResponse.json({ error: 'Sin consultora' }, { status: 400 })

  const targetIsViewer = isFreeViewerRole(role as UserRole)

  // Viewers (sin cargo): Admin o colaborador. Otros roles: solo Admin Principal.
  if (targetIsViewer) {
    if (!canInviteViewers(myRole, systemRole)) {
      return NextResponse.json({ error: 'Sin permisos para invitar usuarios' }, { status: 403 })
    }
  } else if (!canManageUsers(myRole, systemRole)) {
    return NextResponse.json({ error: 'Solo el Admin Principal puede crear Administradores o Colaboradores' }, { status: 403 })
  }

  // Control de seats: solo cuentan los roles con cargo. El auditor del organismo de
  // control (solo lectura) NO consume seat, igual que los viewers.
  if (consumesSeat(role as UserRole)) {
    const [{ data: members }, { data: consultora }] = await Promise.all([
      supabase
        .from('consultoras_members')
        .select('role')
        .eq('consultora_id', consultoraId)
        .eq('is_active', true),
      supabase
        .from('consultoras')
        .select('seats_max')
        .eq('id', consultoraId)
        .single(),
    ])
    const seatsMax = consultora?.seats_max ?? 3
    const seatsUsed = (members ?? []).filter(m => consumesSeat(m.role as UserRole)).length
    if (seatsUsed >= seatsMax) {
      return NextResponse.json({ error: `SEATS_LIMIT:${seatsUsed}:${seatsMax}` }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  // Genera el link de invitación SIN enviar email (a diferencia de
  // inviteUserByEmail, que dispara el mail). El admin comparte el action_link
  // como prefiera; el invitado lo abre, setea contraseña y queda activo.
  const { data: invited, error: inviteError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name } },
  })

  if (inviteError) {
    console.error('[invite-user] generateLink falló:', inviteError)
    return NextResponse.json({ error: inviteError.message }, { status: 500 })
  }

  const invitedUser = invited.user
  const actionLink = invited.properties?.action_link
  if (!invitedUser || !actionLink) {
    console.error('[invite-user] generateLink OK pero sin user/actionLink:', invited)
    return NextResponse.json({ error: 'No se pudo generar el link de invitación' }, { status: 500 })
  }

  const { error: profileError } = await admin.from('profiles').upsert({
    id: invitedUser.id,
    full_name: full_name || email,
    system_role: 'user',
  }, { onConflict: 'id' })

  if (profileError) {
    console.error('[invite-user] upsert profiles falló:', profileError)
  }

  const { error: memberError } = await admin.from('consultoras_members').insert({
    consultora_id: consultoraId,
    user_id: invitedUser.id,
    role,
    invited_by: user.id,
  })

  if (memberError) {
    console.error('[invite-user] insert consultoras_members falló:', memberError)
    return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  // ── Identidad normalizada: la cuenta se linkea a UNA persona del directorio ──
  // La persona es dueña del email (single source of truth). Se setea user_id.
  // IMPORTANTE: este bloque es secundario — si falla no aborta la invitación;
  // el link ya fue generado y el miembro fue creado.
  try {
    if (persona_id) {
      // Viewer de Observaciones u otro: linkear una persona existente del directorio.
      const { error: linkErr } = await admin
        .from('personas_directorio')
        .update({ user_id: invitedUser.id, email })
        .eq('id', persona_id)
      if (linkErr) {
        console.error('[invite-user] update personas_directorio (por persona_id) falló:', linkErr)
      }
    } else {
      const nameParts = full_name.trim().split(/\s+/)
      const nombre = nameParts[0]
      const apellido = nameParts.slice(1).join(' ') || nombre

      // 1) Buscar por email exacto
      const { data: existingByEmail } = await admin
        .from('personas_directorio')
        .select('id')
        .eq('email', email)
        .maybeSingle()

      if (existingByEmail) {
        // Ya existe una persona con ese email → linkear
        const { error: linkErr } = await admin
          .from('personas_directorio')
          .update({ user_id: invitedUser.id })
          .eq('id', existingByEmail.id)
        if (linkErr) {
          console.error('[invite-user] update personas_directorio (por email) falló:', linkErr)
        }
      } else {
        // 2) Buscar persona activa por nombre+apellido (puede chocar con unique index)
        const { data: existingByName } = await admin
          .from('personas_directorio')
          .select('id, user_id')
          .eq('nombre', nombre)
          .eq('apellido', apellido)
          .eq('is_active', true)
          .maybeSingle()

        if (existingByName) {
          // Persona activa con mismo nombre → linkear en vez de insertar
          console.warn('[invite-user] persona existente por nombre, linkeando user_id:', existingByName.id)
          const { error: linkErr } = await admin
            .from('personas_directorio')
            .update({ user_id: invitedUser.id, email })
            .eq('id', existingByName.id)
          if (linkErr) {
            console.error('[invite-user] update personas_directorio (por nombre) falló:', linkErr)
          }
        } else {
          // 3) Insertar nueva persona — asegurar el tipo "Usuarios"
          let tipoId: string | undefined
          const { data: usuarioTipo } = await admin
            .from('personas_tipos').select('id').eq('nombre', 'Usuarios').maybeSingle()
          tipoId = usuarioTipo?.id

          if (!tipoId) {
            const { data: nuevoTipo, error: tipoErr } = await admin
              .from('personas_tipos').insert({ nombre: 'Usuarios' }).select('id').single()
            if (tipoErr) {
              console.error('[invite-user] insert personas_tipos falló:', tipoErr)
            }
            tipoId = nuevoTipo?.id
          }

          if (!tipoId) {
            console.error('[invite-user] no se pudo obtener tipo_id "Usuarios" — se omite creación de persona en directorio')
          } else {
            const { error: insertErr } = await admin.from('personas_directorio').insert({
              tipo_id: tipoId,
              nombre,
              apellido,
              email,
              user_id: invitedUser.id,
              is_active: true,
            })
            if (insertErr) {
              // Puede ser el unique index (nombre+apellido+dni cuando dni IS NOT NULL)
              // o cualquier otro constraint. Lo logueamos y seguimos — el link ya existe.
              console.error('[invite-user] insert personas_directorio falló:', insertErr)
            }
          }
        }
      }
    }
  } catch (personaErr) {
    // Falla inesperada en el bloque de directorio — loguear y continuar
    console.error('[invite-user] bloque personas_directorio excepción inesperada:', personaErr)
  }

  return NextResponse.json({ success: true, link: actionLink, role })
}
