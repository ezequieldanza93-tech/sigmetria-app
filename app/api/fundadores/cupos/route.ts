import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { createServiceClient } from '@/lib/supabase/service'
import { calcularPrecioFinal } from '@/lib/billing/descuento'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Rate-limit liviano para endpoint público: 30 req / 60 s por IP.
// Si no hay Upstash configurado (local dev), se permite todo.
function createPublicRatelimit(): Ratelimit {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return {
      limit: async () => ({ success: true, remaining: 999, limit: 999, reset: 0 }),
      blockUntilUsed: async () => {},
    } as unknown as Ratelimit
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(30, '60 s'),
    analytics: false,
    prefix: 'ratelimit:fundadores-cupos',
  })
}

const ratelimit = createPublicRatelimit()

// Slugs que NO participan del Programa Fundadores
const SLUGS_EXCLUIDOS = ['trial', 'empresa']

export interface CuposPlan {
  slug: string
  nombre: string
  cupos_disponibles: number
  precio_mensual: number | null
  precio_anual: number | null
  precio_fundador_anual: number | null
}

export interface CuposResponse {
  planes: CuposPlan[]
}

export async function GET(): Promise<Response> {
  // Identificador para rate-limit: IP del request (header estándar en Vercel)
  const reqHeaders = await headers()
  const ip =
    reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    reqHeaders.get('x-real-ip') ??
    'anonymous'

  const { success } = await ratelimit.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Cache-Control': 'no-store',
          'Retry-After': '60',
        },
      },
    )
  }

  const service = createServiceClient()

  // Traer planes visibles y activos (excluyendo trial y empresa)
  const { data: planesRaw, error: planesError } = await service
    .from('plans')
    .select('id, slug, nombre, precio_mensual_neto, founder_slots_total, founder_seed_taken')
    .eq('is_visible', true)
    .eq('is_active', true)
    .not('slug', 'in', `(${SLUGS_EXCLUIDOS.map(s => `"${s}"`).join(',')})`)
    .order('sort_order', { ascending: true, nullsFirst: true })

  if (planesError || !planesRaw) {
    return NextResponse.json(
      { error: 'Error al obtener planes' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // Contar suscripciones Fundador activas agrupadas por plan
  const planIds = planesRaw.map(p => p.id)
  const { data: foundersActivos } = await service
    .from('subscriptions')
    .select('plan_id')
    .eq('is_founder', true)
    .in('plan_id', planIds)

  // Agrupar conteo por plan_id
  const conteoFounders: Record<string, number> = {}
  for (const row of foundersActivos ?? []) {
    conteoFounders[row.plan_id] = (conteoFounders[row.plan_id] ?? 0) + 1
  }

  const planes: CuposPlan[] = planesRaw.map(plan => {
    const precioMensual =
      plan.precio_mensual_neto != null ? Number(plan.precio_mensual_neto) : null

    const tomados = conteoFounders[plan.id] ?? 0
    const disponibles =
      (plan.founder_slots_total ?? 0) - (plan.founder_seed_taken ?? 0) - tomados

    // Calcular precios derivados
    const precioAnualCalc = calcularPrecioFinal(precioMensual, 'annual', false)
    const precioFounderAnualCalc = calcularPrecioFinal(precioMensual, 'annual', true)

    return {
      slug: plan.slug,
      nombre: plan.nombre,
      cupos_disponibles: Math.max(0, disponibles),
      precio_mensual: precioMensual,
      precio_anual: precioAnualCalc?.precioFinal ?? null,
      precio_fundador_anual: precioFounderAnualCalc?.precioFinal ?? null,
    }
  })

  return NextResponse.json(
    { planes } satisfies CuposResponse,
    {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      },
    },
  )
}
