'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { sugerirObservacionRatelimit } from '@/lib/rate-limit'
import type { ActionResult } from '@/lib/types'

// ============================================================================
// IA inline para redacción de observaciones de campo de HyS.
//
// Patrón: "la IA sugiere, el humano confirma". Esta acción NUNCA escribe en la
// base. Devuelve un borrador redactado + una sugerencia de categoría; el
// profesional edita en el textarea y recién ahí guarda (createObservacionGestion).
//
// Generación de UN turno (no es un agente ni un loop de tools): un único
// messages.create contra el SDK oficial de Anthropic. Para que la salida sea
// JSON tipado y confiable usamos tool_choice forzado sobre una sola herramienta
// (la IA "rellena" el schema). Modelo: claude-sonnet-4-6 (el actual).
// ============================================================================

const MODEL = 'claude-sonnet-4-6'
// Límite duro de salida; un borrador de observación es corto.
const MAX_TOKENS = 1024
// Timeout de la llamada a la API: si la IA tarda/falla, el profesional sigue
// pudiendo escribir a mano. NO bloqueamos el formulario.
const API_TIMEOUT_MS = 30_000
// Acota lo que mandamos como contexto para no inflar tokens ni costo.
const MAX_NOTAS = 2000

export interface SugerenciaObservacion {
  /** Borrador redactado para el textarea (descripcion). El profesional lo edita. */
  borrador: string
  /** id de observaciones_categorias sugerido (pre-selección editable), o null. */
  categoriaId: string | null
}

interface SugerirObservacionInput {
  /** Notas crudas del profesional (lo que tipeó en el textarea). */
  notas: string
  /** Nombre del tipo de gestión, si está disponible (contexto). */
  gestionNombre?: string | null
  /** Nombre del establecimiento, si está disponible (contexto). */
  establecimientoNombre?: string | null
}

const SYSTEM_PROMPT = `Sos un asistente experto en Higiene y Seguridad en el Trabajo (HyS) en Argentina. Tu tarea es redactar OBSERVACIONES DE CAMPO a partir de las notas crudas de un profesional que está relevando un establecimiento.

Una buena observación de campo cumple TODO esto:
- CLARA y OBJETIVA: describe el hecho/condición tal como se observó, sin opinar ni exagerar. Lenguaje técnico pero entendible.
- ACCIONABLE: deja claro qué hay que corregir.
- Identifica el RIESGO asociado (qué puede pasar si no se corrige) cuando las notas lo permitan.
- Incluye una RECOMENDACIÓN o medida correctiva concreta.
- Redacción impersonal y profesional, en español rioplatense, tiempo presente.
- 2 a 5 oraciones. No inventes datos que no estén en las notas (no agregues mediciones, normas o nombres que el profesional no mencionó). Si las notas son escuetas, redactá lo que haya con prolijidad sin rellenar con suposiciones.

Devolvés además la categoría que mejor clasifica la observación, eligiéndola SOLO de la lista provista. Si ninguna encaja claramente, no fuerces una categoría.

Respondé EXCLUSIVAMENTE usando la herramienta "redactar_observacion".`

/**
 * Sugiere un borrador de observación + categoría a partir de notas crudas.
 * No persiste nada. Gateado por cupo (Upstash) a nivel consultora.
 */
export async function sugerirObservacion(
  input: SugerirObservacionInput
): Promise<ActionResult<SugerenciaObservacion>> {
  // --- Auth ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const notas = (input.notas ?? '').trim()
  if (!notas) {
    return { success: false, error: 'Escribí algunas notas para que la IA las redacte' }
  }

  // --- API key presente? Si falta, degradamos con un mensaje claro (no rompe el form) ---
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: 'La redacción con IA no está disponible en este momento' }
  }

  // --- Gating + cupo (rate-limit por consultora; fallback al usuario) ---
  const role = await getEffectiveRole()
  const cupoKey = role?.consultoraId ?? user.id
  const { success: dentroDelCupo, remaining } = await sugerirObservacionRatelimit.limit(cupoKey)
  if (!dentroDelCupo) {
    return {
      success: false,
      error: 'Se agotó el cupo de redacciones con IA por ahora. Probá de nuevo más tarde o escribí la observación a mano.',
    }
  }

  // --- Catálogo de categorías (para clasificar) ---
  const { data: categoriasData } = await supabase
    .from('observaciones_categorias')
    .select('id, nombre')
    .order('nivel')
  const categorias = (categoriasData ?? []) as { id: string; nombre: string }[]

  // --- Contexto opcional ---
  const contexto: string[] = []
  if (input.establecimientoNombre) contexto.push(`Establecimiento: ${input.establecimientoNombre}`)
  if (input.gestionNombre) contexto.push(`Tipo de gestión: ${input.gestionNombre}`)
  const contextoTxt = contexto.length ? `\n\nContexto:\n${contexto.join('\n')}` : ''

  const listaCategorias = categorias.length
    ? categorias.map((c) => `- ${c.nombre}`).join('\n')
    : '(sin categorías disponibles)'

  // La herramienta: la IA rellena este schema. categoria_nombre es un enum sobre
  // el catálogo real → mapeamos el nombre devuelto al id (más robusto que pedir
  // el UUID directo, que el modelo podría alucinar).
  const categoriaNombres = categorias.map((c) => c.nombre)
  const tool: Anthropic.Tool = {
    name: 'redactar_observacion',
    description: 'Devuelve el borrador redactado de la observación y la categoría sugerida.',
    input_schema: {
      type: 'object',
      properties: {
        borrador: {
          type: 'string',
          description: 'La observación de campo redactada (2-5 oraciones).',
        },
        categoria_nombre: {
          type: 'string',
          description:
            'Nombre EXACTO de la categoría que mejor clasifica la observación, tomado de la lista. Dejar vacío si ninguna encaja.',
          ...(categoriaNombres.length ? { enum: ['', ...categoriaNombres] } : {}),
        },
      },
      required: ['borrador'],
    },
  }

  const userPrompt = `Notas crudas del profesional:
"""
${notas.slice(0, MAX_NOTAS)}
"""${contextoTxt}

Categorías disponibles para clasificar:
${listaCategorias}`

  // --- Llamada a la API (un único turno) ---
  const client = new Anthropic()
  try {
    const completion = await client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'redactar_observacion' },
        messages: [{ role: 'user', content: userPrompt }],
      },
      { timeout: API_TIMEOUT_MS }
    )

    const toolUse = completion.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    if (!toolUse) {
      return { success: false, error: 'La IA no devolvió una redacción. Probá de nuevo.' }
    }

    const out = toolUse.input as { borrador?: unknown; categoria_nombre?: unknown }
    const borrador = typeof out.borrador === 'string' ? out.borrador.trim() : ''
    if (!borrador) {
      return { success: false, error: 'La IA no devolvió una redacción. Probá de nuevo.' }
    }

    const categoriaNombre =
      typeof out.categoria_nombre === 'string' ? out.categoria_nombre.trim() : ''
    const match = categoriaNombre
      ? categorias.find((c) => c.nombre.toLowerCase() === categoriaNombre.toLowerCase())
      : undefined

    return {
      success: true,
      data: {
        borrador,
        categoriaId: match?.id ?? null,
      },
    }
  } catch (err) {
    // Cualquier fallo de la API (timeout, 429, 5xx) NO debe bloquear al profesional:
    // devolvemos error legible y el form sigue permitiendo escribir a mano.
    const msg =
      err instanceof Anthropic.APIError
        ? 'La IA tardó demasiado o no está disponible. Escribí la observación a mano.'
        : 'No se pudo redactar con IA. Escribí la observación a mano.'
    return { success: false, error: msg, data: { remaining } }
  }
}
