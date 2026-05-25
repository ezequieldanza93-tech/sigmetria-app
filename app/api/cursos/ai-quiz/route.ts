import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { aiQuizRatelimit } from '@/lib/rate-limit'
import { parseAiQuizResponse } from '@/lib/cursos/parse-ai-response'

export const runtime = 'nodejs'
export const maxDuration = 60

async function extractPdfText(buf: Buffer): Promise<string> {
  try {
    // pdf-parse uses pdfjs internally
    const pdfParseModule = await import('pdf-parse')
    const PDFParse = (pdfParseModule as any).default || pdfParseModule.PDFParse || pdfParseModule
    const data = typeof PDFParse === 'function' ? await PDFParse(buf) : null
    if (data && data.text) return data.text
    throw new Error('No text extracted')
  } catch {
    throw new Error('No se pudo extraer texto del PDF. Asegurate de que no sea una imagen escaneada.')
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Check rate limit
  const { success: rateOk } = await aiQuizRatelimit.limit(user.id)
  if (!rateOk) {
    return NextResponse.json({ error: 'Demasiados pedidos. Esperá un rato.' }, { status: 429 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const numPreguntasRaw = formData.get('num_preguntas') as string | null
  const numPreguntas = Math.min(Math.max(parseInt(numPreguntasRaw || '10'), 3), 20)

  if (!file || file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Subí un PDF válido' }, { status: 400 })
  }

  // Parse PDF text
  const buf = Buffer.from(await file.arrayBuffer())
  let pdfText: string
  try {
    pdfText = await extractPdfText(buf)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 })
  }

  if (pdfText.length < 100) {
    return NextResponse.json({ error: 'El PDF es muy corto o no tiene texto extraíble' }, { status: 400 })
  }

  const client = new Anthropic()

  const completion = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Sos un experto en HSE (salud y seguridad ocupacional). Generá ${numPreguntas} preguntas de quiz tipo "multiple_choice" basadas en este material.

Devolvé EXCLUSIVAMENTE un JSON array con este shape (sin texto adicional):
[
  {
    "enunciado": "...",
    "tipo": "multiple_choice",
    "opciones": [
      { "texto": "...", "es_correcta": false },
      { "texto": "...", "es_correcta": true },
      { "texto": "...", "es_correcta": false },
      { "texto": "...", "es_correcta": false }
    ],
    "explicacion": "Por qué es correcta la opción correcta"
  }
]

Cada pregunta debe tener exactamente 4 opciones, 1 correcta. En español, lenguaje claro.

Material:
${pdfText.slice(0, 15000)}`,
    }],
  })

  const text = completion.content[0].type === 'text' ? completion.content[0].text : ''
  
  let preguntas: ReturnType<typeof parseAiQuizResponse>
  try {
    preguntas = parseAiQuizResponse(text)
    } catch {
    return NextResponse.json({ error: 'La AI no devolvió respuesta válida. Probá de nuevo.' }, { status: 422 })
  }

  return NextResponse.json({ preguntas })
}
