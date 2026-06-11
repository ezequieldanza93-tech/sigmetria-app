/**
 * Contexto de auditoría — trace_id y origen para la cadena de custodia.
 *
 * El trigger `fn_audit_trigger` lee `request.headers ->> 'x-trace-id'` y `'x-audit-origen'`
 * (disponibles DENTRO de la transacción del request en PostgREST). Para que un flujo de negocio
 * multi-tabla comparta un mismo trace_id, se crea un cliente Supabase con esos headers globales
 * y se usa ESE cliente para todas las escrituras del flujo.
 *
 * Adopción incremental: las server actions existentes siguen funcionando sin trace_id (queda
 * NULL en el audit_log). Para correlacionar un flujo (ej. una recorrida completa), usar
 * `createAuditedClient()` en lugar de `createClient()`.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { randomUUID } from 'node:crypto'

export const AUDIT_TRACE_HEADER = 'x-trace-id'
export const AUDIT_ORIGEN_HEADER = 'x-audit-origen'

export type AuditOrigen = 'humano' | 'automatizado' | 'sistema'

/** Genera un nuevo trace_id (UUID v4) para un flujo de negocio. */
export function newTraceId(): string {
  return randomUUID()
}

/** Headers de auditoría para adjuntar a un cliente Supabase. */
export function auditHeaders(traceId: string, origen: AuditOrigen = 'humano'): Record<string, string> {
  return { [AUDIT_TRACE_HEADER]: traceId, [AUDIT_ORIGEN_HEADER]: origen }
}

/**
 * Cliente Supabase de servidor con contexto de auditoría (trace_id + origen) en los headers.
 * Todas las escrituras hechas con este cliente quedan correlacionadas por el mismo trace_id.
 */
export async function createAuditedClient(
  traceId: string = newTraceId(),
  origen: AuditOrigen = 'humano',
) {
  const cookieStore = await cookies()
  const client = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: auditHeaders(traceId, origen) },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            if (process.env.NODE_ENV !== 'production')
              console.error('[supabase-audited] Error al setear cookies')
          }
        },
      },
    },
  )
  return { client, traceId }
}
