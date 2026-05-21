import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { tools } from './tools'
import { searchKnowledge } from './knowledge'

const HAS_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY
const HAS_GEMINI = !!process.env.GOOGLE_API_KEY_A

const STRICT_SYSTEM_PROMPT = `Eres Sigía, asistente de Sigmetría HyS (gestión HyS laboral).

REGLAS:
1. Respondé SOLO con datos reales de las tools. Si no hay datos: "No tengo esa información".
2. NO inventes, no especules, no delires.
3. Respuestas cortas en español argentino. Solo la información pedida.
4. Usá las tools para consultar datos. No asumas nada.
5. Si algo no es de la app, decí que no podés responder.
6. Priorizá decir "No tengo esa información" antes que improvisar.`

export type Message = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type PendingAction = {
  id: string
  action_type: string
  payload: Record<string, unknown>
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
}

export async function processMessage(
  message: string,
  conversationId: string | null,
  userId: string,
  context?: { establecimientoId?: string; empresaId?: string; establecimientoNombre?: string; empresaNombre?: string },
): Promise<{ reply: string; conversationId: string; pendingActions: PendingAction[] }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // --- Get/create conversation ---
  let convId = conversationId
  let prevMessages: { role: string; content: string }[] = []

  if (!convId) {
    const { data: conv } = await supabase
      .from('agent_conversations')
      .insert({ user_id: userId, title: message.slice(0, 100) })
      .select('id')
      .single()
    if (conv) convId = conv.id
  }

  if (convId) {
    const { data: history } = await supabase
      .from('agent_messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    prevMessages = history ?? []

    await supabase.from('agent_messages').insert({
      conversation_id: convId,
      role: 'user',
      content: message,
    })
  }

  // --- Try LLM ---
  if (HAS_ANTHROPIC || HAS_GEMINI) {
    try {
      const provider = HAS_ANTHROPIC ? 'anthropic' : 'google'
      return await processWithLLM(message, convId!, userId, supabase, prevMessages, context, provider)
    } catch {
      // fall through to knowledge base
    }
  }

  // --- Fallback: knowledge base ---
  const knowledge = await searchKnowledge(message, 3)
  const contextStr = knowledge.map(k => k.content).join('\n')
  if (contextStr) {
    return saveAndReturn(supabase, convId!, `Según la base de conocimiento de Sigmetría HyS:\n\n${contextStr}`)
  }

  // --- Ultimate fallback ---
  return saveAndReturn(supabase, convId!,
    'No entendí bien tu consulta. Estas son algunas cosas que podés preguntar:\n\n'
    + '• "cuántas empresas tengo"\n'
    + '• "listame los establecimientos"\n'
    + '• "cuántas gestiones tengo este mes"\n'
    + '• "cuándo es la próxima gestión"\n'
    + '• "mostrame los siniestros"\n'
    + '• "planificar un checklist de extintores para el 15/06"\n'
    + '• "cuáles son mis riesgos"\n\n'
    + 'También podés usar Sigía desde la pestaña **Asistente HyS** dentro de un establecimiento para consultas con contexto automático.',
  )
}

async function processWithLLM(
  message: string,
  convId: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>,
  prevMessages: { role: string; content: string }[],
  context?: { establecimientoId?: string; empresaId?: string; establecimientoNombre?: string; empresaNombre?: string },
  provider: 'anthropic' | 'google' = 'google',
): Promise<{ reply: string; conversationId: string; pendingActions: PendingAction[] }> {
  let model
  if (provider === 'anthropic') {
    model = new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      temperature: 0.2,
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  } else {
    model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash',
      temperature: 0.2,
      maxOutputTokens: 512,
      apiKey: process.env.GOOGLE_API_KEY_A,
    })
  }

  const modelWithTools = model.bindTools(tools)

  const contextNote = context?.establecimientoNombre
    ? `\n\nContexto actual: el usuario está en el establecimiento "${context.establecimientoNombre}" (ID: ${context.establecimientoId}). Usá este contexto para filtrar consultas a menos que el usuario mencione explícitamente otro establecimiento.`
    : ''

  const messages = [
    new SystemMessage(STRICT_SYSTEM_PROMPT + contextNote),
    ...(prevMessages ?? []).map(m =>
      m.role === 'user' ? new HumanMessage(m.content) : new HumanMessage({ content: m.content, name: 'assistant' })
    ),
    new HumanMessage(message),
  ]

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  let reply: string
  try {
    const response = await modelWithTools.invoke(messages, { signal: controller.signal })
    reply = response.content as string
    clearTimeout(timeout)
  } catch {
    clearTimeout(timeout)
    throw new Error('LLM invocation failed')
  }

  await supabase.from('agent_messages').insert({
    conversation_id: convId,
    role: 'assistant',
    content: reply,
  })

  const { data: pendingActions } = await supabase
    .from('agent_pending_actions')
    .select('*')
    .eq('requested_by', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })

  return {
    reply,
    conversationId: convId,
    pendingActions: (pendingActions ?? []) as unknown as PendingAction[],
  }
}

async function saveAndReturn(supabase: any, convId: string, reply: string, pendingActions?: PendingAction[]) {
  if (convId) {
    try {
      await supabase.from('agent_messages').insert({
        conversation_id: convId,
        role: 'assistant',
        content: reply,
      })
    } catch {
      // silent - non-critical
    }
  }
  return {
    reply,
    conversationId: convId,
    pendingActions: pendingActions ?? [],
  }
}
