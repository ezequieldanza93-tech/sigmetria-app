-- ============================================================
-- Bucket privado `exports` — paquetes de PORTABILIDAD (Res. SRT 48/2025)
-- ============================================================
-- Por qué: para volúmenes grandes el ZIP de portabilidad se genera y se guarda
-- en Storage; al titular se le entrega un SIGNED URL temporal (TTL corto) en
-- vez de transferir el binario por la respuesta HTTP. El bucket es PRIVADO:
-- solo se accede vía signed URL firmado server-side con la sesión/permiso del
-- solicitante.
--
-- POSTURA DE SEGURIDAD (igual que 20260617000002): datos de cliente/compliance
-- => PRIVADO. Aislamiento por tenant: el path empieza con {consultora_id} y la
-- RLS usa el helper public.storage_path_consultora_id(name) (ya existente) para
-- restringir lectura/escritura a miembros activos de esa consultora.
--
-- Convención de path:
--   {consultora_id}/{empresa_id}/{timestamp}_sigmetria_export_*.zip
--
-- ADITIVA y NO aplicada (corrida autónoma): se versiona, no se pushea.
-- Idempotente: ON CONFLICT en bucket; DROP POLICY IF EXISTS + CREATE.
-- ============================================================

-- ─── 1. Declarar el bucket (privado) ────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'exports',
  'exports',
  false,                       -- PRIVADO
  524288000,                   -- 500 MB (paquetes grandes con binarios)
  ARRAY['application/zip','application/octet-stream']
)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ─── 2. RLS de lectura/escritura por tenant ─────────────────
-- Lectura: miembro ACTIVO de la consultora dueña del path (primer segmento).
DROP POLICY IF EXISTS "exports: members read" ON storage.objects;
CREATE POLICY "exports: members read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- Escritura (INSERT): idem. En la práctica el writer es el service role (que
-- bypasea RLS), pero dejamos la policy para que un usuario autenticado de la
-- consultora también pueda escribir su propio export si se hiciera client-side.
DROP POLICY IF EXISTS "exports: members insert" ON storage.objects;
CREATE POLICY "exports: members insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- DELETE: idem (limpieza de exports viejos por el dueño / GC).
DROP POLICY IF EXISTS "exports: members delete" ON storage.objects;
CREATE POLICY "exports: members delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'exports'
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- NOTA: la limpieza/expiración de paquetes viejos (TTL del objeto en Storage)
-- queda como tarea de mantenimiento (cron). El signed URL ya expira por TTL.
