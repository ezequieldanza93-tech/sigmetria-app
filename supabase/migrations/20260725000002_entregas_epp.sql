-- ============================================================
-- Entrega de EPP con conformidad / descargo POR ÍTEM (validez legal)
-- ============================================================
-- El profesional registra QUÉ EPP le entregó a un trabajador. El trabajador
-- (usuario con cuenta + MFA) recibe la entrega y, ÍTEM POR ÍTEM, da conformidad
-- o hace descargo ("no son los guantes adecuados", "el zapato me queda chico").
--
-- Validez legal: la tabla se engancha al audit_log con hash encadenado
-- (fn_audit_trigger resuelve consultora_id → cadena por consultora). Cada
-- respuesta del trabajador queda sellada con actor (auth.uid), timestamp y hash.
-- La firma manuscrita opcional reutiliza la tabla `firmas` (entidad_tipo='entrega_epp').
--
-- Migración ADITIVA. No toca migraciones aplicadas.
-- ============================================================

BEGIN;

-- ── Encabezado de la entrega (un acto de entrega a un trabajador) ──────────────
CREATE TABLE IF NOT EXISTS public.entregas_epp (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id       uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  establecimiento_id  uuid REFERENCES public.establecimientos(id) ON DELETE SET NULL,
  persona_id          uuid NOT NULL REFERENCES public.personas_directorio(id) ON DELETE RESTRICT,
  entregado_por_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entregado_por_nombre text,                                  -- snapshot del profesional
  fecha_entrega       date NOT NULL DEFAULT CURRENT_DATE,
  estado              text NOT NULL DEFAULT 'pendiente'
                        CHECK (estado IN ('pendiente','parcial','confirmada','observada')),
  observaciones       text,                                   -- notas del profesional
  -- geo-sello del momento del registro (opcional)
  geo_lat             double precision,
  geo_lng             double precision,
  geo_precision_m     double precision,
  geo_captured_at     timestamptz,
  -- conformidad global del trabajador
  respondida_at       timestamptz,
  firma_id            uuid REFERENCES public.firmas(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entregas_epp_consultora    ON public.entregas_epp(consultora_id);
CREATE INDEX IF NOT EXISTS idx_entregas_epp_persona       ON public.entregas_epp(persona_id);
CREATE INDEX IF NOT EXISTS idx_entregas_epp_establecimiento ON public.entregas_epp(establecimiento_id);

-- ── Ítems de la entrega (conformidad / descargo POR ÍTEM) ──────────────────────
-- consultora_id denormalizado: que fn_resolve_consultora_id resuelva la cadena de
-- custodia por consultora (la tabla solo tiene entrega_id de otro modo → cadena global).
CREATE TABLE IF NOT EXISTS public.entregas_epp_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id      uuid NOT NULL REFERENCES public.entregas_epp(id) ON DELETE CASCADE,
  consultora_id   uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  producto_id     uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  variante_id     uuid REFERENCES public.producto_variantes(id) ON DELETE SET NULL,
  -- snapshot de QUÉ se entregó (validez legal: queda congelado aunque el catálogo cambie)
  producto_nombre text NOT NULL,
  talle           text,
  cantidad        numeric NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  -- conformidad por ítem
  conformidad     text NOT NULL DEFAULT 'pendiente'
                    CHECK (conformidad IN ('pendiente','conforme','observado')),
  descargo        text,                                       -- motivo del trabajador si observa
  respondido_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entregas_epp_items_entrega ON public.entregas_epp_items(entrega_id);

-- Copia el consultora_id desde el encabezado si no se provee (robustez + audit chain correcta).
CREATE OR REPLACE FUNCTION public.fn_entregas_epp_items_set_consultora()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.consultora_id IS NULL THEN
    SELECT consultora_id INTO NEW.consultora_id FROM public.entregas_epp WHERE id = NEW.entrega_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_entregas_epp_items_consultora ON public.entregas_epp_items;
CREATE TRIGGER trg_entregas_epp_items_consultora
  BEFORE INSERT ON public.entregas_epp_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_entregas_epp_items_set_consultora();

-- ── Cadena de custodia: auditar ambas tablas (hash encadenado por consultora) ──
DROP TRIGGER IF EXISTS audit_entregas_epp ON public.entregas_epp;
CREATE TRIGGER audit_entregas_epp
  AFTER INSERT OR UPDATE OR DELETE ON public.entregas_epp
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

DROP TRIGGER IF EXISTS audit_entregas_epp_items ON public.entregas_epp_items;
CREATE TRIGGER audit_entregas_epp_items
  AFTER INSERT OR UPDATE OR DELETE ON public.entregas_epp_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE public.entregas_epp       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entregas_epp_items ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro activo de la consultora (staff, viewers, auditores).
DROP POLICY IF EXISTS "entregas_epp: select miembros" ON public.entregas_epp;
CREATE POLICY "entregas_epp: select miembros"
  ON public.entregas_epp FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.consultoras_members cm
    WHERE cm.consultora_id = entregas_epp.consultora_id
      AND cm.user_id = (SELECT auth.uid()) AND cm.is_active = true
  ));

-- SELECT: el TRABAJADOR dueño (su persona del directorio).
DROP POLICY IF EXISTS "entregas_epp: select trabajador" ON public.entregas_epp;
CREATE POLICY "entregas_epp: select trabajador"
  ON public.entregas_epp FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.personas_directorio pd
    WHERE pd.id = entregas_epp.persona_id AND pd.user_id = (SELECT auth.uid())
  ));

-- INSERT / UPDATE / DELETE: solo roles de escritura de la consultora.
DROP POLICY IF EXISTS "entregas_epp: insert staff" ON public.entregas_epp;
CREATE POLICY "entregas_epp: insert staff"
  ON public.entregas_epp FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.consultoras_members cm
    WHERE cm.consultora_id = entregas_epp.consultora_id
      AND cm.user_id = (SELECT auth.uid()) AND cm.is_active = true
      AND cm.role::text IN ('full_access_main','full_access_branch','colaborador')
  ));

DROP POLICY IF EXISTS "entregas_epp: update staff" ON public.entregas_epp;
CREATE POLICY "entregas_epp: update staff"
  ON public.entregas_epp FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.consultoras_members cm
    WHERE cm.consultora_id = entregas_epp.consultora_id
      AND cm.user_id = (SELECT auth.uid()) AND cm.is_active = true
      AND cm.role::text IN ('full_access_main','full_access_branch','colaborador')
  ));

DROP POLICY IF EXISTS "entregas_epp: delete staff" ON public.entregas_epp;
CREATE POLICY "entregas_epp: delete staff"
  ON public.entregas_epp FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.consultoras_members cm
    WHERE cm.consultora_id = entregas_epp.consultora_id
      AND cm.user_id = (SELECT auth.uid()) AND cm.is_active = true
      AND cm.role::text IN ('full_access_main','full_access_branch','colaborador')
  ));

-- Ítems: SELECT miembros + trabajador dueño; escritura solo staff.
DROP POLICY IF EXISTS "entregas_epp_items: select miembros" ON public.entregas_epp_items;
CREATE POLICY "entregas_epp_items: select miembros"
  ON public.entregas_epp_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.consultoras_members cm
    WHERE cm.consultora_id = entregas_epp_items.consultora_id
      AND cm.user_id = (SELECT auth.uid()) AND cm.is_active = true
  ));

DROP POLICY IF EXISTS "entregas_epp_items: select trabajador" ON public.entregas_epp_items;
CREATE POLICY "entregas_epp_items: select trabajador"
  ON public.entregas_epp_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.entregas_epp ee
    JOIN public.personas_directorio pd ON pd.id = ee.persona_id
    WHERE ee.id = entregas_epp_items.entrega_id AND pd.user_id = (SELECT auth.uid())
  ));

DROP POLICY IF EXISTS "entregas_epp_items: write staff" ON public.entregas_epp_items;
CREATE POLICY "entregas_epp_items: write staff"
  ON public.entregas_epp_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.consultoras_members cm
    WHERE cm.consultora_id = entregas_epp_items.consultora_id
      AND cm.user_id = (SELECT auth.uid()) AND cm.is_active = true
      AND cm.role::text IN ('full_access_main','full_access_branch','colaborador')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.consultoras_members cm
    WHERE cm.consultora_id = entregas_epp_items.consultora_id
      AND cm.user_id = (SELECT auth.uid()) AND cm.is_active = true
      AND cm.role::text IN ('full_access_main','full_access_branch','colaborador')
  ));

-- ============================================================
-- RPCs del TRABAJADOR (SECURITY DEFINER: enforce dueño por persona.user_id)
-- ============================================================

-- Lista las entregas del trabajador actual, con sus ítems anidados.
CREATE OR REPLACE FUNCTION public.mis_entregas_epp()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(e ORDER BY e.fecha_entrega DESC, e.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      ee.id, ee.fecha_entrega, ee.estado, ee.observaciones,
      ee.respondida_at, ee.firma_id, ee.created_at,
      est.nombre       AS establecimiento_nombre,
      emp.razon_social AS empresa_nombre,
      (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', it.id,
          'producto_nombre', it.producto_nombre,
          'talle', it.talle,
          'cantidad', it.cantidad,
          'conformidad', it.conformidad,
          'descargo', it.descargo,
          'respondido_at', it.respondido_at
        ) ORDER BY it.created_at), '[]'::jsonb)
        FROM public.entregas_epp_items it WHERE it.entrega_id = ee.id
      ) AS items
    FROM public.entregas_epp ee
    JOIN public.personas_directorio pd
      ON pd.id = ee.persona_id AND pd.user_id = (SELECT auth.uid())
    LEFT JOIN public.establecimientos est ON est.id = ee.establecimiento_id
    LEFT JOIN public.empresas emp          ON emp.id = est.empresa_id
  ) e;
$$;
GRANT EXECUTE ON FUNCTION public.mis_entregas_epp() TO authenticated;

-- Responde un ítem: conforme=true → 'conforme'; conforme=false → 'observado' (descargo OBLIGATORIO).
-- Recalcula el estado del encabezado. Solo el trabajador dueño puede responder.
CREATE OR REPLACE FUNCTION public.responder_item_entrega_epp(
  p_item_id  uuid,
  p_conforme boolean,
  p_descargo text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entrega uuid;
  v_total   int;
  v_resp    int;
  v_obs     int;
BEGIN
  IF NOT p_conforme AND (p_descargo IS NULL OR length(trim(p_descargo)) = 0) THEN
    RAISE EXCEPTION 'Si observás el ítem, el descargo es obligatorio (contanos qué pasa: talle, modelo, etc.)';
  END IF;

  UPDATE public.entregas_epp_items it
  SET conformidad   = CASE WHEN p_conforme THEN 'conforme' ELSE 'observado' END,
      descargo      = CASE WHEN p_conforme THEN NULL ELSE trim(p_descargo) END,
      respondido_at = now()
  WHERE it.id = p_item_id
    AND EXISTS (
      SELECT 1 FROM public.entregas_epp ee
      JOIN public.personas_directorio pd ON pd.id = ee.persona_id
      WHERE ee.id = it.entrega_id AND pd.user_id = (SELECT auth.uid())
    )
  RETURNING it.entrega_id INTO v_entrega;

  IF v_entrega IS NULL THEN
    RAISE EXCEPTION 'No podés responder este ítem (no es tuyo o no existe)';
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE respondido_at IS NOT NULL),
         count(*) FILTER (WHERE conformidad = 'observado')
  INTO v_total, v_resp, v_obs
  FROM public.entregas_epp_items WHERE entrega_id = v_entrega;

  UPDATE public.entregas_epp
  SET estado = CASE
        WHEN v_resp = 0          THEN 'pendiente'
        WHEN v_resp < v_total    THEN 'parcial'
        WHEN v_obs > 0           THEN 'observada'
        ELSE 'confirmada'
      END,
      respondida_at = CASE WHEN v_resp = v_total THEN now() ELSE respondida_at END,
      updated_at = now()
  WHERE id = v_entrega;
END;
$$;
GRANT EXECUTE ON FUNCTION public.responder_item_entrega_epp(uuid, boolean, text) TO authenticated;

COMMIT;
