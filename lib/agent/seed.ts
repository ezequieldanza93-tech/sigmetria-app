import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const KNOWLEDGE_CHUNKS = [
  {
    category: 'general',
    content: 'Sigmetría HyS es una plataforma SaaS de gestión de Higiene y Seguridad laboral. Permite gestionar empresas, establecimientos, empleados, siniestros, inspecciones, riesgos, documentación y reportes. Está diseñada para consultores, empresas y ART.',
  },
  {
    category: 'general',
    content: 'La plataforma Sigmetría HyS está compuesta por módulos: Empresas, Establecimientos, Empleados, Siniestros, Inspecciones, Riesgos, Documentos, Analytics, y Gestión de agenda.',
  },
  {
    category: 'roles',
    content: 'Los roles disponibles son: Super Admin (acceso total), Consultor (gestiona múltiples empresas), Cliente (acceso a sus propios datos), y Visitas (solo lectura). Los permisos se configuran desde el panel de administración.',
  },
  {
    category: 'roles',
    content: 'El Super Admin puede gestionar usuarios, roles, y acceder a todas las empresas y establecimientos del sistema. Los Consultores tienen acceso a las empresas asignadas por una consultora.',
  },
  {
    category: 'siniestros',
    content: 'Los siniestros se registran con: fecha de ocurrencia, descripción, tipo (accidente, enfermedad profesional, incidente), gravedad (leve, moderado, grave), establecimiento asociado, y sectores involucrados.',
  },
  {
    category: 'siniestros',
    content: 'El módulo de siniestros permite llevar un historial completo, adjuntar documentación, y generar estadísticas de siniestralidad por período, establecimiento o tipo.',
  },
  {
    category: 'inspecciones',
    content: 'Las inspecciones pueden ser programadas (con fecha y hora definida) o espontáneas (sin programación previa). Se asignan a sectores del establecimiento y tienen un estado: pendiente, en_curso, completada, cancelada.',
  },
  {
    category: 'inspecciones',
    content: 'Cada inspección puede incluir una lista de verificación (checklist) con ítems a revisar. Los resultados se registran y pueden generar acciones correctivas.',
  },
  {
    category: 'riesgos',
    content: 'La matriz de riesgos permite identificar, evaluar y controlar riesgos laborales. Cada riesgo tiene: nombre, descripción, nivel (bajo, medio, alto, crítico), probabilidad, impacto, y medidas de control.',
  },
  {
    category: 'riesgos',
    content: 'Los riesgos pasan por un ciclo de vida: abierto (identificado), en_progreso (mitigación en curso), mitigado (controlado), cerrado (resuelto). Se puede adjuntar evidencia documental en cada etapa.',
  },
  {
    category: 'establecimientos',
    content: 'Los establecimientos representan unidades productivas (plantas, depósitos, oficinas). Cada establecimiento tiene: nombre, tipo (industrial, comercial, servicio), domicilio, coordenadas GPS, y sectores internos.',
  },
  {
    category: 'establecimientos',
    content: 'Los establecimientos pueden tener múltiples sectores (áreas, departamentos). Cada sector puede tener riesgos, inspecciones, documentos y empleados asignados.',
  },
  {
    category: 'documentos',
    content: 'Los documentos se organizan por tipo: habilitaciones, seguros, contratos, certificados ART, planos, informes técnicos, y otros. Cada documento puede tener fecha de vencimiento y archivo adjunto.',
  },
  {
    category: 'documentos',
    content: 'El sistema alerta sobre vencimientos próximos de documentación. Se pueden configurar anticipos de alerta por tipo de documento.',
  },
  {
    category: 'empresas',
    content: 'Las empresas son los clientes de la plataforma. Cada empresa tiene: razón social, CUIT, domicilio, rubro, ART asignada, y uno o más establecimientos asociados.',
  },
  {
    category: 'reportes',
    content: 'La plataforma permite generar reportes en PDF y exportar datos a Excel. Los reportes disponibles incluyen: siniestralidad, cumplimiento documental, matriz de riesgos, y agenda de inspecciones.',
  },
  {
    category: 'agenda',
    content: 'El módulo de gestión permite planificar y dar seguimiento a acciones: inspecciones, capacitaciones, reuniones, y tareas pendientes. Cada gestión tiene fecha planificada, responsable, y estado.',
  },
  {
    category: 'analytics',
    content: 'El módulo de Analytics muestra KPIs y métricas: tasa de siniestralidad, cumplimiento de inspecciones, evolución de riesgos, documentos vencidos/próximos a vencer, y distribución por tipo y gravedad.',
  },
  {
    category: 'general',
    content: 'El asistente Sig está integrado en la plataforma para ayudar a los usuarios mediante lenguaje natural. Puede consultar datos, responder preguntas sobre el sistema, y ejecutar acciones previa aprobación del usuario.',
  },
  {
    category: 'general',
    content: 'Para usar Sig, los usuarios pueden hacer clic en el botón flotante en la esquina inferior derecha del dashboard, o ir a la sección "Asistente HyS" en el menú de cada establecimiento.',
  },
]

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export async function seedKnowledgeBase() {
  const supabase = await createClient()

  // Clear existing
  await supabase.from('agent_knowledge_chunks').delete().neq('id', '00000000-0000-0000-0000-000000000000')

  for (const chunk of KNOWLEDGE_CHUNKS) {
    let embedding: number[] = []
    if (openai) {
      const resp = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunk.content,
      })
      embedding = resp.data[0].embedding
    }

    const { error } = await supabase.from('agent_knowledge_chunks').insert({
      content: chunk.content,
      category: chunk.category,
      embedding: embedding.length > 0 ? embedding : null,
    })

    if (error) {
      console.error(`[Seed] Error inserting chunk: ${error.message}`)
    }
  }

  return { seeded: KNOWLEDGE_CHUNKS.length }
}
