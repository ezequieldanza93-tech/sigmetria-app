import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Cliente con service role — bypasea RLS
// SOLO usar en server-side (API routes, server actions)
// NUNCA exponer en el cliente
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
