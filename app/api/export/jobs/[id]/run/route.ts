import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildEmpresaExportPackage, exportFilename } from '@/lib/export/build-package'
import { storeExportAndSign } from '@/lib/export/store-and-sign'
import { sendExportListoEmail } from '@/lib/email/export-listo'
import type { ExportRequestScope } from '@/lib/export/scoping'

/**
 * WORKER async de export (Estándar 3 Portabilidad, SRT Disp. 15/2026).
 *
 * Lo dispara el route de export con `after(() => fetch(...))` cuando el front
 * pide modo job. Toma el job (pending → processing), arma el paquete con
 * lib/export/*, lo guarda en el bucket `exports` + signed URL, marca ready con
 * los totales y emailea el link (best-effort). En error → estado error.
 *
 * AISLAMIENTO: el job ya fue encolado por un usuario que pasó
 * has_empresa_read_access en el route. Acá NO hay sesión, así que usamos el
 * cliente service_role (sin RLS). El aislamiento por empresa lo garantiza el
 * filtro EXPLÍCITO por empresa/establecimiento de buildEmpresaExportPackage
 * (defensa en profundidad, ver el doc del archivo) + el storage_path prefijado
 * por {consultora_id}.
 *
 * Auth: Bearer CRON_SECRET (igual que app/api/cron/limpiar-exports).
 * Idempotente: si el job ya está ready, no re-procesa.
 */

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[export-worker] CRON_SECRET no configurado')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: jobId } = await params
  const admin = createAdminClient()

  // ── Cargar el job ──
  const { data: job, error: loadErr } = await admin
    .from('export_jobs')
    .select('id, consultora_id, empresa_id, solicitado_por, estado, scope')
    .eq('id', jobId)
    .maybeSingle()

  if (loadErr || !job) {
    return NextResponse.json({ error: 'Job inexistente' }, { status: 404 })
  }

  // Idempotencia: si ya terminó, no re-procesamos.
  if (job.estado === 'ready') {
    return NextResponse.json({ jobId, estado: 'ready', skipped: true })
  }
  if (job.estado === 'error') {
    return NextResponse.json({ jobId, estado: 'error', skipped: true })
  }

  // ── Tomar el job (pending → processing). Si otro worker ya lo tomó, salimos. ──
  const { data: tomado, error: takeErr } = await admin.rpc('export_job_mark_processing', {
    p_id: jobId,
  })
  if (takeErr) {
    console.error('[export-worker] no se pudo marcar processing:', takeErr)
    return NextResponse.json({ error: 'No se pudo tomar el job' }, { status: 500 })
  }
  if (!tomado) {
    // Ya no estaba pending (otro worker lo tomó o terminó) → idempotente.
    return NextResponse.json({ jobId, estado: 'processing', skipped: true })
  }

  const scope = job.scope as unknown as ExportRequestScope
  const empresaId = job.empresa_id as string
  const consultoraId = job.consultora_id as string

  try {
    // ── Armar el paquete (service_role: sin RLS, con filtro explícito por empresa) ──
    const pkg = await buildEmpresaExportPackage(admin, empresaId, scope)
    const filename = exportFilename(pkg.empresaNombre)

    // ── Guardar en el bucket + firmar URL ──
    const stored = await storeExportAndSign(admin, consultoraId, empresaId, filename, pkg.zip)

    const expiresAt = new Date(Date.now() + stored.ttlSeconds * 1000).toISOString()

    // ── Marcar ready ──
    const { error: readyErr } = await admin.rpc('export_job_mark_ready', {
      p_id: jobId,
      p_storage_path: stored.path,
      p_bytes: stored.bytes,
      p_total_rows: pkg.totalRows,
      p_total_archivos: pkg.totalArchivos,
      p_expires_at: expiresAt,
    })
    if (readyErr) {
      console.error('[export-worker] no se pudo marcar ready:', readyErr)
      // El job quedó procesado pero sin marcar ready → el cron lo reconciliará.
      return NextResponse.json({ error: 'Generado pero no se pudo marcar ready' }, { status: 500 })
    }

    // ── Email best-effort (no bloquea el resultado del worker) ──
    const { data: userRes } = await admin.auth.admin.getUserById(job.solicitado_por as string)
    const email = userRes?.user?.email
    if (email) {
      const meta = userRes?.user?.user_metadata as Record<string, unknown> | undefined
      const userName =
        (meta?.full_name as string | undefined) ?? (meta?.name as string | undefined) ?? null
      const alcanceTexto =
        scope.modo === 'completo'
          ? 'Completo'
          : `Parcial${scope.desde || scope.hasta ? ` (${scope.desde ?? '…'} a ${scope.hasta ?? '…'})` : ''}${
              scope.entidades ? ` [${scope.entidades.join(', ')}]` : ''
            }`
      sendExportListoEmail({
        email,
        userName,
        empresaNombre: pkg.empresaNombre,
        signedUrl: stored.signedUrl,
        ttlHoras: Math.round(stored.ttlSeconds / 3600),
        alcance: alcanceTexto,
      }).catch(err => console.error('[export-worker] email no enviado (no bloqueante):', err))
    }

    return NextResponse.json({
      jobId,
      estado: 'ready',
      bytes: stored.bytes,
      totalRows: pkg.totalRows,
      totalArchivos: pkg.totalArchivos,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error generando la exportación'
    console.error('[export-worker] error procesando job', jobId, e)
    await admin.rpc('export_job_mark_error', { p_id: jobId, p_error: msg })
    return NextResponse.json({ jobId, estado: 'error', error: msg }, { status: 500 })
  }
}
