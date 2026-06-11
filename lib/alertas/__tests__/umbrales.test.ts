import { describe, it, expect } from 'vitest'
import {
  diasHastaVencimiento,
  umbralQueDispara,
  agruparPorConsultora,
  type UmbralConfig,
} from '@/lib/alertas/umbrales'

const UMBRALES: UmbralConfig[] = [
  { dias_antes: 30, severidad: 'info' },
  { dias_antes: 15, severidad: 'warning' },
  { dias_antes: 7, severidad: 'critical' },
]

describe('diasHastaVencimiento', () => {
  const hoy = new Date('2026-06-11T10:30:00') // hora intermedia: debe normalizarse a medianoche

  it('cuenta días futuros correctamente', () => {
    expect(diasHastaVencimiento('2026-06-18', hoy)).toBe(7)
    expect(diasHastaVencimiento('2026-07-11', hoy)).toBe(30)
  })

  it('devuelve 0 el día del vencimiento', () => {
    expect(diasHastaVencimiento('2026-06-11', hoy)).toBe(0)
  })

  it('devuelve negativo si ya venció', () => {
    expect(diasHastaVencimiento('2026-06-01', hoy)).toBe(-10)
  })
})

describe('umbralQueDispara', () => {
  it('dispara SOLO el día exacto del umbral (anti-spam)', () => {
    expect(umbralQueDispara(30, UMBRALES)).toEqual({ dias_antes: 30, severidad: 'info' })
    expect(umbralQueDispara(15, UMBRALES)).toEqual({ dias_antes: 15, severidad: 'warning' })
    expect(umbralQueDispara(7, UMBRALES)).toEqual({ dias_antes: 7, severidad: 'critical' })
  })

  it('NO dispara en días intermedios dentro de la ventana', () => {
    expect(umbralQueDispara(20, UMBRALES)).toBeNull()
    expect(umbralQueDispara(10, UMBRALES)).toBeNull()
    expect(umbralQueDispara(1, UMBRALES)).toBeNull()
  })

  it('NO dispara para umbrales desactivados', () => {
    const inactivos: UmbralConfig[] = [{ dias_antes: 7, severidad: 'critical', activo: false }]
    expect(umbralQueDispara(7, inactivos)).toBeNull()
  })

  it('ante empate de día, gana la mayor severidad', () => {
    const dup: UmbralConfig[] = [
      { dias_antes: 7, severidad: 'info' },
      { dias_antes: 7, severidad: 'critical' },
    ]
    expect(umbralQueDispara(7, dup)).toEqual({ dias_antes: 7, severidad: 'critical' })
  })

  it('devuelve null cuando ya venció (no es un aviso temprano)', () => {
    expect(umbralQueDispara(-5, UMBRALES)).toBeNull()
  })
})

describe('agruparPorConsultora (anti-spam: 1 aviso por consultora)', () => {
  it('agrupa ítems por consultora_id', () => {
    const items = [
      { consultora_id: 'a', doc: 1 },
      { consultora_id: 'b', doc: 2 },
      { consultora_id: 'a', doc: 3 },
    ]
    const map = agruparPorConsultora(items)
    expect(map.size).toBe(2)
    expect(map.get('a')).toHaveLength(2)
    expect(map.get('b')).toHaveLength(1)
  })

  it('devuelve map vacío para lista vacía', () => {
    expect(agruparPorConsultora([]).size).toBe(0)
  })
})
