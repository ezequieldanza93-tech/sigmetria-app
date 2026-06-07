import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrigin } from '@/lib/csrf'
import { uploadAsset } from '@/lib/storage/upload'
import { consultoraIdFromEstablecimiento } from '@/lib/storage/tenant-path'

export async function POST(request: NextRequest) {
  const originErr = requireOrigin(request)
  if (originErr) return originErr

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/login', request.url))

  const { searchParams } = new URL(request.url)
  const estId = searchParams.get('estId')
  if (!estId) return NextResponse.redirect(new URL('/dashboard', request.url))

  const formData = await request.formData()
  const file = formData.get('plano') as File | null
  if (!file) return NextResponse.redirect(request.url)

  // El bucket `planos` es PRIVADO: el path DEBE ir prefijado por consultora para
  // que la RLS de lectura por tenant matchee (si no, un colega de la misma
  // consultora recibe 403). Centralizamos en uploadAsset, que valida mime/size,
  // arma el path tenant-prefijado y registra en la tabla maestra `archivos`.
  // Es el mismo writer canónico que usa lib/actions/establecimiento.ts.
  const consultoraId = await consultoraIdFromEstablecimiento(supabase, estId)
  if (!consultoraId) {
    return NextResponse.json(
      { error: 'No se pudo resolver la consultora del establecimiento' },
      { status: 400 },
    )
  }

  const up = await uploadAsset({
    bucket: 'planos',
    consultoraId,
    entityType: 'establecimiento',
    entityId: estId,
    kind: 'pdf',
    file,
  })
  if (!up.ok) {
    return NextResponse.json({ error: up.error }, { status: 400 })
  }

  // Persistimos el PATH (no la URL). Se firma on-read con resolveAssetUrl('planos', path).
  await supabase
    .from('establecimientos')
    .update({ plano_url: up.path })
    .eq('id', estId)

  return NextResponse.redirect(request.url)
}
