import { describe, it, expect } from 'vitest'
import {
  computeStorageDelta,
  parseListObjectsV2,
  storageKeyFor,
  type RemoteObject,
  type SourceObject,
} from '@/scripts/storage-delta'

describe('storageKeyFor', () => {
  it('builds storage/<bucket>/<path>', () => {
    expect(storageKeyFor('documentos', 'abc/x.pdf')).toBe('storage/documentos/abc/x.pdf')
  })

  it('normalizes Windows separators and leading slashes', () => {
    expect(storageKeyFor('planos', '\\foo\\bar.png')).toBe('storage/planos/foo/bar.png')
    expect(storageKeyFor('logos', '/y.svg')).toBe('storage/logos/y.svg')
  })
})

describe('computeStorageDelta', () => {
  const source: SourceObject[] = [
    { bucket: 'documentos', path: 'a/1.pdf', size: 100 },
    { bucket: 'documentos', path: 'a/2.pdf', size: 200 },
    { bucket: 'planos', path: 'p.png', size: 50 },
  ]

  it('uploads everything when R2 is empty', () => {
    const delta = computeStorageDelta(source, [])
    expect(delta).toHaveLength(3)
    expect(delta).toEqual(source)
  })

  it('skips objects already present with the same size', () => {
    const remote: RemoteObject[] = [
      { key: 'storage/documentos/a/1.pdf', size: 100 },
      { key: 'storage/documentos/a/2.pdf', size: 200 },
      { key: 'storage/planos/p.png', size: 50 },
    ]
    const delta = computeStorageDelta(source, remote)
    expect(delta).toHaveLength(0)
  })

  it('re-uploads only the objects whose size differs', () => {
    const remote: RemoteObject[] = [
      { key: 'storage/documentos/a/1.pdf', size: 100 }, // igual → skip
      { key: 'storage/documentos/a/2.pdf', size: 999 }, // difiere → re-subir
      // planos/p.png falta → subir
    ]
    const delta = computeStorageDelta(source, remote)
    expect(delta.map((d) => d.path)).toEqual(['a/2.pdf', 'p.png'])
  })

  it('ignores extra remote objects not present in source (no deletion)', () => {
    const remote: RemoteObject[] = [
      { key: 'storage/documentos/a/1.pdf', size: 100 },
      { key: 'storage/documentos/a/2.pdf', size: 200 },
      { key: 'storage/planos/p.png', size: 50 },
      { key: 'storage/viejo/borrado.pdf', size: 1 }, // huérfano en R2 → no toca
    ]
    const delta = computeStorageDelta(source, remote)
    expect(delta).toHaveLength(0)
  })

  it('preserves source order in the delta', () => {
    const delta = computeStorageDelta(source, [])
    expect(delta.map((d) => `${d.bucket}/${d.path}`)).toEqual([
      'documentos/a/1.pdf',
      'documentos/a/2.pdf',
      'planos/p.png',
    ])
  })
})

describe('parseListObjectsV2', () => {
  it('flattens Contents across pages and defaults missing sizes to 0', () => {
    const pages = [
      { Contents: [{ Key: 'storage/a.pdf', Size: 10 }, { Key: 'storage/b.pdf' }] },
      { Contents: [{ Key: 'storage/c.pdf', Size: 30 }] },
    ]
    expect(parseListObjectsV2(pages)).toEqual([
      { key: 'storage/a.pdf', size: 10 },
      { key: 'storage/b.pdf', size: 0 },
      { key: 'storage/c.pdf', size: 30 },
    ])
  })

  it('handles empty / missing Contents (empty bucket prefix)', () => {
    expect(parseListObjectsV2([{}])).toEqual([])
    expect(parseListObjectsV2([{ Contents: [] }])).toEqual([])
  })
})
