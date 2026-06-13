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

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

  const invitedUser = invited.user
  const actionLink = invited.properties?.action_link
  if (!invitedUser || !actionLink) {
    return NextResponse.json({ error: 'No se pudo generar el link de invitación' }, { status: 500 })
  }

  await admin.from('profiles').upsert({
    id: invitedUser.id,
    full_name: full_name || email,
    system_role: 'user',
  }, { onConflict: 'id' })

  const { error: memberError } = await admin.from('consultoras_members').insert({
    consultora_id: consultoraId,
    user_id: invitedUser.id,
    role,
    invited_by: user.id,
  })

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })

  // ── Identidad normalizada: la cuenta se linkea a UNA persona del directorio ──
  // La persona es dueña del email (single source of truth). Se setea user_id.
  if (persona_id) {
    // Viewer de Observaciones u otro: linkear una persona existente del directorio.
    await admin
      .from('personas_directorio')
      .update({ user_id: invitedUser.id, email })
      .eq('id', persona_id)
  } else {
    const nameParts = full_name.trim().split(/\s+/)
    const nombre = nameParts[0]
    const apellido = nameParts.slice(1).join(' ') || nombre

    const { data: existing } = await admin
      .from('personas_directorio')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existing) {
      await admin.from('personas_directorio').update({ user_id: invitedUser.id }).eq('id', existing.id)
    } else {
      // Asegurar el tipo "Usuarios"
      let tipoId: string | undefined
      const { data: usuarioTipo } = await admin
        .from('personas_tipos').select('id').eq('nombre', 'Usuarios').maybeSingle()
      tipoId = usuarioTipo?.id
      if (!tipoId) {
        const { data: nuevoTipo } = await admin
          .from('personas_tipos').insert({ nombre: 'Usuarios' }).select('id').single()
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
        })
      }
    }
  }

  return NextResponse.json({ success: true, link: actionLink, role })
}
