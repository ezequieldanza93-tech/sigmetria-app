import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireOrigin } from '@/lib/csrf'

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_SIZE = 20 * 1024 * 1024

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

  if (!ALLOWED_MIMES.includes(file.type)) {
    return NextResponse.json({ error: 'Tipo de archivo no permitido. Permitidos: JPEG, PNG, WebP, PDF' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'El archivo supera el límite de 20 MB' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  // Unificado al bucket `planos` (mismo que lib/actions/establecimiento.ts) para
  // que la columna plano_url sea consistente y resoluble con publicAssetUrl('planos', ...).
  const filePath = `${estId}/${Date.now()}.${ext}`

  const { data: upload, error: uploadError } = await supabase.storage
    .from('planos')
    .upload(filePath, file, { upsert: true })

  if (uploadError || !upload) {
    console.error('Upload error:', uploadError)
    return NextResponse.redirect(request.url)
  }

  // Persistimos el PATH (no la URL).
  await supabase
    .from('establecimientos')
    .update({ plano_url: upload.path })
    .eq('id', estId)

  return NextResponse.redirect(request.url)
}
