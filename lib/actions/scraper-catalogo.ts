'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ActionResult } from '@/lib/types'

// Catálogo de proveedores SCRAPEADO. Vive en tablas scraper_* con RLS deny-all
// (solo service_role). Acceso SOLO staff. Lectura vía admin client + signed URLs
// (los buckets scraper-producto-* son privados).

const BUCKET_FOTOS = 'scraper-producto-fotos'
const BUCKET_FICHAS = 'scraper-producto-fichas'

async function ensureSuperAdmin(): Promise<ActionResult<string>> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'No autenticado' }
  const { data: profile } = await supabase
    .from('profiles').select('is_super_admin').eq('id', user.id).single()
  if (!profile?.is_super_admin) return { success: false, error: 'Acceso solo para staff' }
  return { success: true, data: user.id }
}

export async function getScraperCatalogos(): Promise<ActionResult<any[]>> {
  const auth = await ensureSuperAdmin()
  if (!auth.success) return auth
  const admin = createAdminClient()

  const { data: cats, error } = await admin
    .from('scraper_catalogos')
    .select('id, nombre, slug, scrapeado_en')
    .order('nombre')
  if (error) return { success: false, error: error.message }

  const { data: prods } = await admin.from('scraper_productos').select('catalogo_id')
  const counts: Record<string, number> = {}
  for (const p of prods ?? []) counts[p.catalogo_id] = (counts[p.catalogo_id] ?? 0) + 1

  return { success: true, data: (cats ?? []).map(c => ({ ...c, productos: counts[c.id] ?? 0 })) }
}

export async function getScraperProductos(catalogoId: string): Promise<ActionResult<any[]>> {
  const auth = await ensureSuperAdmin()
  if (!auth.success) return auth
  const admin = createAdminClient()

  const { data: prods, error } = await admin
    .from('scraper_productos')
    .select('id, nombre, codigo, descripcion, url_origen, categoria_id')
    .eq('catalogo_id', catalogoId)
    .order('nombre')
    .limit(1000)
  if (error) return { success: false, error: error.message }
  if (!prods?.length) return { success: true, data: [] }

  const ids = prods.map(p => p.id)
  const { data: assets } = await admin
    .from('scraper_producto_assets')
    .select('producto_id, tipo, bucket, path_storage, filename')
    .in('producto_id', ids)

  // Firmar URLs (buckets privados) en batch por bucket — bypassa RLS vía admin.
  async function firmar(bucket: string, paths: string[]): Promise<Record<string, string>> {
    if (!paths.length) return {}
    const { data } = await admin.storage.from(bucket).createSignedUrls(paths, 3600)
    const map: Record<string, string> = {}
    ;(data ?? []).forEach((d: any) => { if (d.path && d.signedUrl) map[d.path] = d.signedUrl })
    return map
  }
  const fotosPaths = (assets ?? []).filter(a => a.bucket === BUCKET_FOTOS).map(a => a.path_storage)
  const fichasPaths = (assets ?? []).filter(a => a.bucket === BUCKET_FICHAS).map(a => a.path_storage)
  const [fotoMap, fichaMap] = await Promise.all([firmar(BUCKET_FOTOS, fotosPaths), firmar(BUCKET_FICHAS, fichasPaths)])

  const porProducto: Record<string, { fotos: string[]; fichas: { url: string; filename: string }[] }> = {}
  for (const a of assets ?? []) {
    const e = (porProducto[a.producto_id] ??= { fotos: [], fichas: [] })
    if (a.bucket === BUCKET_FOTOS && fotoMap[a.path_storage]) e.fotos.push(fotoMap[a.path_storage])
    else if (a.bucket === BUCKET_FICHAS && fichaMap[a.path_storage]) e.fichas.push({ url: fichaMap[a.path_storage], filename: a.filename })
  }

  return {
    success: true,
    data: prods.map(p => ({
      ...p,
      fotos: porProducto[p.id]?.fotos ?? [],
      fichas: porProducto[p.id]?.fichas ?? [],
    })),
  }
}
