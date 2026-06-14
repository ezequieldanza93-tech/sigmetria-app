import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

function getSupabase() {
  return createClient()
}

export const tools: DynamicStructuredTool[] = [
  // ─── EMPRESAS ────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: 'listar_empresas',
    description: `Lista empresas de la consultora. 
Úsala cuando el usuario pregunte por empresas: "qué empresas tengo", "listame las empresas", "mostrame empresas activas", "cuántas empresas tengo", "empresas habilitadas".
No necesita parámetros, filtra automáticamente por la consultora del usuario.`,
    schema: z.object({}),
    func: async () => {
      const supabase = await getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return JSON.stringify({ error: 'No autenticado' })
      const { data: membership } = await supabase.from('consultoras_members').select('consultora_id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
      if (!membership) return JSON.stringify({ error: 'Sin consultora' })
      const { data } = await supabase.from('empresas').select('id, razon_social, cuit, is_active').eq('consultora_id', membership.consultora_id).order('razon_social')
      return JSON.stringify(data ?? [])
    },
  }),

  new DynamicStructuredTool({
    name: 'crear_empresa',
    description: `Crea una nueva empresa. 
Úsala cuando el usuario pida dar de alta una empresa: "crear empresa", "nueva empresa", "dar de alta una empresa".
Parámetros: razon_social (obligatorio), cuit, domicilio, email, telefono (opcionales).`,
    schema: z.object({ razon_social: z.string(), cuit: z.string().optional(), domicilio: z.string().optional(), email: z.string().optional(), telefono: z.string().optional() }),
    func: async ({ razon_social, cuit, domicilio, email, telefono }) => {
      const supabase = await getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return JSON.stringify({ success: false, error: 'No autenticado' })
      const { data: membership } = await supabase.from('consultoras_members').select('consultora_id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
      if (!membership) return JSON.stringify({ success: false, error: 'Sin consultora' })
      // Id generado + insert SIN RETURNING: el .select() dispararía la policy de
      // SELECT (has_empresa_read_access, STABLE) sobre la fila nueva → 42501.
      const empresaId = crypto.randomUUID()
      const { error } = await supabase.from('empresas').insert({ id: empresaId, razon_social, cuit, domicilio, email, telefono, consultora_id: membership.consultora_id })
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify({ success: true, id: empresaId, message: `Empresa "${razon_social}" creada correctamente` })
    },
  }),

  // ─── ESTABLECIMIENTOS ────────────────────────────────────────
  new DynamicStructuredTool({
    name: 'listar_establecimientos',
    description: `Lista establecimientos de la consultora (con razón social de la empresa).
Úsala cuando el usuario pregunte: "qué establecimientos tengo", "mostrame los establecimientos", "dónde trabajo", "cuántos establecimientos hay".
Opcional: podés filtrar por empresa_id si el usuario pregunta por una empresa específica.`,
    schema: z.object({ empresa_id: z.string().uuid().optional() }),
    func: async ({ empresa_id }) => {
      const supabase = await getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return JSON.stringify({ error: 'No autenticado' })
      const { data: membership } = await supabase.from('consultoras_members').select('consultora_id').eq('user_id', user.id).eq('is_active', true).maybeSingle()
      if (!membership) return JSON.stringify({ error: 'Sin consultora' })
      let query = supabase.from('establecimientos').select('id, nombre, direccion, status, created_at, empresas!inner(id, razon_social)')
        .eq('empresas.consultora_id', membership.consultora_id)
        .neq('status', 'cancelled')
      if (empresa_id) query = query.eq('empresa_id', empresa_id)
      const { data } = await query.order('nombre')
      return JSON.stringify(data ?? [])
    },
  }),

  // ─── GESTIONES ───────────────────────────────────────────────
  new DynamicStructuredTool({
    name: 'listar_gestiones',
    description: `Lista gestiones planificadas de un establecimiento.
Úsala cuando el usuario pregunte: "qué gestiones tengo", "mostrame las gestiones", "gestiones planificadas", "tareas programadas", "checklists pendientes", "cuántas gestiones hay".
Parámetros:
- establecimiento_id (obligatorio): ID del establecimiento
- desde (opcional): fecha ISO "YYYY-MM-DD" para filtrar desde
- hasta (opcional): fecha ISO "YYYY-MM-DD" para filtrar hasta
- estado (opcional): "pendiente", "realizado", "planificado"
- limit (opcional): máximo resultados (default 20)

Ej: "mostrame las gestiones de mayo" → establecimiento_id + desde="2026-05-01" hasta="2026-05-31"
Ej: "qué gestiones tengo para este mes" → establecimiento_id + desde="2026-05-01" hasta="2026-05-31"
Ej: "próximas gestiones" → establecimiento_id + desde="hoy" + limit=5`,
    schema: z.object({
      establecimiento_id: z.string().uuid(),
      desde: z.string().optional(),
      hasta: z.string().optional(),
      estado: z.enum(['pendiente', 'realizado', 'planificado']).optional(),
      limit: z.number().int().positive().max(50).optional(),
    }),
    func: async ({ establecimiento_id, desde, hasta, estado, limit }) => {
      const supabase = await getSupabase()
      const now = new Date().toISOString().slice(0, 10)
      const from = desde ?? `${now.slice(0, 7)}-01`
      const to = hasta ?? `${now.slice(0, 7)}-31`

      let query = supabase
        .from('registro_gestiones')
        .select('id, fecha_planificada, fecha_ejecutada, notas, gestiones!inner(nombre, gestiones_categorias!inner(nombre, gestiones_grupos!inner(nombre)))')
        .eq('establecimiento_id', establecimiento_id)
        .gte('fecha_planificada', from)
        .lte('fecha_planificada', to)
        .order('fecha_planificada', { ascending: true })
        .limit(limit ?? 20)

      if (estado === 'realizado') query = query.not('fecha_ejecutada', 'is', null)
      else if (estado === 'pendiente') query = query.is('fecha_ejecutada', null).lt('fecha_planificada', now)
      else if (estado === 'planificado') query = query.is('fecha_ejecutada', null).gte('fecha_planificada', now)

      const { data } = await query
      return JSON.stringify(data ?? [])
    },
  }),

  new DynamicStructuredTool({
    name: 'consultar_catalogo_gestiones',
    description: `Devuelve el catálogo completo de gestiones disponible (grupos → categorías → gestiones).
Úsala cuando el usuario pregunte: "qué gestiones hay disponibles", "qué tipos de gestión existen", "qué checklists puedo hacer", "mostrame el catálogo", "qué gestiones existen", "qué puedo planificar".
No necesita parámetros, devuelve toda la estructura del catálogo.`,
    schema: z.object({}),
    func: async () => {
      const supabase = await getSupabase()
      const { data: grupos } = await supabase.from('gestiones_grupos').select('id, nombre').order('nombre')
      if (!grupos) return JSON.stringify([])
      const { data: categorias } = await supabase.from('gestiones_categorias').select('id, nombre, grupo_id').order('nombre')
      if (!categorias) return JSON.stringify(grupos.map(g => ({ ...g, categorias: [] })))
      const { data: gestiones } = await supabase.from('gestiones').select('id, nombre, categoria_id, descripcion, aplica_por_iso').order('nombre')
      const gestionesList = gestiones ?? []
      const catMap = new Map<string, { id: string; nombre: string; gestiones: typeof gestionesList }>()
      for (const cat of categorias) {
        catMap.set(cat.id, { ...cat, gestiones: [] })
      }
      if (gestionesList.length > 0) {
        for (const g of gestionesList) {
          catMap.get(g.categoria_id)?.gestiones.push(g)
        }
      }
      return JSON.stringify(grupos.map(g => ({
        ...g,
        categorias: categorias.filter(c => c.grupo_id === g.id).map(c => catMap.get(c.id)),
      })))
    },
  }),

  new DynamicStructuredTool({
    name: 'registrar_gestion',
    description: `Registra una nueva gestión/checklist/tarea planificada (requiere aprobación del usuario).
Úsala cuando el usuario pida: "planificar una gestión", "agendar un checklist", "programar una tarea", "crear una gestión".
Parámetros:
- establecimiento_id (obligatorio): UUID del establecimiento
- tipo (obligatorio): tipo de gestión (checklist_general, checklist_extintores, capacitacion, etc.)
- descripcion (obligatorio): descripción o nombre de la gestión a planificar
- fecha_planificada (obligatorio): fecha ISO "YYYY-MM-DD"

Esta tool NO ejecuta la acción directo, crea una solicitud pendiente que el usuario debe aprobar.`,
    schema: z.object({ establecimiento_id: z.string().uuid(), tipo: z.string(), descripcion: z.string(), fecha_planificada: z.string() }),
    func: async ({ establecimiento_id, tipo, descripcion, fecha_planificada }) => {
      const supabase = await getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return JSON.stringify({ success: false, error: 'No autenticado' })
      const { error } = await supabase.from('agent_pending_actions').insert({
        action_type: 'registrar_gestion',
        payload: { establecimiento_id, tipo, descripcion, fecha_planificada },
        status: 'pending',
        requested_by: user.id,
      })
      if (error) return JSON.stringify({ success: false, error: error.message, requires_approval: true })
      return JSON.stringify({ success: true, requires_approval: true, message: 'Solicitud creada. El usuario debe aprobarla desde el panel de pendientes.' })
    },
  }),

  // ─── INCIDENTES ──────────────────────────────────────────────
  new DynamicStructuredTool({
    name: 'listar_incidentes',
    description: `Lista incidentes laborales de un establecimiento.
Úsala cuando el usuario pregunte: "qué incidentes hubo", "mostrame los accidentes", "siniestros de planta sur", "accidentes laborales", "incidentes".
Parámetros:
- establecimiento_id (obligatorio): UUID del establecimiento
- limit (opcional): máximo resultados (default 10)
- gravedad (opcional): "leve", "moderado", "grave" — se traduce al tipo accidente_leve|accidente_moderado|accidente_grave`,
    schema: z.object({ establecimiento_id: z.string().uuid(), limit: z.number().int().positive().max(50).optional(), gravedad: z.enum(['leve', 'moderado', 'grave']).optional() }),
    func: async ({ establecimiento_id, limit, gravedad }) => {
      const supabase = await getSupabase()
      let query = supabase.from('incidentes').select('*').eq('establecimiento_id', establecimiento_id).order('fecha_ocurrencia', { ascending: false }).limit(limit ?? 10)
      // Compatibilidad: "gravedad" del usuario se mapea al enum `tipo` nuevo.
      if (gravedad) query = query.eq('tipo', `accidente_${gravedad}`)
      const { data } = await query
      return JSON.stringify(data ?? [])
    },
  }),

  new DynamicStructuredTool({
    name: 'crear_incidente',
    description: `Registra un nuevo incidente/accidente laboral.
Úsala cuando el usuario reporte: "hubo un accidente", "registrar incidente", "reportar incidente", "nuevo accidente".
Parámetros: establecimiento_id, fecha_ocurrencia ("YYYY-MM-DD"), descripcion, gravedad (leve|moderado|grave — opcional, define la severidad del accidente), tipo (opcional).`,
    schema: z.object({ establecimiento_id: z.string().uuid(), fecha_ocurrencia: z.string(), descripcion: z.string(), gravedad: z.enum(['leve', 'moderado', 'grave']).optional(), tipo: z.enum(['incidente', 'accidente_leve', 'accidente_moderado', 'accidente_grave']).optional() }),
    func: async ({ establecimiento_id, fecha_ocurrencia, descripcion, gravedad, tipo }) => {
      const supabase = await getSupabase()
      // El tipo explícito gana; si no, se deriva de gravedad; por defecto, 'incidente'.
      const tipoFinal = tipo ?? (gravedad ? `accidente_${gravedad}` : 'incidente')
      const { data, error } = await supabase.from('incidentes').insert({ establecimiento_id, fecha_ocurrencia, descripcion, tipo: tipoFinal }).select('id').single()
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify({ success: true, id: data.id })
    },
  }),

  // ─── INSPECCIONES ────────────────────────────────────────────
  new DynamicStructuredTool({
    name: 'listar_inspecciones',
    description: `Lista inspecciones programadas de un establecimiento.
Úsala cuando el usuario pregunte: "qué inspecciones hay", "inspecciones programadas", "mostrame las inspecciones", "control de obra", "fechas de inspección".
Parámetros:
- establecimiento_id (obligatorio): UUID del establecimiento
- limit (opcional): máximo resultados (default 10)
- estado (opcional): "pendiente", "realizado", "cancelado"`,
    schema: z.object({ establecimiento_id: z.string().uuid(), limit: z.number().int().positive().max(50).optional(), estado: z.enum(['pendiente', 'realizado', 'cancelado']).optional() }),
    func: async ({ establecimiento_id, limit, estado }) => {
      const supabase = await getSupabase()
      let query = supabase.from('inspecciones').select('*').eq('establecimiento_id', establecimiento_id).order('fecha_programada', { ascending: false }).limit(limit ?? 10)
      if (estado) query = query.eq('estado', estado)
      const { data } = await query
      return JSON.stringify(data ?? [])
    },
  }),

  // ─── RIESGOS ─────────────────────────────────────────────────
  new DynamicStructuredTool({
    name: 'listar_riesgos',
    description: `Lista riesgos identificados en un establecimiento.
Úsala cuando el usuario pregunte: "qué riesgos hay", "matriz de riesgos", "mostrame los riesgos", "peligros identificados", "riesgos críticos".
Parámetros:
- establecimiento_id (obligatorio): UUID del establecimiento
- limit (opcional): máximo resultados (default 20)
- nivel (opcional): "bajo", "medio", "alto", "crítico" para filtrar`,
    schema: z.object({ establecimiento_id: z.string().uuid(), limit: z.number().int().positive().max(50).optional(), nivel: z.enum(['bajo', 'medio', 'alto', 'crítico', 'critico']).optional() }),
    func: async ({ establecimiento_id, limit, nivel }) => {
      const supabase = await getSupabase()
      let query = supabase.from('riesgos').select('*').eq('establecimiento_id', establecimiento_id).order('nivel', { ascending: false }).limit(limit ?? 20)
      if (nivel) query = query.eq('nivel', nivel)
      const { data } = await query
      return JSON.stringify(data ?? [])
    },
  }),

  new DynamicStructuredTool({
    name: 'actualizar_riesgo',
    description: `Actualiza el estado de un riesgo identificado (requiere aprobación del usuario).
Úsala cuando el usuario pida: "cerrar riesgo", "mitigar riesgo", "cambiar estado del riesgo", "actualizar riesgo".
Parámetros: riesgo_id (UUID), estado ("abierto"|"en_progreso"|"mitigado"|"cerrado"), notas (opcional).`,
    schema: z.object({ riesgo_id: z.string().uuid(), estado: z.enum(['abierto', 'en_progreso', 'mitigado', 'cerrado']), notas: z.string().optional() }),
    func: async ({ riesgo_id, estado, notas }) => {
      const supabase = await getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return JSON.stringify({ success: false, error: 'No autenticado' })
      const { error } = await supabase.from('agent_pending_actions').insert({
        action_type: 'actualizar_riesgo',
        payload: { riesgo_id, estado, notas },
        status: 'pending',
        requested_by: user.id,
      })
      if (error) return JSON.stringify({ success: false, error: error.message, requires_approval: true })
      return JSON.stringify({ success: true, requires_approval: true, message: 'Solicitud enviada para aprobación.' })
    },
  }),

  // ─── EMPLEADOS ───────────────────────────────────────────────
  new DynamicStructuredTool({
    name: 'consultar_empleados',
    description: `Lista empleados/trabajadores/personas de un establecimiento.
Úsala cuando el usuario pregunte: "qué empleados hay", "trabajadores del establecimiento", "lista de personas", "personal del establecimiento", "cuántos empleados tiene".
Parámetros:
- establecimiento_id (obligatorio): UUID del establecimiento
- limit (opcional): máximo resultados (default 50)`,
    schema: z.object({ establecimiento_id: z.string().uuid(), limit: z.number().int().positive().max(200).optional() }),
    func: async ({ establecimiento_id, limit }) => {
      const supabase = await getSupabase()
      const { data } = await supabase.from('personas_establecimientos')
        .select('persona_id, fecha_alta, personas_directorio!persona_id(id, nombre, apellido, dni, email, telefono)')
        .eq('establecimiento_id', establecimiento_id)
        .limit(limit ?? 50)
      return JSON.stringify(data ?? [])
    },
  }),

  // ─── VENCIMIENTOS ────────────────────────────────────────────
  new DynamicStructuredTool({
    name: 'consultar_vencimientos',
    description: `Consulta documentos próximos a vencer de un establecimiento.
Úsala cuando el usuario pregunte: "qué vence pronto", "documentos vencidos", "vencimientos próximos", "cosa por vencer", "alertas de vencimiento", "qué está por vencer".
Parámetros:
- establecimiento_id (obligatorio): UUID del establecimiento
- dias (opcional): proximidad en días para filtrar (default 30, ej: 7 para la semana)`,
    schema: z.object({ establecimiento_id: z.string().uuid(), dias: z.number().int().positive().max(365).optional() }),
    func: async ({ establecimiento_id, dias }) => {
      const supabase = await getSupabase()
      const hasta = new Date()
      hasta.setDate(hasta.getDate() + (dias ?? 30))
      const { data } = await supabase
        .from('establecimientos_documentos')
        .select('*, documentos_tipos(nombre)')
        .eq('establecimiento_id', establecimiento_id)
        .not('vencimiento', 'is', null)
        .lte('vencimiento', hasta.toISOString().slice(0, 10))
        .order('vencimiento', { ascending: true })
      return JSON.stringify(data ?? [])
    },
  }),

  // ─── KNOWLEDGE BASE ──────────────────────────────────────────
  new DynamicStructuredTool({
    name: 'buscar_en_knowledge_base',
    description: `Busca información en la base de conocimiento interna de Sigmetría HyS.
Úsala cuando necesites información conceptual sobre la plataforma: cómo funciona, qué módulos tiene, cómo se usan las features, definiciones, roles, permisos, reportes.
NO la uses para consultar datos del usuario (empresas, gestiones, etc.) — para eso están las otras tools.
Parámetros:
- query: texto a buscar (en lenguaje natural)
- limit (opcional): máximo resultados (default 5)`,
    schema: z.object({ query: z.string(), limit: z.number().int().positive().max(20).optional() }),
    func: async ({ query, limit }) => {
      const { searchKnowledge } = await import('./knowledge')
      return JSON.stringify(await searchKnowledge(query, limit ?? 5))
    },
  }),

  // ─── NOTIFICACIONES ──────────────────────────────────────────
  new DynamicStructuredTool({
    name: 'enviar_notificacion',
    description: `Envía una notificación o alerta a un destinatario (requiere aprobación del usuario).
Úsala cuando el usuario pida: "enviar alerta", "notificar a alguien", "mandar un aviso", "enviar notificación".
Parámetros: destinatario, mensaje, tipo (opcional: "email"|"sms"|"push").`,
    schema: z.object({ destinatario: z.string(), mensaje: z.string(), tipo: z.enum(['email', 'sms', 'push']).optional() }),
    func: async ({ destinatario, mensaje, tipo }) => {
      const supabase = await getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return JSON.stringify({ success: false, error: 'No autenticado' })
      const { error } = await supabase.from('agent_pending_actions').insert({
        action_type: 'enviar_notificacion',
        payload: { destinatario, mensaje, tipo: tipo ?? 'email' },
        status: 'pending',
        requested_by: user.id,
      })
      if (error) return JSON.stringify({ success: false, error: error.message, requires_approval: true })
      return JSON.stringify({ success: true, requires_approval: true, message: 'Solicitud de notificación enviada para aprobación.' })
    },
  }),
]
