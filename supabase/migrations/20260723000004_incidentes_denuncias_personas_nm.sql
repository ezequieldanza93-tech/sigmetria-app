-- ============================================================
-- Sigmetría HyS — Personas en Incidentes y Denuncias (N:M)
-- ============================================================
--
-- OBJETIVO:
-- Reemplazar el modelado de "involucrados" / "testigos" por texto libre por
-- vínculos al directorio (personas_directorio) + nombres sueltos (terceros
-- no cargados en el directorio). Cada persona involucrada/testigo es UNA fila:
--   * persona_id  -> FK a personas_directorio  (persona del directorio)
--   * nombre_suelto -> texto libre              (tercero sin cargar)
-- Exactamente UNO de los dos viene seteado por fila (CHECK).
--
-- CONTEXTO (estado vivo, NO el de 20260529000001 que fue dropeado):
--   * `incidentes` = `siniestros` renombrada (20260614000002). Está keyed por
--     establecimiento_id (NO tiene consultora_id/empresa_id). RLS via
--     has_establecimiento_read/write_access(establecimiento_id). NUNCA tuvo
--     columnas involucrados/testigos (eran del módulo viejo dropeado), por lo
--     que NO hay columnas text que conservar como snapshot.
--   * `denuncias` = recreada en 20260630000008, keyed por establecimiento_id
--     NOT NULL (+ consultora_id/empresa_id). RLS via
--     has_establecimiento_read/write_access(establecimiento_id). Tampoco tiene
--     columna involucrados.
--
-- Las tablas N:M heredan el acceso del padre (incidente / denuncia) espejando
-- el patrón de incidentes_fotos / denuncias_fotos: EXISTS sobre el padre con
-- has_establecimiento_*_access(padre.establecimiento_id).
--
-- ADITIVO + IDEMPOTENTE: CREATE TABLE IF NOT EXISTS, DROP POLICY IF EXISTS
-- antes de CREATE POLICY, índices IF NOT EXISTS. No borra ni altera columnas
-- existentes.
-- ============================================================


-- ── 1. incidentes_involucrados ────────────────────────────────

CREATE TABLE IF NOT EXISTS public.incidentes_involucrados (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  incidente_id  UUID        NOT NULL REFERENCES public.incidentes(id) ON DELETE CASCADE,
  persona_id    UUID        REFERENCES public.personas_directorio(id) ON DELETE SET NULL,
  nombre_suelto TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT incidentes_involucrados_persona_o_suelto CHECK (
    (persona_id IS NOT NULL AND nombre_suelto IS NULL)
    OR (persona_id IS NULL AND nombre_suelto IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_inc_involucrados_incidente ON public.incidentes_involucrados(incidente_id);
CREATE INDEX IF NOT EXISTS idx_inc_involucrados_persona   ON public.incidentes_involucrados(persona_id) WHERE persona_id IS NOT NULL;

ALTER TABLE public.incidentes_involucrados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidentes_involucrados: select" ON public.incidentes_involucrados;
CREATE POLICY "incidentes_involucrados: select" ON public.incidentes_involucrados FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidentes_involucrados.incidente_id
      AND has_establecimiento_read_access(i.establecimiento_id)
  ));

DROP POLICY IF EXISTS "incidentes_involucrados: insert" ON public.incidentes_involucrados;
CREATE POLICY "incidentes_involucrados: insert" ON public.incidentes_involucrados FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidente_id
      AND has_establecimiento_write_access(i.establecimiento_id)
  ));

DROP POLICY IF EXISTS "incidentes_involucrados: update" ON public.incidentes_involucrados;
CREATE POLICY "incidentes_involucrados: update" ON public.incidentes_involucrados FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidentes_involucrados.incidente_id
      AND has_establecimiento_write_access(i.establecimiento_id)
  ));

DROP POLICY IF EXISTS "incidentes_involucrados: delete" ON public.incidentes_involucrados;
CREATE POLICY "incidentes_involucrados: delete" ON public.incidentes_involucrados FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidentes_involucrados.incidente_id
      AND has_establecimiento_write_access(i.establecimiento_id)
  ));


-- ── 2. incidentes_testigos ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.incidentes_testigos (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  incidente_id  UUID        NOT NULL REFERENCES public.incidentes(id) ON DELETE CASCADE,
  persona_id    UUID        REFERENCES public.personas_directorio(id) ON DELETE SET NULL,
  nombre_suelto TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT incidentes_testigos_persona_o_suelto CHECK (
    (persona_id IS NOT NULL AND nombre_suelto IS NULL)
    OR (persona_id IS NULL AND nombre_suelto IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_inc_testigos_incidente ON public.incidentes_testigos(incidente_id);
CREATE INDEX IF NOT EXISTS idx_inc_testigos_persona   ON public.incidentes_testigos(persona_id) WHERE persona_id IS NOT NULL;

ALTER TABLE public.incidentes_testigos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "incidentes_testigos: select" ON public.incidentes_testigos;
CREATE POLICY "incidentes_testigos: select" ON public.incidentes_testigos FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidentes_testigos.incidente_id
      AND has_establecimiento_read_access(i.establecimiento_id)
  ));

DROP POLICY IF EXISTS "incidentes_testigos: insert" ON public.incidentes_testigos;
CREATE POLICY "incidentes_testigos: insert" ON public.incidentes_testigos FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidente_id
      AND has_establecimiento_write_access(i.establecimiento_id)
  ));

DROP POLICY IF EXISTS "incidentes_testigos: update" ON public.incidentes_testigos;
CREATE POLICY "incidentes_testigos: update" ON public.incidentes_testigos FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidentes_testigos.incidente_id
      AND has_establecimiento_write_access(i.establecimiento_id)
  ));

DROP POLICY IF EXISTS "incidentes_testigos: delete" ON public.incidentes_testigos;
CREATE POLICY "incidentes_testigos: delete" ON public.incidentes_testigos FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.incidentes i
    WHERE i.id = incidentes_testigos.incidente_id
      AND has_establecimiento_write_access(i.establecimiento_id)
  ));


-- ── 3. denuncias_involucrados ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.denuncias_involucrados (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id   UUID        NOT NULL REFERENCES public.denuncias(id) ON DELETE CASCADE,
  persona_id    UUID        REFERENCES public.personas_directorio(id) ON DELETE SET NULL,
  nombre_suelto TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT denuncias_involucrados_persona_o_suelto CHECK (
    (persona_id IS NOT NULL AND nombre_suelto IS NULL)
    OR (persona_id IS NULL AND nombre_suelto IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_den_involucrados_denuncia ON public.denuncias_involucrados(denuncia_id);
CREATE INDEX IF NOT EXISTS idx_den_involucrados_persona  ON public.denuncias_involucrados(persona_id) WHERE persona_id IS NOT NULL;

ALTER TABLE public.denuncias_involucrados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "denuncias_involucrados: select" ON public.denuncias_involucrados;
CREATE POLICY "denuncias_involucrados: select" ON public.denuncias_involucrados FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_involucrados.denuncia_id
      AND has_establecimiento_read_access(d.establecimiento_id)
  ));

DROP POLICY IF EXISTS "denuncias_involucrados: insert" ON public.denuncias_involucrados;
CREATE POLICY "denuncias_involucrados: insert" ON public.denuncias_involucrados FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncia_id
      AND has_establecimiento_write_access(d.establecimiento_id)
  ));

DROP POLICY IF EXISTS "denuncias_involucrados: update" ON public.denuncias_involucrados;
CREATE POLICY "denuncias_involucrados: update" ON public.denuncias_involucrados FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_involucrados.denuncia_id
      AND has_establecimiento_write_access(d.establecimiento_id)
  ));

DROP POLICY IF EXISTS "denuncias_involucrados: delete" ON public.denuncias_involucrados;
CREATE POLICY "denuncias_involucrados: delete" ON public.denuncias_involucrados FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.denuncias d
    WHERE d.id = denuncias_involucrados.denuncia_id
      AND has_establecimiento_write_access(d.establecimiento_id)
  ));


-- ── 4. Comments ───────────────────────────────────────────────

COMMENT ON TABLE public.incidentes_involucrados IS 'Personas involucradas en un incidente: FK al directorio o nombre suelto (tercero).';
COMMENT ON TABLE public.incidentes_testigos     IS 'Testigos de un incidente: FK al directorio o nombre suelto (tercero).';
COMMENT ON TABLE public.denuncias_involucrados  IS 'Personas involucradas en una denuncia: FK al directorio o nombre suelto (tercero).';
