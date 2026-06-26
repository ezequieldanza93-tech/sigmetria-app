'use server'

import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromEstablecimiento, tenantStoragePath } from '@/lib/storage/tenant-path'
import { aplicarSelloGeo } from '@/lib/actions/geo-sello'
import type { ActionResult } from '@/lib/types'

/**
 * Server actions del Protocolo de Estrés Térmico por Calor / Carga Térmica
 * (SRT 30/2023).
 *
 * El protocolo se ejecuta COMO gestión, igual que iluminación / ruido
 * (ver lib/actions/medicion-iluminacion.ts). Patrón replicado:
 *  - recibe el registro planificado (registro_id + rg_fecha_planificada) + establecimiento + gestion_establecimiento
 *  - sube adjuntos al bucket PRIVADO `documentos` con tenantStoragePath (guarda PATH, no URL)
 *  - flag `finalizar` (FormData): true cierra el protocolo (estado='finalizado',
 *    gestión Realizada → fecha_ejecutada/ejecutado_at + geo-sello). false guarda como
 *    BORRADOR re-editable (estado='borrador', la gestión NO queda Realizada).
 *  - UPSERT: si ya existe un borrador del mismo registro, lo UPDATE-a + DELETE de
 *    hijas (CASCADE) + re-INSERT. Un protocolo 'finalizado' NO se puede modificar.
 *  - INSERT cabecera + hijas (puestos → períodos → tareas) + observaciones → gestiones_observaciones
 *  - NO traga errores en silencio: si falla un insert crítico, rollback manual + { success:false }
 *
 * Anidamiento PROFUNDO: cabecera → puestos (por trabajador/GHE) → períodos (60 min) → tareas.
 */

// ── Input tipado de los hijos (vienen del FormData como JSON) ──────────

interface TareaInput {
  numero?: number | null
  descripcion?: string | null
  tiempo_min?: number | null
  tm_w?: number | null
  tgbh?: number | null
  var?: number | null
  orden?: number | null
}

interface PeriodoInput {
  numero?: number | null
  hora_inicio?: string | null
  exterior?: boolean | null
  tgbh_ponderado?: number | null
  tm_ponderado?: number | null
  var_ponderado?: number | null
  tgbhef?: number | null
  vlp?: number | null
  vla?: number | null
  supera_vlp?: boolean | null
  supera_vla?: boolean | null
  // Flag propio de la columna "VLP Aclimatado" (Planilla B): umbral del personal
  // aclimatado (curva VLA), distinto de supera_vlp (no-aclimatado).
  supera_vlp_aclimatado?: boolean | null
  regimen_ft?: number | null
  info_adicional?: string | null
  orden?: number | null
  tareas?: TareaInput[]
}

interface PuestoInput {
  nombre_puesto?: string | null
  ambiente_homogeneo?: boolean | null
  altura_medicion?: number | null
  tipo_fuente?: string | null
  trabajador?: string | null
  trabajador_persona_id?: string | null
  ghe?: boolean | null
  aclimatado?: boolean | null
  conclusion?: string | null
  orden?: number | null
  periodos?: PeriodoInput[]
}

// Observación de seguimiento (finding adicional). Mismo contrato que iluminación:
// viene del FormData como JSON `observaciones_seguimiento`; las fotos llegan como
// `obs-foto-{idx}` File.
interface ObsSeguimientoInput {
  descripcion: string
  categoria_id: string
  clasificacion_id?: string | null
  responsable_id?: string | null
  fecha_subsanacion?: string | null
  tiene_foto?: boolean
}

/**
 * EJECUTOR del Protocolo de Carga Térmica desde una fila planificada.
 *
 * Lee del FormData:
 *  - registro_id / rg_fecha_planificada / establecimiento_id / gestion_establecimiento_id?
 *  - instrumento_id? / certificado_id? / firmante? (texto libre)
 *  - fecha_medicion / fecha_medicion_fin? / hora_inicio / hora_fin / turnos?
 *  - condiciones atmosféricas: fuente_datos_atm / atm_temp_max / atm_temp_min / atm_humedad / atm_presion / atm_viento
 *  - condiciones_puesto / representante_trabajadores / representante_empresa / observaciones
 *  - conclusiones_aclimatado / conclusiones_no_aclimatado / recomendaciones
 *  - certificado / plano → File? (suben a `documentos`, guarda PATH)
 *  - puestos → JSON: array de PuestoInput (cada uno con sus períodos, cada período con sus tareas)
 *  - observaciones_seguimiento → JSON (findings adicionales → gestiones_observaciones)
 */
export async function crearMedicionCargaTermica(
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
  const fechaMedicion = (formData.get('fecha_medicion') as string) || null
  const fechaMedicionFin = (formData.get('fecha_medicion_fin') as string) || null
  const horaInicio = (formData.get('hora_inicio') as string) || null
  const horaFin = (formData.get('hora_fin') as string) || null
  const turnos = (formData.get('turnos') as string) || null
  const fuenteDatosAtm = (formData.get('fuente_datos_atm') as string) || null
  const atmTempMax = parseNum(formData.get('atm_temp_max') as string | null)
  const atmTempMin = parseNum(formData.get('atm_temp_min') as string | null)
  const atmHumedad = parseNum(formData.get('atm_humedad') as string | null)
  const atmPresion = parseNum(formData.get('atm_presion') as string | null)
  const atmViento = (formData.get('atm_viento') as string) || null
  const condicionesPuesto = (formData.get('condiciones_puesto') as string) || null
  const representanteTrabajadores = (formData.get('representante_trabajadores') as string) || null
  const representanteTrabajadoresPersonaId = (formData.get('representante_trabajadores_persona_id') as string) || null
  const representanteEmpresa = (formData.get('representante_empresa') as string) || null
  const representanteEmpresaPersonaId = (formData.get('representante_empresa_persona_id') as string) || null
  const observaciones = (formData.get('observaciones') as string) || null
  const conclusionesAclimatado = (formData.get('conclusiones_aclimatado') as string) || null
  const conclusionesNoAclimatado = (formData.get('conclusiones_no_aclimatado') as string) || null
  const recomendaciones = (formData.get('recomendaciones') as string) || null
  const certificadoFile = formData.get('certificado') as File | null
  const planoFile = formData.get('plano') as File | null
  const puestosRaw = (formData.get('puestos') as string) || '[]'
  const observacionesSeguimientoRaw = (formData.get('observaciones_seguimiento') as string) || null

  // Flag de cierre: 'true' => finaliza el protocolo (queda cerrado e inmutable y la
  // gestión pasa a Realizada). 'false'/ausente => guarda como BORRADOR re-editable
  // (la gestión NO se marca Realizada).
  const finalizar = (formData.get('finalizar') as string) === 'true'
  const estado: 'borrador' | 'finalizado' = finalizar ? 'finalizado' : 'borrador'

  if (!registroId) return { success: false, error: 'Registro requerido' }
  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }

  // Parseo de puestos (con períodos y tareas). El contenido del protocolo son los
  // puestos: si el JSON viene roto es un error crítico.
  let puestos: PuestoInput[] = []
  try {
    const parsed = JSON.parse(puestosRaw)
    puestos = Array.isArray(parsed) ? parsed : []
  } catch {
    return { success: false, error: 'Los puestos medidos tienen un formato inválido' }
  }

  // El path de un bucket PRIVADO debe empezar con el consultora_id para que la RLS
  // de lectura por tenant matchee (ver lib/storage/tenant-path.ts).
  const consultoraId = await consultoraIdFromEstablecimiento(supabase, establecimientoId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del establecimiento' }

  // ── Validación de firmante: debe ser la persona del usuario logueado ──
  // El selector preselecciona y bloquea (readOnly) la persona del usuario
  // (profiles.persona_id). Acá lo verificamos server-side: nadie puede firmar
  // por otro. Si llegó un firmante distinto al del perfil, rechazamos.
  if (firmantePersonaId) {
    const { data: perfil } = await supabase
      .from('profiles')
      .select('persona_id')
      .eq('id', user.id)
      .maybeSingle()
    if (!perfil?.persona_id || perfil.persona_id !== firmantePersonaId) {
      return { success: false, error: 'Solo podés firmar el protocolo con tu propia persona' }
    }
  }

  // ── EDICIÓN / UPSERT: ¿ya existe una medición para este registro? ─────
  // Buscamos la cabecera existente del mismo registro (mismo registro_gestion_id +
  // rg_fecha_planificada). Si está 'finalizado' NO se puede tocar. Si es 'borrador'
  // re-guardamos sobre ella (UPDATE cabecera + DELETE hijas → re-INSERT) para que el
  // técnico pueda seguir editando donde dejó y luego finalizar.
  let existenteQuery = supabase
    .from('medicion_carga_termica')
    .select('id, estado')
    .eq('registro_gestion_id', registroId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
  if (rgFechaPlanificada) existenteQuery = existenteQuery.eq('rg_fecha_planificada', rgFechaPlanificada)
  const { data: existente, error: existenteErr } = await existenteQuery.maybeSingle()
  if (existenteErr) return { success: false, error: 'Error al verificar el protocolo existente: ' + existenteErr.message }
  if (existente && existente.estado === 'finalizado') {
    return { success: false, error: 'El protocolo ya fue finalizado y no se puede modificar' }
  }
  const medicionExistenteId = existente ? (existente.id as string) : null

  const ts = Date.now()

  // ── 1. Subir adjuntos opcionales (certificado / plano) → guardamos PATH, no URL ──
  let certificadoUrl: string | null = null
  if (certificadoFile && certificadoFile.size > 0) {
    const ext = certificadoFile.name.split('.').pop() ?? 'pdf'
    const path = tenantStoragePath(consultoraId, 'mediciones-carga-termica', establecimientoId, `${ts}-certificado.${ext}`)
    const { data: up, error: upErr } = await supabase.storage
      .from('documentos')
      .upload(path, certificadoFile, { upsert: false })
    if (upErr) return { success: false, error: 'Error al subir el certificado: ' + upErr.message }
    certificadoUrl = up.path
  }

  let planoUrl: string | null = null
  if (planoFile && planoFile.size > 0) {
    const ext = planoFile.name.split('.').pop() ?? 'pdf'
    const path = tenantStoragePath(consultoraId, 'mediciones-carga-termica', establecimientoId, `${ts}-plano.${ext}`)
    const { data: up, error: upErr } = await supabase.storage
      .from('documentos')
      .upload(path, planoFile, { upsert: false })
    if (upErr) return { success: false, error: 'Error al subir el plano: ' + upErr.message }
    planoUrl = up.path
  }

  // ── 2. UPDATE del registro planificado ──────────────────────────────
  // Fecha de ejecución = HOY por componentes locales (sin drift UTC de toISOString).
  const now = new Date()
  const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  // Solo al FINALIZAR la gestión queda Realizada (fecha_ejecutada + ejecutado_at).
  // En BORRADOR NO se tocan esos campos: el plan sigue mostrando la gestión pendiente.
  if (finalizar) {
    let regUpdate = supabase
      .from('gestiones_registros')
      // ejecutado_at = now(): hora real de finalización de la medición (queda Realizado).
      .update({ fecha_ejecutada: hoy, ejecutado_at: new Date().toISOString() })
      .eq('id', registroId)
    if (rgFechaPlanificada) regUpdate = regUpdate.eq('fecha_planificada', rgFechaPlanificada)
    const { data: regRow, error: regErr } = await regUpdate.select('fecha_planificada').single()
    if (regErr) return { success: false, error: 'Error al actualizar el registro: ' + regErr.message }

    // Geo-sello del lugar de ejecución. Usamos la fecha_planificada autoritativa del
    // registro (clave de partición). NO-BLOQUEANTE. Solo al finalizar.
    await aplicarSelloGeo(supabase, registroId, regRow.fecha_planificada as string, formData)
  }

  // ── 3. UPSERT cabecera ──────────────────────────────────────────────
  // Campos comunes a INSERT (alta) y UPDATE (re-guardado de borrador). Para no perder
  // un adjunto previo cuando NO se sube uno nuevo en la re-edición, solo pisamos
  // certificado_url/plano_url si llegó un archivo nuevo (certificadoUrl/planoUrl != null).
  const cabeceraData = {
    consultora_id: consultoraId,
    establecimiento_id: establecimientoId,
    registro_gestion_id: registroId,
    rg_fecha_planificada: rgFechaPlanificada,
    gestion_establecimiento_id: gestionEstablecimientoId,
    instrumento_id: instrumentoId,
    certificado_id: certificadoId,
    firmante,
    firmante_persona_id: firmantePersonaId,
    fecha_medicion: fechaMedicion,
    fecha_medicion_fin: fechaMedicionFin,
    hora_inicio: horaInicio,
    hora_fin: horaFin,
    turnos,
    fuente_datos_atm: fuenteDatosAtm,
    atm_temp_max: atmTempMax,
    atm_temp_min: atmTempMin,
    atm_humedad: atmHumedad,
    atm_presion: atmPresion,
    atm_viento: atmViento,
    condiciones_puesto: condicionesPuesto,
    representante_trabajadores: representanteTrabajadores,
    representante_trabajadores_persona_id: representanteTrabajadoresPersonaId,
    representante_empresa: representanteEmpresa,
    representante_empresa_persona_id: representanteEmpresaPersonaId,
    observaciones,
    conclusiones_aclimatado: conclusionesAclimatado,
    conclusiones_no_aclimatado: conclusionesNoAclimatado,
    recomendaciones,
    estado,
  }

  let medicionId: string
  if (medicionExistenteId) {
    // Re-guardado de un BORRADOR existente: UPDATE cabecera + limpieza de hijas.
    const updatePayload: Record<string, unknown> = { ...cabeceraData }
    // Adjuntos: solo se pisan si se subió uno nuevo en esta edición.
    if (certificadoUrl != null) updatePayload.certificado_url = certificadoUrl
    if (planoUrl != null) updatePayload.plano_url = planoUrl
    const { error: updErr } = await supabase
      .from('medicion_carga_termica')
      .update(updatePayload)
      .eq('id', medicionExistenteId)
    if (updErr) return { success: false, error: 'Error al actualizar la medición: ' + updErr.message }
    medicionId = medicionExistenteId

    // DELETE de las filas hijas (puestos). El ON DELETE CASCADE limpia períodos y
    // tareas. Re-insertamos a continuación con el contenido actual del wizard.
    const { error: delErr } = await supabase
      .from('medicion_carga_termica_puestos')
      .delete()
      .eq('medicion_id', medicionId)
    if (delErr) return { success: false, error: 'Error al limpiar los puestos previos: ' + delErr.message }
  } else {
    // Alta nueva.
    const { data: cabecera, error: cabErr } = await supabase
      .from('medicion_carga_termica')
      .insert({
        ...cabeceraData,
        certificado_url: certificadoUrl,
        plano_url: planoUrl,
      })
      .select('id')
      .single()
    if (cabErr) return { success: false, error: 'Error al crear la medición: ' + cabErr.message }
    medicionId = cabecera.id as string
  }

  // ── 4. INSERT puestos → períodos → tareas ───────────────────────────
  // Inserción en cascada. Si algo falla en un ALTA nueva, rollback manual de la
  // cabecera (ON DELETE CASCADE limpia puestos/períodos/tareas ya insertados). En
  // un RE-GUARDADO de borrador NO borramos la cabecera (perderíamos el borrador):
  // dejamos lo insertado y devolvemos el error para que el técnico reintente.
  const rollbackCabecera = async () => {
    if (!medicionExistenteId) {
      await supabase.from('medicion_carga_termica').delete().eq('id', medicionId)
    }
  }
  for (let i = 0; i < puestos.length; i++) {
    const pu = puestos[i]
    const { data: puesto, error: puErr } = await supabase
      .from('medicion_carga_termica_puestos')
      .insert({
        medicion_id: medicionId,
        nombre_puesto: pu.nombre_puesto ?? null,
        ambiente_homogeneo: pu.ambiente_homogeneo ?? null,
        altura_medicion: pu.altura_medicion ?? null,
        tipo_fuente: pu.tipo_fuente ?? null,
        trabajador: pu.trabajador ?? null,
        trabajador_persona_id: pu.trabajador_persona_id ?? null,
        ghe: pu.ghe ?? null,
        aclimatado: pu.aclimatado ?? null,
        conclusion: pu.conclusion ?? null,
        orden: pu.orden ?? i,
      })
      .select('id')
      .single()
    if (puErr) {
      await rollbackCabecera()
      return { success: false, error: 'Error al guardar un puesto: ' + puErr.message }
    }

    const periodos = Array.isArray(pu.periodos) ? pu.periodos : []
    for (let j = 0; j < periodos.length; j++) {
      const per = periodos[j]
      const { data: periodo, error: perErr } = await supabase
        .from('medicion_carga_termica_periodos')
        .insert({
          puesto_id: puesto.id as string,
          numero: per.numero ?? j + 1,
          hora_inicio: per.hora_inicio || null,
          exterior: per.exterior ?? null,
          tgbh_ponderado: per.tgbh_ponderado ?? null,
          tm_ponderado: per.tm_ponderado ?? null,
          var_ponderado: per.var_ponderado ?? null,
          tgbhef: per.tgbhef ?? null,
          vlp: per.vlp ?? null,
          vla: per.vla ?? null,
          supera_vlp: per.supera_vlp ?? null,
          supera_vla: per.supera_vla ?? null,
          supera_vlp_aclimatado: per.supera_vlp_aclimatado ?? null,
          regimen_ft: per.regimen_ft ?? null,
          info_adicional: per.info_adicional ?? null,
          orden: per.orden ?? j,
        })
        .select('id')
        .single()
      if (perErr) {
        await rollbackCabecera()
        return { success: false, error: 'Error al guardar un período: ' + perErr.message }
      }

      const tareas = Array.isArray(per.tareas) ? per.tareas : []
      if (tareas.length > 0) {
        const tareaRows = tareas.map((t, k) => ({
          periodo_id: periodo.id as string,
          numero: t.numero ?? k + 1,
          descripcion: t.descripcion ?? null,
          tiempo_min: t.tiempo_min ?? null,
          tm_w: t.tm_w ?? null,
          tgbh: t.tgbh ?? null,
          var: t.var ?? null,
          orden: t.orden ?? k,
        }))
        const { error: tarErr } = await supabase
          .from('medicion_carga_termica_tareas')
          .insert(tareaRows)
        if (tarErr) {
          await rollbackCabecera()
          return { success: false, error: 'Error al guardar las tareas de un período: ' + tarErr.message }
        }
      }
    }
  }

  // ── 5. INSERT observaciones de seguimiento → pool común gestiones_observaciones
  // Replicado de crearMedicionIluminacion: mismo contrato de FormData y forma de
  // inserción (registro_gestion_id + rg_fecha_planificada para que entren a Seguimiento).
  //
  // Las observaciones de seguimiento SOLO se insertan al FINALIZAR (no en borrador):
  // viven en el pool gestiones_observaciones (Seguimiento), NO son hijas con CASCADE del
  // protocolo y el wizard no las re-hidrata, así que insertarlas en cada "Guardar borrador"
  // las DUPLICARÍA en Seguimiento. Mismo criterio que crearMedicionIluminacion.
  if (finalizar && observacionesSeguimientoRaw) {
    let observacionesSeg: ObsSeguimientoInput[] = []
    try {
      const parsed = JSON.parse(observacionesSeguimientoRaw)
      observacionesSeg = Array.isArray(parsed) ? parsed : []
    } catch {
      return { success: false, error: 'Las observaciones de seguimiento tienen un formato inválido' }
    }

    const validas = observacionesSeg.filter(o => o.descripcion?.trim() && o.categoria_id)
    if (validas.length > 0) {
      const rows = await Promise.all(validas.map(async (o, idx) => {
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
              console.error('[medicionCargaTermica] Error al subir foto de observación:', obsUploadError.message)
            } else if (obsUp) {
              foto_url = obsUp.path
            }
          }
        }
        return {
          registro_gestion_id: registroId,
          rg_fecha_planificada: rgFechaPlanificada,
          descripcion: o.descripcion.trim(),
          categoria_id: o.categoria_id,
          clasificacion_id: o.clasificacion_id || null,
          responsable_id: o.responsable_id || null,
          fecha_planificada: o.fecha_subsanacion || hoy,
          foto_url,
        }
      }))
      const { error: obsError } = await supabase.from('gestiones_observaciones').insert(rows)
      if (obsError) {
        console.error('[medicionCargaTermica] Error al insertar gestiones_observaciones:', obsError.message)
        return { success: false, error: 'La medición se guardó, pero no se pudieron registrar las observaciones de seguimiento: ' + obsError.message }
      }
    }
  }

  return { success: true, data: { medicionId } }
}

// ── Lectura completa: cabecera + puestos + períodos + tareas (vista + PDF) ──

/**
 * Trae una medición completa para la vista y el PDF: cabecera con joins a
 * establecimiento (→ empresa), instrumento, certificado, y por cada puesto sus
 * períodos con sus tareas.
 */
export async function getMedicionCargaTermica(
  medicionId: string
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!medicionId) return { success: false, error: 'ID de medición requerido' }

  const { data, error } = await supabase
    .from('medicion_carga_termica')
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
        productos_componentes ( nombre ),
        organizaciones_externas ( nombre )
      ),
      certificados_calibracion (
        id, fecha_emision, fecha_vencimiento, certificado_url
      ),
      medicion_carga_termica_puestos (
        *,
        medicion_carga_termica_periodos (
          *,
          medicion_carga_termica_tareas ( * )
        )
      )
    `)
    .eq('id', medicionId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Medición no encontrada' }

  return { success: true, data: data as Record<string, unknown> }
}

// ── Catálogos para la UI ───────────────────────────────────────────────

export interface InstrumentoCargaTermica {
  id: string
  modelo: string
  numero_serie: string | null
  marca: string | null
}

/**
 * Lista los instrumentos tipo "Monitor de Estrés Térmico" activos.
 *
 * SCOPING idéntico a getInstrumentosLuxometro: `mediciones_instrumentos` NO tiene
 * `consultora_id`; la RLS de SELECT no es por tenant (catálogo global). Filtramos
 * por tipo + activos y dejamos que la RLS global gobierne.
 */
export async function getInstrumentosCargaTermica(): Promise<ActionResult<InstrumentoCargaTermica[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('mediciones_instrumentos')
    .select('id, modelo, numero_serie, productos_componentes!inner(nombre), organizaciones_externas(nombre)')
    .eq('is_active', true)
    .eq('productos_componentes.nombre', 'Carga Térmica')
    .order('modelo', { ascending: true })

  if (error) return { success: false, error: error.message }

  const result: InstrumentoCargaTermica[] = (data ?? []).map(r => {
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

export interface VarRopaOption {
  id: string
  tipo_ropa: string
  var: number
  orden: number | null
}

/** Lookup VAR (valor de adición por ropa) — Tabla 1 del instructivo SRT 30/2023. */
export async function getVarRopa(): Promise<ActionResult<VarRopaOption[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ct_var_ropa')
    .select('id, tipo_ropa, var, orden')
    .order('orden', { ascending: true })

  if (error) return { success: false, error: error.message }

  const result: VarRopaOption[] = (data ?? []).map(r => ({
    id: r.id as string,
    tipo_ropa: r.tipo_ropa as string,
    var: Number(r.var),
    orden: (r.orden as number | null) ?? null,
  }))
  return { success: true, data: result }
}

export interface TmActividadOption {
  id: string
  actividad: string
  tm_w: number
  orden: number | null
}

/** Lookup tasa metabólica (W) por actividad — Tablas 4 y 5 del instructivo SRT 30/2023. */
export async function getTmActividad(): Promise<ActionResult<TmActividadOption[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('ct_tm_actividad')
    .select('id, actividad, tm_w, orden')
    .order('orden', { ascending: true })

  if (error) return { success: false, error: error.message }

  const result: TmActividadOption[] = (data ?? []).map(r => ({
    id: r.id as string,
    actividad: r.actividad as string,
    tm_w: Number(r.tm_w),
    orden: (r.orden as number | null) ?? null,
  }))
  return { success: true, data: result }
}

export interface SectorConPuestos {
  id: string
  nombre: string
  puestos: Array<{ id: string; nombre: string }>
}

/**
 * Sectores del establecimiento (activos) con sus puestos de trabajo (activos).
 * Mismo helper que iluminación: alimenta los selectores de la UI.
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

// ── Helper de parseo numérico tolerante ────────────────────────────────
function parseNum(v: string | null): number | null {
  if (v == null || v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
