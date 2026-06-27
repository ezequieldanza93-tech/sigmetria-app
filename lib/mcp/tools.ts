import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

// ─── Context passed to every tool ──────────────────────────────
export interface McpToolContext {
  consultoraId: string
}

// ─── Tool result helper ────────────────────────────────────────
function textResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  }
}

function errorResult(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  }
}

function getSupabase() {
  return createServiceClient()
}

// ─── Tool implementations ──────────────────────────────────────

export async function listarEmpresas(ctx: McpToolContext) {
  const supabase = getSupabase()
  const { data, error } = await supabase
    .from('empresas')
    .select('id, razon_social, cuit, is_active')
    .eq('consultora_id', ctx.consultoraId)
    .order('razon_social')

  if (error) return errorResult(error.message)
  return textResult(data ?? [])
}

export async function crearEmpresa(
  ctx: McpToolContext,
  args: { razon_social: string; cuit?: string; domicilio?: string },
) {
  const supabase = getSupabase()
  const empresaId = crypto.randomUUID()
  const { error } = await supabase.from('empresas').insert({
    id: empresaId,
    razon_social: args.razon_social,
    cuit: args.cuit ?? null,
    domicilio: args.domicilio ?? null,
    consultora_id: ctx.consultoraId,
  })
  if (error) return errorResult(error.message)
  return textResult({ success: true, id: empresaId, message: `Empresa "${args.razon_social}" creada correctamente` })
}

export async function listarEstablecimientos(ctx: McpToolContext, args?: { empresa_id?: string }) {
  const supabase = getSupabase()

  // 1. Get all empresas from this consultora
  let empresasQuery = supabase
    .from('empresas')
    .select('id, razon_social')
    .eq('consultora_id', ctx.consultoraId)

  if (args?.empresa_id) empresasQuery = empresasQuery.eq('id', args.empresa_id)

  const { data: empresas, error: empError } = await empresasQuery
  if (empError) return errorResult(empError.message)
  if (!empresas?.length) return textResult([])

  const empresaIds = empresas.map(e => e.id)
  const empMap = new Map(empresas.map(e => [e.id, e.razon_social]))

  // 2. Get establecimientos for those empresas
  const { data: establecimientos, error: estError } = await supabase
    .from('establecimientos')
    .select('id, nombre, empresa_id')
    .in('empresa_id', empresaIds)
    .order('nombre')

  if (estError) return errorResult(estError.message)

  const result = (establecimientos ?? []).map(e => ({
    ...e,
    empresa_razon_social: empMap.get(e.empresa_id) ?? '?',
  }))

  return textResult(result)
}

export async function listarGestiones(
  ctx: McpToolContext,
  args: {
    establecimiento_id: string
    desde?: string
    hasta?: string
    estado?: 'pendiente' | 'realizado' | 'planificado'
    limit?: number
  },
) {
  const supabase = getSupabase()
  const now = new Date().toISOString().slice(0, 10)
  const yearMonth = now.slice(0, 7)
  const from = args.desde ?? `${yearMonth}-01`
  const lastDay = new Date(parseInt(yearMonth.split('-')[0]), parseInt(yearMonth.split('-')[1]), 0).getDate()
  const to = args.hasta ?? `${yearMonth}-${String(lastDay).padStart(2, '0')}`

  let query = supabase
    .from('gestiones_registros')
    .select(
      `id, fecha_planificada, fecha_ejecutada, notas, estado, gestiones_establecimientos!gestion_establecimiento_id!inner(
        gestion_id, establecimiento_id,
        gestiones!gestion_id!inner(
          nombre,
          gestiones_categorias!categoria_id!inner(nombre, gestiones_grupos!grupo_id!inner(nombre))
        )
      )`,
    )
    .eq('gestiones_establecimientos.establecimiento_id', args.establecimiento_id)
    .gte('fecha_planificada', from)
    .lte('fecha_planificada', to)
    .order('fecha_planificada', { ascending: true })
    .limit(args.limit ?? 20)

  if (args.estado === 'realizado') query = query.not('fecha_ejecutada', 'is', null)
  else if (args.estado === 'pendiente') query = query.is('fecha_ejecutada', null).lt('fecha_planificada', now)
  else if (args.estado === 'planificado') query = query.is('fecha_ejecutada', null).gte('fecha_planificada', now)

  const { data, error } = await query
  if (error) return errorResult(error.message)
  return textResult(data ?? [])
}

export async function listarIncidentes(
  ctx: McpToolContext,
  args: {
    establecimiento_id: string
    limit?: number
    gravedad?: 'leve' | 'moderado' | 'grave'
  },
) {
  const supabase = getSupabase()

  let query = supabase
    .from('incidentes')
    .select('*')
    .eq('establecimiento_id', args.establecimiento_id)
    .order('fecha_ocurrencia', { ascending: false })
    .limit(args.limit ?? 10)

  if (args.gravedad) {
    query = query.eq('tipo', `accidente_${args.gravedad}`)
  }

  const { data, error } = await query
  if (error) return errorResult(error.message)
  return textResult(data ?? [])
}

export async function listarInspecciones(
  ctx: McpToolContext,
  args: {
    establecimiento_id: string
    limit?: number
    estado?: 'pendiente' | 'realizado' | 'cancelado'
  },
) {
  const supabase = getSupabase()

  let query = supabase
    .from('inspecciones')
    .select('*')
    .eq('establecimiento_id', args.establecimiento_id)
    .order('fecha_programada', { ascending: false })
    .limit(args.limit ?? 10)

  if (args.estado) query = query.eq('estado', args.estado)

  const { data, error } = await query
  if (error) return errorResult(error.message)
  return textResult(data ?? [])
}

export async function listarRiesgos(
  ctx: McpToolContext,
  args: {
    establecimiento_id: string
    limit?: number
    nivel?: 'bajo' | 'medio' | 'alto' | 'crítico' | 'critico'
  },
) {
  const supabase = getSupabase()

  let query = supabase
    .from('riesgos')
    .select('*')
    .eq('establecimiento_id', args.establecimiento_id)
    .order('nivel', { ascending: false })
    .limit(args.limit ?? 20)

  if (args.nivel) query = args.nivel === 'critico'
    ? query.eq('nivel', 'crítico')
    : query.eq('nivel', args.nivel)

  const { data, error } = await query
  if (error) return errorResult(error.message)
  return textResult(data ?? [])
}

export async function consultarEmpleados(
  ctx: McpToolContext,
  args: { establecimiento_id: string; limit?: number },
) {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('personas_establecimientos')
    .select(
      'persona_id, establecimiento_id, personas_directorio!persona_id(id, nombre, apellido, dni, email, telefono)',
    )
    .eq('establecimiento_id', args.establecimiento_id)
    .limit(args.limit ?? 50)

  if (error) return errorResult(error.message)
  return textResult(data ?? [])
}

export async function consultarVencimientos(
  ctx: McpToolContext,
  args: { establecimiento_id: string; dias?: number },
) {
  const supabase = getSupabase()
  const hasta = new Date()
  hasta.setDate(hasta.getDate() + (args.dias ?? 30))

  const { data, error } = await supabase
    .from('establecimientos_documentos')
    .select('*, documentos_tipos(nombre)')
    .eq('establecimiento_id', args.establecimiento_id)
    .not('fecha_vencimiento', 'is', null)
    .lte('fecha_vencimiento', hasta.toISOString().slice(0, 10))
    .order('fecha_vencimiento', { ascending: true })

  if (error) return errorResult(error.message)
  return textResult(data ?? [])
}

export async function consultarCatalogoGestiones(_ctx: McpToolContext) {
  const supabase = getSupabase()

  const { data: grupos, error: err1 } = await supabase.from('gestiones_grupos').select('id, nombre').order('nombre')
  if (err1) return errorResult(err1.message)
  if (!grupos) return textResult([])

  const { data: categorias, error: err2 } = await supabase
    .from('gestiones_categorias')
    .select('id, nombre, grupo_id')
    .order('nombre')
  if (err2) return errorResult(err2.message)
  if (!categorias) return textResult(grupos.map(g => ({ ...g, categorias: [] })))

  const { data: gestiones, error: err3 } = await supabase
    .from('gestiones')
    .select('id, nombre, categoria_id, descripcion, aplica_por_iso')
    .order('nombre')

  if (err3) return errorResult(err3.message)

  const gestionesList = gestiones ?? []
  const catMap = new Map<string, { id: string; nombre: string; gestiones: typeof gestionesList }>()

  for (const cat of categorias) {
    catMap.set(cat.id, { ...cat, gestiones: [] })
  }
  for (const g of gestionesList) {
    catMap.get(g.categoria_id)?.gestiones.push(g)
  }

  const result = grupos.map(g => ({
    ...g,
    categorias: categorias.filter(c => c.grupo_id === g.id).map(c => catMap.get(c.id)),
  }))

  return textResult(result)
}

export async function chatConSigia(
  ctx: McpToolContext,
  args: { mensaje: string; establecimiento_id?: string; empresa_id?: string },
) {
  const supabase = getSupabase()

  // Obtener el user_id de la consultora (primer admin)
  const { data: member, error: memberError } = await supabase
    .from('consultoras_members')
    .select('user_id')
    .eq('consultora_id', ctx.consultoraId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (memberError) return errorResult(memberError.message)
  if (!member) return errorResult('No se encontró un usuario activo para esta consultora')

  // Obtener nombres si tenemos IDs
  let establecimientoNombre: string | undefined
  let empresaNombre: string | undefined

  if (args.establecimiento_id) {
    const { data: est } = await supabase
      .from('establecimientos')
      .select('nombre')
      .eq('id', args.establecimiento_id)
      .maybeSingle()
    establecimientoNombre = est?.nombre
  }

  if (args.empresa_id) {
    const { data: emp } = await supabase
      .from('empresas')
      .select('razon_social')
      .eq('id', args.empresa_id)
      .maybeSingle()
    empresaNombre = emp?.razon_social
  }

  // Importación dinámica para evitar circular deps
  const { processMessage } = await import('@/lib/agent/executor')
  const result = await processMessage(args.mensaje, null, member.user_id, {
    establecimientoId: args.establecimiento_id,
    empresaId: args.empresa_id,
    establecimientoNombre,
    empresaNombre,
  })

  return textResult({
    respuesta: result.reply,
    conversationId: result.conversationId,
    pendingActions: result.pendingActions,
  })
}
