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
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { full_name },
  })

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 })

  if (invited.user) {
    await admin.from('profiles').upsert({
      id: invited.user.id,
      full_name: full_name || email,
      system_role: 'user',
    }, { onConflict: 'id' })

    const { error: memberError } = await admin.from('consultoras_members').insert({
      consultora_id: consultoraId,
      user_id: invited.user.id,
      role,
      invited_by: user.id,
    })

    if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
