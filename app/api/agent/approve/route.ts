import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { actionId } = await req.json()
  if (!actionId) return NextResponse.json({ error: 'actionId requerido' }, { status: 400 })

  const { data: action, error: fetchError } = await supabase
    .from('agent_pending_actions')
    .select('*')
    .eq('id', actionId)
    .single()

  if (fetchError || !action) {
    return NextResponse.json({ error: 'Acción no encontrada' }, { status: 404 })
  }

  if (action.status !== 'pending') {
    return NextResponse.json({ error: 'La acción ya fue procesada' }, { status: 400 })
  }

  const payload = action.payload as Record<string, unknown>

  if (action.action_type === 'registrar_gestion') {
    const { error } = await supabase.from('gestiones_establecimientos').insert({
      establecimiento_id: payload.establecimiento_id as string,
      tipo: payload.tipo as string,
      descripcion: payload.descripcion as string,
      fecha_planificada: payload.fecha_planificada as string,
    })
    if (error) return NextResponse.json({ success: false, error: error.message })
  }

  if (action.action_type === 'actualizar_riesgo') {
    const { error } = await supabase
      .from('riesgos')
      .update({ estado: payload.estado as string, notas: payload.notas as string })
      .eq('id', payload.riesgo_id as string)
    if (error) return NextResponse.json({ success: false, error: error.message })
  }

  const { error: updateError } = await supabase
    .from('agent_pending_actions')
    .update({ status: 'approved' })
    .eq('id', actionId)

  if (updateError) return NextResponse.json({ success: false, error: updateError.message })

  return NextResponse.json({ success: true, message: 'Acción aprobada y ejecutada' })
}
