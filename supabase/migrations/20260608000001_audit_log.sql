-- ============================================================
-- Sigmetría HyS — Trazabilidad completa (Art. 4.2 Res. SRT 48/2025)
--
-- 1. Tabla audit_log (inmutable, append-only)
-- 2. Función genérica fn_audit_trigger (SECURITY DEFINER)
-- 3. Triggers en las 8 tablas funcionales
-- 4. RLS: SELECT restringido, INSERT/UPDATE/DELETE bloqueados
-- ============================================================

BEGIN;

-- ============================================================
-- 1. Tabla audit_log
-- ============================================================
CREATE TABLE public.audit_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_nombre  text        NOT NULL,
  accion        text        NOT NULL CHECK (accion IN ('INSERT','UPDATE','DELETE')),
  registro_id   uuid        NOT NULL,
  user_id       uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  datos_antes   jsonb,
  datos_nuevo   jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Índices: búsqueda por registro, por usuario, por fecha
CREATE INDEX idx_audit_log_tabla_registro
  ON public.audit_log (tabla_nombre, registro_id);

CREATE INDEX idx_audit_log_user_id
  ON public.audit_log (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX idx_audit_log_created_at
  ON public.audit_log (created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 2. Función genérica de auditoría
-- SECURITY DEFINER: corre como postgres, bypasea RLS al insertar.
-- auth.uid() funciona porque el JWT context es de sesión.
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_audit_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_registro_id uuid;
  v_antes       jsonb;
  v_nuevo       jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_registro_id := NEW.id;
    v_antes       := NULL;
    v_nuevo       := to_jsonb(NEW);

  ELSIF TG_OP = 'UPDATE' THEN
    v_registro_id := NEW.id;
    v_antes       := to_jsonb(OLD);
    v_nuevo       := to_jsonb(NEW);

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
    datos_antes,
    datos_nuevo
  ) VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_registro_id,
    auth.uid(),
    v_antes,
    v_nuevo
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;


-- ============================================================
-- 3. Triggers en las tablas funcionales
-- Nota: capacitacion_asistentes fue renombrada en 20260522000001
--       → nombre actual: capacitaciones_asistentes
-- Nota: empleados y documentos fueron reemplazadas por un modelo
--       más granular (personas_directorio / establecimientos_documentos)
--       en migraciones posteriores a 20260514000003 — no se aplican aquí.
-- ============================================================

DROP TRIGGER IF EXISTS audit_siniestros ON public.siniestros;
CREATE TRIGGER audit_siniestros
  AFTER INSERT OR UPDATE OR DELETE ON public.siniestros
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_inspecciones ON public.inspecciones;
CREATE TRIGGER audit_inspecciones
  AFTER INSERT OR UPDATE OR DELETE ON public.inspecciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_capacitaciones ON public.capacitaciones;
CREATE TRIGGER audit_capacitaciones
  AFTER INSERT OR UPDATE OR DELETE ON public.capacitaciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_capacitaciones_asistentes ON public.capacitaciones_asistentes;
CREATE TRIGGER audit_capacitaciones_asistentes
  AFTER INSERT OR UPDATE OR DELETE ON public.capacitaciones_asistentes
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_riesgos ON public.riesgos;
CREATE TRIGGER audit_riesgos
  AFTER INSERT OR UPDATE OR DELETE ON public.riesgos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_mediciones ON public.mediciones;
CREATE TRIGGER audit_mediciones
  AFTER INSERT OR UPDATE OR DELETE ON public.mediciones
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- ============================================================
-- 4. RLS policies para audit_log
--
-- SELECT:
--   - developer ve todo
--   - cada usuario ve sus propias entradas
--   - full_access_main / full_access_branch ven las entradas de
--     los miembros de su misma consultora
--
-- INSERT: bloqueado para usuarios — el trigger SECURITY DEFINER
--         corre como postgres y bypasea esta restricción.
--
-- UPDATE / DELETE: nadie (inmutabilidad total)
-- ============================================================

CREATE POLICY "audit_log: select"
  ON public.audit_log FOR SELECT TO authenticated
  USING (
    public.is_developer()
    OR user_id = (SELECT auth.uid())
    OR (
      user_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM public.consultoras_members cm1
        JOIN public.consultoras_members cm2
          ON cm2.consultora_id = cm1.consultora_id
        WHERE cm1.user_id   = (SELECT auth.uid())
          AND cm1.is_active = true
          AND cm1.role IN ('full_access_main', 'full_access_branch')
          AND cm2.user_id   = audit_log.user_id
          AND cm2.is_active = true
      )
    )
  );

CREATE POLICY "audit_log: insert"
  ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (false);

CREATE POLICY "audit_log: update"
  ON public.audit_log FOR UPDATE TO authenticated
  USING (false);

CREATE POLICY "audit_log: delete"
  ON public.audit_log FOR DELETE TO authenticated
  USING (false);

COMMIT;
