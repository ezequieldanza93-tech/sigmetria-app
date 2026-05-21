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
  context?: { establecimientoId?: string; empresaId?: string; establecimientoNombre?: string; empresaNombre?: string },
): Promise<{ reply: string; conversationId: string; pendingActions: PendingAction[] }> {
  if (MOCK_MODE) {
    return mockResponse(message, conversationId, userId, context)
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
  userId: string,
  context?: { establecimientoId?: string; empresaId?: string; establecimientoNombre?: string; empresaNombre?: string },
): Promise<{ reply: string; conversationId: string; pendingActions: PendingAction[] }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const lower = message.toLowerCase()
  const establecimientoId = context?.establecimientoId

  // Saludos
  if (lower.includes('hola') || lower.includes('buen') || lower.includes('qué tal')) {
    let greeting = '¡Hola! Soy Sig, el asistente virtual de Sigmetría HyS.'
    if (context?.establecimientoNombre) {
      greeting += ` Estás consultando desde **${context.establecimientoNombre}**.`
    }
    greeting += ' ¿En qué puedo ayudarte hoy? Podés consultarme sobre empresas, establecimientos, siniestros, inspecciones, riesgos, gestiones y más.'
    return {
      reply: greeting,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  if (lower.includes('qué podés hacer') || lower.includes('capacidades') || lower.includes('funcionalidades') || lower.includes('ayuda')) {
    let caps = 'Estas son mis capacidades principales:\n\n📋 **Consultas:**\n- Empresas (cantidad, listado)\n- Establecimientos\n- Gestiones (cantidad, próximas, filtros)\n- Siniestros, inspecciones, riesgos\n- Empleados\n- Vencimientos de documentación\n\n✍️ **Acciones con aprobación:**\n- Planificar checklist o gestión\n- Registrar gestiones\n- Actualizar estado de riesgos\n- Enviar notificaciones\n\n🔍 **Filtros:** podés preguntar por mes, tipo, estado o establecimiento.'
    if (context?.establecimientoNombre) {
      caps += `\n\n📍 Estás viendo **${context.establecimientoNombre}** — todas las consultas se filtran automáticamente a este establecimiento.`
    } else {
      caps += '\n\n💡 También podés usar Sig desde la pestaña "Asistente HyS" dentro de un establecimiento para consultas con contexto automático.'
    }
    return {
      reply: caps,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  // Helpers para obtener consultora
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
    return {
      reply: 'No encontré tu consultora asociada. Si pensás que es un error, contactá al administrador.',
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  // --- GESTIONES: consultas con filtros ---
  if (lower.includes('gestión') || lower.includes('gestion') || lower.includes('gestione') || lower.includes('programada') || lower.includes('planificada') || lower.includes('checklist') || lower.includes('check list') || lower.includes('extintor') || lower.includes('extintores')) {
    const targetEstId = await detectEstablecimiento(lower, consultoraId) ?? establecimientoId

    if (!targetEstId) {
      const establecimientos = await listEstablecimientos(consultoraId)
      if (!establecimientos || establecimientos.length === 0) {
        return {
          reply: 'No encontré establecimientos activos en tu consultora. Primero necesitás tener empresas y establecimientos cargados.',
          conversationId: conversationId ?? 'mock-conversation',
          pendingActions: [],
        }
      }
      if (establecimientos.length === 1) {
        return queryGestiones(establecimientos[0].id, establecimientos[0].nombre, lower, supabase)
      }
      return {
        reply: `Tenés varios establecimientos. Decime cuál te interesa:\n\n${establecimientos.map(e => `• **${e.empresa_razon}** — ${e.nombre}`).join('\n')}`,
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const estNombre = context?.establecimientoNombre || (await getEstNombre(targetEstId))
    return queryGestiones(targetEstId, estNombre ?? 'el establecimiento', lower, supabase)
  }

  // --- PLANIFICAR: crear checklist, gestión, etc ---
  if (lower.includes('planificar') || lower.includes('programar') || lower.includes('agendar') || lower.includes('crear una gestión') || lower.includes('nueva gestión') || lower.includes('nuevo checklist') || lower.includes('nuevo check list')) {
    const targetEstId = await detectEstablecimiento(lower, consultoraId) ?? establecimientoId

    if (!targetEstId) {
      const establecimientos = await listEstablecimientos(consultoraId)
      if (!establecimientos || establecimientos.length === 0) {
        return {
          reply: 'No hay establecimientos activos. Necesitás un establecimiento para planificar una gestión.',
          conversationId: conversationId ?? 'mock-conversation',
          pendingActions: [],
        }
      }
      return {
        reply: `¿Para cuál establecimiento querés planificarlo?\n\n${establecimientos.map(e => `• **${e.empresa_razon}** — ${e.nombre}`).join('\n')}`,
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    // Extract description and date from message
    const descMatch = message.match(/(?:checklist|check list|gestión|gestion|tarea|inspección|inspeccion|revisión|revision)\s+(?:de\s+|para\s+)?([^.\n]+)/i)
    const dateMatch = message.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/i) || message.match(/(?:para\s+)?(?:el\s+)?(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+del?\s+(\d{4}))?/i)

    let tipo = 'checklist_general'
    let descripcion = descMatch?.[1]?.trim() || message
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

    if (lower.includes('extintor')) tipo = 'checklist_extintores'
    else if (lower.includes('matricial') || lower.includes('matriz')) tipo = 'checklist_matriz_riesgos'
    else if (lower.includes('epp') || lower.includes('equipo protección')) tipo = 'checklist_epp'
    else if (lower.includes('orden') || lower.includes('limpieza')) tipo = 'checklist_orden_limpieza'

    if (descripcion.length > 200) descripcion = descripcion.slice(0, 200)

    const { error } = await supabase.from('agent_pending_actions').insert({
      action_type: 'planificar_gestion',
      payload: { establecimiento_id: targetEstId, tipo, descripcion, fecha_planificada: fecha },
      status: 'pending',
      requested_by: userId,
    })

    if (error) {
      return {
        reply: `Hubo un error al crear la solicitud: ${error.message}`,
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const estNombre = context?.establecimientoNombre || (await getEstNombre(targetEstId))

    return {
      reply: `📋 Te propongo planificar esta gestión:\n\n**Tipo:** ${tipo}\n**Descripción:** ${descripcion}\n**Fecha:** ${fecha}\n**Establecimiento:** ${estNombre ?? '?'}\n\n¿Aprobás la solicitud?`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  // --- EMPRESAS ---
  if (lower.includes('empresa') && (lower.includes('cuántas') || lower.includes('cuantas') || lower.includes('cuenta') || lower.includes('contar') || lower.includes('habilitada') || lower.includes('activa'))) {
    const { count } = await supabase
      .from('empresas')
      .select('*', { count: 'exact', head: true })
      .eq('consultora_id', consultoraId)
      .eq('is_active', true)
    return {
      reply: `Tenés **${count ?? 0} empresas habilitadas** en tu consultora.`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  if (lower.includes('empresa') && (lower.includes('lista') || lower.includes('listado') || lower.includes('todas') || lower.includes('mostrar') || lower.includes('cuales') || lower.includes('cuáles'))) {
    const { data: empresas } = await supabase
      .from('empresas')
      .select('id, razon_social, cuit, is_active')
      .eq('consultora_id', consultoraId)
      .order('razon_social')
    if (!empresas || empresas.length === 0) {
      return {
        reply: 'No hay empresas cargadas en tu consultora.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }
    const activas = empresas.filter(e => e.is_active)
    const lines = empresas.map(e => `• ${e.razon_social}${e.cuit ? ` (CUIT: ${e.cuit})` : ''} — ${e.is_active ? '✅ Activa' : '❌ Inactiva'}`)
    return {
      reply: `Tenés **${empresas.length} empresas** (${activas.length} activas):\n\n${lines.join('\n')}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  // --- SINIESTROS ---
  if (lower.includes('siniestro')) {
    const targetEstId = await detectEstablecimiento(lower, consultoraId) ?? establecimientoId
    const ids = targetEstId ? [targetEstId] : await listEstIds(consultoraId)
    if (!ids.length) {
      return { reply: 'No hay establecimientos activos.', conversationId: conversationId ?? 'mock-conversation', pendingActions: [] }
    }
    const { data: siniestros } = await supabase
      .from('siniestros')
      .select('id, fecha_ocurrencia, descripcion, gravedad, establecimiento_id')
      .in('establecimiento_id', ids)
      .order('fecha_ocurrencia', { ascending: false })
      .limit(10)

    if (!siniestros?.length) {
      return { reply: 'No hay siniestros registrados.', conversationId: conversationId ?? 'mock-conversation', pendingActions: [] }
    }
    const lines = siniestros.map(s => `• ${s.fecha_ocurrencia} | ${(s.descripcion ?? '').slice(0, 60) || '?'} | *${s.gravedad}*`)
    return {
      reply: `Últimos ${siniestros.length} siniestros:\n\n${lines.join('\n')}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  // --- INSPECCIONES ---
  if (lower.includes('inspeccion') || lower.includes('inspección')) {
    const targetEstId = await detectEstablecimiento(lower, consultoraId) ?? establecimientoId
    const ids = targetEstId ? [targetEstId] : await listEstIds(consultoraId)
    if (!ids.length) {
      return { reply: 'No hay establecimientos activos.', conversationId: conversationId ?? 'mock-conversation', pendingActions: [] }
    }
    const { data: inspecciones } = await supabase
      .from('inspecciones')
      .select('id, fecha_programada, tipo, estado')
      .in('establecimiento_id', ids)
      .order('fecha_programada', { ascending: false })
      .limit(10)

    if (!inspecciones || inspecciones.length === 0) {
      return {
        reply: 'No hay inspecciones registradas.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }
    const lines = inspecciones.map(i => `• ${i.fecha_programada} | ${i.tipo} | *${i.estado}*`)
    return {
      reply: `Últimas ${inspecciones.length} inspecciones:\n\n${lines.join('\n')}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  // --- RIESGOS ---
  if (lower.includes('riesgo') || lower.includes('matriz')) {
    const targetEstId = await detectEstablecimiento(lower, consultoraId) ?? establecimientoId
    const ids = targetEstId ? [targetEstId] : await listEstIds(consultoraId)
    if (!ids.length) {
      return { reply: 'No hay establecimientos activos.', conversationId: conversationId ?? 'mock-conversation', pendingActions: [] }
    }
    const { data: riesgos } = await supabase
      .from('riesgos')
      .select('id, nombre, nivel, estado')
      .in('establecimiento_id', ids)
      .order('nivel', { ascending: false })
      .limit(15)

    if (!riesgos || riesgos.length === 0) {
      return { reply: 'No hay riesgos identificados.', conversationId: conversationId ?? 'mock-conversation', pendingActions: [] }
    }
    const criticos = riesgos.filter(r => r.nivel === 'crítico' || r.nivel === 'critico')
    const altos = riesgos.filter(r => r.nivel === 'alto')
    let summary = `Tenés **${riesgos.length} riesgos**.`
    if (criticos.length > 0) summary += ` ⚠️ **${criticos.length} críticos**`
    if (altos.length > 0) summary += ` 🔶 **${altos.length} altos**`
    return {
      reply: `${summary}\n\n${riesgos.map(r => `• ${r.nombre} | *${r.nivel}* | ${r.estado}`).join('\n')}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  // --- EMPLEADOS ---
  if (lower.includes('empleado') || lower.includes('trabajador') || lower.includes('persona')) {
    const targetEstId = await detectEstablecimiento(lower, consultoraId) ?? establecimientoId ?? (await listEstablecimientos(consultoraId))?.[0]?.id
    if (!targetEstId) {
      return { reply: 'No hay establecimientos activos.', conversationId: conversationId ?? 'mock-conversation', pendingActions: [] }
    }
    const { count } = await supabase.from('personas_establecimientos')
      .select('*', { count: 'exact', head: true })
      .eq('establecimiento_id', targetEstId)
    const estNombre = context?.establecimientoNombre || (await getEstNombre(targetEstId))
    return {
      reply: `En **${estNombre ?? 'el establecimiento'}** hay **${count ?? 0} personas** registradas.`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  // --- ESTABLECIMIENTOS ---
  if (lower.includes('establecimiento') && (lower.includes('cuántos') || lower.includes('cuantos') || lower.includes('cuenta') || lower.includes('contar') || lower.includes('lista') || lower.includes('listado') || lower.includes('todos'))) {
    const establecimientos = await listEstablecimientos(consultoraId)
    if (!establecimientos || establecimientos.length === 0) {
      return { reply: 'No hay establecimientos cargados.', conversationId: conversationId ?? 'mock-conversation', pendingActions: [] }
    }
    const activos = establecimientos.filter(e => e.status === 'active')
    return {
      reply: `Tenés **${establecimientos.length} establecimientos** (${activos.length} activos):\n\n${establecimientos.map(e => `• **${e.empresa_razon}** — ${e.nombre} (${e.status === 'active' ? '✅' : '❌'})`).join('\n')}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  // Fallback a knowledge base
  const knowledge = await searchKnowledge(message, 3)
  const contextStr = knowledge.map(k => k.content).join('\n')

  if (contextStr) {
    return {
      reply: `Según la base de conocimiento de Sigmetría HyS:\n\n${contextStr}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  return {
    reply: 'No entendí bien tu consulta. Estas son algunas cosas que podés preguntar:\n\n• "cuántas empresas tengo"\n• "listame los establecimientos"\n• "cuántas gestiones tengo este mes"\n• "cuándo es la próxima gestión"\n• "mostrame los siniestros"\n• "planificar un checklist de extintores para el 15/06"\n• "cuáles son mis riesgos"\n\nTambién podés usar Sig desde la pestaña **Asistente HyS** dentro de un establecimiento para consultas con contexto automático.',
    conversationId: conversationId ?? 'mock-conversation',
    pendingActions: [],
  }

  // --- HELPERS ---
  async function detectEstablecimiento(msg: string, cId: string): Promise<string | null> {
    for (const word of msg.split(/\s+/)) {
      if (word.length < 4) continue
      const { data: est } = await supabase
        .from('establecimientos')
        .select('id')
        .ilike('nombre', `%${word}%`)
        .in('empresa_id', (await supabase.from('empresas').select('id').eq('consultora_id', cId)).data?.map(e => e.id) ?? [])
        .limit(1)
        .maybeSingle()
      if (est) return est.id
    }
    return null
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

  async function queryGestiones(estId: string, estNombre: string, msg: string, sb: typeof supabase) {
    const thisMonth = new Date().toISOString().slice(0, 7)
    const now = new Date().toISOString().slice(0, 10)

    // Próxima gestión
    if (msg.includes('próxima') || msg.includes('proxima') || msg.includes('próximo') || msg.includes('proximo') || msg.includes('siguiente')) {
      const { data: next } = await sb
        .from('registro_gestiones')
        .select('id, gestion_establecimiento_id, gestiones!inner(nombre), fecha_planificada')
        .eq('establecimiento_id', estId)
        .gte('fecha_planificada', now)
        .order('fecha_planificada', { ascending: true })
        .limit(1)
      if (!next?.length) {
        return { reply: `No hay gestiones próximas planificadas en **${estNombre}**.`, conversationId: conversationId ?? 'mock-conversation', pendingActions: [] }
      }
      const g = next[0]
      return { reply: `📅 Próxima gestión en **${estNombre}**: **${(g.gestiones as unknown as { nombre: string }).nombre}** — planificada para el ${g.fecha_planificada}.`, conversationId: conversationId ?? 'mock-conversation', pendingActions: [] }
    }

    // Por mes / periodo
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
      return { reply: `No hay gestiones planificadas en **${estNombre}** para ${monthFilter}.`, conversationId: conversationId ?? 'mock-conversation', pendingActions: [] }
    }

    const lines = gestiones.map(g =>
      `• **${(g.gestiones as unknown as { nombre: string }).nombre}** — ${g.fecha_planificada}${g.estado ? ` | *${g.estado}*` : ''}`
    )
    return {
      reply: `📊 **${gestiones.length} gestiones** en **${estNombre}** para ${monthFilter}:\n\n${lines.join('\n')}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

}
