/**
 * TEST DE AISLAMIENTO MULTI-TENANT (Res. SRT 48/2025).
 *
 * Demuestra que el paquete de la empresa A NO contiene filas de la empresa B,
 * incluso ante un backend que filtra de más (defensa en profundidad del
 * filtrado explícito de build-package). Usa un mock de SupabaseClient en
 * memoria — NO requiere DB. Para correrlo: `npx vitest run lib/export`.
 *
 * Si se quisiera validar el aislamiento CONTRA LA DB REAL (RLS), ver
 * docs/portabilidad.md → sección "Aislamiento / cómo correr el test SQL".
 */

import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { buildEmpresaExportPackage } from '@/lib/export/build-package'
import type { ExportRequestScope } from '@/lib/export/scoping'

// ── Dataset de dos empresas (A = objetivo, B = NO debe aparecer) ──
const DB: Record<string, Record<string, unknown>[]> = {
  empresas: [
    { id: 'empA', razon_social: 'Empresa A', cuit: '30-A' },
    { id: 'empB', razon_social: 'Empresa B', cuit: '30-B' },
  ],
  establecimientos: [
    { id: 'estA1', empresa_id: 'empA', nombre: 'Planta A', created_at: '2026-03-01' },
    { id: 'estB1', empresa_id: 'empB', nombre: 'Planta B', created_at: '2026-03-01' },
  ],
  incidentes: [
    { id: 'incA', empresa_id: 'empA', establecimiento_id: 'estA1', titulo: 'A', created_at: '2026-04-01' },
    { id: 'incB', empresa_id: 'empB', establecimiento_id: 'estB1', titulo: 'B', created_at: '2026-04-01' },
  ],
  // riesgos se scopea por establecimiento; metemos una fila de B que un backend
  // mal filtrado podría devolver — el filtro explícito debe excluirla.
  riesgos: [
    { id: 'rA', establecimiento_id: 'estA1', descripcion: 'riesgo A', created_at: '2026-05-01' },
    { id: 'rB', establecimiento_id: 'estB1', descripcion: 'riesgo B', created_at: '2026-05-01' },
  ],
}

/** Mock minimalista del query builder de supabase-js usado por build-package. */
function makeMockClient(opts: { leakEstablecimiento?: boolean } = {}) {
  function from(table: string) {
    let rows = DB[table] ? [...DB[table]] : []
    const builder = {
      _filters: [] as { col: string; val: unknown; op: 'eq' | 'in' }[],
      select() {
        return builder
      },
      eq(col: string, val: unknown) {
        rows = rows.filter(r => r[col] === val)
        return builder
      },
      in(col: string, vals: unknown[]) {
        // Si leakEstablecimiento, ignoramos el filtro .in para simular un backend
        // que devuelve filas de otros tenants → el filtro explícito debe atajarlo.
        if (opts.leakEstablecimiento && col === 'establecimiento_id') {
          return builder
        }
        rows = rows.filter(r => (vals as unknown[]).includes(r[col]))
        return builder
      },
      then(resolve: (v: { data: Record<string, unknown>[]; error: null }) => void) {
        resolve({ data: rows, error: null })
      },
    }
    return builder
  }

  return {
    from,
    storage: {
      from() {
        return {
          async download() {
            return { data: null, error: { message: 'sin storage en test' } }
          },
        }
      },
    },
  } as unknown as Parameters<typeof buildEmpresaExportPackage>[0]
}

const SCOPE: ExportRequestScope = {
  modo: 'completo',
  entidades: null,
  desde: null,
  hasta: null,
  formatos: ['json'],
  incluyeArchivos: false,
  async: false,
}

async function readEntity(zipBytes: Uint8Array, file: string): Promise<Record<string, unknown>[]> {
  const zip = await JSZip.loadAsync(zipBytes)
  const f = zip.file(`data/${file}.json`)
  if (!f) return []
  return JSON.parse(await f.async('string'))
}

describe('AISLAMIENTO — export de empresa A no contiene datos de empresa B', () => {
  it('only includes empresa A, its establecimientos, incidentes and riesgos', async () => {
    const supabase = makeMockClient()
    const pkg = await buildEmpresaExportPackage(supabase, 'empA', SCOPE)

    const empresa = await readEntity(pkg.zip, 'empresa')
    expect(empresa).toHaveLength(1)
    expect(empresa[0].id).toBe('empA')

    const ests = await readEntity(pkg.zip, 'establecimientos')
    expect(ests.map(e => e.id)).toEqual(['estA1'])

    const incs = await readEntity(pkg.zip, 'incidentes')
    expect(incs.map(i => i.id)).toEqual(['incA'])

    const riesgos = await readEntity(pkg.zip, 'riesgos')
    expect(riesgos.map(r => r.id)).toEqual(['rA'])
  })

  it('excludes empresa B even if the backend leaks rows (defense in depth)', async () => {
    const supabase = makeMockClient({ leakEstablecimiento: true })
    const pkg = await buildEmpresaExportPackage(supabase, 'empA', SCOPE)

    const riesgos = await readEntity(pkg.zip, 'riesgos')
    // El backend "filtró mal" y devolvió rB, pero el filtro explícito por el set
    // de establecimientos de A lo descarta.
    expect(riesgos.map(r => r.id)).toEqual(['rA'])
    expect(riesgos.some(r => r.id === 'rB')).toBe(false)
  })

  it('produces a manifest with a SHA-256 for every file', async () => {
    const supabase = makeMockClient()
    const pkg = await buildEmpresaExportPackage(supabase, 'empA', SCOPE)
    const zip = await JSZip.loadAsync(pkg.zip)
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
    expect(manifest.archivos.length).toBeGreaterThan(0)
    for (const f of manifest.archivos) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/)
    }
  })
})
