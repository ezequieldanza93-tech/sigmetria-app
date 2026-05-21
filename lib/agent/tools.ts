import { DynamicStructuredTool } from '@langchain/core/tools'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

function getSupabase() {
  return createClient()
}

export const tools: DynamicStructuredTool[] = [
  new DynamicStructuredTool({
    name: 'crear_empresa',
    description: 'Crea una nueva empresa con los datos proporcionados.',
    schema: z.object({ razon_social: z.string(), cuit: z.string().optional(), domicilio: z.string().optional(), email: z.string().optional(), telefono: z.string().optional() }),
    func: async ({ razon_social, cuit, domicilio, email, telefono }) => {
      const supabase = await getSupabase()
      const { data, error } = await supabase.from('empresas').insert({ razon_social, cuit, domicilio, email, telefono }).select('id').single()
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify({ success: true, id: data.id })
    },
  }),
  new DynamicStructuredTool({
    name: 'crear_siniestro',
    description: 'Registra un siniestro laboral.',
    schema: z.object({ establecimiento_id: z.string(), fecha_ocurrencia: z.string(), descripcion: z.string(), gravedad: z.enum(['leve', 'moderado', 'grave']), tipo: z.string().optional() }),
    func: async ({ establecimiento_id, fecha_ocurrencia, descripcion, gravedad, tipo }) => {
      const supabase = await getSupabase()
      const { data, error } = await supabase.from('siniestros').insert({ establecimiento_id, fecha_ocurrencia, descripcion, gravedad, tipo: tipo ?? 'accidente' }).select('id').single()
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify({ success: true, id: data.id })
    },
  }),
  new DynamicStructuredTool({
    name: 'listar_siniestros',
    description: 'Lista siniestros de un establecimiento.',
    schema: z.object({ establecimiento_id: z.string(), limit: z.number().optional() }),
    func: async ({ establecimiento_id, limit }) => {
      const supabase = await getSupabase()
      const { data, error } = await supabase.from('siniestros').select('*').eq('establecimiento_id', establecimiento_id).order('fecha_ocurrencia', { ascending: false }).limit(limit ?? 10)
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify(data)
    },
  }),
  new DynamicStructuredTool({
    name: 'listar_inspecciones',
    description: 'Lista inspecciones programadas de un establecimiento.',
    schema: z.object({ establecimiento_id: z.string(), limit: z.number().optional() }),
    func: async ({ establecimiento_id, limit }) => {
      const supabase = await getSupabase()
      const { data, error } = await supabase.from('inspecciones').select('*').eq('establecimiento_id', establecimiento_id).order('fecha_programada', { ascending: false }).limit(limit ?? 10)
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify(data)
    },
  }),
  new DynamicStructuredTool({
    name: 'listar_riesgos',
    description: 'Lista riesgos identificados en un establecimiento.',
    schema: z.object({ establecimiento_id: z.string(), limit: z.number().optional() }),
    func: async ({ establecimiento_id, limit }) => {
      const supabase = await getSupabase()
      const { data, error } = await supabase.from('riesgos').select('*').eq('establecimiento_id', establecimiento_id).order('fecha_identificacion', { ascending: false }).limit(limit ?? 10)
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify(data)
    },
  }),
  new DynamicStructuredTool({
    name: 'buscar_en_knowledge_base',
    description: 'Busca en la base de conocimiento interno de la plataforma Sigmetría HyS.',
    schema: z.object({ query: z.string(), limit: z.number().optional() }),
    func: async ({ query, limit }) => {
      const { searchKnowledge } = await import('./knowledge')
      return JSON.stringify(await searchKnowledge(query, limit ?? 5))
    },
  }),
  new DynamicStructuredTool({
    name: 'consultar_vencimientos',
    description: 'Consulta vencimientos próximos de documentación de un establecimiento.',
    schema: z.object({ establecimiento_id: z.string() }),
    func: async ({ establecimiento_id }) => {
      const supabase = await getSupabase()
      const { data, error } = await supabase.from('establecimientos_documentos').select('*, documentos_tipos(nombre)').eq('establecimiento_id', establecimiento_id).not('vencimiento', 'is', null).order('vencimiento', { ascending: true })
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify(data)
    },
  }),
  new DynamicStructuredTool({
    name: 'consultar_empleados',
    description: 'Consulta empleados/trabajadores de un establecimiento.',
    schema: z.object({ establecimiento_id: z.string() }),
    func: async ({ establecimiento_id }) => {
      const supabase = await getSupabase()
      const { data, error } = await supabase.from('personas_establecimientos').select('persona_id, personas_directorio!persona_id(id, nombre, apellido, dni)').eq('establecimiento_id', establecimiento_id)
      if (error) return JSON.stringify({ success: false, error: error.message })
      return JSON.stringify(data)
    },
  }),
  new DynamicStructuredTool({
    name: 'registrar_gestion',
    description: 'Registra una gestión o acción pendiente (requiere aprobación).',
    schema: z.object({ establecimiento_id: z.string(), tipo: z.string(), descripcion: z.string(), fecha_planificada: z.string() }),
    func: async ({ establecimiento_id, tipo, descripcion, fecha_planificada }) => {
      const supabase = await getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('agent_pending_actions').insert({
        action_type: 'registrar_gestion',
        payload: { establecimiento_id, tipo, descripcion, fecha_planificada },
        status: 'pending',
        requested_by: user?.id ?? 'unknown',
      })
      if (error) return JSON.stringify({ success: false, error: error.message, requires_approval: true })
      return JSON.stringify({ success: true, requires_approval: true, message: 'Solicitud enviada para aprobación. El usuario debe aprobarla desde el panel.' })
    },
  }),
  new DynamicStructuredTool({
    name: 'actualizar_riesgo',
    description: 'Actualiza el estado de un riesgo (requiere aprobación).',
    schema: z.object({ riesgo_id: z.string(), estado: z.enum(['abierto', 'en_progreso', 'mitigado', 'cerrado']), notas: z.string().optional() }),
    func: async ({ riesgo_id, estado, notas }) => {
      const supabase = await getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('agent_pending_actions').insert({
        action_type: 'actualizar_riesgo',
        payload: { riesgo_id, estado, notas },
        status: 'pending',
        requested_by: user?.id ?? 'unknown',
      })
      if (error) return JSON.stringify({ success: false, error: error.message, requires_approval: true })
      return JSON.stringify({ success: true, requires_approval: true, message: 'Solicitud enviada para aprobación.' })
    },
  }),
  new DynamicStructuredTool({
    name: 'enviar_notificacion',
    description: 'Envía una notificación o alerta (requiere aprobación).',
    schema: z.object({ destinatario: z.string(), mensaje: z.string(), tipo: z.enum(['email', 'sms', 'push']).optional() }),
    func: async ({ destinatario, mensaje, tipo }) => {
      const supabase = await getSupabase()
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('agent_pending_actions').insert({
        action_type: 'enviar_notificacion',
        payload: { destinatario, mensaje, tipo: tipo ?? 'email' },
        status: 'pending',
        requested_by: user?.id ?? 'unknown',
      })
      if (error) return JSON.stringify({ success: false, error: error.message, requires_approval: true })
      return JSON.stringify({ success: true, requires_approval: true, message: 'Solicitud de notificación enviada para aprobación.' })
    },
  }),
]
