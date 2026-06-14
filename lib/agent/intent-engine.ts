import type { PendingAction } from './executor'

export interface SigiaIntent {
  id: string
  intent: string
  patterns: string[]
  context_required: string[]
  handler: string
  response_template: string
  requires_establecimiento: boolean
  requires_action: boolean
}

export interface IntentMatch {
  intent: SigiaIntent
  confidence: number
}

interface Establishment {
  id: string
  nombre: string
  empresa_razon: string
  status: string
}

export type SupabaseClient = Awaited<ReturnType<typeof import('@/lib/supabase/server').createClient>>

function normalize(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[,.!?;:()"'¡¿\-]+/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

function tokenize(text: string): string[] {
  return normalize(text).split(/\s+/).filter(t => t.length > 2)
}

export function matchIntent(message: string, intents: SigiaIntent[]): IntentMatch | null {
  const normalized = normalize(message)
  const tokens = tokenize(message)
  const tokenSet = new Set(tokens)
  let best: IntentMatch | null = null

  for (const intent of intents) {
    for (const pattern of intent.patterns) {
      const patternNorm = normalize(pattern)
      const patternTokens = patternNorm.split(/\s+/).filter(t => t.length > 0)
      let score = 0
      const patternWords = new Set(patternTokens)

      if (normalized.includes(patternNorm)) {
        score = patternTokens.length * 3
      } else {
        let matchCount = 0
        for (const pw of patternWords) {
          for (const uw of tokenSet) {
            if (pw === uw || pw.startsWith(uw) || uw.startsWith(pw)) {
              matchCount++
              break
            }
          }
        }
        if (matchCount > 0) {
          score = (matchCount / Math.max(patternWords.size, 1)) * 10
          if (matchCount === patternWords.size && patternWords.size >= 2) score += 5
        }
      }

      if (score > 0 && (!best || score > best.confidence)) {
        best = { intent, confidence: score }
      }
    }
  }

  return best && best.confidence >= 2 ? best : null
}

export function extractEstablishment(message: string, establecimientos: Establishment[]): Establishment | null {
  if (!establecimientos?.length) return null
  const normalized = normalize(message)

  for (const est of establecimientos) {
    if (normalized.includes(normalize(est.nombre))) return est
    if (normalized.includes(normalize(est.empresa_razon))) return est
  }

  for (const est of establecimientos) {
    const parts = normalize(est.nombre).split(/\s+/)
    for (const part of parts) {
      if (part.length >= 4 && normalized.includes(part)) return est
    }
    for (const part of normalize(est.empresa_razon).split(/\s+/)) {
      if (part.length >= 4 && normalized.includes(part)) return est
    }
  }

  return null
}

export async function listEstablecimientos(
  supabase: SupabaseClient,
  consultoraId: string,
): Promise<Establishment[] | null> {
  const { data: empresas } = await supabase
    .from('empresas').select('id, razon_social')
    .eq('consultora_id', consultoraId).eq('is_active', true)
  if (!empresas?.length) return null

  const { data: ests } = await supabase
    .from('establecimientos').select('id, nombre, status, empresa_id')
    .in('empresa_id', empresas.map(e => e.id))
    .neq('status', 'cancelled')
    .order('nombre')
  if (!ests) return null

  const empMap = new Map(empresas.map(e => [e.id, e.razon_social]))
  return ests.map(e => ({ ...e, empresa_razon: empMap.get(e.empresa_id) ?? '?' }))
}

type HandlerFn = (
  supabase: SupabaseClient,
  userId: string,
  consultoraId: string,
  message: string,
  establecimientos: Establishment[] | null,
  establecimientoMatch: Establishment | null,
  prevLastAssistantMsg: string,
  convId: string,
) => Promise<{ reply: string; pendingActions: PendingAction[] }>

export const HANDLERS: Record<string, HandlerFn> = {
  handleSaludo: async (_supabase, _userId, _consultoraId, _message, _establecimientos, establecimientoMatch, prevMsg) => {
    if (prevMsg) return { reply: '¡Hola de nuevo! ¿En qué más te puedo ayudar?', pendingActions: [] }
    let reply = '¡Hola! Soy **Sigía**, la asistente virtual de Sigmetría HyS.'
    if (establecimientoMatch) reply += ` Estás consultando desde **${establecimientoMatch.nombre}**.`
    reply += ' ¿En qué puedo ayudarte hoy? Podés consultarme sobre empresas, establecimientos, incidentes, inspecciones, riesgos, gestiones y más.'
    return { reply, pendingActions: [] }
  },

  handleCapacidades: async (_supabase, _userId, _consultoraId, _message, _establecimientos, establecimientoMatch) => {
    let caps = 'Estas son mis capacidades principales:\n\n📋 **Consultas:**\n• Empresas (cantidad, listado)\n• Establecimientos\n• Gestiones (pendientes, próximas, vencidas)\n• Incidentes, inspecciones, riesgos\n• Empleados\n• Vencimientos de documentación\n\n✍️ **Acciones con aprobación:**\n• Planificar checklist o gestión\n• Registrar gestiones\n• Actualizar estado de riesgos\n• Enviar notificaciones\n\n🔍 Podés preguntar por mes, tipo, estado o establecimiento.'
    if (establecimientoMatch) caps += `\n\n📍 Estás viendo **${establecimientoMatch.nombre}** — las consultas se filtran automáticamente.`
    return { reply: caps, pendingActions: [] }
  },

  handleEmpresasCount: async (supabase, _userId, consultoraId) => {
    const { count } = await supabase
      .from('empresas').select('*', { count: 'exact', head: true })
      .eq('consultora_id', consultoraId).eq('is_active', true)
    return { reply: `Tenés **${count ?? 0} empresas habilitadas** en tu consultora.`, pendingActions: [] }
  },

  handleEmpresasList: async (supabase, _userId, consultoraId) => {
    const { data: empresas } = await supabase
      .from('empresas').select('id, razon_social, cuit, is_active')
      .eq('consultora_id', consultoraId).order('razon_social')
    if (!empresas?.length) return { reply: 'No hay empresas cargadas en tu consultora.', pendingActions: [] }
    const activas = empresas.filter(e => e.is_active)
    const lines = empresas.map(e => `• ${e.razon_social}${e.cuit ? ` (CUIT: ${e.cuit})` : ''} — ${e.is_active ? '✅ Activa' : '❌ Inactiva'}`)
    return { reply: `Tenés **${empresas.length} empresas** (${activas.length} activas):\n\n${lines.join('\n')}`, pendingActions: [] }
  },

  handleEstablecimientosCount: async (_supabase, _userId, _consultoraId, _message, establecimientos) => {
    if (!establecimientos?.length) return { reply: 'No hay establecimientos cargados.', pendingActions: [] }
    const activos = establecimientos.filter(e => e.status === 'active')
    return { reply: `Tenés **${establecimientos.length} establecimientos** (${activos.length} activos) en tu consultora.`, pendingActions: [] }
  },

  handleEstablecimientosList: async (_supabase, _userId, _consultoraId, _message, establecimientos) => {
    if (!establecimientos?.length) return { reply: 'No hay establecimientos cargados.', pendingActions: [] }
    const activos = establecimientos.filter(e => e.status === 'active')
    return {
      reply: `Tenés **${establecimientos.length} establecimientos** (${activos.length} activos):\n\n${
        establecimientos.map(e => `• **${e.empresa_razon}** — ${e.nombre} (${e.status === 'active' ? '✅' : '❌'})`).join('\n')
      }`,
      pendingActions: [],
    }
  },

  handleGestionesList: async (supabase, _userId, _consultoraId, _message, establecimientos, establecimientoMatch) => {
    if (!establecimientoMatch && (!establecimientos || establecimientos.length !== 1)) return { reply: '', pendingActions: [] }
    const est = establecimientoMatch ?? establecimientos?.[0] ?? null
    if (!est) return { reply: 'No encontré establecimientos activos.', pendingActions: [] }
    return queryGestionesForEst(supabase, est, _message)
  },

  handleGestionesPendientes: async (supabase, _userId, _consultoraId, _message, establecimientos, establecimientoMatch) => {
    if (!establecimientoMatch && (!establecimientos || establecimientos.length !== 1)) return { reply: '', pendingActions: [] }
    const est = establecimientoMatch ?? establecimientos?.[0] ?? null
    if (!est) return { reply: 'No encontré establecimientos activos.', pendingActions: [] }

    const { data: gestiones } = await supabase
      .from('registro_gestiones').select('id, gestion_establecimiento_id, gestiones!inner(nombre), fecha_planificada, estado, frecuencia')
      .eq('establecimiento_id', est.id).in('estado', ['pendiente', 'en_progreso', 'abierto'])
      .order('fecha_planificada', { ascending: true }).limit(20)

    if (!gestiones?.length) return { reply: `No hay gestiones pendientes en **${est.nombre}**. ¡Todo al día! 🎉`, pendingActions: [] }

    const lines = gestiones.map(g => `• **${(g.gestiones as unknown as { nombre: string }).nombre}** — ${g.fecha_planificada}${g.estado ? ` | *${g.estado}*` : ''}`)
    return { reply: `📋 **${gestiones.length} gestiones pendientes** en **${est.nombre}**:\n\n${lines.join('\n')}`, pendingActions: [] }
  },

  handleGestionesProximas: async (supabase, _userId, _consultoraId, _message, establecimientos, establecimientoMatch) => {
    if (!establecimientoMatch && (!establecimientos || establecimientos.length !== 1)) return { reply: '', pendingActions: [] }
    const est = establecimientoMatch ?? establecimientos?.[0] ?? null
    if (!est) return { reply: 'No encontré establecimientos activos.', pendingActions: [] }

    const now = new Date().toISOString().slice(0, 10)
    const { data: next } = await supabase
      .from('registro_gestiones').select('id, gestion_establecimiento_id, gestiones!inner(nombre), fecha_planificada')
      .eq('establecimiento_id', est.id).gte('fecha_planificada', now)
      .order('fecha_planificada', { ascending: true }).limit(1)

    if (!next?.length) return { reply: `No hay gestiones próximas planificadas en **${est.nombre}**.`, pendingActions: [] }
    const g = next[0]
    return { reply: `📅 Próxima gestión en **${est.nombre}**: **${(g.gestiones as unknown as { nombre: string }).nombre}** — planificada para el ${g.fecha_planificada}.`, pendingActions: [] }
  },

  handleGestionesVencidas: async (supabase, _userId, _consultoraId, _message, establecimientos, establecimientoMatch) => {
    if (!establecimientoMatch && (!establecimientos || establecimientos.length !== 1)) return { reply: '', pendingActions: [] }
    const est = establecimientoMatch ?? establecimientos?.[0] ?? null
    if (!est) return { reply: 'No encontré establecimientos activos.', pendingActions: [] }

    const now = new Date().toISOString().slice(0, 10)
    const { data: vencidas } = await supabase
      .from('registro_gestiones').select('id, gestion_establecimiento_id, gestiones!inner(nombre), fecha_planificada, estado')
      .eq('establecimiento_id', est.id).lt('fecha_planificada', now).neq('estado', 'completado')
      .order('fecha_planificada', { ascending: false }).limit(20)

    if (!vencidas?.length) return { reply: `No hay gestiones vencidas en **${est.nombre}**.`, pendingActions: [] }
    const lines = vencidas.map(g => `• **${(g.gestiones as unknown as { nombre: string }).nombre}** — vencida el ${g.fecha_planificada}${g.estado ? ` | *${g.estado}*` : ''}`)
    return { reply: `⚠️ **${vencidas.length} gestiones vencidas** en **${est.nombre}**:\n\n${lines.join('\n')}`, pendingActions: [] }
  },

  handleSiniestrosList: async (supabase, _userId, _consultoraId, _message, establecimientos, establecimientoMatch) => {
    const ids = establecimientoMatch ? [establecimientoMatch.id] : (establecimientos?.map(e => e.id) ?? [])
    if (!ids.length) return { reply: 'No hay establecimientos activos.', pendingActions: [] }

    const { data: incidentes } = await supabase
      .from('incidentes').select('id, fecha_ocurrencia, descripcion, tipo, establecimiento_id')
      .in('establecimiento_id', ids).order('fecha_ocurrencia', { ascending: false }).limit(10)

    if (!incidentes?.length) return { reply: 'No hay incidentes registrados.', pendingActions: [] }
    const lines = incidentes.map(s => `• ${s.fecha_ocurrencia} | ${(s.descripcion ?? '').slice(0, 60) || '?'} | *${s.tipo}*`)
    return { reply: `Últimos ${incidentes.length} incidentes:\n\n${lines.join('\n')}`, pendingActions: [] }
  },

  handleSiniestrosCount: async (supabase, _userId, _consultoraId, _message, establecimientos, establecimientoMatch) => {
    const ids = establecimientoMatch ? [establecimientoMatch.id] : (establecimientos?.map(e => e.id) ?? [])
    if (!ids.length) return { reply: 'No hay establecimientos activos.', pendingActions: [] }
    const { count } = await supabase
      .from('incidentes').select('*', { count: 'exact', head: true })
      .in('establecimiento_id', ids)
    const nombre = establecimientoMatch?.nombre ?? 'tus establecimientos'
    return { reply: `Tenés **${count ?? 0} incidentes** registrados en ${nombre}.`, pendingActions: [] }
  },

  handleInspeccionesList: async (supabase, _userId, _consultoraId, _message, establecimientos, establecimientoMatch) => {
    const ids = establecimientoMatch ? [establecimientoMatch.id] : (establecimientos?.map(e => e.id) ?? [])
    if (!ids.length) return { reply: 'No hay establecimientos activos.', pendingActions: [] }

    const { data: inspecciones } = await supabase
      .from('inspecciones').select('id, fecha_programada, tipo, estado')
      .in('establecimiento_id', ids).order('fecha_programada', { ascending: false }).limit(10)

    if (!inspecciones?.length) return { reply: 'No hay inspecciones registradas.', pendingActions: [] }
    const lines = inspecciones.map(i => `• ${i.fecha_programada} | ${i.tipo} | *${i.estado}*`)
    return { reply: `Últimas ${inspecciones.length} inspecciones:\n\n${lines.join('\n')}`, pendingActions: [] }
  },

  handleRiesgosList: async (supabase, _userId, _consultoraId, _message, establecimientos, establecimientoMatch) => {
    const ids = establecimientoMatch ? [establecimientoMatch.id] : (establecimientos?.map(e => e.id) ?? [])
    if (!ids.length) return { reply: 'No hay establecimientos activos.', pendingActions: [] }

    const { data: riesgos } = await supabase
      .from('riesgos').select('id, nombre, nivel, estado')
      .in('establecimiento_id', ids).order('nivel', { ascending: false }).limit(15)

    if (!riesgos?.length) return { reply: 'No hay riesgos identificados.', pendingActions: [] }
    const criticos = riesgos.filter(r => r.nivel === 'crítico' || r.nivel === 'critico')
    const altos = riesgos.filter(r => r.nivel === 'alto')
    let summary = `Tenés **${riesgos.length} riesgos**.`
    if (criticos.length > 0) summary += ` ⚠️ **${criticos.length} críticos**`
    if (altos.length > 0) summary += ` 🔶 **${altos.length} altos**`
    return { reply: `${summary}\n\n${riesgos.map(r => `• ${r.nombre} | *${r.nivel}* | ${r.estado}`).join('\n')}`, pendingActions: [] }
  },

  handleEmpleadosCount: async (supabase, _userId, _consultoraId, _message, establecimientos, establecimientoMatch) => {
    const est = establecimientoMatch ?? establecimientos?.[0] ?? null
    if (!est) return { reply: 'No hay establecimientos activos.', pendingActions: [] }
    const { count } = await supabase.from('personas_establecimientos')
      .select('*', { count: 'exact', head: true }).eq('establecimiento_id', est.id)
    return { reply: `En **${est.nombre}** hay **${count ?? 0} personas** registradas.`, pendingActions: [] }
  },

  handleDocumentosVencidos: async () => ({
    reply: '⚠️ La consulta de vencimientos de documentos se puede ver desde la sección **Notificaciones** del dashboard.',
    pendingActions: [],
  }),

  handlePlanificarGestion: async (supabase, userId, _consultoraId, message, establecimientos, establecimientoMatch) => {
    const est = establecimientoMatch ?? establecimientos?.[0] ?? null
    if (!est && establecimientos && establecimientos.length === 0) return { reply: 'No hay establecimientos activos. Necesitás un establecimiento para planificar una gestión.', pendingActions: [] }
    if (!est && establecimientos && establecimientos.length > 1) return { reply: '', pendingActions: [] }
    if (!est) return { reply: 'No hay establecimientos activos.', pendingActions: [] }

    const descMatch = message.match(/(?:checklist|check list|gestión|gestion|tarea|inspección|inspeccion|revisión|revision)\s+(?:de\s+|para\s+)?([^.\n]+)/i)
    const dateMatch = message.match(/(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?/i)
      || message.match(/(?:para\s+)?(?:el\s+)?(\d{1,2})\s+de\s+([a-záéíóú]+)(?:\s+del?\s+(\d{4}))?/i)
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

    const lower = message.toLowerCase()
    if (lower.includes('extintor')) tipo = 'checklist_extintores'
    else if (lower.includes('matricial') || lower.includes('matriz')) tipo = 'checklist_matriz_riesgos'
    else if (lower.includes('epp') || lower.includes('equipo protección')) tipo = 'checklist_epp'
    else if (lower.includes('orden') || lower.includes('limpieza')) tipo = 'checklist_orden_limpieza'

    if (descripcion.length > 200) descripcion = descripcion.slice(0, 200)

    const { error } = await supabase.from('agent_pending_actions').insert({
      action_type: 'planificar_gestion',
      payload: { establecimiento_id: est.id, tipo, descripcion, fecha_planificada: fecha },
      status: 'pending',
      requested_by: userId,
    })
    if (error) return { reply: `Hubo un error al crear la solicitud: ${error.message}`, pendingActions: [] }
    return { reply: `📋 Te propongo planificar esta gestión:\n\n**Tipo:** ${tipo}\n**Descripción:** ${descripcion}\n**Fecha:** ${fecha}\n**Establecimiento:** ${est.nombre}\n\n¿Aprobás la solicitud?`, pendingActions: [] }
  },
}

async function queryGestionesForEst(
  sb: SupabaseClient,
  est: Establishment,
  msg: string,
): Promise<{ reply: string; pendingActions: PendingAction[] }> {
  const thisMonth = new Date().toISOString().slice(0, 7)
  const now = new Date().toISOString().slice(0, 10)
  const normalized = msg.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  if (normalized.includes('proxima') || normalized.includes('siguiente')) {
    const { data: next } = await sb
      .from('registro_gestiones').select('id, gestion_establecimiento_id, gestiones!inner(nombre), fecha_planificada')
      .eq('establecimiento_id', est.id).gte('fecha_planificada', now)
      .order('fecha_planificada', { ascending: true }).limit(1)
    if (!next?.length) return { reply: `No hay gestiones próximas planificadas en **${est.nombre}**.`, pendingActions: [] }
    const g = next[0]
    return { reply: `📅 Próxima gestión en **${est.nombre}**: **${(g.gestiones as unknown as { nombre: string }).nombre}** — planificada para el ${g.fecha_planificada}.`, pendingActions: [] }
  }

  let monthFilter = thisMonth
  const mesMatch = normalized.match(/(?:este\s+)?mes\s+(?:de\s+)?([a-z]+)/i)
    || normalized.match(/(?:en\s+)?([a-z]+)\s*(?:del?\s+(\d{4}))?/i)
  if (mesMatch) {
    const meses: Record<string, string> = { enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06', julio: '07', agosto: '08', septiembre: '09', octubre: '10', noviembre: '11', diciembre: '12' }
    const mesNum = meses[mesMatch[1].toLowerCase()]
    if (mesNum) monthFilter = `${mesMatch[2] || new Date().getFullYear().toString()}-${mesNum}`
  }

  const { data: gestiones } = await sb
    .from('registro_gestiones').select('id, gestion_establecimiento_id, gestiones!inner(nombre), fecha_planificada, estado, frecuencia')
    .eq('establecimiento_id', est.id)
    .gte('fecha_planificada', `${monthFilter}-01`).lte('fecha_planificada', `${monthFilter}-31`)
    .order('fecha_planificada', { ascending: true }).limit(20)

  if (!gestiones?.length) return { reply: `No hay gestiones planificadas en **${est.nombre}** para ${monthFilter}.`, pendingActions: [] }

  const lines = gestiones.map(g =>
    `• **${(g.gestiones as unknown as { nombre: string }).nombre}** — ${g.fecha_planificada}${g.estado ? ` | *${g.estado}*` : ''}`
  )
  return { reply: `📊 **${gestiones.length} gestiones** en **${est.nombre}** para ${monthFilter}:\n\n${lines.join('\n')}`, pendingActions: [] }
}
