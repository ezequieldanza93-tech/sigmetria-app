import { describe, it, expect } from 'vitest'
import { extractStorageRefs, dedupeRefs, isAbsoluteUrl } from '@/lib/export/storage-refs'

describe('extractStorageRefs', () => {
  it('extracts paths from incidentes_fotos.url under the incidentes bucket', () => {
    const refs = extractStorageRefs('incidentes_fotos', [
      { id: '1', url: 'consultora-1/incidentes/i1/foto.jpg' },
      { id: '2', url: 'consultora-1/incidentes/i1/foto2.jpg' },
    ])
    expect(refs).toHaveLength(2)
    expect(refs[0]).toMatchObject({ bucket: 'incidentes', entity: 'incidentes_fotos' })
  })

  it('extracts archivo_url from documentos under the documentos bucket', () => {
    const refs = extractStorageRefs('documentos_empresa', [
      { id: '1', archivo_url: 'consultora-1/empresas/e1/hab.pdf' },
    ])
    expect(refs[0]).toMatchObject({ bucket: 'documentos' })
  })

  it('ignores absolute (legacy) URLs — not downloadable by path', () => {
    const refs = extractStorageRefs('incidentes_fotos', [
      { id: '1', url: 'https://x.supabase.co/storage/v1/object/public/incidentes/foo.jpg' },
    ])
    expect(refs).toHaveLength(0)
  })

  it('ignores null/empty values', () => {
    const refs = extractStorageRefs('documentos_empresa', [
      { id: '1', archivo_url: null },
      { id: '2', archivo_url: '' },
    ])
    expect(refs).toHaveLength(0)
  })

  it('returns nothing for entities without binaries', () => {
    expect(extractStorageRefs('empresa', [{ id: '1' }])).toHaveLength(0)
  })
})

describe('dedupeRefs', () => {
  it('removes duplicates by (bucket, path)', () => {
    const out = dedupeRefs([
      { bucket: 'documentos', path: 'a/b.pdf', entity: 'x' },
      { bucket: 'documentos', path: 'a/b.pdf', entity: 'y' },
      { bucket: 'incidentes', path: 'a/b.pdf', entity: 'z' }, // distinto bucket
    ])
    expect(out).toHaveLength(2)
  })
})

describe('isAbsoluteUrl', () => {
  it('detects http(s) URLs', () => {
    expect(isAbsoluteUrl('https://x/y')).toBe(true)
    expect(isAbsoluteUrl('http://x/y')).toBe(true)
    expect(isAbsoluteUrl('consultora/x/y.pdf')).toBe(false)
  })
})
