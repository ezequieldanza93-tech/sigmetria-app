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
  | 'cursos-material'
  | 'cursos-portadas'
  | 'cursos-certificados'

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
  | 'curso'

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
  'cursos-material':    { maxBytes: 500 * 1024 * 1024, mimes: ['video/mp4','video/webm','application/pdf','image/png','image/jpeg','image/webp'], public: false },
  'cursos-portadas':    { maxBytes: 5 * 1024 * 1024, mimes: ['image/png','image/jpeg','image/webp'],                                            public: true  },
  'cursos-certificados':{ maxBytes: 5 * 1024 * 1024, mimes: ['application/pdf'],                                                                 public: false },
}

/**
 * Nombre de cualquier bucket REAL de la app (no solo los que se suben con
 * uploadAsset). Incluye los buckets creados a mano (documentos, establecimientos,
 * consultoras, avatars) que también se LEEN on-read.
 */
export type StorageBucket =
  | AssetBucket
  | 'documentos'
  | 'establecimientos'
  | 'consultoras'
  | 'avatars'

/**
 * Fuente de verdad público/privado por bucket. Debe estar ALINEADA con la
 * migración 20260617000002_storage_buckets_declare_and_public.sql.
 *
 * Postura: SEGURIDAD ANTE TODO. Solo branding inofensivo es público; todo bucket
 * con datos de cliente/trabajador/compliance es privado (signed URLs).
 *
 * Usado por el resolver server-side (resolve-url.ts) y por el firmador
 * client-side (sign-client.ts).
 */
export const BUCKET_IS_PUBLIC: Record<StorageBucket, boolean> = {
  // 🟢 PÚBLICOS — branding inofensivo
  logos: true,
  consultora: true,
  consultoras: true,
  avatars: true,
  'cursos-portadas': true,
  // ⚠️ PÚBLICOS POR EXCEPCIÓN TEMPORAL — deberían ser privados, pero tienen datos
  // legacy guardados como URL pública absoluta y paths sin tenant. Hasta el cambio
  // dedicado que migre esos datos, el bucket sigue público (ver migración
  // 20260617000002). DEBE coincidir con storage.buckets.public en la DB: si acá
  // dijera false, el código firmaría (createSignedUrl) y la firma cruzada fallaría
  // por RLS en paths sin tenant → lectura rota entre compañeros.
  documentos: true,
  establecimientos: true,
  // 🔴 PRIVADOS — datos sensibles, signed URLs
  firmas: false,
  matriculas: false,
  planos: false,
  certificados: false,
  incidentes: false,
  denuncias: false,
  subcontratistas: false,
  'cursos-material': false,
  'cursos-certificados': false,
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

/**
 * Resultado de subida.
 *
 * IMPORTANTE (escalabilidad): a partir del refactor de pre-lanzamiento,
 * el flujo persiste SIEMPRE el `path` relativo del objeto (no la URL).
 * La URL se deriva on-read con `resolveAssetUrl` (lib/storage/resolve-url.ts).
 *
 * Esto evita atar la DB al dominio/proveedor actual y elimina las signed URLs
 * de 1 año (que mueren solas y filtran el token en la columna).
 */
export type UploadResult =
  | { ok: true; bucket: AssetBucket; path: string }
  | { ok: false; error: string }

/**
 * Sube un archivo al bucket correspondiente con validación de size + mime.
 * Path determinístico: {consultoraId}/{entityType}/{entityId}/{kind}.{ext}
 *
 * Devuelve { bucket, path } — el caller debe persistir el PATH, no una URL.
 * Para mostrar el archivo, usar `resolveAssetUrl(bucket, path)`.
 *
 * Registra cada subida exitosa en la tabla maestra `public.archivos`
 * (auditoría / GC). El registro nunca rompe la subida: si falla, se loguea.
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

  // Registrar en la tabla maestra de archivos (best-effort, no bloqueante).
  await registerArchivo(supabase, {
    consultoraId,
    bucket,
    path,
    sizeBytes: file.size,
    mime: file.type,
    entityType,
    entityId,
  })

  return { ok: true, bucket, path }
}

interface RegisterArchivoInput {
  consultoraId: string
  bucket: AssetBucket
  path: string
  sizeBytes: number
  mime: string
  entityType: EntityType
  entityId: string
}

/**
 * Registra (upsert por bucket+path) un archivo en la tabla maestra `archivos`.
 * Best-effort: ante error, loguea y sigue — nunca rompe el flujo de subida.
 * El `uploaded_by` lo resuelve la propia DB? No: lo seteamos acá con el user actual.
 */
async function registerArchivo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  input: RegisterArchivoInput,
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('archivos')
      .upsert(
        {
          consultora_id: input.consultoraId,
          bucket: input.bucket,
          path: input.path,
          size_bytes: input.sizeBytes,
          mime: input.mime,
          entity_type: input.entityType,
          entity_id: input.entityId,
          uploaded_by: user?.id ?? null,
          deleted_at: null,
        },
        { onConflict: 'bucket,path' },
      )
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[uploadAsset] No se pudo registrar en archivos:', err)
    }
  }
}

/**
 * Borra un asset del Storage. Usado al reemplazar uno existente.
 * No tira error si el archivo no existe (idempotente).
 *
 * Marca también el registro en `archivos` como borrado (soft) para auditoría.
 */
export async function deleteAsset(bucket: AssetBucket, path: string): Promise<void> {
  if (!path) return
  const supabase = await createClient()
  await supabase.storage.from(bucket).remove([path])
  try {
    await supabase
      .from('archivos')
      .update({ deleted_at: new Date().toISOString() })
      .eq('bucket', bucket)
      .eq('path', path)
      .is('deleted_at', null)
  } catch {
    /* best-effort */
  }
}

/**
 * Extrae el path interno del bucket a partir de una URL guardada en DB.
 * Funciona tanto con URLs públicas como signed URLs.
 *
 * Útil para datos LEGACY donde la columna guardó una URL absoluta en vez
 * del path. Para datos nuevos la columna ya es el path y no hace falta.
 */
export function pathFromUrl(url: string, bucket: AssetBucket): string | null {
  if (!url) return null
  const marker = `/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  const after = url.substring(idx + marker.length)
  return after.split('?')[0]
}

/**
 * Normaliza un valor guardado en DB a un PATH de storage, tolerando legacy.
 *
 * - Si es una URL absoluta (dato viejo) → extrae el path con pathFromUrl.
 * - Si ya es un path relativo (dato nuevo) → lo devuelve tal cual.
 *
 * Usar antes de `deleteAsset` cuando la columna puede contener cualquiera
 * de los dos formatos durante la transición.
 */
export function storagePath(value: string | null | undefined, bucket: AssetBucket): string | null {
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return pathFromUrl(value, bucket)
  return value
}
