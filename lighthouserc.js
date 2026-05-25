/**
 * Lighthouse CI configuration.
 *
 * Run baseline (after a deploy):
 *   npx @lhci/cli@latest autorun
 *
 * Targets all 4 categories at >=90 on the public routes that don't require auth.
 * Authenticated routes (/dashboard/*) require a logged-in session and are not in
 * the default LHCI pass — they should be audited manually via Chrome devtools.
 */
const BASE_URL = process.env.LHCI_BASE_URL ?? 'https://hys-app-sig.vercel.app'

module.exports = {
  ci: {
    collect: {
      url: [`${BASE_URL}/`, `${BASE_URL}/login`],
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        skipAudits: ['uses-http2'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
}
