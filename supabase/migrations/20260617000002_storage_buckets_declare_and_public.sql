-- ============================================================
-- Storage buckets: declarar los creados a mano + postura de seguridad
-- ============================================================
-- Contexto: los buckets `documentos`, `establecimientos`, `consultoras` y
-- `avatars` fueron creados a mano en el dashboard (sin migración) → no son
-- reproducibles en un entorno nuevo. Acá se declaran idempotentemente.
--
-- Decisión de diseño (refactor de paths): la app guarda el PATH relativo y
-- deriva la URL on-read. El proveedor expone dos formas de derivar la URL:
--   - Bucket PÚBLICO  → publicAssetUrl()/getPublicUrl(): string puro, sin red.
--   - Bucket PRIVADO  → signed URL (createSignedUrl/createSignedUrls), TTL corto,
--                       firmada con la sesión del usuario (respeta RLS).
--
-- POSTURA DE SEGURIDAD (decisión del dueño: SEGURIDAD ANTE TODO):
-- Solo son PÚBLICOS los buckets de branding inofensivo. TODO bucket que pueda
-- contener datos de cliente, trabajador o compliance (firmas digitales,
-- documentos, certificados, matrículas, planos, material de cursos, etc.) es
-- PRIVADO y se sirve con signed URLs. Ante la duda → PRIVADO.
--
--   🟢 PÚBLICOS  : logos, consultora, consultoras, avatars, cursos-portadas
--   🔴 PRIVADOS  : firmas, certificados, matriculas, subcontratistas,
--                  cursos-certificados, planos, cursos-material
--
-- ⚠️ EXCEPCIÓN TEMPORAL — documentos / establecimientos (deben ser privados,
-- pero AÚN NO se flipean acá):
--   Tienen datos LEGACY (21 filas) guardados como URL pública absoluta
--   (.../object/public/documentos/...). Si se flipea a privado, esas URLs
--   devuelven 403 y el resolver las pasa tal cual (legacy) → se rompen TODOS los
--   documentos/evidencias existentes. Además sus paths no tienen consultora_id
--   adelante, así que la lectura colaborativa por tenant no matchea.
--   La privatización se hace en un cambio DEDICADO Y TESTEADO: convertir las
--   URLs legacy a paths, garantizar que los uploads nuevos usen paths con tenant,
--   arreglar la policy de lectura colaborativa, y RECIÉN AHÍ flipear a privado.
--   Por eso esta migración los DEJA PÚBLICOS (estado actual, sin cambio).
--
-- Lectura de buckets privados: en el cliente se firma con createSignedUrls
-- (batch) usando el cliente del browser (respeta sesión + RLS); en el servidor
-- se usa resolveAssetUrl()/resolveAssetUrls() (lib/storage/resolve-url.ts).
--
-- Idempotente: ON CONFLICT DO UPDATE en buckets; UPDATE explícito de public;
-- DROP POLICY IF EXISTS + CREATE en policies.
-- ============================================================

-- ─── 1. Declarar buckets creados a mano ─────────────────────
-- Objetivo: que estos buckets existan en un entorno NUEVO (reproducibilidad).
-- `documentos` y `establecimientos` se declaran PÚBLICOS por ahora (ver EXCEPCIÓN
-- TEMPORAL en la cabecera). `consultoras` y `avatars` son branding → PÚBLICOS.
--
-- El ON CONFLICT sincroniza SOLO `public`: NO pisa file_size_limit ni
-- allowed_mime_types de buckets ya existentes, para no imponer un allowlist de
-- mimes/size que podría romper flujos de upload vigentes (documentos hoy tiene
-- límite nulo = sin restricción). Los valores de size/mime de abajo aplican solo
-- al CREAR el bucket en un entorno nuevo.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  -- Documentos generales (PDF/imágenes/office). PÚBLICO temporal (ver cabecera).
  ('documentos',      'documentos',      true,  20 * 1024 * 1024,
    ARRAY['application/pdf','image/png','image/jpeg','image/webp','image/heic',
          'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
  -- Fotos de sitio de establecimientos. PÚBLICO temporal (ver cabecera).
  ('establecimientos','establecimientos',true,  10 * 1024 * 1024,
    ARRAY['image/png','image/jpeg','image/webp','image/heic']),
  -- Assets varios de consultoras (alias histórico de `consultora`, branding) → PÚBLICO
  ('consultoras',     'consultoras',     true,  2  * 1024 * 1024,
    ARRAY['image/png','image/jpeg','image/webp','image/svg+xml']),
  -- Avatares de usuarios (branding inofensivo) → PÚBLICO
  ('avatars',         'avatars',         true,  2  * 1024 * 1024,
    ARRAY['image/png','image/jpeg','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public;

-- ─── 2. Forzar la postura público/privado por bucket ─────────
-- 🟢 PÚBLICOS: branding inofensivo + documentos/establecimientos (excepción
-- temporal, ver cabecera). Se listan documentos/establecimientos EXPLÍCITAMENTE
-- para garantizar que esta migración NO los flipee a privado.
UPDATE storage.buckets
SET public = true
WHERE id IN (
  'logos','consultora','consultoras','avatars','cursos-portadas',
  'documentos','establecimientos'
);

-- 🔴 PRIVADOS: datos de cliente/trabajador/compliance. Se sirven con signed URLs.
-- (documentos y establecimientos NO están acá: ver EXCEPCIÓN TEMPORAL en cabecera.)
UPDATE storage.buckets
SET public = false
WHERE id IN (
  'firmas','certificados','matriculas','subcontratistas',
  'cursos-certificados','planos','cursos-material'
);

-- ─── 3. RLS de ESCRITURA para documentos/establecimientos/consultoras/avatars ──
-- Escritura restringida a usuarios autenticados de la consultora dueña del path
-- (primer segmento del path = consultora_id, reutilizando el helper de
-- 20260521172801). Se mantienen tal cual estaban: no cambia la escritura.

-- INSERT
DROP POLICY IF EXISTS "legacy assets: members insert" ON storage.objects;
CREATE POLICY "legacy assets: members insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('documentos','establecimientos','consultoras','avatars')
    AND (
      -- avatars y consultoras: path arbitrario, basta estar autenticado
      bucket_id IN ('avatars','consultoras')
      -- documentos/establecimientos: si el path empieza con un consultora_id,
      -- el usuario debe ser miembro de esa consultora; si no, basta auth
      OR public.storage_path_consultora_id(name) IS NULL
      OR EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = (SELECT auth.uid())
          AND cm.is_active = true
          AND cm.consultora_id = public.storage_path_consultora_id(name)
      )
    )
  );

-- UPDATE
DROP POLICY IF EXISTS "legacy assets: members update" ON storage.objects;
CREATE POLICY "legacy assets: members update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('documentos','establecimientos','consultoras','avatars')
    AND (
      bucket_id IN ('avatars','consultoras')
      OR public.storage_path_consultora_id(name) IS NULL
      OR EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = (SELECT auth.uid())
          AND cm.is_active = true
          AND cm.consultora_id = public.storage_path_consultora_id(name)
      )
    )
  );

-- DELETE
DROP POLICY IF EXISTS "legacy assets: members delete" ON storage.objects;
CREATE POLICY "legacy assets: members delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('documentos','establecimientos','consultoras','avatars')
    AND (
      bucket_id IN ('avatars','consultoras')
      OR public.storage_path_consultora_id(name) IS NULL
      OR EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = (SELECT auth.uid())
          AND cm.is_active = true
          AND cm.consultora_id = public.storage_path_consultora_id(name)
      )
    )
  );

-- ─── 4. RLS de LECTURA (SELECT) para documentos/establecimientos ──
-- PREPARACIÓN para la futura privatización: agregamos la policy de SELECT por
-- membresía AHORA, aunque estos buckets sigan PÚBLICOS por la excepción temporal.
-- En un bucket público la lectura por URL pública NO pasa por RLS, así que esta
-- policy es INOFENSIVA hoy (solo agrega un grant para usuarios autenticados, no
-- restringe nada) y deja el terreno listo para cuando se flipeen a privado.
-- Patrón de membresía: solo miembros ACTIVOS de la consultora dueña del path.
--
-- Caso A — path bien formado {consultora_id}/...: lo lee cualquier miembro
-- ACTIVO de esa consultora (sharing dentro del tenant).
DROP POLICY IF EXISTS "legacy assets: members read" ON storage.objects;
CREATE POLICY "legacy assets: members read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('documentos','establecimientos')
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.consultora_id = public.storage_path_consultora_id(name)
    )
  );

-- ─── 4b. Fallback por OWNER para paths SIN tenant en el primer segmento ──
-- ATENCIÓN (deuda técnica): varios writers de buckets privados NO prefijan el
-- path con el consultora_id. Esquemas tenant-less detectados:
--   documentos: `formularios/...`, `formularios-fotos/...`, `incidentes/...`,
--               `evidencias/...`, `reportes-fotograficos/...`,
--               `observaciones-fotos/...`
--   planos:     `{establecimiento_id}/...` (establecimiento_id, NO consultora_id)
-- Para esos paths storage_path_consultora_id() devuelve NULL o un UUID que no es
-- de consultora → la policy de arriba NO matchea.
--
-- Mientras se migran esos paths al esquema {consultora_id}/... (ver RIESGOS),
-- damos un fallback SEGURO: el USUARIO que SUBIÓ el objeto (owner_id = auth.uid())
-- siempre puede leerlo. Cubre el caso típico (mismo usuario sube y ve, p.ej. el
-- auto-download post-finalización de formularios) SIN abrir lectura cross-tenant.
-- NO usa una regla "cualquier miembro" porque sería un leak entre consultoras.
DROP POLICY IF EXISTS "private assets: owner read fallback" ON storage.objects;
CREATE POLICY "private assets: owner read fallback" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN (
      'documentos','establecimientos','firmas','certificados','matriculas',
      'subcontratistas','planos','cursos-material','cursos-certificados'
    )
    AND owner_id = (SELECT auth.uid()::text)
  );

-- ─── 5. Deprecar bucket `planos-establecimientos` ───────────
-- Los uploads de planos se unificaron al bucket `planos` (ver
-- lib/actions/establecimiento.ts, app/api/upload-plano/route.ts, iperc.ts).
-- No borramos el bucket (puede tener datos de prueba) pero lo marcamos.
--
-- NOTA: NO usamos `COMMENT ON TABLE storage.buckets` porque el rol de migración
-- no es dueño de esa tabla (ERROR 42501 must be owner). La doc queda acá:
--   `planos-establecimientos` está DEPRECADO → usar `planos`.
--   Postura: PRIVADO por defecto para datos sensibles (firmas, certificados,
--   matriculas, subcontratistas, cursos-certificados, planos, cursos-material).
--   Público: branding (logos, consultora, consultoras, avatars, cursos-portadas).
--   EXCEPCIÓN TEMPORAL: documentos y establecimientos quedan PÚBLICOS hasta el
--   cambio dedicado que migre las URLs legacy a paths y arregle la lectura por
--   tenant; recién entonces pasan a PRIVADO.;
