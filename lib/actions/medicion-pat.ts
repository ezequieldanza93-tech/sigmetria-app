'use server'

import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromEstablecimiento, tenantStoragePath } from '@/lib/storage/tenant-path'
import { aplicarSelloGeo } from '@/lib/actions/geo-sello'
import type { ActionResult } from '@/lib/types'

/**
 * Server actions del Protocolo de Medición de Puesta a Tierra (PAT — SRT 900/2015).
 *
 * El protocolo se ejecuta COMO gestión, igual que el reporte fotográfico y la
 * medición de iluminación (ver lib/actions/medicion-iluminacion.ts). Patrón replicado:
 *  - recibe el registro planificado (registro_id + rg_fecha_planificada) + establecimiento + gestion_establecimiento
 *  - sube adjuntos al bucket PRIVADO `documentos` con tenantStoragePath (guarda PATH, no URL)
 *  - UPDATE gestiones_registros.fecha_ejecutada = hoy
 *  - INSERT cabecera + tomas
 *  - INSERTA las observaciones de seguimiento en gestiones_observaciones para que
 *    entren al pool de Seguimiento (mismo contrato que iluminación / reporte fotográfico)
 *  - NO traga errores en silencio: si falla un insert crítico, rollback manual + { success:false }
 */

// ── Input tipado de los hijos (vienen del FormData como JSON) ──────────

interface TomaInput {
  numero_toma?: number | null
  sector_id?: string | null
  seccion?: string | null
  condicion_terreno?: string | null
  uso_pat?: string | null
  ect?: string | null
  valor_medido_ohm?: number | null
  valor_exigido_ohm?: number | null
  cumple?: boolean | null
  continuidad?: boolean | null
  capacidad_carga?: boolean | null
  proteccion?: string | null
  desconexion_automatica?: boolean | null
  observaciones?: string | null
  orden?: number | null
}

// Observación de seguimiento (finding adicional a las tomas).
// Mismo contrato que crearMedicionIluminacion: viene del FormData como JSON
// `observaciones_seguimiento`; las fotos llegan como `obs-foto-{idx}` File.
interface ObsSeguimientoInput {
  descripcion: string
  categoria_id: string
  clasificacion_id?: string | null
  responsable_id?: string | null
  fecha_subsanacion?: string | null
  tiene_foto?: boolean
}

// CHECK de DB: ect solo puede ser uno de estos (o null).
const ECT_VALIDOS = ['TT', 'TN-S', 'TN-C', 'TN-C-S', 'IT']
// CHECK de DB: proteccion solo puede ser una de estas (o null).
const PROTECCION_VALIDAS = ['DD', 'IA', 'Fus']

/**
 * EJECUTOR del Protocolo de Medición de Puesta a Tierra desde una fila planificada.
 *
 * Lee del FormData:
 *  - registro_id                  → gestiones_registros que se ejecuta (UPDATE)
 *  - rg_fecha_planificada         → compañera de la FK compuesta del registro particionado
 *  - establecimiento_id           → tenant + RLS
 *  - gestion_establecimiento_id   → vínculo a la gestión del establecimiento (opcional)
 *  - instrumento_id?              → telurímetro usado (FK opcional)
 *  - certificado_id?              → certificado de calibración VIGENTE del instrumento (FK opcional, traído automáticamente)
 *  - firmante?                    → profesional firmante como texto (derivado de la persona; se conserva por compatibilidad)
 *  - firmante_persona_id?         → profesional firmante elegido del directorio (FK personas_directorio, opcional)
 *  - metodologia                  → texto
 *  - fecha_medicion               → date (YYYY-MM-DD)
 *  - fecha_medicion_fin?          → date (YYYY-MM-DD)
 *  - hora_inicio / hora_fin       → time (HH:MM)
 *  - conclusiones / recomendaciones / observaciones → texto
 *  - certificado                  → File? (adjunto, sube a `documentos`, guarda PATH en certificado_url)
 *  - plano                        → File? (adjunto, sube a `documentos`, guarda PATH en plano_url)
 *  - tomas                        → JSON: array de TomaInput
 *  - observaciones_seguimiento    → JSON: array de findings → gestiones_observaciones
 */
export async function crearMedicionPat(
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
  const firmantePersonaId = (formData.get('firmante_persona_id') as string) || null
  const metodologia = (formData.get('metodologia') as string) || null
  const fechaMedicion = (formData.get('fecha_medicion') as string) || null
  const fechaMedicionFin = (formData.get('fecha_medicion_fin') as string) || null
  const horaInicio = (formData.get('hora_inicio') as string) || null
  const horaFin = (formData.get('hora_fin') as string) || null
  const conclusiones = (formData.get('conclusiones') as string) || null
  const recomendaciones = (formData.get('recomendaciones') as string) || null
  const observaciones = (formData.get('observaciones') as string) || null
  const certificadoFile = formData.get('certificado') as File | null
  const planoFile = formData.get('plano') as File | null
  const tomasRaw = (formData.get('tomas') as string) || '[]'
  const observacionesSeguimientoRaw = (formData.get('observaciones_seguimiento') as string) || null

  if (!registroId) return { success: false, error: 'Registro requerido' }
  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }

  // Parseo de tomas. Si el JSON viene roto es un error crítico: el contenido del
  // protocolo son las tomas, sin ellas la cabecera queda vacía.
  let tomas: TomaInput[] = []
  try {
    const parsed = JSON.parse(tomasRaw)
    tomas = Array.isArray(parsed) ? parsed : []
  } catch {
    return { success: false, error: 'Las tomas de tierra tienen un formato inválido' }
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
    const path = tenantStoragePath(consultoraId, 'mediciones-pat', establecimientoId, `${ts}-certificado.${ext}`)
    const { data: up, error: upErr } = await supabase.storage
      .from('documentos')
      .upload(path, certificadoFile, { upsert: false })
    if (upErr) return { success: false, error: 'Error al subir el certificado: ' + upErr.message }
    certificadoUrl = up.path
  }

  let planoUrl: string | null = null
  if (planoFile && planoFile.size > 0) {
    const ext = planoFile.name.split('.').pop() ?? 'pdf'
    const path = tenantStoragePath(consultoraId, 'mediciones-pat', establecimientoId, `${ts}-plano.${ext}`)
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
    // ejecutado_at = now(): hora real de finalización de la medición (queda Realizado).
    .update({ fecha_ejecutada: hoy, ejecutado_at: new Date().toISOString() })
    .eq('id', registroId)
  // rg_fecha_planificada completa la PK compuesta del registro particionado:
  // si la UI lo manda, acotamos el UPDATE a la fila exacta.
  if (rgFechaPlanificada) regUpdate = regUpdate.eq('fecha_planificada', rgFechaPlanificada)
  const { data: regRow, error: regErr } = await regUpdate.select('fecha_planificada').single()
  if (regErr) return { success: false, error: 'Error al actualizar el registro: ' + regErr.message }

  // Geo-sello del lugar de ejecución. Usamos la fecha_planificada autoritativa del
  // registro (clave de partición). NO-BLOQUEANTE.
  await aplicarSelloGeo(supabase, registroId, regRow.fecha_planificada as string, formData)

  // ── 3. INSERT cabecera ──────────────────────────────────────────────
  const { data: cabecera, error: cabErr } = await supabase
    .from('medicion_pat')
    .insert({
      consultora_id: consultoraId,
      establecimiento_id: establecimientoId,
      registro_gestion_id: registroId,
      rg_fecha_planificada: rgFechaPlanificada,
      gestion_establecimiento_id: gestionEstablecimientoId,
      instrumento_id: instrumentoId,
      certificado_id: certificadoId,
      firmante,
      firmante_persona_id: firmantePersonaId,
      metodologia,
      fecha_medicion: fechaMedicion,
      fecha_medicion_fin: fechaMedicionFin,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      conclusiones,
      recomendaciones,
      observaciones,
      certificado_url: certificadoUrl,
      plano_url: planoUrl,
      estado: 'completado',
    })
    .select('id')
    .single()
  if (cabErr) return { success: false, error: 'Error al crear la medición: ' + cabErr.message }

  const medicionId = cabecera.id as string

  // ── 4. INSERT tomas ─────────────────────────────────────────────────
  // Se insertan en lote. Si algo falla, rollback manual de la cabecera
  // (ON DELETE CASCADE limpia las tomas ya insertadas) y devolvemos error
  // en vez de tragarlo y reportar éxito.
  if (tomas.length > 0) {
    const tomaRows = tomas.map((t, i) => ({
      medicion_id: medicionId,
      numero_toma: t.numero_toma ?? i + 1,
      sector_id: t.sector_id || null,
      seccion: t.seccion ?? null,
      condicion_terreno: t.condicion_terreno ?? null,
      uso_pat: t.uso_pat ?? null,
      ect: t.ect && ECT_VALIDOS.includes(t.ect) ? t.ect : null,
      valor_medido_ohm: t.valor_medido_ohm ?? null,
      valor_exigido_ohm: t.valor_exigido_ohm ?? null,
      cumple: t.cumple ?? null,
      continuidad: t.continuidad ?? null,
      capacidad_carga: t.capacidad_carga ?? null,
      proteccion: t.proteccion && PROTECCION_VALIDAS.includes(t.proteccion) ? t.proteccion : null,
      desconexion_automatica: t.desconexion_automatica ?? null,
      observaciones: t.observaciones ?? null,
      orden: t.orden ?? i,
    }))
    const { error: tomasErr } = await supabase.from('medicion_pat_tomas').insert(tomaRows)
    if (tomasErr) {
      await supabase.from('medicion_pat').delete().eq('id', medicionId)
      return { success: false, error: 'Error al guardar las tomas de tierra: ' + tomasErr.message }
    }
  }

  // ── 5. INSERT observaciones de seguimiento → pool común gestiones_observaciones
  // Replicado de crearMedicionIluminacion: mismo contrato de FormData (JSON
  // `observaciones_seguimiento` + fotos `obs-foto-{idx}`), misma forma de inserción
  // (registro_gestion_id + rg_fecha_planificada para que entren a Seguimiento) y
  // subida de fotos al bucket privado `documentos` con tenantStoragePath.
  // Son findings ADICIONALES a las tomas. NO se traga el error: si falla el insert,
  // devolvemos error (la medición ya quedó guardada, pero lo informamos).
  if (observacionesSeguimientoRaw) {
    let obsSeguimiento: ObsSeguimientoInput[] = []
    try {
      const parsed = JSON.parse(observacionesSeguimientoRaw)
      obsSeguimiento = Array.isArray(parsed) ? parsed : []
    } catch {
      return { success: false, error: 'Las observaciones de seguimiento tienen un formato inválido' }
    }

    const validas = obsSeguimiento.filter(o => o.descripcion?.trim() && o.categoria_id)
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
              console.error('[medicionPat] Error al subir foto de observación:', obsUploadError.message)
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
        console.error('[medicionPat] Error al insertar gestiones_observaciones:', obsError.message)
        return { success: false, error: 'La medición se guardó, pero no se pudieron registrar las observaciones de seguimiento: ' + obsError.message }
      }
    }
  }

  return { success: true, data: { medicionId } }
}

// ── Lectura completa: cabecera + tomas (vista + PDF) ───────────────────

/**
 * Trae una medición completa para la vista y el PDF: cabecera con joins a
 * establecimiento (→ empresa), instrumento, certificado, y por cada toma su sector.
 *
 * Devuelve el row tal como lo arma PostgREST (joins embebidos). Tipamos como
 * Record<string, unknown> porque la forma exacta la consume la vista/PDF.
 */
export async function getMedicionPat(
  medicionId: string
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!medicionId) return { success: false, error: 'ID de medición requerido' }

  const { data, error } = await supabase
    .from('medicion_pat')
    .select(`
      *,
      establecimientos (
        id, nombre, domicilio, codigo_postal,
        empresas (
          id, razon_social, cuit, domicilio, localidad_id, logo_destacado_url
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
      medicion_pat_tomas (
        *,
        establecimientos_sectores ( id, nombre )
      )
    `)
    .eq('id', medicionId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Medición no encontrada' }

  return { success: true, data: data as Record<string, unknown> }
}

// ── Catálogos para la UI ───────────────────────────────────────────────

export interface InstrumentoTelurimetro {
  id: string
  modelo: string
  numero_serie: string | null
  marca: string | null
}

/**
 * Lista los instrumentos tipo "Telurímetro" activos.
 *
 * SCOPING: `mediciones_instrumentos` NO tiene `consultora_id`. La RLS de SELECT
 * de esa tabla NO es por tenant — devuelve TODOS los instrumentos a cualquier
 * miembro activo de consultora. Es un catálogo global, igual que la página
 * /dashboard/instrumentos. Reutilizamos ESE criterio: filtramos por tipo
 * Telurímetro + activos y dejamos que la RLS global gobierne.
 */
export async function getInstrumentosPat(): Promise<ActionResult<InstrumentoTelurimetro[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('mediciones_instrumentos')
    .select('id, modelo, numero_serie, mediciones_instrumentos_tipos!inner(nombre), organizaciones_externas(nombre)')
    .eq('is_active', true)
    .eq('mediciones_instrumentos_tipos.nombre', 'Telurímetro')
    .order('modelo', { ascending: true })

  if (error) return { success: false, error: error.message }

  const result: InstrumentoTelurimetro[] = (data ?? []).map(r => {
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

export interface SectorConPuestos {
  id: string
  nombre: string
  puestos: Array<{ id: string; nombre: string }>
}

/**
 * Sectores del establecimiento (activos) con sus puestos de trabajo (activos).
 * Para que la UI arme el selector de sector de cada toma medida.
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
