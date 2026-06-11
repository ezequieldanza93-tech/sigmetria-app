import { describe, it, expect } from 'vitest'
import {
  canWrite,
  canDelete,
  canManageUsers,
  isFreeViewerRole,
  FREE_VIEWER_ROLES,
  type UserRole,
} from '@/lib/types'

// ════════════════════════════════════════════════════════════════════════════
// Dynamic Viewers — SOLO LECTURA (Art. 4.5 Res. SRT 48/2025, Prompt 4)
//
// Estos tests demuestran, sobre la lógica de permisos TS (lib/types.ts), que
// NINGÚN rol viewer puede escribir/borrar/gestionar usuarios. Esta lógica es el
// espejo en la app del gating de RLS: las policies de escritura de las tablas
// transaccionales usan has_*_write_access(), funciones cuyo branch de rol SOLO
// incluye full_access_main / full_access_branch / colaborador — nunca un viewer.
//
// Roles viewer (solo-lectura): full_viewer, colaborador_viewer,
// visualizador_comentarista, viewer_observaciones, responsable_estandares.
// (responsable_estandares lee toda la consultora + audit_log, pero no escribe.)
// ════════════════════════════════════════════════════════════════════════════

const READONLY_ROLES: UserRole[] = [
  'full_viewer',
  'colaborador_viewer',
  'visualizador_comentarista',
  'viewer_observaciones',
  'responsable_estandares',
]

const OPERATIONAL_WRITE_ROLES: UserRole[] = [
  'full_access_main',
  'full_access_branch',
  'colaborador',
]

describe('Dynamic Viewers — solo lectura (gating de escritura)', () => {
  it.each(READONLY_ROLES)('rol "%s" NO puede escribir (canWrite=false)', (role) => {
    expect(canWrite(role, 'user')).toBe(false)
  })

  it.each(READONLY_ROLES)('rol "%s" NO puede borrar (canDelete=false)', (role) => {
    expect(canDelete(role, 'user')).toBe(false)
  })

  it.each(READONLY_ROLES)('rol "%s" NO puede gestionar usuarios (canManageUsers=false)', (role) => {
    expect(canManageUsers(role, 'user')).toBe(false)
  })
})

describe('Roles operativos — sí escriben (control negativo del test)', () => {
  it.each(OPERATIONAL_WRITE_ROLES)('rol "%s" SÍ puede escribir', (role) => {
    expect(canWrite(role, 'user')).toBe(true)
  })

  it('solo full_access_main/branch pueden borrar', () => {
    expect(canDelete('full_access_main', 'user')).toBe(true)
    expect(canDelete('full_access_branch', 'user')).toBe(true)
    // colaborador escribe pero NO borra (migración 20260517000010_colaborador_no_delete)
    expect(canDelete('colaborador', 'user')).toBe(false)
  })

  it('solo full_access_main gestiona usuarios', () => {
    expect(canManageUsers('full_access_main', 'user')).toBe(true)
    expect(canManageUsers('full_access_branch', 'user')).toBe(false)
    expect(canManageUsers('colaborador', 'user')).toBe(false)
  })
})

describe('FREE_VIEWER_ROLES — clasificación de viewers sin seat', () => {
  it('los 4 viewers free son solo-lectura', () => {
    expect(FREE_VIEWER_ROLES).toEqual(
      expect.arrayContaining([
        'full_viewer',
        'colaborador_viewer',
        'visualizador_comentarista',
        'viewer_observaciones',
      ]),
    )
  })

  it.each(FREE_VIEWER_ROLES)('isFreeViewerRole("%s") = true', (role) => {
    expect(isFreeViewerRole(role)).toBe(true)
  })

  it.each(OPERATIONAL_WRITE_ROLES)('isFreeViewerRole("%s") = false (rol operativo)', (role) => {
    expect(isFreeViewerRole(role)).toBe(false)
  })

  it('isFreeViewerRole maneja null/undefined sin romper', () => {
    expect(isFreeViewerRole(null)).toBe(false)
    expect(isFreeViewerRole(undefined)).toBe(false)
  })
})

describe('developer (system_role) — override total', () => {
  it('developer escribe, borra y gestiona aunque su rol de consultora sea viewer', () => {
    expect(canWrite('full_viewer', 'developer')).toBe(true)
    expect(canDelete('full_viewer', 'developer')).toBe(true)
    expect(canManageUsers('full_viewer', 'developer')).toBe(true)
  })
})
