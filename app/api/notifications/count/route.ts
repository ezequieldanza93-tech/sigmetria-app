import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ count: 0 })

  const { data: count } = await supabase.rpc('count_notificaciones_no_leidas', {
    p_usuario_id: user.id,
  })

  return NextResponse.json({ count: count ?? 0 })
}
