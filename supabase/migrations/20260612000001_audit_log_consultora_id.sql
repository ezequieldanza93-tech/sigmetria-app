-- ============================================================
-- Sigmetría HyS — Audit log: escalabilidad fase 1
--
-- Problema original:
--   1. RLS SELECT hace double-JOIN a consultoras_members por cada fila
--      → O(n) queries en vez de O(1)
--   2. UPDATE serializa la fila completa → datos_antes = datos_nuevo en
--      campos sin cambio, desperdicia espacio y dificulta el análisis
--   3. fn_audit_trigger no conoce consultora_id → imposible indexar por consultora
--
-- Solución:
--   1. Agregar columna consultora_id (denormalización intencional)
--   2. Backfill desde consultoras_members
--   3. Índice compuesto (consultora_id, created_at) para paginación eficiente
--   4. fn_audit_trigger actualizada: resuelve consultora_id + diff-only UPDATE
--   5. RLS SELECT reemplazada por lookup O(1) contra consultora_id directo
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Agregar columna consultora_id
-- ============================================================
ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS consultora_id uuid
    REFERENCES public.consultoras(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Backfill: asignar consultora_id desde consultoras_members
--    Para usuarios con membresía activa tomamos la primera encontrada
--    (ORDER BY consultora_id para determinismo). Usuarios sin membresía
--    activa quedan en NULL (e.g. developer global).
-- ============================================================
UPDATE public.audit_log al
SET consultora_id = (
  SELECT cm.consultora_id
  FROM public.consultoras_members cm
  WHERE cm.user_id   = al.user_id
    AND cm.is_active = true
  ORDER BY cm.consultora_id
  LIMIT 1
)
WHERE al.user_id IS NOT NULL
  AND al.consultora_id IS NULL;

-- ============================================================
-- 3. Índice compuesto: paginación eficiente por consultora + fecha
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_audit_log_consultora_fecha
  ON public.audit_log (consultora_id, created_at DESC)
  WHERE consultora_id IS NOT NULL;

-- ============================================================
-- 4. Función de auditoría actualizada
--    Mejoras:
--    a) Resuelve consultora_id del usuario autenticado en tiempo de ejecución
--    b) Para UPDATE: almacena solo los campos que cambiaron (diff-only)
--       → reduce almacenamiento y facilita queries de análisis de cambios
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_registro_id   uuid;
  v_antes         jsonb;
  v_nuevo         jsonb;
  v_consultora_id uuid;
  v_uid           uuid;
  v_key           text;
  v_old_val       jsonb;
  v_new_val       jsonb;
  v_diff_antes    jsonb := '{}';
  v_diff_nuevo    jsonb := '{}';
BEGIN
  v_uid := auth.uid();

  -- Resolver consultora_id del usuario actual (una sola consulta por trigger)
  IF v_uid IS NOT NULL THEN
    SELECT cm.consultora_id INTO v_consultora_id
    FROM public.consultoras_members cm
    WHERE cm.user_id   = v_uid
      AND cm.is_active = true
    ORDER BY cm.consultora_id
    LIMIT 1;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_registro_id := NEW.id;
    v_antes       := NULL;
    v_nuevo       := to_jsonb(NEW);

  ELSIF TG_OP = 'UPDATE' THEN
    v_registro_id := NEW.id;

    -- Diff-only: almacenar solo los campos que realmente cambiaron
    FOR v_key IN SELECT key FROM jsonb_each(to_jsonb(OLD)) LOOP
      v_old_val := to_jsonb(OLD) -> v_key;
      v_new_val := to_jsonb(NEW) -> v_key;
      IF v_old_val IS DISTINCT FROM v_new_val THEN
        v_diff_antes := v_diff_antes || jsonb_build_object(v_key, v_old_val);
        v_diff_nuevo := v_diff_nuevo || jsonb_build_object(v_key, v_new_val);
      END IF;
    END LOOP;

    -- Si no cambió nada (trigger disparado sin cambios reales), no auditar
    IF v_diff_antes = '{}'::jsonb AND v_diff_nuevo = '{}'::jsonb THEN
      RETURN NEW;
    END IF;

    v_antes := v_diff_antes;
    v_nuevo := v_diff_nuevo;

  ELSIF TG_OP = 'DELETE' THEN
    v_registro_id := OLD.id;
    v_antes       := to_jsonb(OLD);
    v_nuevo       := NULL;
  END IF;

  INSERT INTO public.audit_log (
    tabla_nombre,
    accion,
    registro_id,
    user_id,
    consultora_id,
    datos_antes,
    datos_nuevo
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_registro_id,
    v_uid,
    v_consultora_id,
    v_antes,
    v_nuevo
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================================
-- 5. RLS SELECT: reemplazar double-JOIN por lookup O(1) directo
--    La política anterior hacía JOIN cm1→cm2 por cada fila del resultado.
--    La nueva compara consultora_id directamente — un solo subquery cacheado.
--
--    Roles con acceso al audit log de su consultora:
--      - full_access_main, full_access_branch (gestión completa)
--      - responsable_estandares (Art. 3.1 Res. SRT 48/2025)
--      - auditor_externo (si el rol existe — migración P3)
-- ============================================================
DROP POLICY IF EXISTS "audit_log: select" ON public.audit_log;

CREATE POLICY "audit_log: select"
  ON public.audit_log FOR SELECT TO authenticated
  USING (
    -- Developer: acceso global
    public.is_developer()

    -- Propio usuario ve sus propias entradas siempre
    OR user_id = (SELECT auth.uid())

    -- Miembros con rol de gestión/auditoría ven todo su consultora
    OR (
      consultora_id IS NOT NULL
      AND consultora_id = (
        SELECT cm.consultora_id
        FROM public.consultoras_members cm
        WHERE cm.user_id = (SELECT auth.uid())
          AND cm.is_active = true
          AND cm.role::text IN (
            'full_access_main',
            'full_access_branch',
            'responsable_estandares',
            'auditor_externo'
          )
        LIMIT 1
      )
    )
  );

COMMIT;
