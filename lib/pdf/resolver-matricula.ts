/**
 * resolver-matricula.ts — Resuelve la MATRÍCULA del profesional que EJECUTA la gestión
 * para la carátula/firma de los protocolos (helper compartido por los protocolos del
 * motor: ruido, PAT, carga térmica, carga de fuego, ergonomía — e iluminación, el gold
 * standard del que se extrajo).
 *
 * Cascada (best-effort, todo dentro de un try/catch):
 *   auth.getUser()
 *     → perfiles_profesionales por user_id  (perfiles_profesionales.user_id = auth user id)
 *       → matriculas_profesionales activa (la más reciente)  → "emisor numero"
 *
 * Devuelve la cadena compuesta `"<emisor> <numero>"` (trim), o null si:
 *   no hay usuario / no hay perfil / no hay matrícula activa / falla algún query.
 * El motor del PDF ya tiene fallback cuando la matrícula viene vacía.
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Resuelve la matrícula del profesional autenticado que ejecuta la gestión.
 *
 * @returns la matrícula compuesta `"<emisor> <numero>"`, o null si no se pudo resolver.
 */
export async function resolverMatriculaProfesional(): Promise<string | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    // perfiles_profesionales.user_id → profiles.id (= auth user id).
    const { data: perfilUser } = await supabase
      .from('perfiles_profesionales')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    const perfilId = (perfilUser?.id as string | null) ?? null
    if (!perfilId) return null

    // Matrícula activa del perfil → "emisor numero" (la más reciente).
    const { data: matRow } = await supabase
      .from('matriculas_profesionales')
      .select('emisor, numero')
      .eq('perfil_id', perfilId)
      .eq('activa', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!matRow) return null

    const emisor = (matRow.emisor as string | null) ?? ''
    const numero = (matRow.numero as string | null) ?? ''
    const compuesta = `${emisor} ${numero}`.trim()
    return compuesta || null
  } catch (err) {
    console.error(
      '[RESOLVER-MATRICULA] no se pudo resolver la matrícula del responsable que ejecuta:',
      err instanceof Error ? err.message : String(err),
    )
    return null
  }
}
