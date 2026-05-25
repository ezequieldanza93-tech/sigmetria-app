'use server'

import { headers } from 'next/headers'
import { authRatelimit } from '@/lib/rate-limit'

export async function checkLoginRateLimit(): Promise<{ allowed: boolean; message?: string }> {
  const headersList = await headers()
  const ip = headersList.get('x-forwarded-for') ?? headersList.get('x-real-ip') ?? 'anonymous'

  const { success } = await authRatelimit.limit(ip)

  if (!success) {
    return {
      allowed: false,
      message: `Demasiados intentos. Esperá un minuto antes de reintentar.`,
    }
  }

  return { allowed: true }
}
