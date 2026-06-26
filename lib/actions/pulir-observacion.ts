'use server'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/auth/effective-role'
import { sugerirObservacionRatelimit } from '@/lib/rate-limit'
import type { ActionResult } from '@/lib/types'

// ============================================================================
// IA inline para PULIR una observación dictada por voz.
//
// A diferencia de sugerirObservacion (que REDACTA desde notas crudas), acá el
// profesional ya escribió/dictó la observación y solo queremos limpiarla: la
// transcripción de voz suele venir con palabras mal reconocidas, sin puntuación
// o con muletillas. La IA entiende el CONCEPTO y devuelve una observación
// profesional, CONCISA, de experto en Higiene y Seguridad. NO la alarga ni le
// inventa datos: corrige y prolija lo que ya está.
//
// Generación de UN turno (no es un agente ni un loop de tools): un único
// messages.create contra el SDK oficial de Anthropic. Forzamos tool_choice sobre
// una sola herramienta para que la salida sea texto tipado y confiable.
// Mismo cliente IA + mismo rate limit (Upstash) que sugerirObservacion.
// ============================================================================

const MODEL = 'claude-sonnet-4-6'
// Una observación pulida es corta; límite duro de salida.
const MAX_TOKENS = 1024
// Si la IA tarda/falla, el profesional conserva su texto tal cual. NO bloqueamos.
const API_TIMEOUT_MS = 30_000
// Acota lo que mandamos para no inflar tokens ni costo.
const MAX_TEXTO = 2000

const SYSTEM_PROMPT = `Sos un experto en Higiene y Seguridad en el Trabajo (HyS) en Argentina. Recibís una OBSERVACIÓN DE CAMPO que un profesional dictó por voz o escribió rápido, y tu única tarea es PULIRLA.

Reglas:
- Entendé el CONCEPTO que quiso transmitir y reescribilo como una observación profesional, CLARA y OBJETIVA, en español rioplatense, tiempo presente, redacción impersonal.
- La transcripción de voz puede venir con palabras mal reconocidas, sin puntuación o con muletillas: corregilas usando el sentido común técnico de HyS.
- SÉ CONCISO: NO la alargues, NO agregues riesgos, normas, mediciones, recomendaciones ni datos que el profesional no haya mencionado. Solo prolijás lo que ya está.
- No agregues encabezados, comillas ni comentarios. Devolvé únicamente el texto pulido de la observación.

Respondé EXCLUSIVAMENTE usando la herramienta "pulir_observacion".`

/**
 * Pule el texto de una observación dictada/escrita por el profesional.
 * No persiste nada. Gateado por cupo (Upstash) a nivel consultora.
 * Contrato consumido por components/ui/voice-textarea.tsx (prop pulirAction).
 */
export async function pulirObservacion(
  texto: string
): Promise<ActionResult<string>> {
  // --- Auth ---
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const original = (texto ?? '').trim()
  if (!original) {
    return { success: false, error: 'Escribí o dictá algo para pulir con IA' }
  }

  // --- API key presente? Si falta, degradamos con un mensaje claro (no rompe el form) ---
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: 'La IA no está disponible en este momento' }
  }

  // --- Gating + cupo (mismo rate-limit que sugerirObservacion: por consultora; fallback al usuario) ---
  const role = await getEffectiveRole()
  const cupoKey = role?.consultoraId ?? user.id
  const { success: dentroDelCupo } = await sugerirObservacionRatelimit.limit(cupoKey)
  if (!dentroDelCupo) {
    return {
      success: false,
      error: 'Se agotó el cupo de IA por ahora. Probá de nuevo más tarde o dejá el texto como está.',
    }
  }

  // La herramienta: la IA rellena este schema con el texto pulido.
  const tool: Anthropic.Tool = {
    name: 'pulir_observacion',
    description: 'Devuelve el texto pulido de la observación de campo.',
    input_schema: {
      type: 'object',
      properties: {
        texto: {
          type: 'string',
          description: 'La observación pulida: profesional, concisa y prolija. Sin encabezados ni comillas.',
        },
      },
      required: ['texto'],
    },
  }

  const userPrompt = `Observación a pulir:
"""
${original.slice(0, MAX_TEXTO)}
"""`

  // --- Llamada a la API (un único turno) ---
  const client = new Anthropic()
  try {
    const completion = await client.messages.create(
      {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'pulir_observacion' },
        messages: [{ role: 'user', content: userPrompt }],
      },
      { timeout: API_TIMEOUT_MS }
    )

    const toolUse = completion.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    if (!toolUse) {
      return { success: false, error: 'La IA no devolvió un texto pulido. Probá de nuevo.' }
    }

    const out = toolUse.input as { texto?: unknown }
    const pulido = typeof out.texto === 'string' ? out.texto.trim() : ''
    if (!pulido) {
      return { success: false, error: 'La IA no devolvió un texto pulido. Probá de nuevo.' }
    }

    return { success: true, data: pulido }
  } catch (err) {
    // Cualquier fallo de la API (timeout, 429, 5xx) NO debe bloquear al profesional:
    // devolvemos error legible y el form conserva el texto original.
    const msg =
      err instanceof Anthropic.APIError
        ? 'La IA tardó demasiado o no está disponible. Dejá el texto como está.'
        : 'No se pudo pulir con IA. Dejá el texto como está.'
    return { success: false, error: msg }
  }
}
