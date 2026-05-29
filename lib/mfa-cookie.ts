// Helpers para la cookie de sesión MFA verificada.
// Usa Web Crypto API (crypto.subtle) — compatible con Edge runtime (middleware)
// y Node.js runtime (server actions) sin imports adicionales.
//
// SETUP: requiere env var MFA_COOKIE_SECRET (mínimo 32 bytes random).
// Generar con: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

export const MFA_COOKIE_NAME = 'mfa_verified'
export const MFA_COOKIE_TTL_MS = 24 * 60 * 60 * 1000 // 24 horas

function bufToBase64url(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64urlToBuf(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/\//g, '/').padEnd(
    b64url.length + (4 - (b64url.length % 4)) % 4,
    '='
  )
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0))
}

async function getHmacKey(usage: 'sign' | 'verify'): Promise<CryptoKey> {
  const secret = process.env.MFA_COOKIE_SECRET
  if (!secret) throw new Error('MFA_COOKIE_SECRET no configurado')
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    [usage]
  )
}

export async function createMfaCookie(userId: string): Promise<string> {
  const exp = Date.now() + MFA_COOKIE_TTL_MS
  const payload = bufToBase64url(new TextEncoder().encode(JSON.stringify({ userId, exp })))
  const key = await getHmacKey('sign')
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return `${payload}.${bufToBase64url(sig)}`
}

export async function verifyMfaCookie(value: string, userId: string): Promise<boolean> {
  try {
    const dotIndex = value.lastIndexOf('.')
    if (dotIndex === -1) return false
    const payload = value.slice(0, dotIndex)
    const sig = value.slice(dotIndex + 1)
    const key = await getHmacKey('verify')
    const valid = await crypto.subtle.verify(
      'HMAC', key, base64urlToBuf(sig), new TextEncoder().encode(payload)
    )
    if (!valid) return false
    const data: { userId: string; exp: number } = JSON.parse(
      new TextDecoder().decode(base64urlToBuf(payload))
    )
    return data.userId === userId && Date.now() < data.exp
  } catch {
    return false
  }
}
