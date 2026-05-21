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
  userId: string,
): Promise<{ reply: string; conversationId: string; pendingActions: PendingAction[] }> {
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()

  const lower = message.toLowerCase()

  if (lower.includes('hola') || lower.includes('buen') || lower.includes('qué tal')) {
    return {
      reply: '¡Hola! Soy Sig, el asistente virtual de Sigmetría HyS. ¿En qué puedo ayudarte hoy? Podés consultarme sobre empresas, establecimientos, siniestros, inspecciones, riesgos y más.',
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  if (lower.includes('qué podés hacer') || lower.includes('capacidades') || lower.includes('funcionalidades') || lower.includes('ayuda')) {
    return {
      reply: 'Estas son mis capacidades principales:\n\n📋 **Consultas:**\n- Ver siniestros, inspecciones y riesgos de un establecimiento\n- Consultar vencimientos de documentación\n- Buscar empleados\n- Responder preguntas sobre la plataforma\n\n✍️ **Acciones automáticas:**\n- Crear empresas\n- Registrar siniestros\n\n🔐 **Acciones con aprobación:**\n- Registrar gestiones/acciones pendientes\n- Actualizar estado de riesgos\n- Enviar notificaciones\n\n¿Sobre qué querés consultar?',
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) {
    return {
      reply: 'No encontré tu consultora asociada. Si pensás que es un error, contactá al administrador.',
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  const consultoraId = membership.consultora_id

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
    const inactivas = empresas.filter(e => !e.is_active)
    const lines = empresas.map(e => `• ${e.razon_social}${e.cuit ? ` (CUIT: ${e.cuit})` : ''} — ${e.is_active ? '✅ Activa' : '❌ Inactiva'}`)

    return {
      reply: `Tenés **${empresas.length} empresas** en total (${activas.length} activas, ${inactivas.length} inactivas):\n\n${lines.join('\n')}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  if (lower.includes('gestión') || lower.includes('gestion') || lower.includes('gestione') || lower.includes('vencimiento') || lower.includes('vence') || lower.includes('vencen')) {
    let targetEstId: string | null = null

    for (const word of lower.split(/\s+/)) {
      const { data: est } = await supabase
        .from('establecimientos')
        .select('id')
        .ilike('nombre', `%${word}%`)
        .limit(1)
        .maybeSingle()
      if (est) { targetEstId = est.id; break }
    }

    if (!targetEstId) {
      const { data: establecimientos } = await supabase
        .from('establecimientos')
        .select('id, nombre, empresa_id, empresas!inner(id, razon_social, consultora_id)')
        .eq('empresas.consultora_id', consultoraId)
        .eq('status', 'active')
        .order('nombre')
        .limit(5)

      if (!establecimientos || establecimientos.length === 0) {
        return {
          reply: 'No encontré establecimientos activos en tu consultora. ¿Querés que te muestre las empresas primero?',
          conversationId: conversationId ?? 'mock-conversation',
          pendingActions: [],
        }
      }

      if (establecimientos.length === 1) {
        targetEstId = establecimientos[0].id
      } else {
        const estList = establecimientos.map(e => `• **${(e.empresas as unknown as { razon_social: string }).razon_social}** — ${e.nombre}`).join('\n')
        const { data: gestiones } = await supabase
          .from('registro_gestiones')
          .select('id, gestion_establecimiento_id, gestiones!inner(nombre), fecha_planificada')
          .in('establecimiento_id', establecimientos.map(e => e.id))
          .gte('fecha_planificada', new Date().toISOString().slice(0, 10))
          .order('fecha_planificada', { ascending: true })
          .limit(10)

        if (!gestiones || gestiones.length === 0) {
          return {
            reply: `No encontré gestiones próximas. Estos son tus establecimientos activos:\n\n${estList}\n\nDecime sobre cuál querés consultar.`,
            conversationId: conversationId ?? 'mock-conversation',
            pendingActions: [],
          }
        }

        const gLines = gestiones.map(g =>
          `• **${(g.gestiones as unknown as { nombre: string }).nombre}** — planificada: ${g.fecha_planificada}`
        )
        return {
          reply: `Estas son las próximas gestiones en tus establecimientos:\n\n${gLines.join('\n')}`,
          conversationId: conversationId ?? 'mock-conversation',
          pendingActions: [],
        }
      }
    }

    const thisMonth = new Date().toISOString().slice(0, 7)
    const { count } = await supabase
      .from('registro_gestiones')
      .select('*', { count: 'exact', head: true })
      .eq('establecimiento_id', targetEstId)
      .gte('fecha_planificada', `${thisMonth}-01`)
      .lte('fecha_planificada', `${thisMonth}-31`)

    const { data: est } = await supabase.from('establecimientos').select('nombre').eq('id', targetEstId).single()

    return {
      reply: `En **${(est as { nombre: string })?.nombre ?? 'el establecimiento'}** tenés **${count ?? 0} gestiones** planificadas para este mes.`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  if (lower.includes('siniestro')) {
    const { data: empresas } = await supabase
      .from('empresas')
      .select('id, razon_social')
      .eq('consultora_id', consultoraId)
      .eq('is_active', true)

    if (!empresas || empresas.length === 0) {
      return {
        reply: 'No tenés empresas activas. Los siniestros se registran por establecimiento. Primero necesitás tener empresas cargadas.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const empresaIds = empresas.map(e => e.id)
    const { data: establecimientos } = await supabase
      .from('establecimientos')
      .select('id, nombre, empresa_id')
      .in('empresa_id', empresaIds)
      .eq('status', 'active')

    if (!establecimientos || establecimientos.length === 0) {
      return {
        reply: 'No hay establecimientos activos. Los siniestros se registran por establecimiento.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const estIds = establecimientos.map(e => e.id)
    const { data: siniestros } = await supabase
      .from('siniestros')
      .select('id, fecha_ocurrencia, descripcion, gravedad, establecimiento_id')
      .in('establecimiento_id', estIds)
      .order('fecha_ocurrencia', { ascending: false })
      .limit(10)

    if (!siniestros || siniestros.length === 0) {
      return {
        reply: 'No hay siniestros registrados en tus establecimientos.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const estMap = new Map(establecimientos.map(e => [e.id, e.nombre]))
    const lines = siniestros.map(s => `• **${estMap.get(s.establecimiento_id) ?? '?'}** — ${s.fecha_ocurrencia} | ${s.descripcion.slice(0, 60)} | *${s.gravedad}*`)

    return {
      reply: `Últimos ${siniestros.length} siniestros registrados:\n\n${lines.join('\n')}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  if (lower.includes('inspeccion') || lower.includes('inspección')) {
    const { data: establecimientos } = await supabase
      .from('establecimientos')
      .select('id, nombre')
      .in('empresa_id', (await supabase.from('empresas').select('id').eq('consultora_id', consultoraId).eq('is_active', true)).data?.map(e => e.id) ?? [])
      .eq('status', 'active')

    if (!establecimientos || establecimientos.length === 0) {
      return {
        reply: 'No hay establecimientos activos.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const { data: inspecciones } = await supabase
      .from('inspecciones')
      .select('id, fecha_programada, tipo, estado, establecimiento_id')
      .in('establecimiento_id', establecimientos.map(e => e.id))
      .order('fecha_programada', { ascending: false })
      .limit(10)

    if (!inspecciones || inspecciones.length === 0) {
      return {
        reply: 'No hay inspecciones registradas.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const estMap = new Map(establecimientos.map(e => [e.id, e.nombre]))
    const lines = inspecciones.map(i => `• **${estMap.get(i.establecimiento_id) ?? '?'}** — ${i.fecha_programada} | ${i.tipo} | *${i.estado}*`)

    return {
      reply: `Últimas ${inspecciones.length} inspecciones:\n\n${lines.join('\n')}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  if (lower.includes('riesgo') || lower.includes('matriz')) {
    const { data: establecimientos } = await supabase
      .from('establecimientos')
      .select('id, nombre')
      .in('empresa_id', (await supabase.from('empresas').select('id').eq('consultora_id', consultoraId).eq('is_active', true)).data?.map(e => e.id) ?? [])
      .eq('status', 'active')

    if (!establecimientos || establecimientos.length === 0) {
      return {
        reply: 'No hay establecimientos activos.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const { data: riesgos } = await supabase
      .from('riesgos')
      .select('id, nombre, nivel, estado, establecimiento_id')
      .in('establecimiento_id', establecimientos.map(e => e.id))
      .order('nivel', { ascending: false })
      .limit(15)

    if (!riesgos || riesgos.length === 0) {
      return {
        reply: 'No hay riesgos identificados.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const estMap = new Map(establecimientos.map(e => [e.id, e.nombre]))
    const criticos = riesgos.filter(r => r.nivel === 'crítico' || r.nivel === 'critico')
    const altos = riesgos.filter(r => r.nivel === 'alto')
    const lines = riesgos.map(r =>
      `• **${estMap.get(r.establecimiento_id) ?? '?'}** — ${r.nombre} | *${r.nivel}* | ${r.estado}`
    )

    let summary = `Tenés **${riesgos.length} riesgos** identificados.`
    if (criticos.length > 0) summary += ` ⚠️ **${criticos.length} críticos**`
    if (altos.length > 0) summary += ` 🔶 **${altos.length} altos**`

    return {
      reply: `${summary}\n\n${lines.join('\n')}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  if (lower.includes('empleado') || lower.includes('trabajador') || lower.includes('persona')) {
    const { data: establecimientos } = await supabase
      .from('establecimientos')
      .select('id, nombre')
      .in('empresa_id', (await supabase.from('empresas').select('id').eq('consultora_id', consultoraId).eq('is_active', true)).data?.map(e => e.id) ?? [])
      .eq('status', 'active')
      .limit(1)

    if (!establecimientos || establecimientos.length === 0) {
      return {
        reply: 'No hay establecimientos activos.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const { count } = await supabase
      .from('personas_establecimientos')
      .select('*', { count: 'exact', head: true })
      .eq('establecimiento_id', establecimientos[0].id)

    return {
      reply: `En **${establecimientos[0].nombre}** hay **${count ?? 0} personas** registradas. Decime si querés ver los detalles de algún establecimiento en particular.`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  if (lower.includes('establecimiento') && (lower.includes('cuántos') || lower.includes('cuantos') || lower.includes('cuenta') || lower.includes('contar') || lower.includes('lista') || lower.includes('listado') || lower.includes('todos'))) {
    const { data: empresas } = await supabase
      .from('empresas')
      .select('id, razon_social')
      .eq('consultora_id', consultoraId)
      .eq('is_active', true)

    if (!empresas || empresas.length === 0) {
      return {
        reply: 'No hay empresas activas.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const { data: establecimientos } = await supabase
      .from('establecimientos')
      .select('id, nombre, empresa_id, status')
      .in('empresa_id', empresas.map(e => e.id))
      .order('nombre')

    if (!establecimientos || establecimientos.length === 0) {
      return {
        reply: 'No hay establecimientos cargados.',
        conversationId: conversationId ?? 'mock-conversation',
        pendingActions: [],
      }
    }

    const empMap = new Map(empresas.map(e => [e.id, e.razon_social]))
    const activos = establecimientos.filter(e => e.status === 'active')
    const lines = establecimientos.map(e =>
      `• **${empMap.get(e.empresa_id) ?? '?'}** — ${e.nombre} (${e.status === 'active' ? '✅ Activo' : '❌ Inactivo'})`
    )

    return {
      reply: `Tenés **${establecimientos.length} establecimientos** (${activos.length} activos):\n\n${lines.join('\n')}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  const knowledge = await searchKnowledge(message, 3)
  const context = knowledge.map(k => k.content).join('\n')

  if (context) {
    return {
      reply: `Según la base de conocimiento de Sigmetría HyS:\n\n${context}`,
      conversationId: conversationId ?? 'mock-conversation',
      pendingActions: [],
    }
  }

  return {
    reply: 'No entendí bien tu consulta. Podés preguntarme sobre:\n\n• Empresas (listado, cantidad)\n• Establecimientos\n• Siniestros\n• Inspecciones\n• Riesgos\n• Empleados\n• Gestiones y vencimientos\n\n¿Sobre qué querés consultar?',
    conversationId: conversationId ?? 'mock-conversation',
    pendingActions: [],
  }
}
