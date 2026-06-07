-- ============================================================
-- Hardening de RLS de storage: cerrar lectura/escritura cross-tenant
-- en buckets ya privados y limpiar policies legacy del dashboard.
-- ============================================================
-- Contexto: la privatización de `documentos`/`establecimientos`
-- (migr 20260617000004) flipeó buckets.public=false PERO dejó vivas policies
-- legacy creadas desde el dashboard de Supabase que ANULAN el aislamiento
-- multi-tenant (las RLS permisivas se combinan con OR):
--
--   - "Documentos son públicos"  (SELECT, role=public, qual: bucket_id='documentos')
--       -> cualquier usuario firma/lee CUALQUIER objeto de documentos (cross-tenant).
--         Con el bucket privado, createSignedUrl corre un SELECT bajo la RLS del
--         usuario: esta policy lo deja firmar paths de CUALQUIER consultora.
--   - "Usuarios autenticados pueden subir documentos" (INSERT, solo chequea bucket_id)
--       -> cualquier autenticado escribe en cualquier path de documentos.
--   - "Usuarios autenticados pueden actualizar/eliminar sus documentos" (owner)
--       -> redundantes con las structured 'legacy assets: members *'.
--
-- Las policies estructuradas que QUEDAN ('legacy assets: members read/insert/
-- update/delete' + 'private assets: owner read fallback') ya implementan el
-- aislamiento por tenant: match cm.consultora_id = storage_path_consultora_id(name),
-- donde storage_path_consultora_id() devuelve el PRIMER segmento del path.
-- VERIFICADO que TODOS los writers vigentes de documentos/establecimientos
-- prefijan el path con {consultora_id} (tenantStoragePath y equivalentes), así
-- que cerrar estas policies NO rompe ningún flujo actual.
--
-- También se remueve el escape-hatch 'storage_path_consultora_id(name) IS NULL'
-- de las policies de ESCRITURA legacy (permitía a cualquier miembro escribir/
-- borrar objetos con path tenant-less); y se cierra el bucket deprecado y vacío
-- 'planos-establecimientos' (estaba público).
--
-- NO se toca subcontratistas / organizaciones_externas: su modelo es GLOBAL por
-- diseño (organizaciones_externas.scope='global', sin consultora_id; su propia
-- RLS expone a cualquier miembro activo) — no es tenant-scoped. Ajustarlo es una
-- decisión de producto, no deuda de este refactor.
--
-- Idempotente.
-- ============================================================

-- ─── 1. documentos: dropear policies legacy del dashboard ───────────────────
-- "Documentos son públicos" puede tener distinta codificación del acento (ú);
-- la buscamos por patrón y la dropeamos por su nombre real para no fallar el match.
DO $$
DECLARE pol text;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND cmd = 'SELECT'
      AND policyname ILIKE 'Documentos son p%blicos'
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', pol);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Usuarios autenticados pueden subir documentos" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar sus documentos" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar sus documentos" ON storage.objects;

-- ─── 2. Remover el escape-hatch tenant-less de las policies de escritura ────
-- Cubren documentos/establecimientos/consultoras/avatars. avatars y consultoras
-- siguen exentos del match por tenant (no usan path tenant-prefijado). Para
-- documentos/establecimientos se exige el match de la consultora del 1er segmento.
DROP POLICY IF EXISTS "legacy assets: members insert" ON storage.objects;
CREATE POLICY "legacy assets: members insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['documentos','establecimientos','consultoras','avatars'])
    AND (
      bucket_id = ANY (ARRAY['avatars','consultoras'])
      OR EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = (SELECT auth.uid())
          AND cm.is_active = true
          AND cm.consultora_id = public.storage_path_consultora_id(name)
      )
    )
  );

DROP POLICY IF EXISTS "legacy assets: members update" ON storage.objects;
CREATE POLICY "legacy assets: members update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['documentos','establecimientos','consultoras','avatars'])
    AND (
      bucket_id = ANY (ARRAY['avatars','consultoras'])
      OR EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = (SELECT auth.uid())
          AND cm.is_active = true
          AND cm.consultora_id = public.storage_path_consultora_id(name)
      )
    )
  );

DROP POLICY IF EXISTS "legacy assets: members delete" ON storage.objects;
CREATE POLICY "legacy assets: members delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['documentos','establecimientos','consultoras','avatars'])
    AND (
      bucket_id = ANY (ARRAY['avatars','consultoras'])
      OR EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = (SELECT auth.uid())
          AND cm.is_active = true
          AND cm.consultora_id = public.storage_path_consultora_id(name)
      )
    )
  );

-- ─── 3. planos-establecimientos: bucket deprecado y vacío -> privado y cerrado ──
UPDATE storage.buckets SET public = false WHERE id = 'planos-establecimientos';
DROP POLICY IF EXISTS "planos_establecimientos_select" ON storage.objects;
DROP POLICY IF EXISTS "planos_establecimientos_insert" ON storage.objects;
DROP POLICY IF EXISTS "planos_establecimientos_delete" ON storage.objects;
