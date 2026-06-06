'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { consultoraIdFromEstablecimiento, tenantStoragePath } from '@/lib/storage/tenant-path'
import type { ActionResult } from '@/lib/types'

// ---- Helpers ----

async function getConsultoraId(): Promise<ActionResult<string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: member } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!member) return { success: false, error: 'Sin membresía activa' }
  return { success: true, data: member.consultora_id }
}

// ============================================================
// PELIGROS LIBRARY
// ============================================================

export async function getPeligrosLibrary(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const { data, error } = await supabase
    .from('iperc_peligros_library')
    .select('*')
    .eq('consultora_id', cId.data)
    .order('factor')
    .order('nombre')

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function createPeligro(
  _prev: ActionResult<any> | null,
  formData: FormData
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const nombre = (formData.get('nombre') as string)?.trim()
  const factor = formData.get('factor') as string
  if (!nombre || !factor) return { success: false, error: 'Nombre y factor requeridos' }

  const { data, error } = await supabase
    .from('iperc_peligros_library')
    .insert({ consultora_id: cId.data, nombre, factor })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/configuracion/iperc')
  return { success: true, data }
}

export async function updatePeligro(
  id: string,
  _prev: ActionResult<any> | null,
  formData: FormData
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const nombre = (formData.get('nombre') as string)?.trim()
  const factor = formData.get('factor') as string
  if (!nombre || !factor) return { success: false, error: 'Nombre y factor requeridos' }

  const { data, error } = await supabase
    .from('iperc_peligros_library')
    .update({ nombre, factor })
    .eq('id', id)
    .eq('consultora_id', cId.data)
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/configuracion/iperc')
  return { success: true, data }
}

export async function deletePeligro(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('iperc_peligros_library').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/configuracion/iperc')
  return { success: true, data: null }
}

// ============================================================
// RIESGOS LIBRARY
// ============================================================

export async function getRiesgosLibrary(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const { data, error } = await supabase
    .from('iperc_riesgos_library')
    .select('*')
    .eq('consultora_id', cId.data)
    .order('tipo')
    .order('nombre')

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function createRiesgoLib(
  _prev: ActionResult<any> | null,
  formData: FormData
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const nombre = (formData.get('nombre') as string)?.trim()
  const tipo = formData.get('tipo') as string
  if (!nombre || !tipo) return { success: false, error: 'Nombre y tipo requeridos' }

  const { data, error } = await supabase
    .from('iperc_riesgos_library')
    .insert({ consultora_id: cId.data, nombre, tipo })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/configuracion/iperc')
  return { success: true, data }
}

export async function updateRiesgoLib(
  id: string,
  _prev: ActionResult<any> | null,
  formData: FormData
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const nombre = (formData.get('nombre') as string)?.trim()
  const tipo = formData.get('tipo') as string
  if (!nombre || !tipo) return { success: false, error: 'Nombre y tipo requeridos' }

  const { data, error } = await supabase
    .from('iperc_riesgos_library')
    .update({ nombre, tipo })
    .eq('id', id)
    .eq('consultora_id', cId.data)
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/configuracion/iperc')
  return { success: true, data }
}

export async function deleteRiesgoLib(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('iperc_riesgos_library').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/configuracion/iperc')
  return { success: true, data: null }
}

// ============================================================
// MEDIDAS DE CONTROL
// ============================================================

export async function getMedidasControl(
  search?: string
): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  let query = supabase
    .from('medidas_control')
    .select('*')
    .eq('consultora_id', cId.data)
    .eq('activo', true)

  if (search) {
    query = query.ilike('texto', `%${search}%`)
  }

  const { data, error } = await query
    .order('veces_usada', { ascending: false })
    .order('texto')
    .limit(50)

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function getMedidasControlTop(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const { data, error } = await supabase
    .from('medidas_control')
    .select('*')
    .eq('consultora_id', cId.data)
    .eq('activo', true)
    .order('veces_usada', { ascending: false })
    .limit(20)

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function createMedidaControl(
  texto: string
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const trimmed = texto.trim()
  if (!trimmed) return { success: false, error: 'El texto es obligatorio' }
  if (trimmed.length > 150) return { success: false, error: 'Máximo 150 caracteres' }

  const { data, error } = await supabase
    .from('medidas_control')
    .insert({ consultora_id: cId.data, texto: trimmed })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/configuracion/iperc')
  return { success: true, data }
}

export async function incrementMedidaUso(id: string): Promise<void> {
  const supabase = await createClient()
  await supabase.rpc('increment_medida_uso', { medida_id: id })
}

export async function deleteMedidaControl(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('medidas_control').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  revalidatePath('/dashboard/configuracion/iperc')
  return { success: true, data: null }
}

// ============================================================
// CONSECUENCIAS & PROBABILIDADES (read-only)
// ============================================================

export async function getConsecuencias(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const { data, error } = await supabase
    .from('iperc_consecuencias')
    .select('*, iperc_consecuencia_items(*)')
    .eq('consultora_id', cId.data)
    .order('orden')

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function getProbabilidades(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const { data, error } = await supabase
    .from('iperc_probabilidades')
    .select('*')
    .eq('consultora_id', cId.data)
    .order('orden')

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function getNivelesRiesgo(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const { data, error } = await supabase
    .from('iperc_niveles_riesgo')
    .select('*')
    .eq('consultora_id', cId.data)
    .order('valor_min')

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

// ============================================================
// SECTORES IPERC
// ============================================================

export async function getIpercSectores(establecimientoId: string): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('iperc_sectores')
    .select('*, nivel_riesgo_maximo:iperc_niveles_riesgo(*)')
    .eq('establecimiento_id', establecimientoId)
    .order('nombre')

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function createIpercSector(
  establecimientoId: string,
  _prev: ActionResult<any> | null,
  formData: FormData
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }

  const { data, error } = await supabase
    .from('iperc_sectores')
    .insert({ establecimiento_id: establecimientoId, nombre })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  revalidatePath(`/dashboard/empresas/[id]/establecimientos/${establecimientoId}`)
  return { success: true, data }
}

export async function updateIpercSectorPoligono(
  sectorId: string,
  poligonoCoords: Record<string, number>[]
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('iperc_sectores')
    .update({ poligono_coords: poligonoCoords })
    .eq('id', sectorId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function deleteIpercSector(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('iperc_sectores').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

// ============================================================
// PROCESOS
// ============================================================

export async function getIpercProcesos(sectorId: string): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('iperc_procesos')
    .select('*')
    .eq('sector_id', sectorId)
    .order('nombre')

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function createIpercProceso(
  sectorId: string,
  _prev: ActionResult<any> | null,
  formData: FormData
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }

  const { data, error } = await supabase
    .from('iperc_procesos')
    .insert({ sector_id: sectorId, nombre, descripcion: (formData.get('descripcion') as string) || null })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function deleteIpercProceso(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('iperc_procesos').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

// ============================================================
// TAREAS
// ============================================================

export async function getIpercTareas(procesoId: string): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('iperc_tareas')
    .select('*')
    .eq('proceso_id', procesoId)
    .order('task_number')

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function createIpercTarea(
  procesoId: string,
  _prev: ActionResult<any> | null,
  formData: FormData
): Promise<ActionResult<any>> {
  const supabase = await createClient()
  const nombre = (formData.get('nombre') as string)?.trim()
  if (!nombre) return { success: false, error: 'El nombre es obligatorio' }

  const taskNumber = parseInt((formData.get('task_number') as string) || '0', 10)

  const { data, error } = await supabase
    .from('iperc_tareas')
    .insert({ proceso_id: procesoId, nombre, task_number: taskNumber, descripcion: (formData.get('descripcion') as string) || null })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function updateIpercTareaOrden(
  tareaId: string,
  taskNumber: number
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('iperc_tareas')
    .update({ task_number: taskNumber })
    .eq('id', tareaId)

  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function deleteIpercTarea(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('iperc_tareas').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

// ============================================================
// MATRIZ PELIGROS (asignar peligros a tareas)
// ============================================================

export async function addPeligroATarea(
  tareaId: string,
  peligroId: string
): Promise<ActionResult<any>> {
  const supabase = await createClient()

  // Check duplicate
  const { data: existing } = await supabase
    .from('iperc_matriz_peligros')
    .select('id')
    .eq('tarea_id', tareaId)
    .eq('peligro_id', peligroId)
    .maybeSingle()

  if (existing) return { success: false, error: 'Este peligro ya está asignado a la tarea' }

  const { data, error } = await supabase
    .from('iperc_matriz_peligros')
    .insert({ tarea_id: tareaId, peligro_id: peligroId })
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

export async function removePeligroDeTarea(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('iperc_matriz_peligros').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

// ============================================================
// MATRIZ RIESGOS (asignar riesgos a peligros + calcular nivel)
// ============================================================

export async function addRiesgoAPeligro(
  peligroMatrizId: string,
  riesgoId: string,
  probabilidadId?: string,
  consecuenciaId?: string
): Promise<ActionResult<any>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('iperc_matriz_riesgos')
    .insert({ peligro_matriz_id: peligroMatrizId, riesgo_id: riesgoId })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  if (probabilidadId && consecuenciaId) {
    await calcularNivelRiesgoAction(data.id, probabilidadId, consecuenciaId)
  }

  return { success: true, data }
}

export async function removeRiesgoDePeligro(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('iperc_matriz_riesgos').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

export async function calcularNivelRiesgoAction(
  riesgoMatrizId: string,
  probabilidadId: string,
  consecuenciaId: string
): Promise<ActionResult<any>> {
  const supabase = await createClient()

  const [probRes, consRes, nivelesRes] = await Promise.all([
    supabase.from('iperc_probabilidades').select('valor_numerico').eq('id', probabilidadId).single(),
    supabase.from('iperc_consecuencias').select('valor_numerico').eq('id', consecuenciaId).single(),
    supabase.from('iperc_niveles_riesgo').select('*'),
  ])

  if (probRes.error || consRes.error) return { success: false, error: 'Error al obtener valores' }

  const pVal = probRes.data.valor_numerico
  const cVal = consRes.data.valor_numerico
  const valorCalculado = pVal * cVal

  const nivel = nivelesRes.data?.find(
    (n: any) => valorCalculado >= n.valor_min && valorCalculado <= n.valor_max
  )

  const updateData: any = {
    probabilidad_id: probabilidadId,
    consecuencia_id: consecuenciaId,
    valor_calculado: valorCalculado,
    nivel_riesgo_id: nivel?.id ?? null,
  }

  const { data, error } = await supabase
    .from('iperc_matriz_riesgos')
    .update(updateData)
    .eq('id', riesgoMatrizId)
    .select()
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data }
}

// ============================================================
// MEDIDAS EN RIESGO MATRIZ
// ============================================================

export async function addMedidaARiesgo(
  riesgoMatrizId: string,
  medidaId: string
): Promise<ActionResult<any>> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('iperc_riesgos_medidas')
    .insert({ riesgo_matriz_id: riesgoMatrizId, medida_id: medidaId })
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  // Increment usage counter
  await supabase.rpc('increment_medida_uso', { medida_id: medidaId })

  return { success: true, data }
}

export async function removeMedidaDeRiesgo(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { error } = await supabase.from('iperc_riesgos_medidas').delete().eq('id', id)
  if (error) return { success: false, error: error.message }
  return { success: true, data: null }
}

// ============================================================
// GET IPERC COMPLETO (árbol completo de un establecimiento)
// ============================================================

export async function getIpercCompleto(establecimientoId: string): Promise<ActionResult<any[]>> {
  const supabase = await createClient()

  const { data: sectores, error } = await supabase
    .from('iperc_sectores')
    .select(`
      *,
      nivel_riesgo_maximo:iperc_niveles_riesgo(*),
      iperc_procesos(
        *,
        iperc_tareas(
          *,
          iperc_matriz_peligros(
            *,
            peligro:iperc_peligros_library(*),
            iperc_matriz_riesgos(
              *,
              riesgo:iperc_riesgos_library(*),
              probabilidad:iperc_probabilidades(*),
              consecuencia:iperc_consecuencias(*),
              nivel_riesgo:iperc_niveles_riesgo(*),
              iperc_riesgos_medidas(
                *,
                medida:medidas_control(*)
              )
            )
          )
        )
      )
    `)
    .eq('establecimiento_id', establecimientoId)
    .order('nombre')

  if (error) return { success: false, error: error.message }
  return { success: true, data: sectores ?? [] }
}

// ============================================================
// MAPA — Establecimientos con nivel de riesgo
// ============================================================

export async function getEstablecimientosParaMapa(): Promise<ActionResult<any[]>> {
  const supabase = await createClient()
  const cId = await getConsultoraId()
  if (!cId.success) return cId

  const { data: empresas } = await supabase
    .from('empresas')
    .select('id, razon_social')
    .eq('consultora_id', cId.data)
    .eq('is_active', true)

  if (!empresas?.length) return { success: true, data: [] }

  const empresaIds = empresas.map(e => e.id)

  const { data, error } = await supabase
    .from('establecimientos')
    .select(`
      id, nombre, latitud, longitud, empresa_id,
      empresas!inner(razon_social, consultora_id),
      iperc_sectores(
        id, nombre, nivel_riesgo_maximo:iperc_niveles_riesgo(*)
      )
    `)
    .in('empresa_id', empresaIds)
    .not('latitud', 'is', null)
    .not('longitud', 'is', null)

  if (error) return { success: false, error: error.message }
  return { success: true, data: data ?? [] }
}

// ============================================================
// SUBIR PLANO
// ============================================================

export async function subirPlanoEstablecimiento(
  establecimientoId: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()

  const file = formData.get('plano') as File | null
  if (!file) return { success: false, error: 'Seleccioná un archivo' }

  const ext = file.name.split('.').pop()
  // Unificado al bucket `planos` (mismo que lib/actions/establecimiento.ts) para
  // que plano_url sea consistente y resoluble con publicAssetUrl('planos', ...).
  const filePath = `${establecimientoId}/${Date.now()}.${ext}`

  const { data: upload, error: uploadError } = await supabase.storage
    .from('planos')
    .upload(filePath, file, { upsert: true })

  if (uploadError || !upload) return { success: false, error: uploadError?.message ?? 'Error al subir' }

  // Persistimos el PATH (no la URL).
  const { error: updateError } = await supabase
    .from('establecimientos')
    .update({ plano_url: upload.path })
    .eq('id', establecimientoId)

  if (updateError) return { success: false, error: updateError.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`)
  return { success: true, data: null }
}
