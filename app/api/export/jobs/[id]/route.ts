import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { EXPORT_SIGNED_TTL_SECONDS } from '@/lib/export/store-and-sign'

/**
 * Estado de un job de export (Estándar 3 Portabilidad, SRT Disp. 15/2026).
 *
 * GET autenticado con la SESIÓN del usuario: la RLS de export_jobs garantiza
 * que solo un miembro activo de la consultora dueña ve el job. El front hace
 * polling acá hasta que el estado sea 'ready' (abre el signedUrl) o 'error'.
 *
 * El signed URL se firma FRESCO en cada consulta (no se persiste): así nunca
 * devolvemos un link vencido y el TTL arranca cuando el usuario lo va a usar.
 */

export const runtime = 'nodejs'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { id: jobId } = await params

  // RLS: solo el miembro de la consultora dueña obtiene la fila.
  const { data: job, error } = await supabase
    .from('export_jobs')
    .select('estado, bytes, error, storage_path')
    .eq('id', jobId)
    .maybeSingle()

  if (error || !job) {
    return NextResponse.json({ error: 'Job inexistente o sin acceso' }, { status: 404 })
  }

  // Firmar URL fresco solo si está listo y tiene path.
  let signedUrl: string | null = null
  if (job.estado === 'ready' && job.storage_path) {
    const admin = createAdminClient()
    const { data: signed } = await admin.storage
      .from('exports')
      .createSignedUrl(job.storage_path, EXPORT_SIGNED_TTL_SECONDS)
    signedUrl = signed?.signedUrl ?? null
  }

  return NextResponse.json({
    estado: job.estado,
    bytes: job.bytes,
    error: job.error,
    signedUrl,
  })
}
