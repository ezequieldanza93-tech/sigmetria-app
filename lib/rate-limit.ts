import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

function createRatelimit(limiter: Ratelimit['limiter'], prefix: string): Ratelimit {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return {
      limit: async () => ({ success: true, remaining: 999, limit: 999, reset: 0 }),
      blockUntilUsed: async () => {},
    } as unknown as Ratelimit
  }
  return new Ratelimit({
    redis: Redis.fromEnv(),
    limiter,
    analytics: true,
    prefix,
  })
}

export const authRatelimit = createRatelimit(
  Ratelimit.slidingWindow(5, '60 s'),
  'ratelimit:auth'
)

export const apiRatelimit = createRatelimit(
  Ratelimit.slidingWindow(60, '60 s'),
  'ratelimit:api'
)

export async function checkRateLimit(ratelimit: Ratelimit, identifier: string) {
  const { success, remaining } = await ratelimit.limit(identifier)
  if (!success) {
    return { allowed: false, remaining }
  }
  return { allowed: true, remaining }
}
