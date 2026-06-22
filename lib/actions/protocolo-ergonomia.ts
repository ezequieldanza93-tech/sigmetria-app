'use server'

import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromEstablecimiento } from '@/lib/storage/tenant-path'
import { aplicarSelloGeo } from '@/lib/actions/geo-sello'
import type { ActionResult } from '@/lib/types'
import type {
  ErgonomiaFactorTareaInput,
  ErgonomiaEvaluacionFactorInput,
  ErgonomiaMedidasInput,
  ErgonomiaSeguimientoInput,
  ErgonomiaEvaluacionDetalle,
} from '@/lib/types'

/**
 * Server actions del Protocolo de Ergonomía (Res. SRT 886/15 + Disp. SRT 1/2016).
 *
 * El protocolo se ejecuta COMO gestión, igual que los demás protocolos de medición.
 * Patrón replicado de medicion_carga_termica / medicion_pat:
 *  - recibe el registro planificado (registro_id + rg_fecha_planificada) + establecimiento
 *  - UPDATE gestiones_registros.fecha_ejecutada = hoy
 *  - INSERT cabecera → tareas → factores_tarea → evaluacion_factor → medidas → seguimiento
 *  - NO traga errores en silencio: si falla un insert crítico, rollback manual + { success:false }
 *
 * Las 4 planillas del formulario oficial (Res. SRT 886/15 Anexo I):
 *   Planilla 1: cabecera + tareas + factores por tarea
 *   Planilla 2: evaluación inicial por factor (PASO 1 y PASO 2 con SI/NO)
 *   Planilla 3: medidas correctivas y preventivas
 *   Planilla 4: matriz de seguimiento
 */

// ── Helpers ───────────────────────────────────────────────────────────────

function hoy(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function parseBool(v: string | null | undefined): boolean | null {
  if (v == null || v === '') return null
  return v === 'true' || v === '1'
}

function parseIntOrNull(v: string | null | undefined): number | null {
  if (v == null || v === '') return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? n : null
}

/**
 * EJECUTOR del Protocolo de Ergonomía desde una fila planificada.
 *
 * Lee del FormData:
 *   - registro_id / rg_fecha_planificada / establecimiento_id / gestion_establecimiento_id?
 *   - area_sector / puesto_de_trabajo / n_trabajadores / capacitacion / procedimiento_escrito
 *   - ubicacion_sintoma / nombre_trabajadores / trabajador_persona_id?
 *   - manifestacion_temprana / fecha_evaluacion
 *   - firmante / firmante_persona_id
 *   - observaciones / conclusiones / recomendaciones
 *   - tareas → JSON: array de { numero, descripcion }  (hasta 3)
 *   - factores_tarea → JSON: array de ErgonomiaFactorTareaInput
 *   - evaluacion_factor → JSON: array de ErgonomiaEvaluacionFactorInput
 *   - medidas → JSON: array de ErgonomiaMedidasInput
 *   - seguimiento → JSON: array de ErgonomiaSeguimientoInput
 */
export async function crearProtocoloErgonomia(
  formData: FormData
): Promise<ActionResult<{ evaluacionId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const registroId = (formData.get('registro_id') as string) || ''
  const rgFechaPlanificada = (formData.get('rg_fecha_planificada') as string) || null
  const establecimientoId = (formData.get('establecimiento_id') as string) || ''
  const gestionEstablecimientoId = (formData.get('gestion_establecimiento_id') as string) || null

  // Flag de cierre: 'true' = finaliza el protocolo (queda cerrado, marca la gestión
  // como Realizada). Cualquier otro valor (o ausencia) = borrador (re-editable, NO
  // marca la gestión como Realizada).
  const finalizar = (formData.get('finalizar') as string) === 'true'
  const estado: 'borrador' | 'finalizado' = finalizar ? 'finalizado' : 'borrador'

  if (!registroId) return { success: false, error: 'Registro requerido' }
  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }

  // ── Cabecera (Planilla 1 – datos generales) ──────────────────────────
  const areaSector = (formData.get('area_sector') as string) || null
  const puestoDeTrabajo = (formData.get('puesto_de_trabajo') as string) || null
  const nTrabajadores = parseIntOrNull(formData.get('n_trabajadores') as string)
  const capacitacion = parseBool(formData.get('capacitacion') as string)
  const procedimientoEscrito = parseBool(formData.get('procedimiento_escrito') as string)
  const ubicacionSintoma = (formData.get('ubicacion_sintoma') as string) || null
  const nombreTrabajadores = (formData.get('nombre_trabajadores') as string) || null
  const trabajadorPersonaId = (formData.get('trabajador_persona_id') as string) || null
  const manifestacionTemprana = parseBool(formData.get('manifestacion_temprana') as string)
  const fechaEvaluacion = (formData.get('fecha_evaluacion') as string) || null
  const firmante = (formData.get('firmante') as string) || null
  const firmantePersonaId = (formData.get('firmante_persona_id') as string) || null
  const observaciones = (formData.get('observaciones') as string) || null
  const conclusiones = (formData.get('conclusiones') as string) || null
  const recomendaciones = (formData.get('recomendaciones') as string) || null

  // ── JSON payloads ─────────────────────────────────────────────────────
  const tareasRaw = (formData.get('tareas') as string) || '[]'
  const factoresTareaRaw = (formData.get('factores_tarea') as string) || '[]'
  const evaluacionFactorRaw = (formData.get('evaluacion_factor') as string) || '[]'
  const medidasRaw = (formData.get('medidas') as string) || '[]'
  const seguimientoRaw = (formData.get('seguimiento') as string) || '[]'

  let tareas: Array<{ numero: number; descripcion?: string | null }> = []
  let factoresTarea: ErgonomiaFactorTareaInput[] = []
  let evaluacionFactor: ErgonomiaEvaluacionFactorInput[] = []
  let medidas: ErgonomiaMedidasInput[] = []
  let seguimiento: ErgonomiaSeguimientoInput[] = []

  try { tareas = JSON.parse(tareasRaw) } catch { return { success: false, error: 'Formato inválido en tareas' } }
  try { factoresTarea = JSON.parse(factoresTareaRaw) } catch { return { success: false, error: 'Formato inválido en factores' } }
  try { evaluacionFactor = JSON.parse(evaluacionFactorRaw) } catch { return { success: false, error: 'Formato inválido en evaluación de factores' } }
  try { medidas = JSON.parse(medidasRaw) } catch { return { success: false, error: 'Formato inválido en medidas' } }
  try { seguimiento = JSON.parse(seguimientoRaw) } catch { return { success: false, error: 'Formato inválido en seguimiento' } }

  const consultoraId = await consultoraIdFromEstablecimiento(supabase, establecimientoId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del establecimiento' }

  // ── 0. ¿Existe ya una evaluación para este registro? (edición / upsert) ──
  // El borrador se puede re-guardar y luego finalizar. Buscamos la cabecera del
  // mismo registro (referencia suelta: registro_gestion_id + rg_fecha_planificada):
  //  - si existe en estado 'borrador'  → EDICIÓN (UPDATE cabecera + reemplazo de hijos)
  //  - si existe en estado 'finalizado'/'completado' → bloqueado (no se modifica)
  //  - si no existe                     → INSERT nuevo (comportamiento original)
  let existingQuery = supabase
    .from('ergonomia_evaluaciones')
    .select('id, estado')
    .eq('registro_gestion_id', registroId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) existingQuery = existingQuery.eq('rg_fecha_planificada', rgFechaPlanificada)
  const { data: existing, error: existingErr } = await existingQuery.maybeSingle()
  if (existingErr) return { success: false, error: 'No se pudo verificar el estado del protocolo: ' + existingErr.message }
  if (existing && existing.estado !== 'borrador') {
    return { success: false, error: 'El protocolo ya fue finalizado y no se puede modificar' }
  }
  const existingId = (existing?.id as string | undefined) ?? null

  // ── Registro planificado ─────────────────────────────────────────────
  // Solo marcamos Realizado (fecha_ejecutada + ejecutado_at) cuando se FINALIZA;
  // en borrador dejamos esos campos como estén (la gestión NO queda Realizada).
  // De todos modos necesitamos la fecha_planificada autoritativa para el geo-sello.
  const fechaHoy = hoy()
  let regFechaPlanificada: string
  if (finalizar) {
    let regUpdate = supabase
      .from('gestiones_registros')
      .update({ fecha_ejecutada: fechaHoy, ejecutado_at: new Date().toISOString() })
      .eq('id', registroId)
    if (rgFechaPlanificada) regUpdate = regUpdate.eq('fecha_planificada', rgFechaPlanificada)
    const { data: regRow, error: regErr } = await regUpdate.select('fecha_planificada').single()
    if (regErr) return { success: false, error: 'Error al actualizar el registro: ' + regErr.message }
    regFechaPlanificada = regRow.fecha_planificada as string
  } else {
    let regSel = supabase
      .from('gestiones_registros')
      .select('fecha_planificada')
      .eq('id', registroId)
    if (rgFechaPlanificada) regSel = regSel.eq('fecha_planificada', rgFechaPlanificada)
    const { data: regRow, error: regErr } = await regSel.maybeSingle()
    if (regErr) return { success: false, error: 'Error al leer el registro: ' + regErr.message }
    regFechaPlanificada = (regRow?.fecha_planificada as string | undefined) ?? (rgFechaPlanificada ?? fechaHoy)
  }

  // Geo-sello NO-BLOQUEANTE
  await aplicarSelloGeo(supabase, registroId, regFechaPlanificada, formData)

  // ── Cabecera: UPDATE de borrador existente o INSERT nuevo ─────────────
  const cabeceraComun = {
    gestion_establecimiento_id: gestionEstablecimientoId,
    area_sector: areaSector,
    puesto_de_trabajo: puestoDeTrabajo,
    n_trabajadores: nTrabajadores,
    capacitacion,
    procedimiento_escrito: procedimientoEscrito,
    ubicacion_sintoma: ubicacionSintoma,
    nombre_trabajadores: nombreTrabajadores,
    trabajador_persona_id: trabajadorPersonaId || null,
    manifestacion_temprana: manifestacionTemprana,
    fecha_evaluacion: fechaEvaluacion,
    firmante,
    firmante_persona_id: firmantePersonaId || null,
    observaciones,
    conclusiones,
    recomendaciones,
    estado,
  }

  let evaluacionId: string
  if (existingId) {
    // EDICIÓN de un borrador: UPDATE de la cabecera + reemplazo total de los hijos.
    const { error: updErr } = await supabase
      .from('ergonomia_evaluaciones')
      .update(cabeceraComun)
      .eq('id', existingId)
    if (updErr) return { success: false, error: 'Error al actualizar la evaluación: ' + updErr.message }
    evaluacionId = existingId

    // Reemplazo de hijos: borramos las filas previas (las nuevas vienen completas del
    // wizard). Best-effort: si falla un delete, abortamos antes de re-insertar.
    for (const tabla of [
      'ergonomia_tareas',
      'ergonomia_factores_tarea',
      'ergonomia_evaluacion_factor',
      'ergonomia_medidas',
      'ergonomia_seguimiento',
    ] as const) {
      const { error: delErr } = await supabase.from(tabla).delete().eq('evaluacion_id', evaluacionId)
      if (delErr) return { success: false, error: `Error al limpiar datos previos (${tabla}): ` + delErr.message }
    }
  } else {
    const { data: cabecera, error: cabErr } = await supabase
      .from('ergonomia_evaluaciones')
      .insert({
        consultora_id: consultoraId,
        establecimiento_id: establecimientoId,
        registro_gestion_id: registroId,
        rg_fecha_planificada: rgFechaPlanificada,
        ...cabeceraComun,
      })
      .select('id')
      .single()
    if (cabErr) return { success: false, error: 'Error al crear la evaluación: ' + cabErr.message }
    evaluacionId = cabecera.id as string
  }

  // Helper de rollback. En un INSERT nuevo, borra la cabecera (ON DELETE CASCADE limpia
  // hijos). En la EDICIÓN de un borrador NO borramos la cabecera (perderíamos el borrador):
  // los hijos ya quedaron limpios arriba y se repueblan en el próximo guardado OK.
  const rollback = async (msg: string): Promise<ActionResult<never>> => {
    if (!existingId) await supabase.from('ergonomia_evaluaciones').delete().eq('id', evaluacionId)
    return { success: false, error: msg }
  }

  // ── INSERT tareas (Planilla 1) ────────────────────────────────────────
  const tareasValidas = tareas.filter(t => t.numero >= 1 && t.numero <= 3)
  if (tareasValidas.length > 0) {
    const { error: tareasErr } = await supabase
      .from('ergonomia_tareas')
      .insert(tareasValidas.map((t, i) => ({
        evaluacion_id: evaluacionId,
        numero: t.numero,
        descripcion: t.descripcion ?? null,
        orden: i,
      })))
    if (tareasErr) return await rollback('Error al guardar las tareas: ' + tareasErr.message)
  }

  // ── INSERT factores por tarea (Planilla 1 – grilla) ───────────────────
  if (factoresTarea.length > 0) {
    const { error: ftErr } = await supabase
      .from('ergonomia_factores_tarea')
      .insert(factoresTarea.map(f => ({
        evaluacion_id: evaluacionId,
        factor: f.factor,
        tarea_numero: f.tarea_numero,
        presente: f.presente ?? false,
        tiempo_exposicion: f.tiempo_exposicion ?? null,
        nivel_riesgo: f.nivel_riesgo ?? null,
      })))
    if (ftErr) return await rollback('Error al guardar los factores de riesgo: ' + ftErr.message)
  }

  // ── INSERT evaluación inicial por factor (Planilla 2) ─────────────────
  if (evaluacionFactor.length > 0) {
    const { error: efErr } = await supabase
      .from('ergonomia_evaluacion_factor')
      .insert(evaluacionFactor.map(ef => ({
        evaluacion_id: evaluacionId,
        factor: ef.factor,
        tarea_numero: ef.tarea_numero,
        paso1_respuestas: ef.paso1_respuestas ?? [],
        paso1_implica: ef.paso1_implica ?? null,
        paso2_respuestas: ef.paso2_respuestas ?? [],
        nivel_resultante: ef.nivel_resultante ?? null,
        observaciones: ef.observaciones ?? null,
        vibracion_subtipo: ef.vibracion_subtipo ?? null,
      })))
    if (efErr) return await rollback('Error al guardar la evaluación de factores: ' + efErr.message)
  }

  // ── INSERT medidas (Planilla 3) ───────────────────────────────────────
  if (medidas.length > 0) {
    const { error: medErr } = await supabase
      .from('ergonomia_medidas')
      .insert(medidas.map(m => ({
        evaluacion_id: evaluacionId,
        tarea_numero: m.tarea_numero ?? null,
        mg1_informado: m.mg1_informado ?? null,
        mg1_fecha: m.mg1_fecha ?? null,
        mg1_observaciones: m.mg1_observaciones ?? null,
        mg2_capacitado_sintomas: m.mg2_capacitado_sintomas ?? null,
        mg2_fecha: m.mg2_fecha ?? null,
        mg2_observaciones: m.mg2_observaciones ?? null,
        mg3_capacitado_medidas: m.mg3_capacitado_medidas ?? null,
        mg3_fecha: m.mg3_fecha ?? null,
        mg3_observaciones: m.mg3_observaciones ?? null,
        medidas_especificas: m.medidas_especificas ?? [],
        observaciones: m.observaciones ?? null,
      })))
    if (medErr) return await rollback('Error al guardar las medidas preventivas: ' + medErr.message)
  }

  // ── INSERT seguimiento (Planilla 4) ───────────────────────────────────
  if (seguimiento.length > 0) {
    const { error: segErr } = await supabase
      .from('ergonomia_seguimiento')
      .insert(seguimiento.map((s, i) => ({
        evaluacion_id: evaluacionId,
        numero_mcp: s.numero_mcp ?? null,
        nombre_puesto: s.nombre_puesto ?? null,
        fecha_evaluacion: s.fecha_evaluacion ?? null,
        nivel_riesgo: s.nivel_riesgo ?? null,
        fecha_implementacion_admin: s.fecha_implementacion_admin ?? null,
        fecha_implementacion_ingenieria: s.fecha_implementacion_ingenieria ?? null,
        fecha_cierre: s.fecha_cierre ?? null,
        observaciones: s.observaciones ?? null,
        orden: s.orden ?? i,
      })))
    if (segErr) return await rollback('Error al guardar el seguimiento: ' + segErr.message)
  }

  return { success: true, data: { evaluacionId } }
}

// ── Lectura completa ──────────────────────────────────────────────────────

/**
 * Trae una evaluación completa: cabecera + todas las planillas con joins.
 * Usado por el viewer y el PDF.
 */
export async function getProtocoloErgonomia(
  evaluacionId: string
): Promise<ActionResult<ErgonomiaEvaluacionDetalle>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!evaluacionId) return { success: false, error: 'ID de evaluación requerido' }

  const { data, error } = await supabase
    .from('ergonomia_evaluaciones')
    .select(`
      *,
      establecimientos (
        id, nombre, domicilio,
        empresas ( id, razon_social, cuit )
      ),
      ergonomia_tareas ( * ),
      ergonomia_factores_tarea ( * ),
      ergonomia_evaluacion_factor ( * ),
      ergonomia_medidas ( * ),
      ergonomia_seguimiento ( * )
    `)
    .eq('id', evaluacionId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Evaluación no encontrada' }

  return { success: true, data: data as ErgonomiaEvaluacionDetalle }
}
