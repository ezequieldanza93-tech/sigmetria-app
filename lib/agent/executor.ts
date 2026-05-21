import { ChatAnthropic } from '@langchain/anthropic'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { tools } from './tools'
import { searchKnowledge } from './knowledge'

const HAS_ANTHROPIC = !!process.env.ANTHROPIC_API_KEY
const HAS_GEMINI = !!process.env.GOOGLE_API_KEY

const STRICT_SYSTEM_PROMPT = `Eres Sigía, la asistente virtual de Sigmetría HyS, una plataforma de gestión de Higiene y Seguridad laboral.

REGLAS ESTRICTAS:
1. Respondé SOLO con información de los datos que recuperes de la base de datos mediante las herramientas disponibles.
2. Si no encontrás la información solicitada, decí "No tengo esa información" sin inventar nada.
3. NO delires, NO inventes datos, NO especules, NO hagas suposiciones.
4. Respondé en español argentino, claro y conciso. Dá solo la información pedida, ni más ni menos.
5. Optimizá el uso de tokens: respuestas cortas, sin rodeos ni introducciones.
6. Usá las herramientas disponibles para consultar datos reales antes de responder. No asumas nada.
7. Si el usuario pregunta algo fuera del alcance de la plataforma o que no podés responder con datos reales, decí que no podés responder.
8. Cuando menciones datos concretos del usuario, referite a su empresa o establecimiento según el contexto de la conversación.
9. Mantené un tono amable pero profesional. Usá "vos" para dirigirte al usuario.
10. Ante cualquier duda, priorizá decir "No tengo esa información" antes que improvisar.`

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
  if (HAS_ANTHROPIC) {
    try {
      return await processWithLLM(message, conversationId, userId, context, 'anthropic')
    } catch {
      return mockResponse(message, conversationId, userId, context)
    }
  }
  if (HAS_GEMINI) {
    try {
      return await processWithLLM(message, conversationId, userId, context, 'google')
    } catch {
      return mockResponse(message, conversationId, userId, context)
    }
  }
  return mockResponse(message, conversationId, userId, context)
}

async function processWithLLM(
  message: string,
  conversationId: string | null,
  userId: string,
  context?: { establecimientoId?: string; empresaId?: string; establecimientoNombre?: string; empresaNombre?: string },
  provider: 'anthropic' | 'google' = 'google',
): Promise<{ reply: string; conversationId: string; pendingActions: PendingAction[] }> {
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

  let model
  if (provider === 'anthropic') {
    model = new ChatAnthropic({
      model: 'claude-sonnet-4-20250514',
      temperature: 0.3,
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  } else {
    model = new ChatGoogleGenerativeAI({
      model: 'gemini-2.0-flash',
      temperature: 0.3,
      apiKey: process.env.GOOGLE_API_KEY,
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
  const timeout = setTimeout(() => controller.abort(), 15000)
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
    conversationId: convId!,
    pendingActions: (pendingActions ?? []) as unknown as PendingAction[],
  }
}

async function mockResponse(
  message: string,
  conversationId: string | null,
  userId: string,
  context?: { establecimientoId?: string; empresaId?: string; establecimientoNombre?: string; empresaNombre?: string },
): Promise<{ reply: string; conversationId: string; pendingActions: PendingAction[] }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  // --- Persist conversation & load history ---
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

  const lastAssistantMsg = [...prevMessages].reverse().find(m => m.role === 'assistant')?.content ?? ''

  const lower = message.toLowerCase()

  // --- Infer topic from last assistant message for follow-up understanding ---
  const pendingEstSelection = lastAssistantMsg.includes('decime cuál te interesa') || lastAssistantMsg.includes('¿para cuál establecimiento')
  const pendingPlanEstSelection = lastAssistantMsg.includes('¿para cuál establecimiento querés planificarlo')

  async function getConsultoraId(): Promise<string | null> {
    const { data: membership } = await supabase
      .from('consultoras_members')
      .select('consultora_id')
      .eq('user_id', userId)
      .eq('is_active', true)
      .maybeSingle()
    return membership?.consultora_id ?? null
  }

  const consultoraId = await getConsultoraId()
  if (!consultoraId) {
    return saveAndReturn(convId!, 'No encontré tu consultora asociada. Si pensás que es un error, contactá al administrador.')
  }

  // --- If we were asking for an establishment, treat this message as an answer ---
  if (pendingEstSelection || pendingPlanEstSelection) {
    const ests = await listEstablecimientos(consultoraId)
    if (ests) {
      const matchedEst = matchEstablecimiento(message, ests)
      if (matchedEst) {
        if (pendingPlanEstSelection) {
          return planificarGestion(message, matchedEst.id, matchedEst.nombre, supabase, userId, convId!)
        }
        return queryGestiones(matchedEst.id, matchedEst.nombre, lower, convId!, supabase)
      }
      if (ests.length > 0) {
        return saveAndReturn(convId!,
          `No encontré "${message.trim()}" entre los establecimientos disponibles. Elegí uno de estos:\n\n${ests.map(e => `• **${e.empresa_razon}** — ${e.nombre}`).join('\n')}`
        )
      }
    }
  }

  // Saludos
  if (lower.includes('hola') || lower.includes('buen') || lower.includes('qué tal')) {
    let greeting = '¡Hola! Soy Sigía, la asistente virtual de Sigmetría HyS.'
    if (context?.establecimientoNombre) {
      greeting += ` Estás consultando desde **${context.establecimientoNombre}**.`
    }
    greeting += ' ¿En qué puedo ayudarte hoy? Podés consultarme sobre empresas, establecimientos, siniestros, inspecciones, riesgos, gestiones y más.'
    return saveAndReturn(convId!, greeting)
  }

  if (lower.includes('qué podés hacer') || lower.includes('capacidades') || lower.includes('funcionalidades') || lower.includes('ayuda')) {
    let caps = 'Estas son mis capacidades principales:\n\n📋 **Consultas:**\n- Empresas (cantidad, listado)\n- Establecimientos\n- Gestiones (cantidad, próximas, filtros)\n- Siniestros, inspecciones, riesgos\n- Empleados\n- Vencimientos de documentación\n\n✍️ **Acciones con aprobación:**\n- Planificar checklist o gestión\n- Registrar gestiones\n- Actualizar estado de riesgos\n- Enviar notificaciones\n\n🔍 **Filtros:** podés preguntar por mes, tipo, estado o establecimiento.'
    if (context?.establecimientoNombre) {
      caps += `\n\n📍 Estás viendo **${context.establecimientoNombre}** — todas las consultas se filtran automáticamente a este establecimiento.`
    } else {
      caps += '\n\n💡 También podés usar Sigía desde la pestaña **Asistente HyS** dentro de un establecimiento para consultas con contexto automático.'
    }
    return saveAndReturn(convId!, caps)
  }

  // --- GESTIONES ---
  if (lower.includes('gestión') || lower.includes('gestion') || lower.includes('gestione') || lower.includes('programada') || lower.includes('planificada') || lower.includes('checklist') || lower.includes('check list') || lower.includes('extintor') || lower.includes('extintores')) {
    const targetEstId = detectEstablecimiento(lower, await listEstablecimientos(consultoraId) ?? [])?.[0]?.id ?? context?.establecimientoId

    if (!targetEstId) {
      const establecimientos = await listEstablecimientos(consultoraId)
      if (!establecimientos || establecimientos.length === 0) {
        return saveAndReturn(convId!, 'No encontré establecimientos activos en tu consultora.')
      }
      if (establecimientos.length === 1) {
        return queryGestiones(establecimientos[0].id, establecimientos[0].nombre, lower, convId!, supabase)
      }
      return saveAndReturn(convId!, `Tenés varios establecimientos. Decime cuál te interesa:\n\n${establecimientos.map(e => `• **${e.empresa_razon}** — ${e.nombre}`).join('\n')}`)
    }

    const estNombre = context?.establecimientoNombre && targetEstId === context?.establecimientoId
      ? context.establecimientoNombre
      : (await getEstNombre(targetEstId)) ?? 'el establecimiento'
    return queryGestiones(targetEstId, estNombre, lower, convId!, supabase)
  }

  // --- PLANIFICAR ---
  if (lower.includes('planificar') || lower.includes('programar') || lower.includes('agendar') || lower.includes('crear una gestión') || lower.includes('nueva gestión') || lower.includes('nuevo checklist') || lower.includes('nuevo check list')) {
    const targetEstId = detectEstablecimiento(lower, await listEstablecimientos(consultoraId) ?? [])?.[0]?.id ?? context?.establecimientoId

    if (!targetEstId) {
      const establecimientos = await listEstablecimientos(consultoraId)
      if (!establecimientos || establecimientos.length === 0) {
        return saveAndReturn(convId!, 'No hay establecimientos activos. Necesitás un establecimiento para planificar una gestión.')
      }
      return saveAndReturn(convId!, `¿Para cuál establecimiento querés planificarlo?\n\n${establecimientos.map(e => `• **${e.empresa_razon}** — ${e.nombre}`).join('\n')}`)
    }

    return planificarGestion(message, targetEstId, context?.establecimientoNombre && targetEstId === context?.establecimientoId
      ? context.establecimientoNombre
      : (await getEstNombre(targetEstId)) ?? '?', supabase, userId, convId!)
  }

  // --- EMPRESAS ---
  if (lower.includes('empresa') && (lower.includes('cuántas') || lower.includes('cuantas') || lower.includes('cuenta') || lower.includes('contar') || lower.includes('habilitada') || lower.includes('activa'))) {
    const { count } = await supabase
      .from('empresas')
      .select('*', { count: 'exact', head: true })
      .eq('consultora_id', consultoraId)
      .eq('is_active', true)
    return saveAndReturn(convId!, `Tenés **${count ?? 0} empresas habilitadas** en tu consultora.`)
  }

  if (lower.includes('empresa') && (lower.includes('lista') || lower.includes('listado') || lower.includes('todas') || lower.includes('mostrar') || lower.includes('cuales') || lower.includes('cuáles'))) {
    const { data: empresas } = await supabase
      .from('empresas')
      .select('id, razon_social, cuit, is_active')
      .eq('consultora_id', consultoraId)
      .order('razon_social')
    if (!empresas || empresas.length === 0) {
      return saveAndReturn(convId!, 'No hay empresas cargadas en tu consultora.')
    }
    const activas = empresas.filter(e => e.is_active)
    const lines = empresas.map(e => `• ${e.razon_social}${e.cuit ? ` (CUIT: ${e.cuit})` : ''} — ${e.is_active ? '✅ Activa' : '❌ Inactiva'}`)
    return saveAndReturn(convId!, `Tenés **${empresas.length} empresas** (${activas.length} activas):\n\n${lines.join('\n')}`)
  }

  // --- SINIESTROS ---
  if (lower.includes('siniestro')) {
    const targetEstId = detectEstablecimiento(lower, await listEstablecimientos(consultoraId) ?? [])?.[0]?.id ?? context?.establecimientoId
    const ids = targetEstId ? [targetEstId] : await listEstIds(consultoraId)
    if (!ids.length) { return saveAndReturn(convId!, 'No hay establecimientos activos.') }
    const { data: siniestros } = await supabase
      .from('siniestros')
      .select('id, fecha_ocurrencia, descripcion, gravedad, establecimiento_id')
      .in('establecimiento_id', ids)
      .order('fecha_ocurrencia', { ascending: false })
      .limit(10)
    if (!siniestros?.length) { return saveAndReturn(convId!, 'No hay siniestros registrados.') }
    const lines = siniestros.map(s => `• ${s.fecha_ocurrencia} | ${(s.descripcion ?? '').slice(0, 60) || '?'} | *${s.gravedad}*`)
    return saveAndReturn(convId!, `Últimos ${siniestros.length} siniestros:\n\n${lines.join('\n')}`)
  }

  // --- INSPECCIONES ---
  if (lower.includes('inspeccion') || lower.includes('inspección')) {
    const targetEstId = detectEstablecimiento(lower, await listEstablecimientos(consultoraId) ?? [])?.[0]?.id ?? context?.establecimientoId
    const ids = targetEstId ? [targetEstId] : await listEstIds(consultoraId)
    if (!ids.length) { return saveAndReturn(convId!, 'No hay establecimientos activos.') }
    const { data: inspecciones } = await supabase
      .from('inspecciones')
      .select('id, fecha_programada, tipo, estado')
      .in('establecimiento_id', ids)
      .order('fecha_programada', { ascending: false })
      .limit(10)
    if (!inspecciones || inspecciones.length === 0) { return saveAndReturn(convId!, 'No hay inspecciones registradas.') }
    const lines = inspecciones.map(i => `• ${i.fecha_programada} | ${i.tipo} | *${i.estado}*`)
    return saveAndReturn(convId!, `Últimas ${inspecciones.length} inspecciones:\n\n${lines.join('\n')}`)
  }

  // --- RIESGOS ---
  if (lower.includes('riesgo') || lower.includes('matriz')) {
    const targetEstId = detectEstablecimiento(lower, await listEstablecimientos(consultoraId) ?? [])?.[0]?.id ?? context?.establecimientoId
    const ids = targetEstId ? [targetEstId] : await listEstIds(consultoraId)
    if (!ids.length) { return saveAndReturn(convId!, 'No hay establecimientos activos.') }
    const { data: riesgos } = await supabase
      .from('riesgos')
      .select('id, nombre, nivel, estado')
      .in('establecimiento_id', ids)
      .order('nivel', { ascending: false })
      .limit(15)
    if (!riesgos || riesgos.length === 0) { return saveAndReturn(convId!, 'No hay riesgos identificados.') }
    const criticos = riesgos.filter(r => r.nivel === 'crítico' || r.nivel === 'critico')
    const altos = riesgos.filter(r => r.nivel === 'alto')
    let summary = `Tenés **${riesgos.length} riesgos**.`
    if (criticos.length > 0) summary += ` ⚠️ **${criticos.length} críticos**`
    if (altos.length > 0) summary += ` 🔶 **${altos.length} altos**`
    return saveAndReturn(convId!, `${summary}\n\n${riesgos.map(r => `• ${r.nombre} | *${r.nivel}* | ${r.estado}`).join('\n')}`)
  }

  // --- EMPLEADOS ---
  if (lower.includes('empleado') || lower.includes('trabajador') || lower.includes('persona')) {
    const targetEstId = detectEstablecimiento(lower, await listEstablecimientos(consultoraId) ?? [])?.[0]?.id ?? context?.establecimientoId ?? (await listEstablecimientos(consultoraId))?.[0]?.id
    if (!targetEstId) { return saveAndReturn(convId!, 'No hay establecimientos activos.') }
    const { count } = await supabase.from('personas_establecimientos')
      .select('*', { count: 'exact', head: true })
      .eq('establecimiento_id', targetEstId)
    const estNombre = context?.establecimientoNombre && targetEstId === context?.establecimientoId
      ? context.establecimientoNombre
      : (await getEstNombre(targetEstId)) ?? 'el establecimiento'
    return saveAndReturn(convId!, `En **${estNombre}** hay **${count ?? 0} personas** registradas.`)
  }

  // --- ESTABLECIMIENTOS ---
  if (lower.includes('establecimiento') && (lower.includes('cuántos') || lower.includes('cuantos') || lower.includes('cuenta') || lower.includes('contar') || lower.includes('lista') || lower.includes('listado') || lower.includes('todos'))) {
    const establecimientos = await listEstablecimientos(consultoraId)
    if (!establecimientos || establecimientos.length === 0) { return saveAndReturn(convId!, 'No hay establecimientos cargados.') }
    const activos = establecimientos.filter(e => e.status === 'active')
    return saveAndReturn(convId!, `Tenés **${establecimientos.length} establecimientos** (${activos.length} activos):\n\n${establecimientos.map(e => `• **${e.empresa_razon}** — ${e.nombre} (${e.status === 'active' ? '✅' : '❌'})`).join('\n')}`)
  }

  // Fallback a knowledge base
  const knowledge = await searchKnowledge(message, 3)
  const contextStr = knowledge.map(k => k.content).join('\n')
  if (contextStr) {
    return saveAndReturn(convId!, `Según la base de conocimiento de Sigmetría HyS:\n\n${contextStr}`)
  }

  return saveAndReturn(convId!, 'No entendí bien tu consulta. Estas son algunas cosas que podés preguntar:\n\n• "cuántas empresas tengo"\n• "listame los establecimientos"\n• "cuántas gestiones tengo este mes"\n• "cuándo es la próxima gestión"\n• "mostrame los siniestros"\n• "planificar un checklist de extintores para el 15/06"\n• "cuáles son mis riesgos"\n\nTambién podés usar Sigía desde la pestaña **Asistente HyS** dentro de un establecimiento para consultas con contexto automático.')

  // --- HELPERS ---
  async function saveAndReturn(cId: string, reply: string) {
    if (cId) {
      await supabase.from('agent_messages').insert({
        conversation_id: cId,
        role: 'assistant',
        content: reply,
      })
    }
    return { reply, conversationId: cId, pendingActions: [] as PendingAction[] }
  }

  function matchEstablecimiento(msg: string, establecimientos: Awaited<ReturnType<typeof listEstablecimientos>>): NonNullable<typeof establecimientos>[number] | null {
    if (!establecimientos) return null
    const lowerMsg = msg.toLowerCase()
    for (const est of establecimientos) {
      if (lowerMsg.includes(est.nombre.toLowerCase())) return est
    }
    for (const est of establecimientos) {
      const parts = est.nombre.toLowerCase().split(/\s+/)
      for (const part of parts) {
        if (part.length >= 4 && lowerMsg.includes(part)) return est
      }
    }
    return null
  }

  function detectEstablecimiento(msg: string, establecimientos: Awaited<ReturnType<typeof listEstablecimientos>>) {
    if (!establecimientos) return null
    const result = matchEstablecimiento(msg, establecimientos)
    return result ? [result] : null
  }

  async function listEstablecimientos(cId: string) {
    const { data: empresas } = await supabase.from('empresas').select('id, razon_social').eq('consultora_id', cId).eq('is_active', true)
    if (!empresas?.length) return null
    const { data: ests } = await supabase
      .from('establecimientos')
      .select('id, nombre, status, empresa_id')
      .in('empresa_id', empresas.map(e => e.id))
      .order('nombre')
    if (!ests) return null
    const empMap = new Map(empresas.map(e => [e.id, e.razon_social]))
    return ests.map(e => ({ ...e, empresa_razon: empMap.get(e.empresa_id) ?? '?' }))
  }

  async function listEstIds(cId: string): Promise<string[]> {
    const ests = await listEstablecimientos(cId)
    return ests?.map(e => e.id) ?? []
  }

  async function getEstNombre(id: string): Promise<string | null> {
    const { data } = await supabase.from('establecimientos').select('nombre').eq('id', id).single()
    return (data as { nombre: string } | null)?.nombre ?? null
  }

  async function planificarGestion(msg: string, estId: string, estNombre: string, sb: typeof supabase, uid: string, cId: string) {
    const descMatch = msg.match(/(?:checklist|check list|gestión|gestion|tarea|inspección|inspeccion|revisión|revision)\s+(?:de\s+|para\s+)?([^.\n]+)/i)
    const dateMatch = msg.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/i) || msg.match(/(?:para\s+)?(?:el\s+)?(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+del?\s+(\d{4}))?/i)

    let tipo = 'checklist_general'
    let descripcion = descMatch?.[1]?.trim() || msg
    let fecha = ''

    if (dateMatch) {
      if (dateMatch.length >= 4 && dateMatch[3]) {
        fecha = `${dateMatch[3].padStart(4, '20')}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
      } else {
        fecha = `2026-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}`
      }
    } else {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      fecha = tomorrow.toISOString().slice(0, 10)
    }

    if (msg.toLowerCase().includes('extintor')) tipo = 'checklist_extintores'
    else if (msg.toLowerCase().includes('matricial') || msg.toLowerCase().includes('matriz')) tipo = 'checklist_matriz_riesgos'
    else if (msg.toLowerCase().includes('epp') || msg.toLowerCase().includes('equipo protección')) tipo = 'checklist_epp'
    else if (msg.toLowerCase().includes('orden') || msg.toLowerCase().includes('limpieza')) tipo = 'checklist_orden_limpieza'

    if (descripcion.length > 200) descripcion = descripcion.slice(0, 200)

    const { error } = await sb.from('agent_pending_actions').insert({
      action_type: 'planificar_gestion',
      payload: { establecimiento_id: estId, tipo, descripcion, fecha_planificada: fecha },
      status: 'pending',
      requested_by: uid,
    })

    if (error) {
      return saveAndReturn(cId, `Hubo un error al crear la solicitud: ${error.message}`)
    }

    return saveAndReturn(cId, `📋 Te propongo planificar esta gestión:\n\n**Tipo:** ${tipo}\n**Descripción:** ${descripcion}\n**Fecha:** ${fecha}\n**Establecimiento:** ${estNombre}\n\n¿Aprobás la solicitud?`)
  }

  async function queryGestiones(estId: string, estNombre: string, msg: string, cId: string, sb: typeof supabase) {
    const thisMonth = new Date().toISOString().slice(0, 7)
    const now = new Date().toISOString().slice(0, 10)

    if (msg.includes('próxima') || msg.includes('proxima') || msg.includes('próximo') || msg.includes('proximo') || msg.includes('siguiente')) {
      const { data: next } = await sb
        .from('registro_gestiones')
        .select('id, gestion_establecimiento_id, gestiones!inner(nombre), fecha_planificada')
        .eq('establecimiento_id', estId)
        .gte('fecha_planificada', now)
        .order('fecha_planificada', { ascending: true })
        .limit(1)
      if (!next?.length) {
        return saveAndReturn(cId, `No hay gestiones próximas planificadas en **${estNombre}**.`)
      }
      const g = next[0]
      return saveAndReturn(cId, `📅 Próxima gestión en **${estNombre}**: **${(g.gestiones as unknown as { nombre: string }).nombre}** — planificada para el ${g.fecha_planificada}.`)
    }

    let monthFilter = thisMonth
    const mesMatch = msg.match(/(?:este\s+)?mes\s+(?:de\s+)?([a-záéíóú]+)/i) || msg.match(/(?:en\s+)?([a-záéíóú]+)\s*(?:del?\s+(\d{4}))?/i)
    if (mesMatch) {
      const meses: Record<string, string> = { enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12' }
      const mesNum = meses[mesMatch[1].toLowerCase()]
      if (mesNum) {
        const year = mesMatch?.[2] || new Date().getFullYear().toString()
        monthFilter = `${year}-${mesNum}`
      }
    }

    const { data: gestiones } = await sb
      .from('registro_gestiones')
      .select('id, gestion_establecimiento_id, gestiones!inner(nombre), fecha_planificada, estado, frecuencia')
      .eq('establecimiento_id', estId)
      .gte('fecha_planificada', `${monthFilter}-01`)
      .lte('fecha_planificada', `${monthFilter}-31`)
      .order('fecha_planificada', { ascending: true })
      .limit(20)

    if (!gestiones?.length) {
      return saveAndReturn(cId, `No hay gestiones planificadas en **${estNombre}** para ${monthFilter}.`)
    }

    const lines = gestiones.map(g =>
      `• **${(g.gestiones as unknown as { nombre: string }).nombre}** — ${g.fecha_planificada}${g.estado ? ` | *${g.estado}*` : ''}`
    )
    return saveAndReturn(cId, `📊 **${gestiones.length} gestiones** en **${estNombre}** para ${monthFilter}:\n\n${lines.join('\n')}`)
  }
}
