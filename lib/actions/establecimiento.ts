'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { SECTORES_PREDEFINIDOS } from '@/lib/constants'
import type { ActionResult, TipoEstablecimiento } from '@/lib/types'

async function parseUbicacion(raw: string | null): Promise<{ latitude: number | null; longitude: number | null }> {
  if (!raw?.trim()) return { latitude: null, longitude: null }
  const s = raw.trim()

  const urlMatch = s.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/) ?? s.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/)
  if (urlMatch) return { latitude: parseFloat(urlMatch[1]), longitude: parseFloat(urlMatch[2]) }

  const directMatch = s.match(/^(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)$/)
  if (directMatch) return { latitude: parseFloat(directMatch[1]), longitude: parseFloat(directMatch[2]) }

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(s)}&format=json&limit=1`
    const res = await fetch(url, { headers: { 'User-Agent': 'sigmetria-hys-app/1.0' } })
    const data = await res.json()
    if (data?.[0]) return { latitude: parseFloat(data[0].lat), longitude: parseFloat(data[0].lon) }
  } catch { /* fall through */ }

  return { latitude: null, longitude: null }
}

async function uploadFoto(file: File, establecimientoId: string): Promise<string | null> {
  try {
    if (!file || file.size === 0) return null
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `fotos/${establecimientoId}/${Date.now()}.${ext}`
    const buffer = await file.arrayBuffer()
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/establecimientos/${path}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': file.type || 'image/jpeg',
        'x-upsert': 'true',
      },
      body: buffer,
    })
    if (!res.ok) return null
    return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/establecimientos/${path}`
  } catch {
    return null
  }
}

export async function createEstablecimiento(
  empresaId: string,
  _prev: ActionResult<{ id: string }> | null,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = formData.get('nombre') as string
  if (!nombre?.trim()) return { success: false, error: 'El nombre es obligatorio' }

  const tipo = formData.get('tipo') as TipoEstablecimiento | null
  const cantidadStr = formData.get('cantidad_trabajadores') as string
  const cantidad = cantidadStr ? parseInt(cantidadStr, 10) : null
  const { latitude, longitude } = await parseUbicacion(formData.get('ubicacion_gmaps') as string)

  const { data, error } = await supabase
    .from('establecimientos')
    .insert({
      empresa_id: empresaId,
      nombre: nombre.trim(),
      tipo: tipo || null,
      domicilio: (formData.get('domicilio') as string) || null,
      localidad: (formData.get('localidad') as string) || null,
      provincia: (formData.get('provincia') as string) || null,
      codigo_postal: (formData.get('codigo_postal') as string) || null,
      actividad_principal: (formData.get('actividad_principal') as string) || null,
      cantidad_trabajadores: isNaN(cantidad as number) ? null : cantidad,
      horario_trabajo: (formData.get('horario_trabajo') as string) || null,
      description: (formData.get('description') as string) || null,
      latitude,
      longitude,
    })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }

  const foto = formData.get('foto') as File | null
  const photo_site = foto ? await uploadFoto(foto, data.id) : null
  if (photo_site) {
    await supabase.from('establecimientos').update({ photo_site }).eq('id', data.id)
  }

  const sectores = SECTORES_PREDEFINIDOS.map(nombre => ({
    establecimiento_id: data.id,
    nombre,
    es_custom: false,
    cantidad_trabajadores: 0,
  }))
  await supabase.from('sectores_establecimiento').insert(sectores)

  revalidatePath(`/dashboard/empresas/${empresaId}`)
  redirect(`/dashboard/empresas/${empresaId}/establecimientos/${data.id}`)
}

export async function updateEstablecimiento(
  id: string,
  empresaId: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const nombre = formData.get('nombre') as string
  if (!nombre?.trim()) return { success: false, error: 'El nombre es obligatorio' }

  const tipo = formData.get('tipo') as TipoEstablecimiento | null
  const cantidadStr = formData.get('cantidad_trabajadores') as string
  const cantidad = cantidadStr ? parseInt(cantidadStr, 10) : null
  const { latitude, longitude } = await parseUbicacion(formData.get('ubicacion_gmaps') as string)

  const foto = formData.get('foto') as File | null
  const photo_site = foto?.size ? await uploadFoto(foto, id) : undefined

  const { error } = await supabase
    .from('establecimientos')
    .update({
      nombre: nombre.trim(),
      tipo: tipo || null,
      domicilio: (formData.get('domicilio') as string) || null,
      localidad: (formData.get('localidad') as string) || null,
      provincia: (formData.get('provincia') as string) || null,
      codigo_postal: (formData.get('codigo_postal') as string) || null,
      actividad_principal: (formData.get('actividad_principal') as string) || null,
      cantidad_trabajadores: isNaN(cantidad as number) ? null : cantidad,
      horario_trabajo: (formData.get('horario_trabajo') as string) || null,
      description: (formData.get('description') as string) || null,
      latitude,
      longitude,
      ...(photo_site !== undefined && { photo_site }),
    })
    .eq('id', id)

  if (error) return { success: false, error: error.message }

  revalidatePath(`/dashboard/empresas/${empresaId}/establecimientos/${id}`)
  redirect(`/dashboard/empresas/${empresaId}/establecimientos/${id}`)
}
