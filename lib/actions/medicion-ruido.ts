'use server'

import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromEstablecimiento, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'

/**
 * Server actions del Protocolo de Medición de Ruido (SRT 85/2012 — Res 295/03 Anexo V).
 *
 * El protocolo se ejecuta COMO gestión, igual que el reporte fotográfico y la
 * medición de iluminación (ver lib/actions/medicion-iluminacion.ts). Patrón replicado:
 *  - recibe el registro planificado (registro_id + rg_fecha_planificada) + establecimiento + gestion_establecimiento
 *  - sube adjuntos al bucket PRIVADO `documentos` con tenantStoragePath (guarda PATH, no URL)
 *  - UPDATE gestiones_registros.fecha_ejecutada = hoy
 *  - INSERT cabecera + hijas (puntos + períodos)
 *  - NO traga errores en silencio: si falla un insert crítico, rollback manual + { success:false }
 *  - el firmante es TEXTO LIBRE (columna firmante), no un FK a perfiles_profesionales
 */

// ── Input tipado de los hijos (vienen del FormData como JSON) ──────────

interface PeriodoInput {
  laeq_dba: number
  tiempo_exposicion_horas: number
  orden?: number | null
}

interface PuntoInput {
  sector_id?: string | null
  puesto_id?: string | null
  tipo_puesto?: 'puesto' | 'puesto_tipo' | 'movil' | null
  te_horas?: number | null
  tiempo_integracion?: string | null
  caracteristicas_ruido?: 'continuo' | 'intermitente' | 'impacto' | null
  lcpico_dbc?: number | null
  metodo?: 'dosimetro' | 'sonometro' | null
  dosis_pct?: number | null
  laeq_dba?: number | null
  suma_fracciones?: number | null
  cumple?: boolean | null
  info_adicional?: string | null
  orden?: number | null
  periodos?: PeriodoInput[]
}

/**
 * EJECUTOR del Protocolo de Medición de Ruido desde una fila planificada.
 *
 * Lee del FormData:
 *  - registro_id                  → gestiones_registros que se ejecuta (UPDATE)
 *  - rg_fecha_planificada         → compañera de la FK compuesta del registro particionado
 *  - establecimiento_id           → tenant + RLS
 *  - gestion_establecimiento_id   → vínculo a la gestión del establecimiento (opcional)
 *  - instrumento_id?              → sonómetro/dosímetro/decibelímetro usado (FK opcional)
 *  - certificado_id?              → certificado de calibración del instrumento (FK opcional)
 *  - firmante?                    → profesional firmante del protocolo (texto libre: nombre y matrícula)
 *  - fecha_medicion               → date (YYYY-MM-DD)
 *  - fecha_medicion_fin?          → date (YYYY-MM-DD)
 *  - hora_inicio / hora_fin       → time (HH:MM)
 *  - jornada_horas?               → numeric
 *  - turnos                       → texto
 *  - condiciones_normales         → texto
 *  - condiciones_medicion         → texto
 *  - conclusiones / recomendaciones / observaciones → texto
 *  - certificado                  → File? (adjunto, sube a `documentos`, guarda PATH en certificado_url)
 *  - plano                        → File? (adjunto, sube a `documentos`, guarda PATH en plano_url)
 *  - puntos                       → JSON: array de PuntoInput (cada uno con sus períodos)
 */
export async function crearMedicionRuido(
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
  const fechaMedicion = (formData.get('fecha_medicion') as string) || null
  const fechaMedicionFin = (formData.get('fecha_medicion_fin') as string) || null
  const horaInicio = (formData.get('hora_inicio') as string) || null
  const horaFin = (formData.get('hora_fin') as string) || null
  const jornadaHorasRaw = (formData.get('jornada_horas') as string) || null
  const turnos = (formData.get('turnos') as string) || null
  const condicionesNormales = (formData.get('condiciones_normales') as string) || null
  const condicionesMedicion = (formData.get('condiciones_medicion') as string) || null
  const conclusiones = (formData.get('conclusiones') as string) || null
  const recomendaciones = (formData.get('recomendaciones') as string) || null
  const observaciones = (formData.get('observaciones') as string) || null
  const certificadoFile = formData.get('certificado') as File | null
  const planoFile = formData.get('plano') as File | null
  const puntosRaw = (formData.get('puntos') as string) || '[]'

  if (!registroId) return { success: false, error: 'Registro requerido' }
  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }

  // jornada_horas es numeric: parseamos; si viene vacío/roto → null.
  const jornadaHoras = jornadaHorasRaw != null && jornadaHorasRaw !== '' && Number.isFinite(Number(jornadaHorasRaw))
    ? Number(jornadaHorasRaw)
    : null

  // Parseo de puntos (con sus períodos). Si el JSON viene roto es un error crítico:
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
    const path = tenantStoragePath(consultoraId, 'mediciones-ruido', establecimientoId, `${ts}-certificado.${ext}`)
    const { data: up, error: upErr } = await supabase.storage
      .from('documentos')
      .upload(path, certificadoFile, { upsert: false })
    if (upErr) return { success: false, error: 'Error al subir el certificado: ' + upErr.message }
    certificadoUrl = up.path
  }

  let planoUrl: string | null = null
  if (planoFile && planoFile.size > 0) {
    const ext = planoFile.name.split('.').pop() ?? 'pdf'
    const path = tenantStoragePath(consultoraId, 'mediciones-ruido', establecimientoId, `${ts}-plano.${ext}`)
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
    .from('medicion_ruido')
    .insert({
      consultora_id: consultoraId,
      establecimiento_id: establecimientoId,
      registro_gestion_id: registroId,
      rg_fecha_planificada: rgFechaPlanificada,
      gestion_establecimiento_id: gestionEstablecimientoId,
      instrumento_id: instrumentoId,
      certificado_id: certificadoId,
      firmante,
      fecha_medicion: fechaMedicion,
      fecha_medicion_fin: fechaMedicionFin,
      hora_inicio: horaInicio,
      hora_fin: horaFin,
      jornada_horas: jornadaHoras,
      turnos,
      condiciones_normales: condicionesNormales,
      condiciones_medicion: condicionesMedicion,
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

  // ── 4. INSERT puntos + períodos ─────────────────────────────────────
  // Cada punto se inserta y luego se cuelgan sus períodos (método sonómetro).
  // Si algo falla, rollback manual de la cabecera (ON DELETE CASCADE limpia
  // puntos/períodos ya insertados) y devolvemos error en vez de tragarlo.
  for (let i = 0; i < puntos.length; i++) {
    const p = puntos[i]
    const { data: punto, error: puntoErr } = await supabase
      .from('medicion_ruido_puntos')
      .insert({
        medicion_id: medicionId,
        sector_id: p.sector_id || null,
        puesto_id: p.puesto_id || null,
        tipo_puesto: p.tipo_puesto ?? null,
        te_horas: p.te_horas ?? null,
        tiempo_integracion: p.tiempo_integracion ?? null,
        caracteristicas_ruido: p.caracteristicas_ruido ?? null,
        lcpico_dbc: p.lcpico_dbc ?? null,
        metodo: p.metodo ?? null,
        dosis_pct: p.dosis_pct ?? null,
        laeq_dba: p.laeq_dba ?? null,
        suma_fracciones: p.suma_fracciones ?? null,
        cumple: p.cumple ?? null,
        info_adicional: p.info_adicional ?? null,
        orden: p.orden ?? i,
      })
      .select('id')
      .single()
    if (puntoErr) {
      await supabase.from('medicion_ruido').delete().eq('id', medicionId)
      return { success: false, error: 'Error al guardar un punto de medición: ' + puntoErr.message }
    }

    const periodos = Array.isArray(p.periodos) ? p.periodos : []
    if (periodos.length > 0) {
      const periodoRows = periodos.map((per, j) => ({
        punto_id: punto.id as string,
        laeq_dba: per.laeq_dba,
        tiempo_exposicion_horas: per.tiempo_exposicion_horas,
        orden: per.orden ?? j,
      }))
      const { error: periodosErr } = await supabase
        .from('medicion_ruido_periodos')
        .insert(periodoRows)
      if (periodosErr) {
        await supabase.from('medicion_ruido').delete().eq('id', medicionId)
        return { success: false, error: 'Error al guardar los períodos de un punto: ' + periodosErr.message }
      }
    }
  }

  return { success: true, data: { medicionId } }
}

// ── Lectura completa: cabecera + puntos + períodos (vista + PDF) ───────

/**
 * Trae una medición de ruido completa para la vista y el PDF: cabecera con joins
 * a establecimiento (→ empresa: razón social/CUIT/domicilio/localidad), instrumento
 * (marca/modelo/serie), certificado, y por cada punto su sector/puesto + períodos.
 *
 * Devuelve el row tal como lo arma PostgREST (joins embebidos). Tipamos como
 * unknown-amigable porque la forma exacta la consume la vista/PDF.
 */
export async function getMedicionRuido(
  medicionId: string
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!medicionId) return { success: false, error: 'ID de medición requerido' }

  const { data, error } = await supabase
    .from('medicion_ruido')
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
      medicion_ruido_puntos (
        *,
        establecimientos_sectores ( id, nombre ),
        puestos_de_trabajo ( id, nombre ),
        medicion_ruido_periodos ( id, laeq_dba, tiempo_exposicion_horas, orden )
      )
    `)
    .eq('id', medicionId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Medición no encontrada' }

  return { success: true, data: data as Record<string, unknown> }
}

// ── Catálogos para la UI ───────────────────────────────────────────────

export interface InstrumentoRuido {
  id: string
  modelo: string
  numero_serie: string | null
  marca: string | null
  tipo: string | null
}

/**
 * Lista los instrumentos de ruido (tipo Sonómetro / Dosímetro / Decibelímetro) activos.
 *
 * SCOPING: `mediciones_instrumentos` NO tiene `consultora_id`. La RLS de SELECT
 * de esa tabla NO es por tenant — devuelve TODOS los instrumentos a cualquier
 * miembro activo de consultora. Es un catálogo global, igual que la página
 * /dashboard/instrumentos. Replicamos el criterio de getInstrumentosLuxometro de
 * Iluminación: filtramos por tipo + activos y dejamos que la RLS global gobierne.
 */
export async function getInstrumentosRuido(): Promise<ActionResult<InstrumentoRuido[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('mediciones_instrumentos')
    .select('id, modelo, numero_serie, mediciones_instrumentos_tipos!inner(nombre), organizaciones_externas(nombre)')
    .eq('is_active', true)
    .in('mediciones_instrumentos_tipos.nombre', ['Sonómetro', 'Dosímetro', 'Decibelímetro'])
    .order('modelo', { ascending: true })

  if (error) return { success: false, error: error.message }

  const result: InstrumentoRuido[] = (data ?? []).map(r => {
    const marca = r.organizaciones_externas as { nombre: string } | { nombre: string }[] | null
    const marcaRow = Array.isArray(marca) ? marca[0] : marca
    const tipo = r.mediciones_instrumentos_tipos as { nombre: string } | { nombre: string }[] | null
    const tipoRow = Array.isArray(tipo) ? tipo[0] : tipo
    return {
      id: r.id as string,
      modelo: r.modelo as string,
      numero_serie: (r.numero_serie as string | null) ?? null,
      marca: marcaRow?.nombre ?? null,
      tipo: tipoRow?.nombre ?? null,
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
 *
 * Réplica de getSectoresYPuestos de Iluminación: ese módulo vive en otra rama
 * (feat/medicion-iluminacion) y no está disponible para importar acá, así que
 * replicamos la versión idéntica.
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
