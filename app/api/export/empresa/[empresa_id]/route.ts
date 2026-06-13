import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { consultoraIdFromEmpresa } from '@/lib/storage/tenant-path'
import { logAuditEvent } from '@/lib/audit/log-event'
import { parseExportScope } from '@/lib/export/scoping'
import { buildEmpresaExportPackage, exportFilename } from '@/lib/export/build-package'
import { storeExportAndSign } from '@/lib/export/store-and-sign'
import { sendExportListoEmail } from '@/lib/email/export-listo'
import { exportJobRunUrl } from '@/lib/export/worker-url'

// Fast-path: paquetes chicos se generan y descargan en el mismo request. Damos
// margen amplio (Vercel PRO) para que el sync no haga timeout antes de decidir.
export const runtime = 'nodejs'
export const maxDuration = 300

/**
 * Export de portabilidad por empresa (Res. SRT 48/2025).
 *
 * Modos:
 *   - SÍNCRONO (default): arma el ZIP y lo devuelve como descarga directa.
 *   - ASÍNCRONO (?async=1 o paquete grande): guarda el ZIP en el bucket privado
 *     `exports`, devuelve un SIGNED URL temporal en JSON y envía email con el link.
 *
 * Alcance vía query params (ver lib/export/scoping.ts):
 *   ?desde=2026-01-01&hasta=2026-12-31  parcial por rango de fechas
 *   ?entidades=inspecciones,riesgos     parcial por tipo de entidad
 *   ?formato=csv|json|both              formatos (default both)
 *   ?archivos=0                         excluir binarios (default incluidos)
 *   ?async=1                            forzar generación async + link
 *
 * Aislamiento multi-tenant: doble capa (has_empresa_read_access + filtro
 * explícito por empresa/establecimientos). Ver build-package.ts.
 */

// Umbral para pasar a entrega por link aunque no se haya pedido async.
const ASYNC_BYTES_THRESHOLD = 25 * 1024 * 1024 // 25 MB

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ empresa_id: string }> },
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { empresa_id: empresaId } = await params

  // ── Acceso (doble capa: RLS + función explícita) ──
  const { data: hasAccess } = await supabase.rpc('has_empresa_read_access', {
    p_empresa_id: empresaId,
  })
  if (!hasAccess) return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 })

  // ── Parsear alcance ──
  let scope
  try {
    scope = parseExportScope(req.nextUrl.searchParams)
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Parámetros inválidos' },
      { status: 400 },
    )
  }

  const consultoraId = await consultoraIdFromEmpresa(supabase, empresaId)

  // ── SLOW-PATH (worker async): si el front pide modo job (?async=1), NO
  // generamos el ZIP en este request. Encolamos un export_job (pending),
  // devolvemos { modo:'job', jobId } de inmediato y disparamos el worker en
  // background con after(). El worker arma + guarda + firma + emailea. El front
  // hace polling a /api/export/jobs/<id> hasta ready/error.
  if (scope.async) {
    if (!consultoraId) {
      return NextResponse.json(
        { error: 'No se pudo resolver la consultora de la empresa' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: job, error: insErr } = await admin
      .from('export_jobs')
      .insert({
        consultora_id: consultoraId,
        empresa_id: empresaId,
        solicitado_por: user.id,
        estado: 'pending',
        scope: scope as unknown as Record<string, unknown>,
      })
      .select('id')
      .single()

    if (insErr || !job) {
      console.error('[export] no se pudo encolar el job:', insErr)
      return NextResponse.json({ error: 'No se pudo encolar la exportación' }, { status: 500 })
    }

    const jobId = job.id as string
    const runUrl = exportJobRunUrl(jobId, req)
    const secret = process.env.CRON_SECRET

    // Disparo best-effort en background. Si after() no llega a ejecutar el
    // fetch (cold start raro), el cron de reconciliación marca el job en error.
    after(async () => {
      try {
        await fetch(runUrl, {
          method: 'POST',
          headers: secret ? { Authorization: `Bearer ${secret}` } : {},
        })
      } catch (e) {
        console.error('[export] disparo del worker falló (lo recupera el cron):', e)
      }
    })

    return NextResponse.json({ modo: 'job', jobId })
  }

  // ── FAST-PATH (sync): paquetes chicos. Armamos el ZIP en el request.
  let pkg
  try {
    pkg = await buildEmpresaExportPackage(supabase, empresaId, scope)
  } catch (e) {
    console.error('[export] error armando paquete:', e)
    return NextResponse.json({ error: 'Error generando la exportación' }, { status: 500 })
  }

  const filename = exportFilename(pkg.empresaNombre)
  const alcanceTexto =
    scope.modo === 'completo'
      ? 'Completo'
      : `Parcial${scope.desde || scope.hasta ? ` (${scope.desde ?? '…'} a ${scope.hasta ?? '…'})` : ''}${
          scope.entidades ? ` [${scope.entidades.join(', ')}]` : ''
        }`

  // Metadata común para el audit log.
  const auditMeta = {
    alcance: scope.modo,
    desde: scope.desde,
    hasta: scope.hasta,
    entidades: scope.entidades,
    formatos: scope.formatos,
    incluye_archivos: scope.incluyeArchivos,
    filas: pkg.totalRows,
    archivos_binarios: pkg.totalArchivos,
    bytes: pkg.zip.byteLength,
    omitidas: pkg.omitidas.map(o => o.entidad),
  }

  // Aunque vino por fast-path (sync), si el ZIP resultó grande lo entregamos por
  // link (no transferimos un binario enorme por HTTP). scope.async ya se manejó
  // antes como job: acá solo queda el umbral por bytes.
  const debeSerAsync = pkg.zip.byteLength > ASYNC_BYTES_THRESHOLD

  // ── ENTREGA ASÍNCRONA: guardar en bucket + signed URL + email ──
  if (debeSerAsync && consultoraId) {
    try {
      const admin = createAdminClient()
      const stored = await storeExportAndSign(
        admin,
        consultoraId,
        empresaId,
        filename,
        pkg.zip,
      )

      // Email best-effort con el link.
      if (user.email) {
        const userName =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null
        sendExportListoEmail({
          email: user.email,
          userName,
          empresaNombre: pkg.empresaNombre,
          signedUrl: stored.signedUrl,
          ttlHoras: Math.round(stored.ttlSeconds / 3600),
          alcance: alcanceTexto,
        }).catch(err => console.error('[export] email no enviado (no bloqueante):', err))
      }

      // Audit log best-effort.
      await logAuditEvent(supabase, {
        accion: 'EXPORT',
        tabla: 'empresas',
        registroId: empresaId,
        consultoraId,
        meta: { ...auditMeta, formato_entrega: 'async_signed_url', storage_path: stored.path },
      })

      return NextResponse.json({
        modo: 'async',
        signedUrl: stored.signedUrl,
        ttlSegundos: stored.ttlSeconds,
        bytes: stored.bytes,
        filename,
        alcance: alcanceTexto,
        omitidas: pkg.omitidas,
      })
    } catch (e) {
      // Si falla el guardado async, caemos a descarga directa (no perder el export).
      console.error('[export] async falló, fallback a descarga directa:', e)
    }
  }

  // ── ENTREGA SÍNCRONA: descarga directa ──
  await logAuditEvent(supabase, {
    accion: 'EXPORT',
    tabla: 'empresas',
    registroId: empresaId,
    consultoraId,
    meta: { ...auditMeta, formato_entrega: 'descarga_directa' },
  })

  const body = pkg.zip.buffer.slice(
    pkg.zip.byteOffset,
    pkg.zip.byteOffset + pkg.zip.byteLength,
  ) as ArrayBuffer

  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
