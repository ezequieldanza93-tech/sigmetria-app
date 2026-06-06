/**
 * Constantes y tipos PUROS de buckets de Storage.
 *
 * Este módulo NO importa nada de server (ni `next/headers`, ni el cliente
 * Supabase server). Por eso puede importarse TANTO desde código cliente
 * (sign-client.ts, componentes 'use client') COMO desde server (upload.ts,
 * resolve-url.ts) sin arrastrar `next/headers` al bundle del cliente.
 *
 * Antes `BUCKET_IS_PUBLIC` vivía en upload.ts, pero upload.ts importa
 * `@/lib/supabase/server` → al importarlo desde sign-client.ts (cliente) el
 * build de Next fallaba ("You're importing a component that needs next/headers").
 */

/** Buckets que se suben vía `uploadAsset` (con validación de size/mime). */
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
