import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export async function getEmbedding(text: string): Promise<number[]> {
  if (!openai) return []
  const resp = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  return resp.data[0].embedding
}

interface KnowledgeChunk {
  id: string
  content: string
  category: string
  similarity?: number
}

export async function searchKnowledge(query: string, limit = 5): Promise<KnowledgeChunk[]> {
  const embedding = await getEmbedding(query)
  if (embedding.length === 0) {
    return mockSearch(query, limit)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('search_knowledge_chunks', {
    query_embedding: embedding,
    match_threshold: 0.7,
    match_count: limit,
  })

  if (error) {
    console.error('[Agent] searchKnowledge error:', error)
    return mockSearch(query, limit)
  }

  return (data ?? []) as KnowledgeChunk[]
}

function mockSearch(query: string, limit = 5): KnowledgeChunk[] {
  const allChunks = [
    { id: 'mock-1', content: 'Sigmetría HyS es una plataforma de gestión de higiene y seguridad laboral que permite gestionar empresas, establecimientos, empleados, siniestros, inspecciones y riesgos.', category: 'general' },
    { id: 'mock-2', content: 'Los roles disponibles en la plataforma son: Super Admin, Consultor, Cliente, y Visitas. Cada rol tiene permisos específicos.', category: 'roles' },
    { id: 'mock-3', content: 'Los siniestros se clasifican por gravedad: leve, moderado y grave. Se registran con fecha de ocurrencia, descripción y tipo.', category: 'siniestros' },
    { id: 'mock-4', content: 'Las inspecciones pueden ser programadas o espontáneas. Se asignan a sectores específicos del establecimiento.', category: 'inspecciones' },
    { id: 'mock-5', content: 'Los riesgos identificados pasan por estados: abierto, en_progreso, mitigado y cerrado. Cada riesgo tiene un nivel (bajo, medio, alto, crítico).', category: 'riesgos' },
    { id: 'mock-6', content: 'Los establecimientos pueden tener múltiples sectores. Cada sector puede tener riesgos, inspecciones y documentos asociados.', category: 'establecimientos' },
    { id: 'mock-7', content: 'La plataforma permite generar reportes y exportar datos en formato PDF y Excel.', category: 'reportes' },
    { id: 'mock-8', content: 'Los documentos se organizan por tipo (habilitación, seguro, contrato, etc.) y pueden tener vencimiento asociado.', category: 'documentos' },
    { id: 'mock-9', content: 'Las empresas pueden tener múltiples establecimientos. Cada establecimiento tiene una dirección, tipo y ubicación geográfica.', category: 'empresas' },
    { id: 'mock-10', content: 'El módulo de Analytics permite visualizar métricas y KPIs de siniestralidad, cumplimiento y gestión.', category: 'analytics' },
  ]
  const q = query.toLowerCase()
  const words = q.split(/\s+/).filter(w => w.length > 3)
  const scored = allChunks.map(c => {
    const lower = c.content.toLowerCase()
    let score = 0
    if (lower.includes(q)) score += 10
    for (const w of words) {
      if (lower.includes(w)) score += 1
    }
    return { ...c, score }
  })
  return scored.filter(c => c.score > 0).sort((a, b) => b.score - a.score).slice(0, limit)
}
