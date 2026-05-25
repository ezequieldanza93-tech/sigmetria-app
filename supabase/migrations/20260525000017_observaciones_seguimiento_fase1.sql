-- ============================================================
-- Observations Follow-up Phase 1
-- 1. sector_id / puesto_id FK on gestiones_observaciones
-- 2. cliente_visto_at timestamp on gestiones_observaciones
-- 3. observaciones_comentarios — chat thread per observation
-- 4. observaciones_fotos_cliente — viewer-uploaded photos
-- ============================================================


-- ── 1. New columns on gestiones_observaciones ───────────────

ALTER TABLE public.gestiones_observaciones
  ADD COLUMN IF NOT EXISTS sector_id      uuid REFERENCES public.establecimientos_sectores(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS puesto_id      uuid REFERENCES public.puestos_de_trabajo(id)           ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cliente_visto_at timestamptz;

CREATE INDEX IF NOT EXISTS obs_gest_sector_idx  ON public.gestiones_observaciones (sector_id)  WHERE sector_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS obs_gest_puesto_idx  ON public.gestiones_observaciones (puesto_id)  WHERE puesto_id IS NOT NULL;


-- ── 2. observaciones_comentarios ────────────────────────────

CREATE TABLE public.observaciones_comentarios (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  observacion_id uuid        NOT NULL REFERENCES public.gestiones_observaciones(id) ON DELETE CASCADE,
  autor_id       uuid        NOT NULL REFERENCES public.profiles(id)                ON DELETE CASCADE,
  es_viewer      boolean     NOT NULL DEFAULT false,
  contenido      text        NOT NULL CHECK (char_length(contenido) BETWEEN 1 AND 2000),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.observaciones_comentarios ENABLE ROW LEVEL SECURITY;

CREATE INDEX obs_comentarios_observacion_idx ON public.observaciones_comentarios (observacion_id);
CREATE INDEX obs_comentarios_autor_idx       ON public.observaciones_comentarios (autor_id);

-- SELECT: any user with read access to the observation's establishment
CREATE POLICY "observaciones_comentarios: select"
  ON public.observaciones_comentarios FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestiones_observaciones go
      JOIN public.gestiones_registros gr    ON gr.id = go.registro_gestion_id
      JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
      WHERE go.id = observacion_id
        AND has_establecimiento_read_access(ge.establecimiento_id)
    )
  );

-- INSERT: any user with read access can post their own comment
CREATE POLICY "observaciones_comentarios: insert"
  ON public.observaciones_comentarios FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.gestiones_observaciones go
      JOIN public.gestiones_registros gr    ON gr.id = go.registro_gestion_id
      JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
      WHERE go.id = observacion_id
        AND has_establecimiento_read_access(ge.establecimiento_id)
    )
  );

-- UPDATE/DELETE: only own comments
CREATE POLICY "observaciones_comentarios: update"
  ON public.observaciones_comentarios FOR UPDATE TO authenticated
  USING (autor_id = auth.uid());

CREATE POLICY "observaciones_comentarios: delete"
  ON public.observaciones_comentarios FOR DELETE TO authenticated
  USING (autor_id = auth.uid());


-- ── 3. observaciones_fotos_cliente ──────────────────────────

CREATE TABLE public.observaciones_fotos_cliente (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  observacion_id uuid        NOT NULL REFERENCES public.gestiones_observaciones(id) ON DELETE CASCADE,
  autor_id       uuid        NOT NULL REFERENCES public.profiles(id)                ON DELETE CASCADE,
  url            text        NOT NULL,
  categoria      text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.observaciones_fotos_cliente ENABLE ROW LEVEL SECURITY;

CREATE INDEX obs_fotos_cliente_observacion_idx ON public.observaciones_fotos_cliente (observacion_id);

-- SELECT: any user with read access
CREATE POLICY "observaciones_fotos_cliente: select"
  ON public.observaciones_fotos_cliente FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.gestiones_observaciones go
      JOIN public.gestiones_registros gr    ON gr.id = go.registro_gestion_id
      JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
      WHERE go.id = observacion_id
        AND has_establecimiento_read_access(ge.establecimiento_id)
    )
  );

-- INSERT: own upload, read access required
CREATE POLICY "observaciones_fotos_cliente: insert"
  ON public.observaciones_fotos_cliente FOR INSERT TO authenticated
  WITH CHECK (
    autor_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.gestiones_observaciones go
      JOIN public.gestiones_registros gr    ON gr.id = go.registro_gestion_id
      JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
      WHERE go.id = observacion_id
        AND has_establecimiento_read_access(ge.establecimiento_id)
    )
  );

-- DELETE: only own uploads
CREATE POLICY "observaciones_fotos_cliente: delete"
  ON public.observaciones_fotos_cliente FOR DELETE TO authenticated
  USING (autor_id = auth.uid());


-- ── 4. Helper function: marcar observación vista por viewer ──
-- Uses SECURITY DEFINER so viewers (read-only) can set cliente_visto_at
-- without needing write access.

CREATE OR REPLACE FUNCTION public.marcar_observacion_vista(p_observacion_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER STABLE
SET search_path = public
AS $$
BEGIN
  UPDATE public.gestiones_observaciones
  SET cliente_visto_at = now()
  WHERE id = p_observacion_id
    AND EXISTS (
      SELECT 1 FROM public.gestiones_registros gr
      JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
      WHERE gr.id = gestiones_observaciones.registro_gestion_id
        AND has_establecimiento_read_access(ge.establecimiento_id)
    );
END;
$$;
