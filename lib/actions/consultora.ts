'use server'

import { createClient as createServerClient } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import type { ActionResult, Consultora } from '@/lib/types'
import { revalidatePath } from 'next/cache'
import { uploadAsset, deleteAsset, pathFromUrl } from '@/lib/storage/upload'

export async function createConsultora(formData: FormData): Promise<ActionResult<{ id: string }>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role !== 'developer') {
    return { success: false, error: 'Solo developers pueden crear consultoras' }
  }

  const nombre = formData.get('nombre') as string
  const cuit = formData.get('cuit') as string
  const email = formData.get('email') as string
  const telefono = formData.get('telefono') as string

  if (!nombre?.trim()) return { success: false, error: 'El nombre es obligatorio' }

  const { data, error } = await supabase
    .from('consultoras')
    .insert({ nombre: nombre.trim(), cuit: cuit || null, email: email || null, telefono: telefono || null })
    .select('id')
    .single()

  if (error) return { success: false, error: error.message }
  return { success: true, data: { id: data.id } }
}

export async function inviteConsultoraAdmin(formData: FormData): Promise<ActionResult<null>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: profile } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (profile?.system_role !== 'developer') {
    return { success: false, error: 'Solo developers pueden usar esta función' }
  }

  const email = formData.get('email') as string
  const fullName = formData.get('full_name') as string
  const consultoraId = formData.get('consultora_id') as string

  if (!email || !consultoraId) return { success: false, error: 'Email y consultora son obligatorios' }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName },
  })

  if (inviteError) return { success: false, error: inviteError.message }

  // Upsert profile
  if (invited.user) {
    await adminClient.from('profiles').upsert({
      id: invited.user.id,
      full_name: fullName,
      system_role: 'user',
    }, { onConflict: 'id' })

    const { error: memberError } = await adminClient.from('consultoras_members').insert({
      consultora_id: consultoraId,
      user_id: invited.user.id,
      role: 'full_access_main',
      invited_by: user.id,
    })

    if (memberError) return { success: false, error: memberError.message }
  }

  redirect('/dashboard')
}

export async function updateConsultora(data: {
  nombre: string
  telefono: string | null
  email: string | null
  website: string | null
  logo_url: string | null
  social_links: Record<string, string> | null
}): Promise<ActionResult<Consultora>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) return { success: false, error: 'No pertenecés a ninguna consultora' }

  const { data: updated, error } = await supabase
    .from('consultoras')
    .update({
      nombre: data.nombre,
      telefono: data.telefono,
      email: data.email,
      website: data.website,
      logo_url: data.logo_url,
      social_links: data.social_links,
      updated_at: new Date().toISOString(),
    })
    .eq('id', membership.consultora_id)
    .select()
    .single()

  if (error) return { success: false, error: error.message }

  revalidatePath('/dashboard/configuracion/consultora')
  return { success: true, data: updated as unknown as Consultora }
}

export async function uploadConsultoraLogo(
  formData: FormData,
): Promise<ActionResult<{ url: string }>> {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }

  const { data: membership } = await supabase
    .from('consultoras_members')
    .select('consultora_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!membership) return { success: false, error: 'No pertenecés a ninguna consultora' }

  const file = formData.get('logo') as File | null
  if (!file || file.size === 0) return { success: false, error: 'Archivo vacío' }

  const { data: current } = await supabase
    .from('consultoras')
    .select('logo_url')
    .eq('id', membership.consultora_id)
    .single()

  const result = await uploadAsset({
    bucket: 'consultora',
    consultoraId: membership.consultora_id,
    entityType: 'consultora',
    entityId: membership.consultora_id,
    kind: 'logo',
    file,
  })

  if (!result.ok) return { success: false, error: result.error }

  if (current?.logo_url && current.logo_url !== result.url) {
    const oldPath = pathFromUrl(current.logo_url, 'consultora')
    if (oldPath) await deleteAsset('consultora', oldPath)
  }

  await supabase
    .from('consultoras')
    .update({ logo_url: result.url, updated_at: new Date().toISOString() })
    .eq('id', membership.consultora_id)

  revalidatePath('/dashboard/configuracion/consultora')
  return { success: true, data: { url: result.url } }
}
