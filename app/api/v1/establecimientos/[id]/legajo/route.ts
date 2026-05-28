import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { authenticateApiKey, apiError } from '@/lib/api/auth'
import { apiRatelimit, checkRateLimit } from '@/lib/rate-limit'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await authenticateApiKey(request)
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)

  const rl = await checkRateLimit(apiRatelimit, ctx.api_key_id)
  if (!rl.allowed) return apiError('RATE_LIMITED', 'Too many requests — limit: 60/min', 429)

  const { id } = await params
  const supabase = createServiceClient()

  // Verify ownership: establecimiento must belong to consultora
  const { data: est } = await supabase
    .from('establecimientos')
    .select('id, nombre, domicilio, empresa_id, empresas!inner(id, razon_social, cuit, consultora_id)')
    .eq('id', id)
    .maybeSingle()

  if (!est) return apiError('NOT_FOUND', 'Establecimiento not found', 404)

  const empresa = est.empresas as unknown as { id: string; razon_social: string; cuit: string | null; consultora_id: string }
  if (empresa.consultora_id !== ctx.consultora_id) {
    return apiError('FORBIDDEN', 'Access denied', 403)
  }

  const ahora = new Date()
  const hoyMs = ahora.getTime()

  const [
    { data: riesgos },
    { data: inspecciones },
    { data: docs },
    { data: capacitaciones },
    { data: siniestros },
  ] = await Promise.all([
    supabase.from('riesgos')
      .select('nivel, descripcion, fecha_identificacion, resuelto')
      .eq('establecimiento_id', id)
      .eq('resuelto', false)
      .order('fecha_identificacion', { ascending: false }),
    supabase.from('inspecciones')
      .select('estado, fecha_realizada, observaciones')
      .eq('establecimiento_id', id)
      .order('fecha_realizada', { ascending: false })
      .limit(10),
    supabase.from('establecimientos_documentos')
      .select('fecha_vencimiento, documentos_tipos(nombre)')
      .eq('establecimiento_id', id)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false }),
    supabase.from('capacitaciones')
      .select('titulo, fecha_realizada, estado')
      .eq('empresa_id', empresa.id)
      .eq('estado', 'realizada')
      .order('fecha_realizada', { ascending: false })
      .limit(10),
    supabase.from('siniestros')
      .select('tipo, estado, fecha_ocurrencia')
      .eq('establecimiento_id', id)
      .in('estado', ['pendiente', 'en_investigacion'])
      .order('fecha_ocurrencia', { ascending: false }),
  ])

  const documentos = (docs ?? []).map(d => {
    const tipo = (d.documentos_tipos as unknown as { nombre: string } | null)?.nombre ?? '—'
    const vence = d.fecha_vencimiento ? new Date(d.fecha_vencimiento) : null
    return {
      tipo,
      fecha_vencimiento: d.fecha_vencimiento ?? null,
      vigente: !vence || vence.getTime() > hoyMs,
    }
  })

  return NextResponse.json({
    establecimiento: {
      id: est.id,
      nombre: est.nombre,
      domicilio: est.domicilio ?? null,
      empresa: { id: empresa.id, razon_social: empresa.razon_social, cuit: empresa.cuit ?? null },
    },
    riesgos_activos: (riesgos ?? []).map(r => ({
      nivel: r.nivel,
      descripcion: r.descripcion ?? null,
      fecha_identificacion: r.fecha_identificacion ?? null,
    })),
    inspecciones: (inspecciones ?? []).map(i => ({
      estado: i.estado,
      fecha_realizada: i.fecha_realizada ?? null,
      observaciones: i.observaciones ?? null,
    })),
    documentos,
    capacitaciones: (capacitaciones ?? []).map(c => ({
      titulo: c.titulo,
      fecha_realizada: c.fecha_realizada ?? null,
    })),
    siniestros_abiertos: (siniestros ?? []).map(s => ({
      tipo: s.tipo,
      estado: s.estado,
      fecha_ocurrencia: s.fecha_ocurrencia ?? null,
    })),
    generado_en: ahora.toISOString(),
  })
}
