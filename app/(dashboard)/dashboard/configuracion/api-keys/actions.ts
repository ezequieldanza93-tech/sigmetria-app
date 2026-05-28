'use server'

import crypto from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createApiKey(name: string): Promise<{ key: string } | { error: string }> {
  if (!name.trim()) return { error: 'El nombre es requerido' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership || membership.role !== 'full_access_main') {
    return { error: 'Solo el administrador principal puede crear API keys' }
  }

  const rawKey = 'sig_' + crypto.randomBytes(32).toString('hex')
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 12)

  const { error } = await supabase.from('api_keys').insert({
    consultora_id: membership.consultora_id,
    name: name.trim(),
    key_hash: keyHash,
    key_prefix: keyPrefix,
    created_by: user.id,
    permisos: ['read'],
  })

  if (error) return { error: 'Error al crear la key: ' + error.message }

  revalidatePath('/dashboard/configuracion/api-keys')
  return { key: rawKey }
}

export async function revokeApiKey(keyId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'No autenticado' }

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .is('revoked_at', null)

  if (error) return { error: 'Error al revocar: ' + error.message }

  revalidatePath('/dashboard/configuracion/api-keys')
  return {}
}
