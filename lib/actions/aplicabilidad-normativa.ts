'use server'

import { createClient } from '@/lib/supabase/server'
import type { Gestion } from '@/lib/types'

// ============================================================
// Aplicabilidad de la Matriz de Requisitos Legales por establecimiento
// ============================================================
// Evalúa qué normas aplican a un establecimiento concreto cruzando las
// dimensiones agregadas en 20260716000005_normativa_aplicabilidad_extendida:
//   - tipo de establecimiento (join incluye/excluye)
//   - jurisdicción (provincia_id)
//   - habilitación (requiere_habilitacion vs establecimientos.tiene_habilitacion)
//
// Semántica (norma N aplica al establecimiento E):
//   (N.aplica_a_todos OR existe join modo='incluye' con tipo de E)
//   AND NOT existe join modo='excluye' con tipo de E
//   AND (N.provincia_id IS NULL OR N.provincia_id = provincia de E)
//   AND (NOT N.requiere_habilitacion OR E.tiene_habilitacion)
// ============================================================

const CABA = 'Ciudad Autónoma de Buenos Aires'

export interface NormaAplicable {
  id: string
  tipo: string
  numero: string | null
  anio: number | null
  titulo: string
  nombre_completo: string | null
  organismo: string | null
  ambito: string
  estado: string
  descripcion: string | null
  categoria_nombre: string | null
}

interface JoinTipo {
  tipo_establecimiento_id: string
  modo: 'incluye' | 'excluye'
}

interface NormaRow {
  id: string
  tipo: string
  numero: string | null
  anio: number | null
  titulo: string
  nombre_completo: string | null
  organismo: string | null
  ambito: string
  estado: string
  descripcion: string | null
  aplica_a_todos: boolean
  provincia_id: string | null
  requiere_habilitacion: boolean
  requiere_pregunta: boolean
  pregunta_id: string | null
  normativa_categorias: { nombre: string } | null
  normativa_normas_tipos_establecimiento: JoinTipo[] | null
}

interface EstabDims {
  tipo_id: string | null
  tiene_habilitacion: boolean
  provincia_id: string | null
}

async function getEstabDims(establecimientoId: string): Promise<EstabDims | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('establecimientos')
    .select('tipo_id, tiene_habilitacion, localidades(provincia_id)')
    .eq('id', establecimientoId)
    .single()
  if (!data) return null
  const loc = data.localidades as unknown as { provincia_id: string | null } | { provincia_id: string | null }[] | null
  const provincia_id = Array.isArray(loc) ? (loc[0]?.provincia_id ?? null) : (loc?.provincia_id ?? null)
  return {
    tipo_id: data.tipo_id as string | null,
    tiene_habilitacion: Boolean(data.tiene_habilitacion),
    provincia_id,
  }
}

/**
 * Normas de la Matriz de Requisitos Legales que aplican a un establecimiento.
 * RLS limita las normas visibles a la base nacional + las de la consultora.
 */
export async function getNormativasAplicables(establecimientoId: string): Promise<NormaAplicable[]> {
  const supabase = await createClient()
  const dims = await getEstabDims(establecimientoId)
  if (!dims) return []

  const { data } = await supabase
    .from('normativa_normas')
    .select(
      'id, tipo, numero, anio, titulo, nombre_completo, organismo, ambito, estado, descripcion, aplica_a_todos, provincia_id, requiere_habilitacion, requiere_pregunta, pregunta_id, normativa_categorias(nombre), normativa_normas_tipos_establecimiento(tipo_establecimiento_id, modo)'
    )
    .order('orden', { ascending: true, nullsFirst: false })

  const normas = (data ?? []) as unknown as NormaRow[]

  // Respuestas del alta (para el gating condicional de normas).
  const { data: respData } = await supabase
    .from('establecimientos_respuestas')
    .select('pregunta_id, respuesta')
    .eq('establecimiento_id', establecimientoId)
  const respuestas = new Map<string, boolean>()
  for (const r of (respData ?? []) as { pregunta_id: string; respuesta: boolean }[]) {
    respuestas.set(r.pregunta_id, r.respuesta)
  }

  return normas
    .filter((n) => {
      const joins = n.normativa_normas_tipos_establecimiento ?? []
      const incluido = n.aplica_a_todos || joins.some((j) => j.modo === 'incluye' && j.tipo_establecimiento_id === dims.tipo_id)
      const excluido = joins.some((j) => j.modo === 'excluye' && j.tipo_establecimiento_id === dims.tipo_id)
      const aplicaJurisdiccion = !n.provincia_id || n.provincia_id === dims.provincia_id
      const aplicaHabilitacion = !n.requiere_habilitacion || dims.tiene_habilitacion
      // Gating condicional: si requiere pregunta, solo aplica con respuesta = SÍ.
      const aplicaPregunta = !n.requiere_pregunta || !n.pregunta_id || respuestas.get(n.pregunta_id) === true
      return incluido && !excluido && aplicaJurisdiccion && aplicaHabilitacion && aplicaPregunta
    })
    .map((n) => ({
      id: n.id,
      tipo: n.tipo,
      numero: n.numero,
      anio: n.anio,
      titulo: n.titulo,
      nombre_completo: n.nombre_completo,
      organismo: n.organismo,
      ambito: n.ambito,
      estado: n.estado,
      descripcion: n.descripcion,
      categoria_nombre: n.normativa_categorias?.nombre ?? null,
    }))
}

export interface SapAplicabilidad {
  aplica: boolean
  esCaba: boolean
  tieneHabilitacion: boolean
  esObra: boolean
  motivo: string
}

/**
 * ¿Aplica el Sistema de Autoprotección (Ley 5920 CABA) a este establecimiento?
 * Condiciones: radicado en CABA + con habilitación + NO obra de construcción.
 */
export async function esSapAplicable(establecimientoId: string): Promise<SapAplicabilidad> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('establecimientos')
    .select('tiene_habilitacion, establecimientos_tipos(codigo), localidades(provincia)')
    .eq('id', establecimientoId)
    .single()

  if (!data) {
    return { aplica: false, esCaba: false, tieneHabilitacion: false, esObra: false, motivo: 'Establecimiento no encontrado.' }
  }

  const tipo = data.establecimientos_tipos as unknown as { codigo: string } | { codigo: string }[] | null
  const codigo = Array.isArray(tipo) ? tipo[0]?.codigo : tipo?.codigo
  const loc = data.localidades as unknown as { provincia: string | null } | { provincia: string | null }[] | null
  const provincia = Array.isArray(loc) ? loc[0]?.provincia : loc?.provincia

  const esCaba = provincia === CABA
  const tieneHabilitacion = Boolean(data.tiene_habilitacion)
  const esObra = codigo === 'CONSTRUCCION'
  const aplica = esCaba && tieneHabilitacion && !esObra

  let motivo: string
  if (aplica) {
    motivo = 'Aplica: establecimiento en CABA, con habilitación, no es obra de construcción.'
  } else {
    const faltan: string[] = []
    if (!esCaba) faltan.push('no está radicado en CABA')
    if (!tieneHabilitacion) faltan.push('no tiene habilitación declarada')
    if (esObra) faltan.push('es una obra de construcción')
    motivo = `No aplica: ${faltan.join('; ')}.`
  }

  return { aplica, esCaba, tieneHabilitacion, esObra, motivo }
}

/**
 * Gestiones del grupo "Presentaciones" (tipo_ejecucion = presentacion_autoproteccion)
 * que aplican a este establecimiento. Estas gestiones no se modelan por tipo de
 * establecimiento (no entran en getGestionesAplicables): su aplicabilidad es
 * jurisdiccional. Hoy la única es el SAP CABA → se incluye solo si esSapAplicable.
 */
export async function getGestionesPresentacionAplicables(establecimientoId: string): Promise<Gestion[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('gestiones')
    .select('id, nombre, categoria_id, descripcion, created_at, aplica_por_iso, tiene_entregable, tipo_ejecucion, gestiones_categorias(nombre, gestiones_grupos(nombre))')
    .eq('tipo_ejecucion', 'presentacion_autoproteccion')

  const gestiones = (data ?? []) as unknown as Gestion[]
  if (gestiones.length === 0) return []

  const sap = await esSapAplicable(establecimientoId)
  return sap.aplica ? gestiones : []
}
