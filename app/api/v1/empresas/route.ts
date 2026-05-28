import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { authenticateApiKey, apiError } from '@/lib/api/auth'
import { apiRatelimit, checkRateLimit } from '@/lib/rate-limit'

export async function GET(request: Request) {
  const ctx = await authenticateApiKey(request)
  if (!ctx) return apiError('UNAUTHORIZED', 'Invalid or missing API key', 401)

  const rl = await checkRateLimit(apiRatelimit, ctx.api_key_id)
  if (!rl.allowed) return apiError('RATE_LIMITED', 'Too many requests — limit: 60/min', 429)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('empresas')
    .select('id, razon_social, cuit, localidades(nombre, provincia), rubros(nombre)')
    .eq('consultora_id', ctx.consultora_id)
    .order('razon_social')

  if (error) return apiError('INTERNAL_ERROR', 'Database error', 500)

  const empresas = (data ?? []).map(e => {
    const loc = e.localidades as unknown as { nombre: string; provincia: string } | null
    const rub = e.rubros as unknown as { nombre: string } | null
    return {
      id: e.id,
      razon_social: e.razon_social,
      cuit: e.cuit ?? null,
      rubro: rub?.nombre ?? null,
      localidad: loc?.nombre ?? null,
      provincia: loc?.provincia ?? null,
    }
  })

  return NextResponse.json({ data: empresas, total: empresas.length })
}
