'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { uploadAsset, deleteAsset } from '@/lib/storage/upload'
import { clasificar, type ClasificacionInput } from '@/lib/sap/clasificacion'
import type { ActionResult } from '@/lib/types'

// ============================================================
// Server actions — Sistema de Autoprotección (Ley 5920 CABA)
// ============================================================
// Una sap_presentaciones por establecimiento (la activa). Guardado parcial real
// (estado borrador/en_progreso). La clasificación corre el motor lib/sap.
// El acceso lo gobierna RLS (has_establecimiento_read/write_access).
// ============================================================

async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

// ─── Catálogos para el wizard ───────────────────────────────
export async function getCatalogosSap(): Promise<ActionResult<{
  usos: { id: string; codigo: string; nombre: string; grupo_min: number; admite_revalida: string; requiere_excepcion_tad: boolean }[]
  sustancias: { id: string; codigo: string; nombre: string }[]
  mediosTipos: { id: string; codigo: string; nombre: string; requiere_funciona: boolean; requiere_cantidad: boolean; requiere_adjunto: boolean }[]
  rolesTipos: { id: string; codigo: string; nombre: string; descripcion: string | null; min_personas: number; exclusivo: boolean }[]
  docsTipos: { id: string; codigo: string; nombre: string; descripcion: string | null }[]
}>> {
  const { supabase } = await getUser()
  const [usos, sustancias, medios, roles, docs] = await Promise.all([
    supabase.from('sap_usos').select('id, codigo, nombre, grupo_min, admite_revalida, requiere_excepcion_tad').order('orden'),
    supabase.from('sap_sustancias_peligrosas').select('id, codigo, nombre').order('orden'),
    supabase.from('sap_tipos_medio_tecnico').select('id, codigo, nombre, requiere_funciona, requiere_cantidad, requiere_adjunto').order('orden'),
    supabase.from('sap_tipos_rol').select('id, codigo, nombre, descripcion, min_personas, exclusivo').order('orden'),
    supabase.from('sap_tipos_documento').select('id, codigo, nombre, descripcion').order('orden'),
  ])
  return {
    success: true,
    data: {
      usos: usos.data ?? [],
      sustancias: sustancias.data ?? [],
      mediosTipos: medios.data ?? [],
      rolesTipos: roles.data ?? [],
      docsTipos: docs.data ?? [],
    },
  }
}

// ─── Obtener o crear la presentación activa del establecimiento ──
export async function getOrCreatePresentacion(establecimientoId: string): Promise<ActionResult<{ presentacionId: string }>> {
  const { supabase, user } = await getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: existing } = await supabase
    .from('sap_presentaciones')
    .select('id')
    .eq('establecimiento_id', establecimientoId)
    .is('deleted_at', null)
    .neq('estado', 'vencido')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) return { success: true, data: { presentacionId: existing.id } }

  // Resolver tenant (empresa + consultora) por la jerarquía de datos.
  const { data: est } = await supabase
    .from('establecimientos')
    .select('empresa_id, empresas(consultora_id)')
    .eq('id', establecimientoId)
    .single()
  const empresaId = (est?.empresa_id as string | undefined) ?? null
  const empresasRel = est?.empresas as unknown as { consultora_id: string } | { consultora_id: string }[] | null
  const consultoraId = Array.isArray(empresasRel) ? empresasRel[0]?.consultora_id : empresasRel?.consultora_id

  const { data: created, error } = await supabase
    .from('sap_presentaciones')
    .insert({
      establecimiento_id: establecimientoId,
      empresa_id: empresaId,
      consultora_id: consultoraId ?? null,
      estado: 'borrador',
      created_by: user.id,
    })
    .select('id')
    .single()

  if (error || !created) {
    // TOCTOU: otra request concurrente pudo crearla (índice único parcial). Reintentar SELECT.
    const { data: again } = await supabase
      .from('sap_presentaciones')
      .select('id')
      .eq('establecimiento_id', establecimientoId)
      .is('deleted_at', null)
      .neq('estado', 'vencido')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (again) return { success: true, data: { presentacionId: again.id } }
    return { success: false, error: error?.message ?? 'No se pudo crear la presentación' }
  }
  return { success: true, data: { presentacionId: created.id } }
}

// ─── Cargar la presentación completa (hidratar el wizard) ───
export async function getPresentacionCompleta(presentacionId: string): Promise<ActionResult<Record<string, unknown>>> {
  const { supabase } = await getUser()
  const { data: presentacion, error } = await supabase
    .from('sap_presentaciones')
    .select('*')
    .eq('id', presentacionId)
    .single()
  if (error || !presentacion) return { success: false, error: error?.message ?? 'Presentación no encontrada' }

  const [sustancias, actividades, riesgos, medios, roles, simulacros, documentos] = await Promise.all([
    supabase.from('sap_presentaciones_sustancias').select('sustancia_id').eq('presentacion_id', presentacionId),
    supabase.from('sap_actividades_planta').select('*').eq('presentacion_id', presentacionId).order('orden'),
    supabase.from('sap_riesgos').select('*').eq('presentacion_id', presentacionId).order('orden'),
    supabase.from('sap_medios_tecnicos').select('*').eq('presentacion_id', presentacionId),
    supabase.from('sap_roles').select('*').eq('presentacion_id', presentacionId),
    supabase.from('sap_simulacros').select('*').eq('presentacion_id', presentacionId).order('orden'),
    supabase.from('sap_documentos').select('*').eq('presentacion_id', presentacionId).is('deleted_at', null).order('created_at'),
  ])

  return {
    success: true,
    data: {
      presentacion,
      sustancias: (sustancias.data ?? []).map((s) => s.sustancia_id),
      actividades: actividades.data ?? [],
      riesgos: riesgos.data ?? [],
      medios: medios.data ?? [],
      roles: roles.data ?? [],
      simulacros: simulacros.data ?? [],
      documentos: documentos.data ?? [],
    },
  }
}

// ─── Clasificar (corre el motor del Anexo I) ────────────────
const clasificarSchema = z.object({
  usoCodigo: z.string().min(1),
  superficieCubiertaM2: z.number().nonnegative(),
  superficieAireLibreM2: z.number().nonnegative().optional(),
  pisosElevados: z.number().int().nonnegative(),
  tieneSubsuelo: z.boolean(),
  actividadEnSubsuelo: z.boolean(),
  cantidadSubsuelos: z.number().int().nonnegative().optional(),
  litrosInflamables: z.number().nonnegative().optional(),
  kgBateriasLitio: z.number().nonnegative().optional(),
  estacionesCargaEv: z.boolean().optional(),
  prestaServicioVehiculosElectricos: z.boolean().optional(),
  procesosSoldadura: z.boolean().optional(),
  sustanciasPeligrosas: z.array(z.string()).optional(),
  tieneInternacion: z.boolean().optional(),
  gasesMedicinales: z.boolean().optional(),
  tieneDepositoTelonesUtileria: z.boolean().optional(),
})

export async function clasificarPresentacion(
  presentacionId: string,
  input: ClasificacionInput,
  sustanciaIds?: string[],
): Promise<ActionResult<{ grupo: number; motivo: string; viaTramite: string; admiteRevalida: string; requisitosTecnicos: string[]; requiereProfesional: boolean; requiereExcepcionTad: boolean }>> {
  const { supabase, user } = await getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const parsed = clasificarSchema.safeParse(input)
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Datos de clasificación inválidos' }

  let result
  try {
    result = clasificar(parsed.data)
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : 'Uso inválido' }
  }

  const viaTramite = result.requiereExcepcionTad
    ? 'excepcion_cultural'
    : result.grupo === 1
      ? 'ddjj_grupo1'
      : 'sap_completo'

  const { data: uso } = await supabase.from('sap_usos').select('id').eq('codigo', parsed.data.usoCodigo).single()

  const { error } = await supabase
    .from('sap_presentaciones')
    .update({
      uso_id: uso?.id ?? null,
      superficie_cubierta_m2: parsed.data.superficieCubiertaM2,
      superficie_aire_libre_m2: parsed.data.superficieAireLibreM2 ?? null,
      pisos_elevados: parsed.data.pisosElevados,
      tiene_subsuelo: parsed.data.tieneSubsuelo,
      cantidad_subsuelos: parsed.data.cantidadSubsuelos ?? null,
      actividad_en_subsuelo: parsed.data.actividadEnSubsuelo,
      tiene_inflamables: (parsed.data.litrosInflamables ?? 0) > 0,
      litros_inflamables: parsed.data.litrosInflamables ?? null,
      tiene_baterias_litio: (parsed.data.kgBateriasLitio ?? 0) > 0,
      kg_baterias_litio: parsed.data.kgBateriasLitio ?? null,
      estaciones_carga_ev: parsed.data.estacionesCargaEv ?? false,
      presta_servicio_ve: parsed.data.prestaServicioVehiculosElectricos ?? false,
      procesos_soldadura: parsed.data.procesosSoldadura ?? false,
      tiene_internacion: parsed.data.tieneInternacion ?? false,
      gases_medicinales: parsed.data.gasesMedicinales ?? false,
      tiene_deposito_telones_utileria: parsed.data.tieneDepositoTelonesUtileria ?? false,
      grupo_calculado: result.grupo,
      admite_revalida: result.admiteRevalida !== 'no',
      clasificacion_motivo: result.motivo,
      requisitos_tecnicos: result.requisitosTecnicos,
      via_tramite: viaTramite,
      estado: 'en_progreso',
    })
    .eq('id', presentacionId)

  if (error) return { success: false, error: error.message }

  // Guardar sustancias peligrosas seleccionadas (replace-all)
  if (sustanciaIds) {
    const sustErr = await replaceSustancias(presentacionId, sustanciaIds)
    if (sustErr) return { success: false, error: sustErr }
  }

  return {
    success: true,
    data: {
      grupo: result.grupo,
      motivo: result.motivo,
      viaTramite,
      admiteRevalida: result.admiteRevalida,
      requisitosTecnicos: result.requisitosTecnicos,
      requiereProfesional: result.requiereProfesional,
      requiereExcepcionTad: result.requiereExcepcionTad,
    },
  }
}

/** Reemplaza las sustancias de una presentación. Devuelve mensaje de error o null. */
async function replaceSustancias(presentacionId: string, sustanciaIds: string[]): Promise<string | null> {
  const { supabase } = await getUser()
  const { error: delErr } = await supabase.from('sap_presentaciones_sustancias').delete().eq('presentacion_id', presentacionId)
  if (delErr) return delErr.message
  const unique = Array.from(new Set(sustanciaIds))
  if (unique.length) {
    const { error: insErr } = await supabase.from('sap_presentaciones_sustancias').insert(
      unique.map((sustancia_id) => ({ presentacion_id: presentacionId, sustancia_id })),
    )
    if (insErr) return insErr.message
  }
  return null
}

// ─── Guardado parcial de la cabecera (borrador) ─────────────
// Campos editables de la cabecera (whitelist; snake_case = columnas).
const CAMPOS_EDITABLES = new Set<string>([
  'paso_actual',
  // DDJJ Grupo 1
  'g1_declarante_nombre', 'g1_declarante_dni_cuit', 'g1_caracter', 'g1_capacidad_m2_persona',
  'g1_tiene_entrepiso', 'g1_entrepiso_superficie', 'g1_entrepiso_destino', 'g1_subsuelo_destino',
  'g1_elementos_mitigacion', 'g1_personal_instruido', 'g1_responsabilidad_evacuacion',
  // SAP G2/G3 datos
  'razon_social', 'cuit', 'nombre_comercial', 'habilitacion_tipo', 'habilitacion_detalle',
  'dias_horarios', 'ocupacion_diurna', 'ocupacion_nocturna', 'personas_movilidad_reducida',
  'telefono_emergencia', 'qr_ifci',
  'profesional_nombre', 'profesional_titulo', 'profesional_matricula', 'profesional_email', 'profesional_telefono',
  'aviso_descripcion', 'aviso_viva_voz', 'evacuacion_procedimiento', 'punto_reunion_descripcion',
  'puesta_a_resguardo', 'enclavamientos', 'medidas_supletorias',
  'g3_riesgos_entorno', 'g3_riesgos_procesos', 'g3_procedimientos_respuesta', 'g3_procedimiento_alarma',
  'decl_viabilidad', 'decl_comunicar_cambios',
  'fecha_presentacion', 'fecha_aprobacion', 'fecha_vencimiento', 'expediente_nro', 'disposicion_nro',
  'observaciones_autoridad',
])

export async function guardarBorradorPresentacion(
  presentacionId: string,
  patch: Record<string, unknown>,
): Promise<ActionResult<null>> {
  const { supabase, user } = await getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const clean: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    if (CAMPOS_EDITABLES.has(k)) clean[k] = v === '' ? null : v
  }
  if (Object.keys(clean).length === 0) return { success: true, data: null }

  const { error } = await supabase.from('sap_presentaciones').update(clean).eq('id', presentacionId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

// ─── Savers de tablas hijas (replace-all) ───────────────────
interface ActividadInput { planta: string; actividad?: string; superficie_m2?: number; orden?: number }
export async function guardarActividades(presentacionId: string, items: ActividadInput[]): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  await supabase.from('sap_actividades_planta').delete().eq('presentacion_id', presentacionId)
  if (items.length) {
    const { error } = await supabase.from('sap_actividades_planta').insert(
      items.map((it, i) => ({ presentacion_id: presentacionId, planta: it.planta, actividad: it.actividad ?? null, superficie_m2: it.superficie_m2 ?? null, orden: it.orden ?? i })),
    )
    if (error) return { success: false, error: error.message }
  }
  return { success: true, data: null }
}

interface RiesgoInput { peligro_id: string; peligro?: string; probabilidad?: string; severidad?: string; propagacion?: string; orden?: number }
export async function guardarRiesgos(presentacionId: string, items: RiesgoInput[]): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  await supabase.from('sap_riesgos').delete().eq('presentacion_id', presentacionId)
  if (items.length) {
    const { error } = await supabase.from('sap_riesgos').insert(
      items.map((it, i) => ({
        presentacion_id: presentacionId,
        peligro_id: it.peligro_id,
        peligro: it.peligro ?? null,
        probabilidad: it.probabilidad ?? null,
        severidad: it.severidad ?? null,
        propagacion: it.propagacion ?? null,
        orden: it.orden ?? i,
      })),
    )
    if (error) return { success: false, error: error.message }
  }
  return { success: true, data: null }
}

interface MedioInput { tipo_id: string; posee: boolean; funciona?: boolean; cantidad?: number; observaciones?: string }
export async function guardarMedios(presentacionId: string, items: MedioInput[]): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  await supabase.from('sap_medios_tecnicos').delete().eq('presentacion_id', presentacionId)
  if (items.length) {
    const { error } = await supabase.from('sap_medios_tecnicos').insert(
      items.map((it) => ({ presentacion_id: presentacionId, tipo_id: it.tipo_id, posee: it.posee, funciona: it.funciona ?? null, cantidad: it.cantidad ?? null, observaciones: it.observaciones ?? null })),
    )
    if (error) return { success: false, error: error.message }
  }
  return { success: true, data: null }
}

interface RolInput { rol_id: string; persona_nombre: string; persona_dni?: string; es_suplente?: boolean; piso_sector?: string; capacitado?: boolean }
export async function guardarRoles(presentacionId: string, items: RolInput[]): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  await supabase.from('sap_roles').delete().eq('presentacion_id', presentacionId)
  if (items.length) {
    const { error } = await supabase.from('sap_roles').insert(
      items.map((it) => ({ presentacion_id: presentacionId, rol_id: it.rol_id, persona_nombre: it.persona_nombre, persona_dni: it.persona_dni ?? null, es_suplente: it.es_suplente ?? false, piso_sector: it.piso_sector ?? null, capacitado: it.capacitado ?? false })),
    )
    if (error) return { success: false, error: error.message }
  }
  return { success: true, data: null }
}

interface SimulacroInput { orden: number; fecha?: string; hora?: string; realizado?: boolean; tiempo_evacuacion_min?: number; personas_evacuadas?: number; tipo?: string; observaciones?: string }
export async function guardarSimulacros(presentacionId: string, items: SimulacroInput[]): Promise<ActionResult<null>> {
  const { supabase } = await getUser()
  await supabase.from('sap_simulacros').delete().eq('presentacion_id', presentacionId)
  if (items.length) {
    const { error } = await supabase.from('sap_simulacros').insert(
      items.map((it) => ({ presentacion_id: presentacionId, orden: it.orden, fecha: it.fecha ?? null, hora: it.hora ?? null, realizado: it.realizado ?? false, tiempo_evacuacion_min: it.tiempo_evacuacion_min ?? null, personas_evacuadas: it.personas_evacuadas ?? null, tipo: it.tipo ?? null, observaciones: it.observaciones ?? null })),
    )
    if (error) return { success: false, error: error.message }
  }
  return { success: true, data: null }
}

export async function guardarSustancias(presentacionId: string, sustanciaIds: string[]): Promise<ActionResult<null>> {
  const err = await replaceSustancias(presentacionId, sustanciaIds)
  return err ? { success: false, error: err } : { success: true, data: null }
}

// ─── Documentos (Storage privado sap-autoproteccion) ────────
export async function subirDocumentoSap(formData: FormData): Promise<ActionResult<{ documentoId: string }>> {
  const { supabase, user } = await getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const presentacionId = String(formData.get('presentacionId') ?? '')
  const tipoCodigo = String(formData.get('tipoCodigo') ?? '')
  const descripcion = (formData.get('descripcion') as string | null) ?? null
  const file = formData.get('file')
  if (!presentacionId || !tipoCodigo) return { success: false, error: 'Faltan datos del documento' }
  if (!(file instanceof File) || file.size === 0) return { success: false, error: 'Archivo inválido' }

  // Resolver consultora (tenant) y tipo de documento.
  const { data: pres } = await supabase.from('sap_presentaciones').select('consultora_id, establecimiento_id').eq('id', presentacionId).single()
  let consultoraId = pres?.consultora_id as string | null | undefined
  if (!consultoraId && pres?.establecimiento_id) {
    const { data: est } = await supabase.from('establecimientos').select('empresas(consultora_id)').eq('id', pres.establecimiento_id).single()
    const rel = est?.empresas as unknown as { consultora_id: string } | { consultora_id: string }[] | null
    consultoraId = Array.isArray(rel) ? rel[0]?.consultora_id : rel?.consultora_id
  }
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora' }

  const { data: tipo } = await supabase.from('sap_tipos_documento').select('id').eq('codigo', tipoCodigo).single()
  if (!tipo) return { success: false, error: 'Tipo de documento inválido' }

  // kind único por documento (permite varios del mismo tipo).
  const suffix = crypto.randomUUID().slice(0, 8)
  const up = await uploadAsset({
    bucket: 'sap-autoproteccion',
    consultoraId,
    entityType: 'sap',
    entityId: presentacionId,
    kind: `${tipoCodigo.toLowerCase()}_${suffix}`,
    file,
  })
  if (!up.ok) return { success: false, error: up.error }

  const { data: doc, error } = await supabase
    .from('sap_documentos')
    .insert({
      presentacion_id: presentacionId,
      tipo_id: tipo.id,
      path: up.path,
      nombre_archivo: file.name,
      mime: file.type,
      size_bytes: file.size,
      descripcion,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (error || !doc) return { success: false, error: error?.message ?? 'No se pudo registrar el documento' }
  return { success: true, data: { documentoId: doc.id } }
}

export async function eliminarDocumentoSap(documentoId: string): Promise<ActionResult<null>> {
  const { supabase, user } = await getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  const { data: doc } = await supabase.from('sap_documentos').select('path').eq('id', documentoId).single()
  const { error } = await supabase.from('sap_documentos').update({ deleted_at: new Date().toISOString() }).eq('id', documentoId)
  if (error) return { success: false, error: error.message }
  if (doc?.path) await deleteAsset('sap-autoproteccion', doc.path)
  return { success: true, data: null }
}

// ─── Transiciones de estado / finalización ──────────────────
const ESTADOS_VALIDOS = new Set(['borrador', 'en_progreso', 'completo', 'presentado', 'observado', 'aprobado', 'vigencia_anual', 'revalida', 'vencido', 'no_aplica'])

export async function marcarEstadoPresentacion(presentacionId: string, estado: string): Promise<ActionResult<null>> {
  const { supabase, user } = await getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!ESTADOS_VALIDOS.has(estado)) return { success: false, error: 'Estado inválido' }
  const patch: Record<string, unknown> = { estado }
  if (estado === 'presentado') patch.fecha_presentacion = new Date().toISOString().slice(0, 10)
  const { error } = await supabase.from('sap_presentaciones').update(patch).eq('id', presentacionId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

/**
 * Finaliza la carga: marca la presentación como 'completo' y, si se pasó el
 * registro de la agenda, lo marca ejecutado para reflejar el avance.
 */
export async function finalizarPresentacion(
  presentacionId: string,
  registroId?: string,
): Promise<ActionResult<null>> {
  const { supabase, user } = await getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: pres } = await supabase.from('sap_presentaciones').select('grupo_calculado').eq('id', presentacionId).single()
  if (!pres?.grupo_calculado) return { success: false, error: 'Primero hay que clasificar el establecimiento (Paso 1).' }

  const { error } = await supabase.from('sap_presentaciones').update({ estado: 'completo' }).eq('id', presentacionId)
  if (error) return { success: false, error: error.message }

  if (registroId) {
    await supabase
      .from('gestiones_registros')
      .update({ fecha_ejecutada: new Date().toISOString().slice(0, 10) })
      .eq('id', registroId)
  }
  return { success: true, data: null }
}
