export function validateOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const referer = request.headers.get('referer')
  const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL

  if (!allowedOrigin) return true

  if (!origin && !referer) return false

  if (origin && origin !== allowedOrigin) {
    return false
  }

  if (referer && !referer.startsWith(allowedOrigin + '/')) {
    return false
  }

  return true
}

export function requireOrigin(request: Request): Response | null {
  if (!validateOrigin(request)) {
    return new Response(JSON.stringify({ error: 'Origen no válido' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return null
}
