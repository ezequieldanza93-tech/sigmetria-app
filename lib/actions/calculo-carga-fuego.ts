'use server'

import { createClient } from '@/lib/supabase/server'
import { consultoraIdFromEstablecimiento, tenantStoragePath } from '@/lib/storage/tenant-path'
import { aplicarSelloGeo } from '@/lib/actions/geo-sello'
import type { ActionResult } from '@/lib/types'

/**
 * Server actions del Cálculo de Carga de Fuego (Dec 351/79 Anexo VII).
 *
 * El cálculo se ejecuta COMO gestión, igual que el reporte fotográfico y la
 * medición de iluminación (ver lib/actions/medicion-iluminacion.ts). Patrón
 * replicado:
 *  - recibe el registro planificado (registro_id + rg_fecha_planificada) +
 *    establecimiento + gestion_establecimiento
 *  - sube adjuntos al bucket PRIVADO `documentos` con tenantStoragePath (guarda PATH)
 *  - UPDATE gestiones_registros.fecha_ejecutada = hoy
 *  - INSERT cabecera + hijos (materiales) + observaciones de seguimiento
 *  - NO traga errores en silencio: si falla un insert crítico, rollback manual +
 *    { success:false }
 *
 * Diferencia con ruido/iluminación: NO hay instrumento de medición — es un
 * cálculo por inventario, no una medición. Por eso no recibe instrumento_id ni
 * certificado_id.
 */

// ── Input tipado de los hijos (vienen del FormData como JSON) ──────────

interface MaterialInput {
  descripcion?: string | null
  estado?: string | null
  peso_kg?: number | null
  pci_kcal?: number | null
  coef_c?: number | null
  equiv_madera_kg?: number | null
  orden?: number | null
}

// Observación de seguimiento (finding adicional al cálculo). Mismo contrato que
// crearMedicionIluminacion: viene del FormData como JSON `observaciones_seguimiento`;
// las fotos llegan como `obs-foto-{idx}` File.
interface ObsSeguimientoInput {
  descripcion: string
  categoria_id: string
  clasificacion_id?: string | null
  responsable_id?: string | null
  fecha_subsanacion?: string | null
  tiene_foto?: boolean
}

/**
 * EJECUTOR del Cálculo de Carga de Fuego desde una fila planificada.
 *
 * Lee del FormData:
 *  - registro_id                  → gestiones_registros que se ejecuta (UPDATE)
 *  - rg_fecha_planificada         → compañera de la FK compuesta del registro particionado
 *  - establecimiento_id           → tenant + RLS
 *  - gestion_establecimiento_id?  → vínculo a la gestión del establecimiento (opcional)
 *  - firmante?                    → profesional firmante como texto (snapshot derivado de la persona; se conserva para el PDF y compatibilidad)
 *  - firmante_persona_id?         → profesional firmante elegido del directorio (FK personas_directorio, opcional)
 *  - sector_incendio?             → texto
 *  - superficie_m2?               → numeric
 *  - ventilacion?                 → 'natural' | 'mecanica'
 *  - riesgo?                      → 'R1'..'R7'
 *  - qf_kg_m2?                    → carga de fuego calculada (Σ equiv / S)
 *  - f_exigido?                   → resistencia al fuego exigida (lookup)
 *  - potencial_extintor_a/b?      → potencial extintor exigido (lookup)
 *  - observaciones / conclusiones / recomendaciones → texto
 *  - certificado / plano          → File? (adjunto, sube a `documentos`, guarda PATH)
 *  - materiales                   → JSON: array de MaterialInput
 *  - observaciones_seguimiento    → JSON: array de ObsSeguimientoInput (+ fotos obs-foto-{idx})
 */
export async function crearCalculoCargaFuego(
  formData: FormData
): Promise<ActionResult<{ calculoId: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const registroId = (formData.get('registro_id') as string) || ''
  const rgFechaPlanificada = (formData.get('rg_fecha_planificada') as string) || null
  const establecimientoId = (formData.get('establecimiento_id') as string) || ''
  const gestionEstablecimientoId = (formData.get('gestion_establecimiento_id') as string) || null
  const firmante = (formData.get('firmante') as string) || null
  const firmantePersonaId = (formData.get('firmante_persona_id') as string) || null
  const sectorIncendio = (formData.get('sector_incendio') as string) || null
  const superficieRaw = (formData.get('superficie_m2') as string) || null
  const ventilacionRaw = (formData.get('ventilacion') as string) || null
  const riesgoRaw = (formData.get('riesgo') as string) || null
  const qfRaw = (formData.get('qf_kg_m2') as string) || null
  const fExigido = (formData.get('f_exigido') as string) || null
  const potencialA = (formData.get('potencial_extintor_a') as string) || null
  const potencialB = (formData.get('potencial_extintor_b') as string) || null
  const observaciones = (formData.get('observaciones') as string) || null
  const conclusiones = (formData.get('conclusiones') as string) || null
  const recomendaciones = (formData.get('recomendaciones') as string) || null
  const certificadoFile = formData.get('certificado') as File | null
  const planoFile = formData.get('plano') as File | null
  const materialesRaw = (formData.get('materiales') as string) || '[]'
  const observacionesSeguimientoRaw = (formData.get('observaciones_seguimiento') as string) || null

  if (!registroId) return { success: false, error: 'Registro requerido' }
  if (!establecimientoId) return { success: false, error: 'Establecimiento requerido' }

  // CHECK en DB: ventilacion ∈ {natural, mecanica}; riesgo ∈ {R1..R7}. Normalizamos.
  const ventilacion = ventilacionRaw && ['natural', 'mecanica'].includes(ventilacionRaw) ? ventilacionRaw : null
  const riesgo = riesgoRaw && ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7'].includes(riesgoRaw) ? riesgoRaw : null

  const superficieM2 = superficieRaw != null && superficieRaw.trim() !== '' && Number.isFinite(Number(superficieRaw))
    ? Number(superficieRaw) : null
  const qfKgM2 = qfRaw != null && qfRaw.trim() !== '' && Number.isFinite(Number(qfRaw))
    ? Number(qfRaw) : null

  // Parseo de materiales. Si el JSON viene roto es un error crítico: el contenido
  // del cálculo es el inventario, sin él la cabecera queda vacía.
  let materiales: MaterialInput[] = []
  try {
    const parsed = JSON.parse(materialesRaw)
    materiales = Array.isArray(parsed) ? parsed : []
  } catch {
    return { success: false, error: 'Los materiales tienen un formato inválido' }
  }

  // El path de un bucket PRIVADO debe empezar con el consultora_id para que la RLS
  // de lectura por tenant matchee (ver lib/storage/tenant-path.ts).
  const consultoraId = await consultoraIdFromEstablecimiento(supabase, establecimientoId)
  if (!consultoraId) return { success: false, error: 'No se pudo resolver la consultora del establecimiento' }

  // ── Validación: el sector de incendio debe ser un sector existente del establecimiento ──
  // Defensa en profundidad del lado servidor: la UI ya ofrece un select cerrado con los
  // sectores activos, pero acá rechazamos cualquier sector que no coincida con uno real
  // (los sectores se crean en la ficha del establecimiento, no en este cálculo).
  if (sectorIncendio) {
    const { data: sectoresData, error: sectoresError } = await supabase
      .from('establecimientos_sectores')
      .select('nombre')
      .eq('establecimiento_id', establecimientoId)
      .eq('is_active', true)
    if (sectoresError) return { success: false, error: 'No se pudieron validar los sectores del establecimiento: ' + sectoresError.message }
    const nombresSectores = (sectoresData ?? []).map(s => s.nombre as string)
    if (nombresSectores.length === 0) {
      return { success: false, error: 'El establecimiento no tiene sectores cargados. Primero creá sectores en su ficha.' }
    }
    if (!nombresSectores.includes(sectorIncendio)) {
      return { success: false, error: 'El sector de incendio no coincide con ningún sector del establecimiento. Elegí uno de la lista.' }
    }
  }

  const ts = Date.now()

  // ── 1. Subir adjuntos opcionales (certificado / plano) → guardamos PATH, no URL ──
  let certificadoUrl: string | null = null
  if (certificadoFile && certificadoFile.size > 0) {
    const ext = certificadoFile.name.split('.').pop() ?? 'pdf'
    const path = tenantStoragePath(consultoraId, 'calculo-carga-fuego', establecimientoId, `${ts}-certificado.${ext}`)
    const { data: up, error: upErr } = await supabase.storage
      .from('documentos')
      .upload(path, certificadoFile, { upsert: false })
    if (upErr) return { success: false, error: 'Error al subir el certificado: ' + upErr.message }
    certificadoUrl = up.path
  }

  let planoUrl: string | null = null
  if (planoFile && planoFile.size > 0) {
    const ext = planoFile.name.split('.').pop() ?? 'pdf'
    const path = tenantStoragePath(consultoraId, 'calculo-carga-fuego', establecimientoId, `${ts}-plano.${ext}`)
    const { data: up, error: upErr } = await supabase.storage
      .from('documentos')
      .upload(path, planoFile, { upsert: false })
    if (upErr) return { success: false, error: 'Error al subir el plano: ' + upErr.message }
    planoUrl = up.path
  }

  // ── 2. UPDATE del registro planificado (queda Realizado) ────────────
  // Fecha de ejecución = HOY por componentes locales (sin drift UTC de toISOString).
  const now = new Date()
  const hoy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  let regUpdate = supabase
    .from('gestiones_registros')
    // ejecutado_at = now(): hora real de finalización del cálculo (queda Realizado).
    .update({ fecha_ejecutada: hoy, ejecutado_at: new Date().toISOString() })
    .eq('id', registroId)
  if (rgFechaPlanificada) regUpdate = regUpdate.eq('fecha_planificada', rgFechaPlanificada)
  const { data: regRow, error: regErr } = await regUpdate.select('fecha_planificada').single()
  if (regErr) return { success: false, error: 'Error al actualizar el registro: ' + regErr.message }

  // Geo-sello del lugar de ejecución. Usamos la fecha_planificada autoritativa del
  // registro (clave de partición). NO-BLOQUEANTE.
  await aplicarSelloGeo(supabase, registroId, regRow.fecha_planificada as string, formData)

  // ── 3. INSERT cabecera ──────────────────────────────────────────────
  const { data: cabecera, error: cabErr } = await supabase
    .from('calculo_carga_fuego')
    .insert({
      consultora_id: consultoraId,
      establecimiento_id: establecimientoId,
      registro_gestion_id: registroId,
      rg_fecha_planificada: rgFechaPlanificada,
      gestion_establecimiento_id: gestionEstablecimientoId,
      firmante,
      firmante_persona_id: firmantePersonaId,
      sector_incendio: sectorIncendio,
      superficie_m2: superficieM2,
      ventilacion,
      riesgo,
      qf_kg_m2: qfKgM2,
      f_exigido: fExigido,
      potencial_extintor_a: potencialA,
      potencial_extintor_b: potencialB,
      observaciones,
      conclusiones,
      recomendaciones,
      certificado_url: certificadoUrl,
      plano_url: planoUrl,
      estado: 'completado',
    })
    .select('id')
    .single()
  if (cabErr) return { success: false, error: 'Error al crear el cálculo: ' + cabErr.message }

  const calculoId = cabecera.id as string

  // ── 4. INSERT materiales ────────────────────────────────────────────
  // Si algo falla, rollback manual de la cabecera (ON DELETE CASCADE limpia materiales
  // ya insertados) y devolvemos error en vez de tragarlo y reportar éxito.
  const materialRows = materiales
    .filter(m => (m.descripcion && m.descripcion.trim()) || m.peso_kg != null)
    .map((m, i) => ({
      calculo_id: calculoId,
      descripcion: m.descripcion?.trim() || null,
      estado: m.estado ?? null,
      peso_kg: m.peso_kg ?? null,
      pci_kcal: m.pci_kcal ?? null,
      coef_c: m.coef_c ?? null,
      equiv_madera_kg: m.equiv_madera_kg ?? null,
      orden: m.orden ?? i,
    }))
  if (materialRows.length > 0) {
    const { error: matErr } = await supabase
      .from('calculo_carga_fuego_materiales')
      .insert(materialRows)
    if (matErr) {
      await supabase.from('calculo_carga_fuego').delete().eq('id', calculoId)
      return { success: false, error: 'Error al guardar los materiales: ' + matErr.message }
    }
  }

  // ── 5. INSERT observaciones de seguimiento → pool común gestiones_observaciones ──
  // Replicado de crearMedicionIluminacion: mismo contrato (JSON `observaciones_seguimiento`
  // + fotos `obs-foto-{idx}`), misma inserción (registro_gestion_id + rg_fecha_planificada
  // para que entren a Seguimiento). Son findings ADICIONALES al cálculo.
  if (observacionesSeguimientoRaw) {
    let obs: ObsSeguimientoInput[] = []
    try {
      const parsed = JSON.parse(observacionesSeguimientoRaw)
      obs = Array.isArray(parsed) ? parsed : []
    } catch {
      return { success: false, error: 'Las observaciones de seguimiento tienen un formato inválido' }
    }

    const validas = obs.filter(o => o.descripcion?.trim() && o.categoria_id)
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
              console.error('[calculoCargaFuego] Error al subir foto de observación:', obsUploadError.message)
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
        console.error('[calculoCargaFuego] Error al insertar gestiones_observaciones:', obsError.message)
        return { success: false, error: 'El cálculo se guardó, pero no se pudieron registrar las observaciones de seguimiento: ' + obsError.message }
      }
    }
  }

  return { success: true, data: { calculoId } }
}

// ── Lectura completa: cabecera + materiales (vista + PDF) ──────────────

/**
 * Trae un cálculo completo para la vista y el PDF: cabecera con joins a
 * establecimiento (→ empresa) y sus materiales.
 */
export async function getCalculoCargaFuego(
  calculoId: string
): Promise<ActionResult<Record<string, unknown>>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  if (!calculoId) return { success: false, error: 'ID de cálculo requerido' }

  const { data, error } = await supabase
    .from('calculo_carga_fuego')
    .select(`
      *,
      establecimientos (
        id, nombre, domicilio, codigo_postal,
        empresas (
          id, razon_social, cuit, domicilio, localidad_id
        )
      ),
      calculo_carga_fuego_materiales (
        id, descripcion, estado, peso_kg, pci_kcal, coef_c, equiv_madera_kg, orden
      )
    `)
    .eq('id', calculoId)
    .maybeSingle()

  if (error) return { success: false, error: error.message }
  if (!data) return { success: false, error: 'Cálculo no encontrado' }

  return { success: true, data: data as Record<string, unknown> }
}

// ── Catálogos para la UI ───────────────────────────────────────────────

export interface MaterialPci {
  id: string
  categoria: string | null
  material: string
  pci_mj: number | null
  pci_kcal: number | null
  coef_c: number | null
  orden: number | null
}

/** Tabla de PCI / coeficiente C del Anexo VII (lectura global, RLS la limita a autenticados). */
export async function getMaterialesPci(): Promise<ActionResult<MaterialPci[]>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data, error } = await supabase
    .from('dec351_materiales_pci')
    .select('id, categoria, material, pci_mj, pci_kcal, coef_c, orden')
    .eq('is_active', true)
    .order('orden', { ascending: true })

  if (error) return { success: false, error: error.message }

  const result: MaterialPci[] = (data ?? []).map(r => ({
    id: r.id as string,
    categoria: (r.categoria as string | null) ?? null,
    material: r.material as string,
    pci_mj: r.pci_mj != null ? Number(r.pci_mj) : null,
    pci_kcal: r.pci_kcal != null ? Number(r.pci_kcal) : null,
    coef_c: r.coef_c != null ? Number(r.coef_c) : null,
    orden: r.orden != null ? Number(r.orden) : null,
  }))
  return { success: true, data: result }
}

export interface ResistenciaRow {
  ventilacion: string
  riesgo: string
  franja: string
  f_minutos: string | null
}

export interface ExtintorRow {
  clase: string
  riesgo: string
  franja: string
  potencial: string | null
}

export interface ResistenciaYExtintor {
  resistencia: ResistenciaRow[]
  extintor: ExtintorRow[]
}

/**
 * Trae las dos lookups del Anexo VII que la UI cruza en vivo:
 *  - resistencia (Cuadros 2.2.1 / 2.2.2) → F exigido por ventilación + riesgo + franja
 *  - extintor (Tablas 1 y 2)             → potencial extintor A/B por riesgo + franja
 */
export async function getResistenciaYExtintor(): Promise<ActionResult<ResistenciaYExtintor>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const [res, ext] = await Promise.all([
    supabase.from('dec351_carga_fuego_resistencia').select('ventilacion, riesgo, franja, f_minutos'),
    supabase.from('dec351_carga_fuego_extintor').select('clase, riesgo, franja, potencial'),
  ])

  if (res.error) return { success: false, error: res.error.message }
  if (ext.error) return { success: false, error: ext.error.message }

  return {
    success: true,
    data: {
      resistencia: (res.data ?? []) as ResistenciaRow[],
      extintor: (ext.data ?? []) as ExtintorRow[],
    },
  }
}

export interface SectorConPuestos {
  id: string
  nombre: string
  puestos: Array<{ id: string; nombre: string }>
}

/**
 * Sectores del establecimiento (activos) con sus puestos de trabajo (activos).
 * Para que la UI ofrezca el sector de incendio a partir de los sectores cargados.
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
