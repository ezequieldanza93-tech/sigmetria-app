'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { uploadAsset } from '@/lib/storage/upload'
import type { ActionResult } from '@/lib/types'

// Categoría del catálogo (clase EPC) de la que salen los modelos de instrumentos.
const CAT_MEDICIONES_HYS = '318ea652-2295-4d3f-8ffb-f8f047f84fe6'

// El modelo y la marca del instrumento se DERIVAN del producto del catálogo (Mediciones HyS).
// Devuelve null si el producto no existe.
async function productoCatalogo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  productoId: string,
): Promise<{ nombre: string; marca_id: string | null } | null> {
  const { data } = await supabase
    .from('productos')
    .select('nombre, marca_id')
    .eq('id', productoId)
    .maybeSingle()
  return (data as { nombre: string; marca_id: string | null } | null) ?? null
}

/**
 * Shape uniforme que consumen tanto la página /dashboard/instrumentos como los
 * selectores de instrumento de los modales de medición. `marca` es el NOMBRE de
 * la marca (no el id) — lo que el <select>/selector necesita para etiquetar.
 */
export interface InstrumentoCreado {
  id: string
  modelo: string
  numero_serie: string | null
  marca: string | null
}

export async function createInstrumento(
  _prev: ActionResult<InstrumentoCreado> | null,
  formData: FormData
): Promise<ActionResult<InstrumentoCreado>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const subcategoriaId = (formData.get('subcategoria_id') as string) || ''
  const productoId = (formData.get('producto_id') as string) || ''

  // Cuando el alta ocurre desde el selector inline dentro de un modal de medición,
  // el form manda `inline=1`. En ese caso NO revalidamos /dashboard/instrumentos:
  // ese revalidate global desmonta el árbol de la ruta actual (p. ej. /dashboard/gestiones)
  // y cierra el modal con el formulario abierto. La UI inline ya refresca por estado
  // local (el selector recibe el instrumento creado vía onCreated). El refresco de la
  // página /dashboard/instrumentos solo es necesario cuando se crea desde su propia pantalla.
  const esInline = formData.get('inline') === '1'

  if (!subcategoriaId) return { success: false, error: 'Elegí el tipo de medición (subcategoría)' }
  if (!productoId) return { success: false, error: 'Elegí el modelo del instrumento desde el catálogo' }

  const prod = await productoCatalogo(supabase, productoId)
  if (!prod) return { success: false, error: 'El producto elegido no existe en el catálogo' }
  const modelo = prod.nombre
  const marcaId = prod.marca_id

  // Certificado de calibración OPCIONAL al dar de alta. Si vino archivo, ambas fechas
  // son obligatorias; si no vino archivo pero sí fechas, igual se registra la calibración.
  const certFile = formData.get('certificado') as File | null
  const certFechaEmision = (formData.get('cert_fecha_emision') as string) || ''
  const certFechaVencimiento = (formData.get('cert_fecha_vencimiento') as string) || ''
  const tieneCertificado =
    (!!certFile && certFile.size > 0) || !!certFechaEmision || !!certFechaVencimiento

  if (tieneCertificado) {
    if (!certFechaEmision) return { success: false, error: 'Falta la fecha de emisión del certificado.' }
    if (!certFechaVencimiento) return { success: false, error: 'Falta la fecha de vencimiento del certificado.' }
  }

  const { data: inserted, error } = await supabase
    .from('mediciones_instrumentos')
    .insert({
      producto_id: productoId,
      subcategoria_id: subcategoriaId,
      marca_id: marcaId,
      modelo,
      numero_serie: (formData.get('numero_serie') as string) || null,
      dueño_id: (formData.get('dueño_id') as string) || null,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    if (error?.code === '23505') {
      return { success: false, error: 'Ya existe un instrumento con ese número de serie.' }
    }
    return { success: false, error: error?.message ?? 'Error al crear el instrumento' }
  }

  if (tieneCertificado) {
    const { data: membership } = await supabase
      .from('consultoras_members')
      .select('consultora_id')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .maybeSingle()

    if (!membership?.consultora_id) {
      return { success: false, error: 'No pertenecés a ninguna consultora activa' }
    }

    const { data: cert, error: certError } = await supabase
      .from('certificados_calibracion')
      .insert({
        instrumento_id: inserted.id,
        fecha_emision: certFechaEmision,
        fecha_vencimiento: certFechaVencimiento,
        activo: true,
      })
      .select('id')
      .single()

    if (certError || !cert) {
      return { success: false, error: `Certificado: ${certError?.message ?? 'no se pudo registrar'}` }
    }

    if (certFile && certFile.size > 0) {
      const up = await uploadAsset({
        bucket: 'certificados',
        consultoraId: membership.consultora_id,
        entityType: 'certificado_calibracion',
        entityId: cert.id,
        kind: 'certificado',
        file: certFile,
      })
      if (!up.ok) return { success: false, error: `Certificado: ${up.error}` }
      await supabase
        .from('certificados_calibracion')
        .update({ certificado_url: up.path })
        .eq('id', cert.id)
    }
  }

  // Resolver el NOMBRE de la marca para devolver el shape que consumen los
  // selectores de los modales de medición (marca = nombre, no id).
  let marcaNombre: string | null = null
  if (marcaId) {
    const { data: marca } = await supabase
      .from('organizaciones_externas')
      .select('nombre')
      .eq('id', marcaId)
      .maybeSingle()
    marcaNombre = (marca?.nombre as string | undefined) ?? null
  }

  if (!esInline) revalidatePath('/dashboard/instrumentos')
  return {
    success: true,
    data: {
      id: inserted.id as string,
      modelo,
      numero_serie: (formData.get('numero_serie') as string) || null,
      marca: marcaNombre,
    },
  }
}

export async function updateInstrumento(
  _prev: ActionResult<InstrumentoCreado> | null,
  formData: FormData
): Promise<ActionResult<InstrumentoCreado>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const id = formData.get('id') as string
  if (!id) return { success: false, error: 'ID requerido' }

  const subcategoriaId = (formData.get('subcategoria_id') as string) || ''
  const productoId = (formData.get('producto_id') as string) || ''

  if (!subcategoriaId) return { success: false, error: 'Elegí el tipo de medición (subcategoría)' }
  if (!productoId) return { success: false, error: 'Elegí el modelo del instrumento desde el catálogo' }

  const prod = await productoCatalogo(supabase, productoId)
  if (!prod) return { success: false, error: 'El producto elegido no existe en el catálogo' }

  const { error } = await supabase
    .from('mediciones_instrumentos')
    .update({
      producto_id: productoId,
      subcategoria_id: subcategoriaId,
      marca_id: prod.marca_id,
      modelo: prod.nombre,
      numero_serie: (formData.get('numero_serie') as string) || null,
      dueño_id: (formData.get('dueño_id') as string) || null,
    })
    .eq('id', id)

  if (error) {
    if (error.code === '23505') {
      return { success: false, error: 'Ya existe un instrumento con ese número de serie.' }
    }
    return { success: false, error: error.message }
  }

  // Resolver el NOMBRE de la marca para devolver el mismo shape que createInstrumento
  // (lo consumen los selectores de los modales de medición).
  let marcaNombre: string | null = null
  if (prod.marca_id) {
    const { data: marca } = await supabase
      .from('organizaciones_externas')
      .select('nombre')
      .eq('id', prod.marca_id)
      .maybeSingle()
    marcaNombre = (marca?.nombre as string | undefined) ?? null
  }

  revalidatePath('/dashboard/instrumentos')
  return {
    success: true,
    data: {
      id,
      modelo: prod.nombre,
      numero_serie: (formData.get('numero_serie') as string) || null,
      marca: marcaNombre,
    },
  }
}

/**
 * Alta inline de un MODELO en el catálogo (categoría Mediciones HyS, subcategoría elegida),
 * desde el selector de modelo del alta de instrumento. Se crea como producto PROPIO de la
 * consultora (no toca la librería base). Devuelve el id para auto-seleccionarlo.
 */
export async function crearModeloCatalogo(
  nombre: string,
  subcategoriaId: string,
): Promise<ActionResult<{ id: string; nombre: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombreTrim = nombre.trim()
  if (!nombreTrim) return { success: false, error: 'El nombre del modelo es obligatorio' }
  if (!subcategoriaId) return { success: false, error: 'Elegí primero el tipo de medición' }

  const { data: member } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()
  if (!member) return { success: false, error: 'Sin membresía activa' }

  const { data, error } = await supabase
    .from('productos')
    .insert({
      nombre: nombreTrim,
      categoria_id: CAT_MEDICIONES_HYS,
      componente_id: subcategoriaId,
      consultora_id: member.consultora_id,
    })
    .select('id, nombre')
    .single()

  if (error || !data) return { success: false, error: error?.message ?? 'No se pudo crear el modelo' }
  return { success: true, data: { id: data.id as string, nombre: data.nombre as string } }
}

/** Shape uniforme que los <select> de los modales de medición consumen. */
export interface InstrumentoInlineCreado {
  id: string
  modelo: string
  numero_serie: string | null
  marca: string | null
}

/**
 * Alta inline COMPLETA de un instrumento desde un modal de medición.
 *
 * Cada modal conoce el NOMBRE de su subcategoría ("Puesta a Tierra (PAT)",
 * "Iluminación", "Ruido", "Carga Térmica") porque filtra sus instrumentos por
 * `productos_componentes.nombre`. Acá resolvemos ese nombre → subcategoria_id,
 * creamos un modelo PROPIO de la consultora en el catálogo (Mediciones HyS) y
 * damos de alta el instrumento, todo en una sola llamada. Devolvemos el shape
 * que el <select> del modal espera para auto-seleccionarlo sin recargar.
 *
 * Nota de producto: NO pide certificado de calibración acá (el flujo completo
 * de /dashboard/instrumentos sí lo ofrece). El instrumento queda sin certificado
 * vigente y el modal lo avisa con el CertificadoVigenteCard ("cargalo en el
 * instrumento"). Esto es deliberado: el alta inline resuelve el caso "el equipo
 * no estaba cargado" sin frenar la medición.
 */
export async function crearInstrumentoInline(input: {
  subcategoriaNombre: string
  modelo: string
  numeroSerie?: string | null
}): Promise<ActionResult<InstrumentoInlineCreado>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const modeloTrim = (input.modelo ?? '').trim()
  if (!modeloTrim) return { success: false, error: 'El modelo del instrumento es obligatorio' }
  if (!input.subcategoriaNombre) return { success: false, error: 'Falta el tipo de medición' }

  // Resolver subcategoría (componente) por nombre dentro de Mediciones HyS.
  const { data: subcat } = await supabase
    .from('productos_componentes')
    .select('id')
    .eq('categoria_id', CAT_MEDICIONES_HYS)
    .eq('nombre', input.subcategoriaNombre)
    .maybeSingle()
  if (!subcat?.id) {
    return { success: false, error: `No encontré la subcategoría "${input.subcategoriaNombre}" en el catálogo` }
  }
  const subcategoriaId = subcat.id as string

  // Crear el modelo en el catálogo (producto propio de la consultora) y dar de alta el instrumento.
  const modeloRes = await crearModeloCatalogo(modeloTrim, subcategoriaId)
  if (!modeloRes.success) return modeloRes

  const { data: inserted, error } = await supabase
    .from('mediciones_instrumentos')
    .insert({
      producto_id: modeloRes.data.id,
      subcategoria_id: subcategoriaId,
      marca_id: null,
      modelo: modeloRes.data.nombre,
      numero_serie: (input.numeroSerie ?? '').trim() || null,
    })
    .select('id')
    .single()

  if (error || !inserted) {
    if (error?.code === '23505') {
      return { success: false, error: 'Ya existe un instrumento con ese número de serie.' }
    }
    return { success: false, error: error?.message ?? 'No se pudo crear el instrumento' }
  }

  revalidatePath('/dashboard/instrumentos')
  return {
    success: true,
    data: {
      id: inserted.id as string,
      modelo: modeloRes.data.nombre,
      numero_serie: (input.numeroSerie ?? '').trim() || null,
      marca: null,
    },
  }
}

export async function deleteInstrumento(id: string): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { error } = await supabase
    .from('mediciones_instrumentos')
    .update({ is_active: false })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/instrumentos')
  return { success: true, data: null }
}
