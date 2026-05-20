import { describe, it, expect } from 'vitest'
import {
  formatDate,
  formatDateTime,
  formatCUIT,
  roleLabel,
  pluralize,
  cn,
  getInitials,
  formatHours,
} from '@/lib/utils'

describe('formatDate', () => {
  it('returns em dash for null/undefined', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate(undefined)).toBe('—')
  })

  it('formats a valid date string in es-AR locale', () => {
    const result = formatDate('2026-05-20')
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })

  it('formats ISO datetime string', () => {
    const result = formatDate('2026-05-20T14:30:00Z')
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/)
  })
})

describe('formatDateTime', () => {
  it('returns em dash for null/undefined', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDateTime(undefined)).toBe('—')
  })

  it('includes time in output', () => {
    const result = formatDateTime('2026-05-20T14:30:00Z')
    expect(result).toContain(':')
  })
})

describe('formatCUIT', () => {
  it('returns em dash for null/undefined', () => {
    expect(formatCUIT(null)).toBe('—')
    expect(formatCUIT(undefined)).toBe('—')
  })

  it('formats 11-digit CUIT', () => {
    expect(formatCUIT('20123456789')).toBe('20-12345678-9')
  })

  it('returns raw string if not 11 digits', () => {
    expect(formatCUIT('123')).toBe('123')
  })

  it('strips non-digit characters before formatting', () => {
    expect(formatCUIT('20-12345678-9')).toBe('20-12345678-9')
  })
})

describe('roleLabel', () => {
  it('returns em dash for null/undefined', () => {
    expect(roleLabel(null)).toBe('—')
    expect(roleLabel(undefined)).toBe('—')
  })

  it('returns label for known role', () => {
    expect(roleLabel('full_access_main')).toBe('Admin Principal')
  })

  it('returns raw role if not in labels', () => {
    expect(roleLabel('unknown_role' as any)).toBe('unknown_role')
  })
})

describe('pluralize', () => {
  it('returns singular for count 1', () => {
    expect(pluralize(1, 'trabajador')).toBe('trabajador')
  })

  it('returns plural (suffix s) for count > 1', () => {
    expect(pluralize(2, 'trabajador')).toBe('trabajadors')
  })

  it('returns custom plural when provided', () => {
    expect(pluralize(3, 'país', 'países')).toBe('países')
  })
})

describe('cn', () => {
  it('joins truthy classes', () => {
    expect(cn('a', 'b', null, undefined, false, 'c')).toBe('a b c')
  })

  it('returns empty string for no truthy values', () => {
    expect(cn(null, undefined, false)).toBe('')
  })
})

describe('getInitials', () => {
  it('returns ? for null/undefined', () => {
    expect(getInitials(null)).toBe('?')
    expect(getInitials(undefined)).toBe('?')
  })

  it('returns up to 2 initials', () => {
    expect(getInitials('Juan Pérez')).toBe('JP')
  })

  it('handles single name', () => {
    expect(getInitials('Juan')).toBe('J')
  })

  it('uppercases initials', () => {
    expect(getInitials('maría laura garcía')).toBe('ML')
  })
})

describe('formatHours', () => {
  it('returns em dash for null/undefined', () => {
    expect(formatHours(null)).toBe('—')
    expect(formatHours(undefined)).toBe('—')
  })

  it('returns hours with h suffix', () => {
    expect(formatHours(8)).toBe('8h')
  })

  it('handles decimal hours', () => {
    expect(formatHours(7.5)).toBe('7.5h')
  })
})
