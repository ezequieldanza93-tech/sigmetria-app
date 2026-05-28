import crypto from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

export interface ApiKeyContext {
  api_key_id: string
  consultora_id: string
  permisos: string[]
}

export async function authenticateApiKey(request: Request): Promise<ApiKeyContext | null> {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const rawKey = authHeader.slice(7).trim()
  if (!rawKey) return null

  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const supabase = createServiceClient()

  const { data } = await supabase
    .from('api_keys')
    .select('id, consultora_id, permisos, revoked_at')
    .eq('key_hash', keyHash)
    .maybeSingle()

  if (!data || data.revoked_at) return null

  // Fire-and-forget last_used_at update
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return {
    api_key_id: data.id,
    consultora_id: data.consultora_id,
    permisos: data.permisos ?? [],
  }
}

export function apiError(code: string, message: string, status: number): Response {
  return Response.json({ error: { code, message } }, { status })
}
