/**
 * Construcción de URLs absolutas para disparar el WORKER async de export
 * (estándar 3 Portabilidad, SRT Disp. 15/2026).
 *
 * Por qué absoluta: el disparo del worker se hace con `after(() => fetch(...))`
 * dentro del request del route. `fetch` desde el server necesita una URL
 * absoluta — no resuelve rutas relativas.
 *
 * Orden de resolución (de más confiable a fallback):
 *   1. origin del request entrante (host real que pegó el cliente)
 *   2. NEXT_PUBLIC_APP_URL  (dominio canónico, ej. https://app.sigmetria.com.ar)
 *   3. VERCEL_PROJECT_PRODUCTION_URL / VERCEL_URL  (deploy actual)
 *   4. http://localhost:3000  (dev)
 */

/** Base absoluta del deployment, preferiendo el origin del request. */
export function appBaseUrl(req?: { nextUrl: { origin: string } }): string {
  if (req?.nextUrl?.origin) return req.nextUrl.origin
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

/** URL absoluta del endpoint que procesa un job de export. */
export function exportJobRunUrl(jobId: string, req?: { nextUrl: { origin: string } }): string {
  return `${appBaseUrl(req)}/api/export/jobs/${jobId}/run`
}
