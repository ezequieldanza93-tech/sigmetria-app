import { describe, it, expect } from 'vitest'
import { computeIncidenteMetrics } from '@/lib/analytics-compute'
import type { IncidenteRow } from '@/lib/actions/analytics'

// Fixture fijo con el enum NUEVO (incidente, accidente_leve/moderado/grave).
const rows: IncidenteRow[] = [
  { id: '1', establecimiento_id: 'e1', tipo: 'accidente_grave',    estado: 'pendiente',       fecha_ocurrencia: '2026-01-10', dias_perdidos: 10 },
  { id: '2', establecimiento_id: 'e1', tipo: 'accidente_leve',     estado: 'cerrado',         fecha_ocurrencia: '2026-02-15', dias_perdidos: 3 },
  { id: '3', establecimiento_id: 'e1', tipo: 'incidente',          estado: 'en_investigacion', fecha_ocurrencia: '2026-02-20', dias_perdidos: null },
  { id: '4', establecimiento_id: 'e1', tipo: 'accidente_moderado', estado: 'pendiente',       fecha_ocurrencia: '2026-03-15', dias_perdidos: 5 },
]

describe('computeIncidenteMetrics', () => {
  it('cuenta el total de incidentes', () => {
    expect(computeIncidenteMetrics(rows).total).toBe(4)
  })

  it('suma los días perdidos (null cuenta como 0)', () => {
    expect(computeIncidenteMetrics(rows).diasPerdidos).toBe(18)
  })

  it('agrupa por tipo con labels del enum nuevo', () => {
    const porTipo = computeIncidenteMetrics(rows).porTipo
    const map = Object.fromEntries(porTipo.map(t => [t.tipo, t.count]))
    expect(map['Accidente Grave']).toBe(1)
    expect(map['Accidente Leve']).toBe(1)
    expect(map['Accidente Moderado']).toBe(1)
    expect(map['Incidente']).toBe(1)
  })

  it('agrupa por estado', () => {
    const porEstado = computeIncidenteMetrics(rows).porEstado
    const map = Object.fromEntries(porEstado.map(e => [e.estado, e.count]))
    expect(map['pendiente']).toBe(2)
    expect(map['cerrado']).toBe(1)
    expect(map['en_investigacion']).toBe(1)
  })

  it('cuenta días desde el último ACCIDENTE (cualquier severidad), no incidentes', () => {
    // El accidente más reciente es accidente_moderado del 2026-03-15.
    // El incidente del 2026-02-20 NO debe contar como "accidente".
    const accidentes = rows.filter(r => r.tipo.startsWith('accidente_'))
    const last = accidentes.sort((a, b) =>
      new Date(b.fecha_ocurrencia).getTime() - new Date(a.fecha_ocurrencia).getTime()
    )[0]
    const esperado = Math.floor((Date.now() - new Date(last.fecha_ocurrencia).getTime()) / 86400000)
    expect(computeIncidenteMetrics(rows).diasSinAccidente).toBe(esperado)
    // Sanity: hay al menos un accidente, así que no es el centinela 999.
    expect(computeIncidenteMetrics(rows).diasSinAccidente).toBeLessThan(999)
  })

  it('devuelve 999 (centinela) cuando no hay accidentes, solo incidentes', () => {
    const soloIncidentes: IncidenteRow[] = [
      { id: '9', establecimiento_id: 'e1', tipo: 'incidente', estado: 'pendiente', fecha_ocurrencia: '2026-01-01', dias_perdidos: 0 },
    ]
    expect(computeIncidenteMetrics(soloIncidentes).diasSinAccidente).toBe(999)
  })

  it('mantiene 12 meses como máximo de buckets mensuales', () => {
    const mensual = computeIncidenteMetrics(rows).mensual
    // Ene, Feb, Mar → 3 buckets (Feb tiene 2 incidentes).
    expect(mensual.length).toBe(3)
    const feb = mensual.find(m => m.mes === 'Feb')
    expect(feb?.count).toBe(2)
  })
})
