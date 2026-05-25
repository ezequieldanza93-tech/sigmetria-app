import { describe, it, expect } from 'vitest'

// We test that the next.config.ts contains the correct security headers
// by reading the file and checking for expected patterns
import { readFileSync } from 'fs'
import { join } from 'path'

const nextConfig = readFileSync(join(__dirname, '../../next.config.ts'), 'utf-8')

describe('Security Headers (next.config.ts)', () => {
  it('includes Strict-Transport-Security (HSTS)', () => {
    expect(nextConfig).toMatch(/Strict-Transport-Security/)
    expect(nextConfig).toMatch(/max-age=31536000/)
    expect(nextConfig).toMatch(/includeSubDomains/)
  })

  it('includes X-Frame-Options: DENY', () => {
    expect(nextConfig).toContain("X-Frame-Options")
    expect(nextConfig).toContain("DENY")
  })

  it('includes X-Content-Type-Options: nosniff', () => {
    expect(nextConfig).toContain("X-Content-Type-Options")
    expect(nextConfig).toContain("nosniff")
  })

  it('includes Content-Security-Policy', () => {
    expect(nextConfig).toContain("Content-Security-Policy")
  })

  it('CSP does not allow object-src', () => {
    const cspMatch = nextConfig.match(/object-src\s+'none'/)
    expect(cspMatch).not.toBeNull()
  })

  it('includes Referrer-Policy', () => {
    expect(nextConfig).toContain("Referrer-Policy")
  })
})
