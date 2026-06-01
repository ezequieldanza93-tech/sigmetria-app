import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks compartidos ────────────────────────────────────────────
// Autenticación: siempre devuelve un contexto válido cuyo consultora_id
// coincide con el de los datos mockeados.
vi.mock('@/lib/api/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/api/auth')>('@/lib/api/auth')
  return {
    ...actual,
    authenticateApiKey: vi.fn(async () => ({
      api_key_id: 'k1',
      consultora_id: 'consultora-1',
      permisos: [],
    })),
  }
})

vi.mock('@/lib/rate-limit', () => ({
  apiRatelimit: {},
  checkRateLimit: vi.fn(async () => ({ allowed: true })),
}))

// El cliente de Supabase se reconfigura por test vía setServiceClient.
let serviceClientImpl: unknown = null
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: () => serviceClientImpl,
}))

function req() {
  return new Request('https://x.test', { headers: { Authorization: 'Bearer test' } })
}

beforeEach(() => {
  serviceClientImpl = null
})

describe('GET /api/v1/establecimientos/[id]/legajo — contrato D2', () => {
  it('devuelve incidentes_abiertos y el alias deprecado siniestros_abiertos con los mismos valores', async () => {
    const incidentes = [
      { tipo: 'accidente_grave', estado: 'pendiente', fecha_ocurrencia: '2026-01-10' },
      { tipo: 'incidente', estado: 'en_investigacion', fecha_ocurrencia: '2026-02-20' },
    ]

    // Builder mínimo: cada from(...) devuelve un thenable que resuelve { data }.
    serviceClientImpl = {
      from: (table: string) => {
        const data =
          table === 'establecimientos'
            ? {
                id: 'est-1',
                nombre: 'Planta Sur',
                domicilio: 'Calle 1',
                empresa_id: 'emp-1',
                empresas: { id: 'emp-1', razon_social: 'ACME', cuit: '20', consultora_id: 'consultora-1' },
              }
            : table === 'incidentes'
            ? incidentes
            : []
        const builder: Record<string, unknown> = {}
        const chain = () => builder
        for (const m of ['select', 'eq', 'in', 'order', 'limit']) builder[m] = chain
        builder.maybeSingle = async () => ({ data })
        // Para los .from(...) sin maybeSingle (arrays), el await sobre el builder
        // se resuelve con { data } gracias al then de abajo.
        builder.then = (resolve: (v: { data: unknown }) => void) => resolve({ data })
        return builder
      },
    }

    const { GET } = await import('@/app/api/v1/establecimientos/[id]/legajo/route')
    const res = await GET(req(), { params: Promise.resolve({ id: 'est-1' }) })
    const body = await res.json()

    expect(body).toHaveProperty('incidentes_abiertos')
    expect(body).toHaveProperty('siniestros_abiertos')
    expect(body.incidentes_abiertos).toEqual(body.siniestros_abiertos)
    expect(body.incidentes_abiertos).toHaveLength(2)
    expect(body.incidentes_abiertos[0]).toMatchObject({
      tipo: 'accidente_grave',
      estado: 'pendiente',
      fecha_ocurrencia: '2026-01-10',
    })
  })
})

describe('GET /api/v1/empresas/[cuit]/cumplimiento — contrato D2', () => {
  it('cada establecimiento expone incidentes_abiertos (count) + alias siniestros_abiertos igual', async () => {
    serviceClientImpl = {
      from: (table: string) => {
        const data =
          table === 'empresas'
            ? { id: 'emp-1', razon_social: 'ACME', cuit: '20' }
            : table === 'establecimientos'
            ? [{ id: 'est-1', nombre: 'Planta Sur', domicilio: 'Calle 1' }]
            : table === 'incidentes'
            ? [
                { establecimiento_id: 'est-1', fecha_ocurrencia: '2026-05-01' },
                { establecimiento_id: 'est-1', fecha_ocurrencia: '2026-05-02' },
              ]
            : []
        const builder: Record<string, unknown> = {}
        const chain = () => builder
        for (const m of ['select', 'eq', 'in']) builder[m] = chain
        builder.maybeSingle = async () => ({ data })
        builder.then = (resolve: (v: { data: unknown }) => void) => resolve({ data })
        return builder
      },
    }

    const { GET } = await import('@/app/api/v1/empresas/[cuit]/cumplimiento/route')
    const res = await GET(req(), { params: Promise.resolve({ cuit: '20' }) })
    const body = await res.json()

    const est = body.establecimientos[0]
    expect(est).toHaveProperty('incidentes_abiertos')
    expect(est).toHaveProperty('siniestros_abiertos')
    expect(est.incidentes_abiertos).toBe(2)
    expect(est.siniestros_abiertos).toBe(est.incidentes_abiertos)
  })
})
