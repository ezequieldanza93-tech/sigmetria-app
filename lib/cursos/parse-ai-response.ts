interface AiOpcion {
  texto: string
  es_correcta: boolean
}

interface AiPregunta {
  enunciado: string
  tipo: 'multiple_choice'
  opciones: AiOpcion[]
  explicacion: string
}

/**
 * Parsea y valida la respuesta de Claude para el AI Quiz Builder.
 * Busca un JSON array dentro del texto, lo valida contra el shape esperado.
 */
export function parseAiQuizResponse(text: string): AiPregunta[] {
  // Try to find JSON in the response
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error('No se encontró un array JSON en la respuesta')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonMatch[0])
  } catch {
    throw new Error('La respuesta no contiene JSON válido')
  }

  if (!Array.isArray(parsed)) {
    throw new Error('El JSON no es un array')
  }

  const preguntas: AiPregunta[] = []

  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]

    if (!item || typeof item !== 'object') {
      throw new Error(`Pregunta ${i + 1}: no es un objeto válido`)
    }

    if (typeof item.enunciado !== 'string' || !item.enunciado.trim()) {
      throw new Error(`Pregunta ${i + 1}: enunciado requerido`)
    }

    if (item.tipo !== 'multiple_choice') {
      throw new Error(`Pregunta ${i + 1}: solo se soporta tipo multiple_choice`)
    }

    if (!Array.isArray(item.opciones) || item.opciones.length < 2) {
      throw new Error(`Pregunta ${i + 1}: debe tener al menos 2 opciones`)
    }

    const correctas = item.opciones.filter((o: any) => o.es_correcta === true)
    if (correctas.length !== 1) {
      throw new Error(`Pregunta ${i + 1}: debe tener exactamente 1 opción correcta (tiene ${correctas.length})`)
    }

    for (let j = 0; j < item.opciones.length; j++) {
      const o = item.opciones[j]
      if (typeof o.texto !== 'string' || !o.texto.trim()) {
        throw new Error(`Pregunta ${i + 1}, opción ${j + 1}: texto requerido`)
      }
    }

    preguntas.push({
      enunciado: item.enunciado.trim(),
      tipo: 'multiple_choice',
      opciones: item.opciones.map((o: any) => ({
        texto: o.texto.trim(),
        es_correcta: !!o.es_correcta,
      })),
      explicacion: typeof item.explicacion === 'string' ? item.explicacion.trim() : '',
    })
  }

  if (preguntas.length === 0) {
    throw new Error('No se generaron preguntas válidas')
  }

  return preguntas
}
