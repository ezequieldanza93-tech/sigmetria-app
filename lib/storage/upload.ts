import { createClient } from '@/lib/supabase/server'

export type AssetBucket =
  | 'logos'
  | 'consultora'
  | 'firmas'
  | 'matriculas'
  | 'planos'
  | 'certificados'
  | 'incidentes'
  | 'denuncias'
  | 'subcontratistas'

export type EntityType =
  | 'empresa'
  | 'establecimiento'
  | 'consultora'
  | 'profesional'
  | 'matricula_prof'
  | 'matricula'
  | 'certificado_calibracion'
  | 'incidente'
  | 'denuncia'
  | 'subcontratista'

interface BucketConfig {
  maxBytes: number
  mimes: readonly string[]
  public: boolean
}

const BUCKETS: Record<AssetBucket, BucketConfig> = {
  logos:        { maxBytes: 2  * 1024 * 1024, mimes: ['image/png','image/jpeg','image/webp','image/svg+xml'], public: true  },
  consultora:   { maxBytes: 2  * 1024 * 1024, mimes: ['image/png','image/jpeg','image/webp','image/svg+xml'], public: true  },
  firmas:       { maxBytes: 1  * 1024 * 1024, mimes: ['image/png','image/jpeg','image/svg+xml'],              public: false },
  matriculas:   { maxBytes: 5  * 1024 * 1024, mimes: ['image/jpeg','image/png','application/pdf'],            public: false },
  planos:       { maxBytes: 20 * 1024 * 1024, mimes: ['application/pdf','image/png','image/jpeg'],            public: false },
  certificados: { maxBytes: 5  * 1024 * 1024, mimes: ['application/pdf','image/png','image/jpeg'],            public: false },
  incidentes:   { maxBytes: 10 * 1024 * 1024, mimes: ['image/jpeg','image/png','image/webp','image/heic'],    public: false },
  denuncias:    { maxBytes: 10 * 1024 * 1024, mimes: ['image/jpeg','image/png','image/webp','image/heic'],    public: false },
  subcontratistas: { maxBytes: 10 * 1024 * 1024, mimes: ['application/pdf','image/jpeg','image/png'],        public: false },
}

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
}

function extFromMime(mime: string, fallbackName: string): string {
  const fromMime = EXT_BY_MIME[mime]
  if (fromMime) return fromMime
  const fromName = fallbackName.split('.').pop()?.toLowerCase()
  return fromName && fromName.length <= 6 ? fromName : 'bin'
}

interface UploadOptions {
  bucket: AssetBucket
  consultoraId: string
  entityType: EntityType
  entityId: string
  kind: string
  file: File
}

export type UploadResult =
  | { ok: true; url: string; path: string }
  | { ok: false; error: string }

/**
 * Sube un archivo al bucket correspondiente con validación de size + mime.
 * Path determinístico: {consultoraId}/{entityType}/{entityId}/{kind}.{ext}
 * Si el bucket es público, retorna la URL pública. Si es privado, retorna una signed URL (1 año).
 */
export async function uploadAsset(opts: UploadOptions): Promise<UploadResult> {
  const { bucket, consultoraId, entityType, entityId, kind, file } = opts
  const cfg = BUCKETS[bucket]

  if (!file || file.size === 0) {
    return { ok: false, error: 'Archivo vacío o inválido' }
  }
  if (file.size > cfg.maxBytes) {
    return { ok: false, error: `El archivo supera el límite de ${(cfg.maxBytes / 1024 / 1024).toFixed(1)} MB` }
  }
  if (!cfg.mimes.includes(file.type)) {
    return { ok: false, error: `Tipo de archivo no permitido (${file.type}). Permitidos: ${cfg.mimes.join(', ')}` }
  }

  const ext = extFromMime(file.type, file.name)
  const safeKind = kind.replace(/[^a-zA-Z0-9_-]/g, '_')
  const path = `${consultoraId}/${entityType}/${entityId}/${safeKind}.${ext}`

  const supabase = await createClient()
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' })

  if (error) {
    return { ok: false, error: error.message }
  }

  if (cfg.public) {
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return { ok: true, url: data.publicUrl, path }
  }

  const { data, error: signErr } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60 * 24 * 365)
  if (signErr || !data) {
    return { ok: false, error: signErr?.message ?? 'No se pudo generar URL firmada' }
  }
  return { ok: true, url: data.signedUrl, path }
}

/**
 * Borra un asset del Storage. Usado al reemplazar uno existente.
 * No tira error si el archivo no existe (idempotente).
 */
export async function deleteAsset(bucket: AssetBucket, path: string): Promise<void> {
  if (!path) return
  const supabase = await createClient()
  await supabase.storage.from(bucket).remove([path])
}

/**
 * Extrae el path interno del bucket a partir de la URL guardada en DB.
 * Funciona tanto con URLs públicas como signed URLs.
 */
export function pathFromUrl(url: string, bucket: AssetBucket): string | null {
  if (!url) return null
  const marker = `/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const after = url.substring(idx + marker.length)
  return after.split('?')[0]
}
