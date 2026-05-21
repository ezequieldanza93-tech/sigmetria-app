import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { actionId } = await req.json()
  if (!actionId) return NextResponse.json({ error: 'actionId requerido' }, { status: 400 })

  const { error } = await supabase
    .from('agent_pending_actions')
    .update({ status: 'rejected' })
    .eq('id', actionId)
    .eq('requested_by', user.id)

  if (error) return NextResponse.json({ success: false, error: error.message })

  return NextResponse.json({ success: true, message: 'Acción rechazada' })
}
