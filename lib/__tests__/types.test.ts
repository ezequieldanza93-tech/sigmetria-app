import { describe, it, expect } from 'vitest'
import {
  canWrite,
  canDelete,
  canManageUsers,
  canViewAll,
  calcularEstadoGestion,
  ROLE_LABELS,
} from '@/lib/types'

describe('canWrite', () => {
  it('allows developer always', () => {
    expect(canWrite(null, 'developer')).toBe(true)
  })

  it('allows full_access_main', () => {
    expect(canWrite('full_access_main', 'user')).toBe(true)
  })

  it('allows full_access_branch', () => {
    expect(canWrite('full_access_branch', 'user')).toBe(true)
  })

  it('allows colaborador', () => {
    expect(canWrite('colaborador', 'user')).toBe(true)
  })

  it('denies full_viewer', () => {
    expect(canWrite('full_viewer', 'user')).toBe(false)
  })

  it('denies null role for regular users', () => {
    expect(canWrite(null, 'user')).toBe(false)
  })
})

describe('canDelete', () => {
  it('allows developer always', () => {
    expect(canDelete(null, 'developer')).toBe(true)
  })

  it('allows full_access_main', () => {
    expect(canDelete('full_access_main', 'user')).toBe(true)
  })

  it('allows full_access_branch', () => {
    expect(canDelete('full_access_branch', 'user')).toBe(true)
  })

  it('denies colaborador', () => {
    expect(canDelete('colaborador', 'user')).toBe(false)
  })

  it('denies full_viewer', () => {
    expect(canDelete('full_viewer', 'user')).toBe(false)
  })
})

describe('canManageUsers', () => {
  it('allows developer always', () => {
    expect(canManageUsers(null, 'developer')).toBe(true)
  })

  it('allows full_access_main', () => {
    expect(canManageUsers('full_access_main', 'user')).toBe(true)
  })

  it('denies full_access_branch', () => {
    expect(canManageUsers('full_access_branch', 'user')).toBe(false)
  })
})

describe('canViewAll', () => {
  it('allows developer always', () => {
    expect(canViewAll(null, 'developer')).toBe(true)
  })

  it('allows full_access_main', () => {
    expect(canViewAll('full_access_main', 'user')).toBe(true)
  })

  it('allows full_access_branch', () => {
    expect(canViewAll('full_access_branch', 'user')).toBe(true)
  })

  it('allows full_viewer', () => {
    expect(canViewAll('full_viewer', 'user')).toBe(true)
  })

  it('denies colaborador', () => {
    expect(canViewAll('colaborador', 'user')).toBe(false)
  })
})

describe('calcularEstadoGestion', () => {
  it('returns Realizado when fecha_ejecutada exists', () => {
    expect(calcularEstadoGestion('2026-05-20', '2026-05-19')).toBe('Realizado')
  })

  it('returns Pendiente when fecha_planificada is in the past', () => {
    expect(calcularEstadoGestion(null, '2024-01-01')).toBe('Pendiente')
  })

  it('returns Planificado when fecha_planificada is today or future', () => {
    const future = new Date()
    future.setDate(future.getDate() + 30)
    const futureStr = future.toISOString().split('T')[0]
    expect(calcularEstadoGestion(null, futureStr)).toBe('Planificado')
  })
})

describe('ROLE_LABELS', () => {
  it('has labels for all roles', () => {
    expect(ROLE_LABELS.developer).toBe('Developer')
    expect(ROLE_LABELS.full_access_main).toBe('Admin Principal')
    expect(ROLE_LABELS.full_access_branch).toBe('Admin Branch')
    expect(ROLE_LABELS.colaborador).toBe('Colaborador')
    expect(ROLE_LABELS.full_viewer).toBe('Viewer Global')
    expect(ROLE_LABELS.colaborador_viewer).toBe('Viewer Limitado')
  })
})
