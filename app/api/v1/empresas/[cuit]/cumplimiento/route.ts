import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { authenticateApiKey, apiError } from '@/lib/api/auth'
import { apiRatelimit, checkRateLimit } from '@/lib/rate-limit'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cuit: string }> }
) {
  const ctx = await authenticateApiKey(request)
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)

  const rl = await checkRateLimit(apiRatelimit, ctx.api_key_id)
  if (!rl.allowed) return apiError('RATE_LIMITED', 'Too many requests — limit: 60/min', 429)

  const { cuit } = await params
  const supabase = createServiceClient()

  const { data: empresa } = await supabase
    .from('empresas')
    .select('id, razon_social, cuit')
    .eq('cuit', cuit)
    .eq('consultora_id', ctx.consultora_id)
    .maybeSingle()

  if (!empresa) return apiError('NOT_FOUND', 'Empresa not found for this CUIT', 404)

  const { data: ests } = await supabase
    .from('establecimientos')
    .select('id, nombre, domicilio')
    .eq('empresa_id', empresa.id)

  const estIds = (ests ?? []).map(e => e.id)
  const ahora = new Date()
  const hoyMs = ahora.getTime()
  const hace30d = new Date(ahora)
  hace30d.setDate(hace30d.getDate() - 30)

  const [{ data: riesgosRaw }, { data: incidentesRaw }, { data: docsRaw }] = await Promise.all([
    estIds.length > 0
      ? supabase.from('riesgos').select('establecimiento_id, nivel').in('establecimiento_id', estIds).eq('resuelto', false)
      : Promise.resolve({ data: [] }),
    estIds.length > 0
      ? supabase.from('incidentes').select('establecimiento_id, fecha_ocurrencia').in('establecimiento_id', estIds).in('estado', ['pendiente', 'en_investigacion'])
      : Promise.resolve({ data: [] }),
    estIds.length > 0
      ? supabase.from('establecimientos_documentos').select('establecimiento_id, fecha_vencimiento').in('establecimiento_id', estIds)
      : Promise.resolve({ data: [] }),
  ])

  const establecimientos = (ests ?? []).map(est => {
    const riesgos = (riesgosRaw ?? []).filter(r => r.establecimiento_id === est.id)
    const incidentes = (incidentesRaw ?? []).filter(s => s.establecimiento_id === est.id)
    const estDocs = (docsRaw ?? []).filter(d => d.establecimiento_id === est.id)

    const riesgosCriticos = riesgos.filter(r => r.nivel === 'critico').length
    const riesgosAltos = riesgos.filter(r => r.nivel === 'alto').length
    const docsVencidos = estDocs.filter(d => d.fecha_vencimiento && new Date(d.fecha_vencimiento).getTime() < hoyMs).length
    const incidentesAntiguos = incidentes.filter(s => s.fecha_ocurrencia && new Date(s.fecha_ocurrencia).getTime() < hace30d.getTime()).length

    let estado: 'rojo' | 'amarillo' | 'verde'
    if (riesgosCriticos > 0 || incidentesAntiguos > 0 || docsVencidos > 0) {
      estado = 'rojo'
    } else if (riesgosAltos > 0 || incidentes.length > 0) {
      estado = 'amarillo'
    } else {
      estado = 'verde'
    }

    return {
      id: est.id,
      nombre: est.nombre,
      domicilio: est.domicilio ?? null,
      estado,
      riesgos_criticos: riesgosCriticos,
      riesgos_altos: riesgosAltos,
      incidentes_abiertos: incidentes.length,
      // @deprecated — alias de compatibilidad. Usar `incidentes_abiertos`.
      siniestros_abiertos: incidentes.length,
      documentos_vencidos: docsVencidos,
    }
  })

  return NextResponse.json({
    empresa: { id: empresa.id, razon_social: empresa.razon_social, cuit: empresa.cuit },
    establecimientos,
    generado_en: ahora.toISOString(),
  })
}
