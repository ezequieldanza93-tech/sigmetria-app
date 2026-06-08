import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireOrigin } from '@/lib/csrf'
import type { UserRole } from '@/lib/types'
import { canManageUsers } from '@/lib/types'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email(),
  full_name: z.string().min(1),
  role: z.string().min(1),
  consultora_id: z.string().uuid().optional(),
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

  if (!canManageUsers(membership?.role as UserRole ?? null, profile?.system_role ?? 'user')) {
    return NextResponse.json({ error: 'Sin permisos para invitar usuarios' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 })
  }

  const { email, full_name, role, consultora_id } = parsed.data
  const consultoraId = consultora_id ?? membership?.consultora_id
  if (!consultoraId) return NextResponse.json({ error: 'Sin consultora' }, { status: 400 })

  if (membership?.role !== 'full_access_main' && profile?.system_role !== 'developer') {
    return NextResponse.json({ error: 'Solo el Admin Principal puede agregar miembros' }, { status: 403 })
  }

  const [{ count: activeCount }, { data: consultora }] = await Promise.all([
    supabase
      .from('consultoras_members')
      .select('*', { count: 'exact', head: true })
      .eq('consultora_id', consultoraId)
      .eq('is_active', true),
    supabase
      .from('consultoras')
      .select('seats_max')
      .eq('id', consultoraId)
      .single(),
  ])

  const seatsMax = consultora?.seats_max ?? 3
  const seatsUsed = activeCount ?? 0
  if (seatsUsed >= seatsMax) {
    return NextResponse.json({ error: `SEATS_LIMIT:${seatsUsed}:${seatsMax}` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Genera el link de invitación SIN enviar email (a diferencia de
  // inviteUserByEmail, que dispara el mail). El admin comparte el link como
  // prefiera; el invitado lo abre, setea contraseña y queda activo.
  const { data: invited, error: inviteError } = await admin.auth.admin.generateLink({
    type: 'invite',
    email,
    options: { data: { full_name } },
  })

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

  const invitedUser = invited.user
  // No usamos properties.action_link: ese link nativo de Supabase deja la
  // sesión en el hash fragment (#access_token=...), que el middleware
  // cookie-based no puede leer → el invitado cae en /login sin sesión. En su
  // lugar apuntamos a /auth/confirm con el hashed_token, que verifyOtp canjea
  // server-side y escribe las cookies de sesión.
  const hashedToken = invited.properties?.hashed_token
  if (!invitedUser || !hashedToken) {
    return NextResponse.json({ error: 'No se pudo generar el link de invitación' }, { status: 500 })
  }

  const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin
  const inviteLink = `${siteUrl}/auth/confirm?token_hash=${hashedToken}&type=invite`

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

  // Sync to personas_directorio as "Usuarios" type
  const nameParts = full_name.trim().split(/\s+/)
  const nombre = nameParts[0]
  const apellido = nameParts.slice(1).join(' ') || nombre
  const { data: usuarioTipo } = await admin
    .from('personas_tipos')
    .select('id')
    .eq('nombre', 'Usuarios')
    .maybeSingle()
  if (usuarioTipo) {
    const { data: existing } = await admin
      .from('personas_directorio')
      .select('id')
      .eq('email', email)
      .maybeSingle()
    if (!existing) {
      await admin.from('personas_directorio').insert({
        tipo_id: usuarioTipo.id,
        nombre,
        apellido,
        email,
        is_active: true,
      })
    }
  }

  return NextResponse.json({ success: true, link: inviteLink, role })
}
