import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, formatCUIT, pluralize, cn, getInitials, formatHours } from '@/lib/utils'

describe('formatDate', () => {
  it('formats a valid date string', () => {
    const result = formatDate('2026-05-20T12:00:00Z')
    expect(result).toBe('20/05/2026')
  })

  it('returns em dash for null', () => {
    expect(formatDate(null)).toBe('—')
  })

  it('returns em dash for undefined', () => {
    expect(formatDate(undefined)).toBe('—')
  })

  it('returns em dash for empty string', () => {
    expect(formatDate('')).toBe('—')
  })
})

describe('formatDateTime', () => {
  it('formats a valid date string with time', () => {
    const result = formatDateTime('2026-05-20T14:30:00Z')
    expect(result).toContain('20/05/2026')
  })
})

describe('formatCUIT', () => {
  it('formats an 11-digit CUIT', () => {
    expect(formatCUIT('20123456789')).toBe('20-12345678-9')
  })

  it('returns em dash for null', () => {
    expect(formatCUIT(null)).toBe('—')
  })

  it('returns raw value if not 11 digits', () => {
    expect(formatCUIT('12345')).toBe('12345')
  })

  it('strips non-digit characters', () => {
    expect(formatCUIT('20-12345678-9')).toBe('20-12345678-9')
  })
})

describe('pluralize', () => {
  it('returns singular for count 1', () => {
    expect(pluralize(1, 'empleado')).toBe('empleado')
  })

  it('returns plural for count 0', () => {
    expect(pluralize(0, 'empleado')).toBe('empleados')
  })

  it('returns plural for count > 1', () => {
    expect(pluralize(5, 'empleado')).toBe('empleados')
  })

  it('uses custom plural form', () => {
    expect(pluralize(3, 'país', 'países')).toBe('países')
  })
})

describe('cn', () => {
  it('joins truthy class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('filters out falsy values', () => {
    expect(cn('foo', false, undefined, null, 'bar')).toBe('foo bar')
  })

  it('returns empty string for no truthy values', () => {
    expect(cn(false, null, undefined)).toBe('')
  })
})

describe('getInitials', () => {
  it('extracts initials from full name', () => {
    expect(getInitials('Juan Pérez')).toBe('JP')
  })

  it('returns ? for null', () => {
    expect(getInitials(null)).toBe('?')
  })

  it('handles single name', () => {
    expect(getInitials('Juan')).toBe('J')
  })

  it('uppercases initials', () => {
    expect(getInitials('maría garcía')).toBe('MG')
  })
})

describe('formatHours', () => {
  it('formats hours', () => {
    expect(formatHours(8)).toBe('8h')
  })

  it('returns em dash for null', () => {
    expect(formatHours(null)).toBe('—')
  })

  it('returns em dash for undefined', () => {
    expect(formatHours(undefined)).toBe('—')
  })
})
