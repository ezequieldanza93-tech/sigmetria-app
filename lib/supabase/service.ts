import { createClient } from '@supabase/supabase-js'

// Server-only: usa la service role key para bypassear RLS en rutas públicas.
// NUNCA importar este módulo desde código cliente ('use client').
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}
