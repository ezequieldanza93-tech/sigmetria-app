'use server'

import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromEstablecimiento, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'

/**
 * Server actions del Protocolo de Medición de Iluminación (SRT 84/2012 — Dec 351/79 Anexo IV).
 *
 * El protocolo se ejecuta COMO gestión, igual que el reporte fotográfico
 * (ver lib/actions/reporte-fotografico.ts → crearReporteFotograficoEjecucion).
 * Patrón replicado:
 *  - recibe el registro planificado (registro_id + rg_fecha_planificada) + establecimiento + gestion_establecimiento
 *  - sube adjuntos al bucket PRIVADO `documentos` con tenantStoragePath (guarda PATH, no URL)
 *  - UPDATE gestiones_registros.fecha_ejecutada = hoy
 *  - INSERT cabecera + hijas (puntos + celdas)
 *  - NO traga errores en silencio: si falla un insert crítico, rollback manual + { success:false }
 */

// ── Input tipado de los hijos (vienen del FormData como JSON) ──────────

interface CeldaInput {
  fila: number
  columna: number
  valor_lux: number
}

interface PuntoInput {
  sector_id?: string | null
  puesto_id?: string | null
  turno?: string | null
  tipo_iluminacion?: string | null
  tipo_fuente?: string | null
  tipo_sistema?: string | null
  largo?: number | null
  ancho?: number | null
  altura?: number | null
  valor_requerido_lux?: number | null
  requisito_ref?: string | null
  localizada_lux?: number | null
  general_requerida_lux?: number | null
  observaciones?: string | null
  orden?: number | null
  celdas?: CeldaInput[]
}

// Observación de seguimiento (finding adicional a los puntos de la grilla).
// Mismo contrato que crearReporteFotografico: viene del FormData como JSON
// `observaciones_seguimiento`; las fotos llegan como `obs-foto-{idx}` File.
interface ObsSeguimientoInput {
  descripcion: string
  categoria_id: string
  clasificacion_id?: string | null
  responsable_id?: string | null
  fecha_subsanacion?: string | null
  tiene_foto?: boolean
}

/**
 * EJECUTOR del Protocolo de Medición de Iluminación desde una fila planificada.
 *
 * Lee del FormData:
 *  - registro_id                  → gestiones_registros que se ejecuta (UPDATE)
 *  - rg_fecha_planificada         → compañera de la FK compuesta del registro particionado
 *  - establecimiento_id           → tenant + RLS
 *  - gestion_establecimiento_id   → vínculo a la gestión del establecimiento (opcional)
 *  - instrumento_id?              → luxómetro usado (FK opcional)
 *  - certificado_id?              → certificado de calibración del instrumento (FK opcional)
 *  - firmante?                    → profesional firmante del protocolo (texto libre: nombre y matrícula)
 *  - metodologia                  → texto
 *  - fecha_medicion               → date (YYYY-MM-DD)
 *  - hora_inicio / hora_fin       → time (HH:MM)
 *  - condiciones_atmosfericas     → JSON (jsonb)
 *  - altura_criterio              → 'piso' | 'plano_trabajo'
 *  - conclusiones / recomendaciones / observaciones → texto
 *  - certificado                  → File? (adjunto, sube a `documentos`, guarda PATH en certificado_url)
 *  - plano                        → File? (adjunto, sube a `documentos`, guarda PATH en plano_url)
 *  - puntos                       → JSON: array de PuntoInput (cada uno con su grilla de celdas)
 */
export async function crearMedicionIluminacion(
  formData: FormData
): Promise<ActionResult<{ medicionId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const registroId = (formData.get('registro_id') as string) || ''
  const rgFechaPlanificada = (formData.get('rg_fecha_planificada') as string) || null
  const establecimientoId = (formData.get('establecimiento_id') as string) || ''
  const gestionEstablecimientoId = (formData.get('gestion_establecimiento_id') as string) || null
  const instrumentoId = (formData.get('instrumento_id') as string) || null
  const certificadoId = (formData.get('certificado_id') as string) || null
  const firmante = (formData.get('firmante') as string) || null
  const metodologia = (formData.get('metodologia') as string) || null
  const fechaMedicion = (formData.get('fecha_medicion') as string) || null
  const horaInicio = (formData.get('hora_inicio') as string) || null
  const horaFin = (formData.get('hora_fin') as string) || null
  const condicionesRaw = (formData.get('condiciones_atmosfericas') as string) || null
  const alturaCriterioRaw = (formData.get('altura_criterio') as string) || 'piso'
  const conclusiones = (formData.get('conclusiones') as string) || null
  const recomendaciones = (formData.get('recomendaciones') as string) || null
  const observaciones = (formData.get('observaciones') as string) || null
  const certificadoFile = formData.get('certificado') as File | null
  const planoFile = formData.get('plano') as File | null
  const puntosRaw = (formData.get('puntos') as string) || '[]'
  const observacionesSeguimientoRaw = (formData.get('observaciones_seguimiento') as string) || null

  if (!registroId) return { success: false, error: 'Registro requerido' }
  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }

  // altura_criterio tiene CHECK en DB: solo 'piso' | 'plano_trabajo'.
  const alturaCriterio = ['piso', 'plano_trabajo'].includes(alturaCriterioRaw) ? alturaCriterioRaw : 'piso'

  // condiciones_atmosfericas es jsonb: parseamos el JSON; si viene roto, va null (no rompemos la ejecución).
  let condicionesAtmosfericas: unknown = null
  if (condicionesRaw) {
    try {
      condicionesAtmosfericas = JSON.parse(condicionesRaw)
    } catch {
      condicionesAtmosfericas = null
    }
  }

  // Parseo de puntos (con sus celdas). Si el JSON viene roto es un error crítico:
  // el contenido del protocolo son los puntos, sin ellos la cabecera queda vacía.
  let puntos: PuntoInput[] = []
  try {
    const parsed = JSON.parse(puntosRaw)
    puntos = Array.isArray(parsed) ? parsed : []
  } catch {
    return { success: false, error: 'Los puntos de medición tienen un formato inválido' }
  }

  // El path de un bucket PRIVADO debe empezar con el consultora_id para que la RLS
  // de lectura por tenant matchee (ver lib/storage/tenant-path.ts).
  const consultoraId = await consultoraIdFromEstablecimiento(supabase, establecimientoId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del establecimiento' }

  const ts = Date.now()

  // ── 1. Subir adjuntos opcionales (certificado / plano) → guardamos PATH, no URL ──
  let certificadoUrl: string | null = null
  if (certificadoFile && certificadoFile.size > 0) {
    const ext = certificadoFile.name.split('.').pop() ?? 'pdf'
    const path = tenantStoragePath(consultoraId, 'mediciones-iluminacion', establecimientoId, `${ts}-certificado.${ext}`)
    const { data: up, error: upErr } = await supabase.storage
      .from('documentos')
      .upload(path, certificadoFile, { upsert: false })
    if (upErr) return { success: false, error: 'Error al subir el certificado: ' + upErr.message }
    certificadoUrl = up.path
  }

  let planoUrl: string | null = null
  if (planoFile && planoFile.size > 0) {
    const ext = planoFile.name.split('.').pop() ?? 'pdf'
    const path = tenantStoragePath(consultoraId, 'mediciones-iluminacion', establecimientoId, `${ts}-plano.${ext}`)
    const { data: up, error: upErr } = await supabase.storage
      .from('documentos')
      .upload(path, planoFile, { upsert: false })
    if (upErr) return { success: false, error: 'Error al subir el plano: ' + upErr.message }
    planoUrl = up.path
  }

  // ── 2. UPDATE del registro planificado (queda Realizado) ────────────
  // Fecha de ejecución = HOY por componentes locales (sin drift UTC de toISOString,
  // que de noche en AR -3 puede adelantar un día).
  const now = new Date()
  const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  let regUpdate = supabase
    .from('gestiones_registros')
    .update({ fecha_ejecutada: hoy })
    .eq('id', registroId)
  // rg_fecha_planificada completa la PK compuesta del registro particionado:
  // si la UI lo manda, acotamos el UPDATE a la fila exacta.
  if (rgFechaPlanificada) regUpdate = regUpdate.eq('fecha_planificada', rgFechaPlanificada)
  const { error: regErr } = await regUpdate
  if (regErr) return { success: false, error: 'Error al actualizar el registro: ' + regErr.message }

  // ── 3. INSERT cabecera ──────────────────────────────────────────────
  const { data: cabecera, error: cabErr } = await supabase
    .from('medicion_iluminacion')
    .insert({
      consultora_id: consultoraId,
      establecimiento_id: establecimientoId,
      registro_gestion_id: registroId,
      rg_fecha_planificada: rgFechaPlanificada,
      gestion_establecimiento_id: gestionEstablecimientoId,
      instrumento_id: instrumentoId,
      certificado_id: certificadoId,
      firmante,
      metodologia,
      fecha_medicion: fechaMedicion,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      condiciones_atmosfericas: condicionesAtmosfericas,
      altura_criterio: alturaCriterio,
      certificado_url: certificadoUrl,
      plano_url: planoUrl,
      conclusiones,
      recomendaciones,
      observaciones,
      estado: 'completado',
    })
    .select('id')
    .single()
  if (cabErr) return { success: false, error: 'Error al crear la medición: ' + cabErr.message }

  const medicionId = cabecera.id as string

  // ── 4. INSERT puntos + celdas ───────────────────────────────────────
  // Cada punto se inserta y luego se cuelgan sus celdas. Si algo falla, rollback
  // manual de la cabecera (ON DELETE CASCADE limpia puntos/celdas ya insertados)
  // y devolvemos error en vez de tragarlo y reportar éxito.
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i]
    const { data: punto, error: puntoErr } = await supabase
      .from('medicion_iluminacion_puntos')
      .insert({
        medicion_id: medicionId,
        sector_id: p.sector_id || null,
        puesto_id: p.puesto_id || null,
        turno: p.turno ?? null,
        tipo_iluminacion: p.tipo_iluminacion ?? null,
        tipo_fuente: p.tipo_fuente ?? null,
        tipo_sistema: p.tipo_sistema ?? null,
        largo: p.largo ?? null,
        ancho: p.ancho ?? null,
        altura: p.altura ?? null,
        valor_requerido_lux: p.valor_requerido_lux ?? null,
        requisito_ref: p.requisito_ref ?? null,
        localizada_lux: p.localizada_lux ?? null,
        general_requerida_lux: p.general_requerida_lux ?? null,
        observaciones: p.observaciones ?? null,
        orden: p.orden ?? i,
      })
      .select('id')
      .single()
    if (puntoErr) {
      await supabase.from('medicion_iluminacion').delete().eq('id', medicionId)
      return { success: false, error: 'Error al guardar un punto de medición: ' + puntoErr.message }
    }

    const celdas = Array.isArray(p.celdas) ? p.celdas : []
    if (celdas.length > 0) {
      const celdaRows = celdas.map(c => ({
        punto_id: punto.id as string,
        fila: c.fila,
        columna: c.columna,
        valor_lux: c.valor_lux,
      }))
      const { error: celdasErr } = await supabase
        .from('medicion_iluminacion_celdas')
        .insert(celdaRows)
      if (celdasErr) {
        await supabase.from('medicion_iluminacion').delete().eq('id', medicionId)
        return { success: false, error: 'Error al guardar la grilla de un punto: ' + celdasErr.message }
      }
    }
  }

  // ── 5. INSERT observaciones de seguimiento → pool común gestiones_observaciones
  // Replicado EXACTAMENTE de crearReporteFotografico (lib/actions/reporte-fotografico.ts):
  // mismo contrato de FormData (JSON `observaciones_seguimiento` + fotos `obs-foto-{idx}`),
  // misma forma de inserción (registro_gestion_id + rg_fecha_planificada para que entren a
  // Seguimiento), y subida de fotos al bucket privado `documentos` con tenantStoragePath.
  // Son findings ADICIONALES a los puntos de la grilla. NO se traga el error: si falla el
  // insert, devolvemos error (la medición ya quedó guardada, pero lo informamos).
  if (observacionesSeguimientoRaw) {
    let observaciones: ObsSeguimientoInput[] = []
    try {
      const parsed = JSON.parse(observacionesSeguimientoRaw)
      observaciones = Array.isArray(parsed) ? parsed : []
    } catch {
      return { success: false, error: 'Las observaciones de seguimiento tienen un formato inválido' }
    }

    const validas = observaciones.filter(o => o.descripcion?.trim() && o.categoria_id)
    if (validas.length > 0) {
      const rows = await Promise.all(validas.map(async (o, idx) => {
        // foto_url: null por defecto (la obs es un finding independiente, no hereda foto).
        // Si la obs trae su propia foto, la subimos al bucket privado con tenantStoragePath
        // (path prefijado por tenant para que la RLS de lectura matchee). Guardamos el PATH.
        let foto_url: string | null = null
        if (o.tiene_foto) {
          const obsFile = formData.get(`obs-foto-${idx}`) as File | null
          if (obsFile && obsFile.size > 0) {
            const obsExt = obsFile.name.split('.').pop() ?? 'png'
            const obsPath = tenantStoragePath(consultoraId, 'observaciones-fotos', establecimientoId, `${Date.now()}-${idx}.${obsExt}`)
            const { data: obsUp, error: obsUploadError } = await supabase.storage
              .from('documentos')
              .upload(obsPath, obsFile, { upsert: false })
            if (obsUploadError) {
              console.error('[medicionIluminacion] Error al subir foto de observación:', obsUploadError.message)
            } else if (obsUp) {
              foto_url = obsUp.path
            }
          }
        }
        return {
          registro_gestion_id: registroId,
          // rg_fecha_planificada completa la FK compuesta hacia el registro particionado
          // (registro_gestion_id + rg_fecha_planificada) y es NOT NULL. Debe matchear el
          // fecha_planificada del gestiones_registros que se está ejecutando.
          rg_fecha_planificada: rgFechaPlanificada,
          descripcion: o.descripcion.trim(),
          categoria_id: o.categoria_id,
          clasificacion_id: o.clasificacion_id || null,
          responsable_id: o.responsable_id || null,
          // fecha_planificada (= fecha de subsanación comprometida) es NOT NULL y ningún
          // trigger la rellena. Fallback a hoy si el técnico no la cargó.
          fecha_planificada: o.fecha_subsanacion || hoy,
          foto_url,
        }
      }))
      const { error: obsError } = await supabase.from('gestiones_observaciones').insert(rows)
      if (obsError) {
        console.error('[medicionIluminacion] Error al insertar gestiones_observaciones:', obsError.message)
        return { success: false, error: 'La medición se guardó, pero no se pudieron registrar las observaciones de seguimiento: ' + obsError.message }
      }
    }
  }

  return { success: true, data: { medicionId } }
}

// ── Lookup Anexo IV: sugerir valor requerido (campo 32) ────────────────

export interface ValorRequeridoSugerido {
  lux_min: number
  lux_max?: number
  fuente: string
  label: string
}

/**
 * Sugiere candidatos de valor de iluminación requerido (lux) según el Anexo IV.
 *
 * Estrategia:
 *  1. Busca primero en Tabla 2 (intensidad mínima por rubro/local/tarea, is_active).
 *     Si hay match → devuelve esos candidatos con fuente:'Tabla 2'.
 *  2. Si Tabla 2 no matchea, devuelve candidatos de Tabla 1 (clase de tarea visual)
 *     con fuente:'Tabla 1'.
 *
 * El match es laxo (ilike por los criterios provistos): la UI muestra los candidatos
 * y el técnico elige.
 */
export async function sugerirValorRequerido(input: {
  rubro?: string
  local?: string
  tarea?: string
  claseTarea?: string
}): Promise<ActionResult<ValorRequeridoSugerido[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { rubro, local, tarea, claseTarea } = input

  // ── 1. Tabla 2 (rubro / local / tarea) ──────────────────────────────
  let q2 = supabase
    .from('dec351_iluminacion_tabla2')
    .select('lux_min, rubro, local, tarea')
    .eq('is_active', true)
  if (rubro) q2 = q2.ilike('rubro', `%${rubro}%`)
  if (local) q2 = q2.ilike('local', `%${local}%`)
  if (tarea) q2 = q2.ilike('tarea', `%${tarea}%`)

  const { data: t2, error: t2Err } = await q2.order('orden', { ascending: true })
  if (t2Err) return { success: false, error: t2Err.message }

  if (t2 && t2.length > 0) {
    const result: ValorRequeridoSugerido[] = t2.map(r => ({
      lux_min: Number(r.lux_min),
      fuente: 'Tabla 2',
      label: [r.rubro, r.local, r.tarea].filter(Boolean).join(' — '),
    }))
    return { success: true, data: result }
  }

  // ── 2. Fallback: Tabla 1 (clase de tarea visual) ────────────────────
  let q1 = supabase
    .from('dec351_iluminacion_tabla1')
    .select('lux_min, lux_max, clase_tarea, detalle')
    .eq('is_active', true)
  if (claseTarea) q1 = q1.ilike('clase_tarea', `%${claseTarea}%`)

  const { data: t1, error: t1Err } = await q1.order('orden', { ascending: true })
  if (t1Err) return { success: false, error: t1Err.message }

  const result: ValorRequeridoSugerido[] = (t1 ?? []).map(r => ({
    lux_min: r.lux_min != null ? Number(r.lux_min) : 0,
    lux_max: r.lux_max != null ? Number(r.lux_max) : undefined,
    fuente: 'Tabla 1',
    label: [r.clase_tarea, r.detalle].filter(Boolean).join(' — '),
  }))
  return { success: true, data: result }
}

// ── Lectura completa: cabecera + puntos + celdas (vista + PDF) ─────────

/**
 * Trae una medición completa para la vista y el PDF: cabecera con joins a
 * establecimiento (→ empresa), instrumento, certificado, perfil profesional
 * (→ firmante), y por cada punto su sector/puesto + grilla de celdas.
 *
 * Devuelve el row tal como lo arma PostgREST (joins embebidos). Tipamos como
 * unknown-amigable porque la forma exacta la consume la vista/PDF.
 */
export async function getMedicionIluminacion(
  medicionId: string
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!medicionId) return { success: false, error: 'ID de medición requerido' }

  const { data, error } = await supabase
    .from('medicion_iluminacion')
    .select(`
      *,
      establecimientos (
        id, nombre, domicilio, codigo_postal,
        empresas (
          id, razon_social, cuit, domicilio, localidad_id
        )
      ),
      mediciones_instrumentos (
        id, modelo, numero_serie,
        mediciones_instrumentos_tipos ( nombre ),
        organizaciones_externas ( nombre )
      ),
      certificados_calibracion (
        id, fecha_emision, fecha_vencimiento, certificado_url
      ),
      perfiles_profesionales (
        id, firma_url, cuit,
        profiles ( full_name ),
        matriculas_profesionales ( numero, emisor, fecha_vencimiento, activa )
      ),
      medicion_iluminacion_puntos (
        *,
        establecimientos_sectores ( id, nombre ),
        puestos_de_trabajo ( id, nombre ),
        medicion_iluminacion_celdas ( id, fila, columna, valor_lux )
      )
    `)
    .eq('id', medicionId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Medición no encontrada' }

  return { success: true, data: data as Record<string, unknown> }
}

// ── Catálogos para la UI ───────────────────────────────────────────────

export interface Dec351Tablas {
  tabla1: Array<Record<string, unknown>>
  tabla2: Array<Record<string, unknown>>
  tabla4: Array<Record<string, unknown>>
}

/** Trae las tres tablas de referencia del Anexo IV (lectura global, RLS la limita a autenticados). */
export async function getDec351Tablas(): Promise<ActionResult<Dec351Tablas>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const [t1, t2, t4] = await Promise.all([
    supabase.from('dec351_iluminacion_tabla1').select('*').eq('is_active', true).order('orden', { ascending: true }),
    supabase.from('dec351_iluminacion_tabla2').select('*').eq('is_active', true).order('orden', { ascending: true }),
    supabase.from('dec351_iluminacion_tabla4').select('*').order('orden', { ascending: true }),
  ])

  if (t1.error) return { success: false, error: t1.error.message }
  if (t2.error) return { success: false, error: t2.error.message }
  if (t4.error) return { success: false, error: t4.error.message }

  return {
    success: true,
    data: {
      tabla1: (t1.data ?? []) as Array<Record<string, unknown>>,
      tabla2: (t2.data ?? []) as Array<Record<string, unknown>>,
      tabla4: (t4.data ?? []) as Array<Record<string, unknown>>,
    },
  }
}

export interface InstrumentoLuxometro {
  id: string
  modelo: string
  numero_serie: string | null
  marca: string | null
}

/**
 * Lista los instrumentos tipo "Luxómetro" activos.
 *
 * SCOPING: `mediciones_instrumentos` NO tiene `consultora_id`. La RLS de SELECT
 * de esa tabla NO es por tenant — devuelve TODOS los instrumentos a cualquier
 * miembro activo de consultora (`consultoras_members.is_active`). Es un catálogo
 * global, igual que la página /dashboard/instrumentos que lista con solo
 * `.eq('is_active', true)` sin filtro de tenant. Reutilizamos ESE criterio:
 * filtramos por tipo Luxómetro + activos y dejamos que la RLS global gobierne.
 */
export async function getInstrumentosLuxometro(): Promise<ActionResult<InstrumentoLuxometro[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('mediciones_instrumentos')
    .select('id, modelo, numero_serie, mediciones_instrumentos_tipos!inner(nombre), organizaciones_externas(nombre)')
    .eq('is_active', true)
    .eq('mediciones_instrumentos_tipos.nombre', 'Luxómetro')
    .order('modelo', { ascending: true })

  if (error) return { success: false, error: error.message }

  const result: InstrumentoLuxometro[] = (data ?? []).map(r => {
    const marca = r.organizaciones_externas as { nombre: string } | { nombre: string }[] | null
    const marcaRow = Array.isArray(marca) ? marca[0] : marca
    return {
      id: r.id as string,
      modelo: r.modelo as string,
      numero_serie: (r.numero_serie as string | null) ?? null,
      marca: marcaRow?.nombre ?? null,
    }
  })
  return { success: true, data: result }
}

export interface PerfilProfesionalOption {
  id: string
  full_name: string | null
  firma_url: string | null
}

/**
 * Lista los perfiles profesionales (firmantes posibles). La RLS de
 * perfiles_profesionales gobierna la visibilidad por consultora.
 */
export async function getPerfilesProfesionales(): Promise<ActionResult<PerfilProfesionalOption[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('perfiles_profesionales')
    .select('id, firma_url, profiles(full_name)')

  if (error) return { success: false, error: error.message }

  const result: PerfilProfesionalOption[] = (data ?? []).map(r => {
    const prof = r.profiles as { full_name: string | null } | { full_name: string | null }[] | null
    const profRow = Array.isArray(prof) ? prof[0] : prof
    return {
      id: r.id as string,
      full_name: profRow?.full_name ?? null,
      firma_url: (r.firma_url as string | null) ?? null,
    }
  })
  return { success: true, data: result }
}

export interface SectorConPuestos {
  id: string
  nombre: string
  puestos: Array<{ id: string; nombre: string }>
}

/**
 * Sectores del establecimiento (activos) con sus puestos de trabajo (activos).
 * Para que la UI arme el selector sector → puesto de cada punto medido.
 */
export async function getSectoresYPuestos(
  establecimientoId: string
): Promise<ActionResult<SectorConPuestos[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }

  const { data, error } = await supabase
    .from('establecimientos_sectores')
    .select('id, nombre, puestos_de_trabajo ( id, nombre, is_active )')
    .eq('establecimiento_id', establecimientoId)
    .eq('is_active', true)
    .order('nombre', { ascending: true })

  if (error) return { success: false, error: error.message }

  const result: SectorConPuestos[] = (data ?? []).map(s => {
    const puestosRaw = (s.puestos_de_trabajo as Array<{ id: string; nombre: string; is_active: boolean }> | null) ?? []
    return {
      id: s.id as string,
      nombre: s.nombre as string,
      puestos: puestosRaw
        .filter(p => p.is_active)
        .map(p => ({ id: p.id, nombre: p.nombre })),
    }
  })
  return { success: true, data: result }
}
