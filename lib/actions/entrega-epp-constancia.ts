'use server'

/**
 * entrega-epp-constancia.ts — Server actions de la CONSTANCIA DE ENTREGA DE EPP (staff)
 *
 * Flujo (mismo patrón que reporte-fotografico):
 *   1) getConstanciaEntregaEpp(entregaId) → arma { ctx, data } para el report-kit.
 *      - data: payload de la entrega (RPC entrega_epp_constancia, RLS por miembro).
 *      - ctx:  branding (logos/profesional/firma) via buildReportContext del establecimiento.
 *   2) El client component arma el PDF con @react-pdf/renderer y lo manda como data-URI.
 *   3) guardarConstanciaEntregaEpp(formData) → sube el PDF al bucket privado `documentos`
 *      (path tenant-prefijado) y devuelve una signed URL para descargar/compartir.
 */

import { createClient } from '@/lib/supabase/server'
import { buildReportContext } from '@/lib/actions/report-context'
import { consultoraIdFromEstablecimiento, tenantStoragePath } from '@/lib/storage/tenant-path'
import { resolveAssetUrl } from '@/lib/storage/resolve-url'
import type { ReportContext } from '@/lib/pdf/report-kit'
import type { ActionResult } from '@/lib/types'
import type { ConstanciaEntregaData } from '@/lib/pdf/descriptors/constancia-entrega-epp'

const PDF_SIGNED_TTL_SECONDS = 60 * 60

/** Decodifica un PDF en data-URI base64 a Buffer. null si inválido. */
function pdfBase64ToBuffer(raw: string): Buffer | null {
  if (!raw) return null
  const comma = raw.indexOf(',')
  const b64 = raw.startsWith('data:') && comma >= 0 ? raw.slice(comma + 1) : raw
  if (!b64) return null
  try {
    return Buffer.from(b64, 'base64')
  } catch {
    return null
  }
}

export interface ConstanciaEntregaEppPayload {
  ctx: ReportContext | null
  data: ConstanciaEntregaData
}

/**
 * Arma el payload de la constancia: datos de la entrega (RPC RLS-scopeada) +
 * branding del establecimiento. `ctx` puede ser null si la entrega no tiene
 * establecimiento (entrega suelta) — el front genera el PDF con el branding base.
 */
export async function getConstanciaEntregaEpp(
  entregaId: string,
): Promise<ActionResult<ConstanciaEntregaEppPayload>> {
  if (!entregaId) return { success: false, error: 'Falta el id de la entrega' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: rpcData, error } = await supabase.rpc('entrega_epp_constancia', {
    p_entrega_id: entregaId,
  })
  if (error) return { success: false, error: error.message }
  if (!rpcData) return { success: false, error: 'Entrega no encontrada o sin acceso' }

  const data = rpcData as unknown as ConstanciaEntregaData & {
    establecimiento_id: string | null
    establecimiento_nombre: string | null
  }

  const DOCUMENTO = {
    titulo: 'Constancia de Entrega de EPP',
    norma: 'Ley 19.587 / Dec. 351/79 — Provisión de EPP',
  }

  // Branding: si la entrega cuelga de un establecimiento, resolvemos logos/firma/profesional.
  let ctx: ReportContext | null = null
  if (data.establecimiento_id) {
    const ctxRes = await buildReportContext({
      establecimientoId: data.establecimiento_id,
      titulo: DOCUMENTO.titulo,
      norma: DOCUMENTO.norma,
      fechaEmision: data.fecha_entrega,
    })
    if (ctxRes.success) ctx = ctxRes.data
  }

  // Fallback: entrega suelta (sin establecimiento) — armamos un ctx mínimo con la
  // consultora + el profesional logueado para que el PDF igual tenga marca y firma.
  if (!ctx) {
    ctx = await buildFallbackContext(supabase, user.id, data, DOCUMENTO)
  }

  return { success: true, data: { ctx, data } }
}

/**
 * ctx mínimo para entregas sueltas (sin establecimiento). Resuelve consultora +
 * profesional logueado. Empresa/establecimiento quedan con placeholders neutros
 * (el header del report-kit los tolera). Best-effort: nunca lanza.
 */
async function buildFallbackContext(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  data: ConstanciaEntregaData & { establecimiento_id: string | null; establecimiento_nombre: string | null },
  documento: { titulo: string; norma: string },
): Promise<ReportContext | null> {
  try {
    // consultora dueña: vía la persona de la entrega (consultora_id está en entregas_epp).
    const { data: ent } = await supabase
      .from('entregas_epp')
      .select('consultora_id, consultoras!inner(nombre, cuit, logo_url)')
      .eq('id', data.id)
      .maybeSingle()
    const consultora = ent?.consultoras as
      | { nombre: string; cuit: string | null; logo_url: string | null }
      | { nombre: string; cuit: string | null; logo_url: string | null }[]
      | undefined
    const c = Array.isArray(consultora) ? consultora[0] : consultora
    if (!c) return null

    const [{ data: profile }, { data: perfil }] = await Promise.all([
      supabase.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
      supabase.from('perfiles_profesionales').select('id, firma_url').eq('user_id', userId).maybeSingle(),
    ])

    const [logoUrl, firmaUrl] = await Promise.all([
      resolveAssetUrl('consultora', c.logo_url),
      perfil?.firma_url ? resolveAssetUrl('firmas', perfil.firma_url) : Promise.resolve(null),
    ])

    let matricula: string | undefined
    if (perfil?.id) {
      const { data: mats } = await supabase
        .from('matriculas_profesionales')
        .select('emisor, numero')
        .eq('perfil_id', perfil.id)
        .eq('activa', true)
        .order('created_at', { ascending: false })
        .limit(1)
      const m = mats?.[0]
      if (m) matricula = `${m.emisor} ${m.numero}`.trim()
    }

    return {
      consultora: { logoUrl: logoUrl ?? '', nombre: c.nombre, cuit: c.cuit ?? undefined },
      empresa: { razonSocial: '—', cuit: '', logoUrl: undefined },
      establecimiento: { nombre: data.establecimiento_nombre ?? '—' },
      profesional: { nombre: profile?.full_name ?? '—', matricula, firmaUrl: firmaUrl ?? undefined },
      documento: { titulo: documento.titulo, norma: documento.norma, fechaEmision: fechaCortaIso(data.fecha_entrega) },
    }
  } catch {
    return null
  }
}

function fechaCortaIso(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date()
  if (isNaN(d.getTime())) return ''
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`
}

export interface GuardarConstanciaResult {
  pdfSignedUrl: string | null
}

/**
 * Sube el PDF de la constancia (data-URI base64 en el campo `pdf`) al bucket
 * privado `documentos` con path tenant-prefijado y devuelve una signed URL.
 * Requiere `entrega_id` para resolver la consultora dueña por la jerarquía de datos.
 */
export async function guardarConstanciaEntregaEpp(
  formData: FormData,
): Promise<ActionResult<GuardarConstanciaResult>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const entregaId = (formData.get('entrega_id') as string) || ''
  const pdfRaw = (formData.get('pdf') as string) || ''
  if (!entregaId) return { success: false, error: 'Falta el id de la entrega' }

  const pdfBuffer = pdfBase64ToBuffer(pdfRaw)
  if (!pdfBuffer || pdfBuffer.length === 0) {
    return { success: false, error: 'No se recibió un PDF válido' }
  }

  // Resolver consultora + establecimiento de la entrega (RLS valida que el usuario
  // sea miembro; si no, el SELECT devuelve null).
  const { data: entrega, error: entregaErr } = await supabase
    .from('entregas_epp')
    .select('establecimiento_id, consultora_id')
    .eq('id', entregaId)
    .maybeSingle()
  if (entregaErr) return { success: false, error: entregaErr.message }
  if (!entrega) return { success: false, error: 'Entrega no encontrada o sin acceso' }

  // El path de un bucket PRIVADO debe empezar con el consultora_id para que la RLS
  // de lectura por tenant matchee. Preferimos resolver por establecimiento (jerarquía
  // de datos); si la entrega es suelta, usamos el consultora_id del propio registro.
  const consultoraId = entrega.establecimiento_id
    ? await consultoraIdFromEstablecimiento(supabase, entrega.establecimiento_id)
    : (entrega.consultora_id as string | null)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora de la entrega' }

  const path = tenantStoragePath(consultoraId, 'constancias-epp', entregaId, `${Date.now()}.pdf`)
  const { data: up, error: upErr } = await supabase.storage
    .from('documentos')
    .upload(path, pdfBuffer, { upsert: true, contentType: 'application/pdf' })
  if (upErr) return { success: false, error: 'Error al subir la constancia: ' + upErr.message }

  const { data: signed } = await supabase.storage
    .from('documentos')
    .createSignedUrl(up.path, PDF_SIGNED_TTL_SECONDS)

  return { success: true, data: { pdfSignedUrl: signed?.signedUrl ?? null } }
}
