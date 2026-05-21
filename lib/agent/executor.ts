import { ChatAnthropic } from '@langchain/anthropic'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { tools } from './tools'
import { searchKnowledge } from './knowledge'

const MOCK_MODE = !process.env.ANTHROPIC_API_KEY

const SYSTEM_PROMPT = `Eres Sig, el asistente virtual de Sigmetría HyS, una plataforma de gestión de Higiene y Seguridad laboral.

Tu objetivo es ayudar a los usuarios a gestionar sus empresas, establecimientos, empleados, siniestros, inspecciones, riesgos y más.

REGLAS:
1. Respondé SIEMPRE en español argentino, de forma clara y profesional.
2. Si no sabés la respuesta, usá buscar_en_knowledge_base para consultar la base de conocimiento.
3. Para acciones que modifican datos (crear empresa, registrar siniestro, etc.), usá las herramientas disponibles.
4. Para acciones destructivas o que requieren aprobación explícita (registrar gestión, actualizar riesgo, enviar notificación), usá las herramientas que requieren aprobación — estas crearán una solicitud pendiente que el usuario debe aprobar.
5. Si el usuario pregunta "qué podés hacer" o similar, listá tus capacidades principales.
6. Cuando menciones datos concretos del usuario, referite a su empresa o establecimiento según el contexto de la conversación.
7. Mantené un tono amable pero profesional. Usá "vos" para dirigirte al usuario.`

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
): Promise<{ reply: string; conversationId: string; pendingActions: PendingAction[] }> {
  if (MOCK_MODE) {
    return mockResponse(message, conversationId, userId)
  }

  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  let convId = conversationId
  if (!convId) {
    const { data: conv, error } = await supabase
      .from('agent_conversations')
      .insert({ user_id: userId, title: message.slice(0, 100) })
      .select('id')
      .single()
    if (error) throw new Error(`Failed to create conversation: ${error.message}`)
    convId = conv.id
  }

  const { data: prevMessages } = await supabase
    .from('agent_messages')
    .select('role, content')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })

  await supabase.from('agent_messages').insert({
    conversation_id: convId,
    role: 'user',
    content: message,
  })

  const model = new ChatAnthropic({
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    apiKey: process.env.ANTHROPIC_API_KEY,
  })

  const modelWithTools = model.bindTools(tools)

  const messages = [
    new SystemMessage(SYSTEM_PROMPT),
    ...(prevMessages ?? []).map(m =>
      m.role === 'user' ? new HumanMessage(m.content) : new HumanMessage({ content: m.content, name: 'assistant' })
    ),
    new HumanMessage(message),
  ]

  const response = await modelWithTools.invoke(messages)
  const reply = response.content as string

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
    conversationId: convId!,
    pendingActions: (pendingActions ?? []) as unknown as PendingAction[],
  }
}

async function mockResponse(
  message: string,
  conversationId: string | null,
  _userId: string,
): Promise<{ reply: string; conversationId: string; pendingActions: PendingAction[] }> {
  const knowledge = await searchKnowledge(message, 3)
  const context = knowledge.map(k => k.content).join('\n')

  let reply = ''
  const lower = message.toLowerCase()

  if (lower.includes('hola') || lower.includes('buen') || lower.includes('qué tal')) {
    reply = '¡Hola! Soy Sig, el asistente virtual de Sigmetría HyS. ¿En qué puedo ayudarte hoy? Podés consultarme sobre empresas, establecimientos, siniestros, inspecciones, riesgos y más.'
  } else if (lower.includes('qué podés hacer') || lower.includes('capacidades') || lower.includes('funcionalidades') || lower.includes('ayuda')) {
    reply = 'Estas son mis capacidades principales:\n\n📋 **Consultas:**\n- Ver siniestros, inspecciones y riesgos de un establecimiento\n- Consultar vencimientos de documentación\n- Buscar empleados\n- Responder preguntas sobre la plataforma\n\n✍️ **Acciones automáticas:**\n- Crear empresas\n- Registrar siniestros\n\n🔐 **Acciones con aprobación:**\n- Registrar gestiones/acciones pendientes\n- Actualizar estado de riesgos\n- Enviar notificaciones\n\n¿Sobre qué querés consultar?'
  } else if (lower.includes('siniestro')) {
    reply = `Según la información disponible en la base de conocimiento: los siniestros se clasifican por gravedad (leve, moderado, grave) y se registran con fecha de ocurrencia, descripción y tipo. Podés consultar los siniestros de un establecimiento específico o registrar uno nuevo.`
  } else if (lower.includes('inspeccion')) {
    reply = `Las inspecciones pueden ser programadas o espontáneas, y se asignan a sectores específicos del establecimiento. ¿Querés ver las inspecciones de algún establecimiento en particular?`
  } else if (lower.includes('riesgo')) {
    reply = `Los riesgos pasan por estados: abierto → en_progreso → mitigado → cerrado. Cada riesgo tiene un nivel (bajo, medio, alto, crítico). ¿Querés consultar los riesgos de un establecimiento o actualizar el estado de alguno?`
  } else if (context) {
    reply = `Según la base de conocimiento de Sigmetría HyS:\n\n${context}`
  } else {
    reply = 'Entendido. ¿Podrías darme más detalles o especificar sobre qué empresa o establecimiento querés consultar? Así puedo ayudarte mejor.'
  }

  const convId = conversationId ?? 'mock-conversation'

  return {
    reply,
    conversationId: convId,
    pendingActions: [],
  }
}
