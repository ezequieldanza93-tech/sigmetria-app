import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = await createClient()

  // 1. Marcar cursos vencidos
  const { data: vencidosData } = await supabase.rpc('marcar_cursos_vencidos')
  const vencidos = vencidosData ?? 0

  // 2. Crear notificaciones para próximos a vencer (30, 7, 1 día)
  const today = new Date()
  const diasAviso = [30, 7, 1]

  const { data: asignaciones } = await supabase
    .from('curso_asignaciones')
    .select('id, curso_id, persona_id, fecha_limite, directorio_personas!persona_id(created_in_consultora_id, usuario_id, nombre, apellido), cursos!curso_id(titulo, consultora_id)')
    .in('estado', ['pendiente', 'en_curso'])
    .not('fecha_limite', 'is', null)

  let notificacionesCreadas = 0

  for (const asig of (asignaciones ?? []) as any[]) {
    if (!asig.fecha_limite) continue

    const fechaLimite = new Date(asig.fecha_limite)
    const diffDays = Math.ceil((fechaLimite.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

    if (diasAviso.includes(diffDays)) {
      const consultoraId = asig.cursos?.consultora_id ?? asig.directorio_personas?.created_in_consultora_id
      if (!consultoraId) continue

      // Check if notification already exists
      const { count } = await supabase
        .from('notificaciones')
        .select('id', { count: 'exact', head: true })
        .eq('consultora_id', consultoraId)
        .eq('entidad_tipo', 'curso_asignacion')
        .eq('entidad_id', asig.id)
        .eq('dias_restantes', diffDays)

      if (count && count > 0) continue

      await supabase.from('notificaciones').insert({
        consultora_id: consultoraId,
        tipo: 'vencimiento',
        entidad_tipo: 'curso_asignacion',
        entidad_id: asig.id,
        titulo: `Curso próximo a vencer`,
        mensaje: `El curso "${asig.cursos?.titulo}" vence en ${diffDays} día(s). Completalo antes de la fecha límite.`,
        entidad_nombre: asig.cursos?.titulo ?? 'Curso',
        contexto_nombre: `${asig.directorio_personas?.nombre ?? ''} ${asig.directorio_personas?.apellido ?? ''}`.trim() || null,
        fecha_vencimiento: asig.fecha_limite,
        dias_restantes: diffDays,
      })

      notificacionesCreadas++
    }
  }

  return NextResponse.json({
    ok: true,
    vencidos,
    notificaciones_creadas: notificacionesCreadas,
  })
}
