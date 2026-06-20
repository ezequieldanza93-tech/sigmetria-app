-- ============================================================
-- Auditoría de Requisitos Legales por establecimiento (feedback c4e483d0)
-- ============================================================
-- Modelo VERSIONADO (decisión de Ezequiel): cada auditoría es una corrida con
-- fecha + estado (borrador → en_curso → cerrada) que CONGELA (snapshot) las normas
-- aplicables y sus artículos al momento de crearla, para conservar historial real
-- aunque después cambie el catálogo de normativa.
--
-- La aplicabilidad (qué normas aplican) la calcula lib/actions/aplicabilidad-normativa.ts
-- (tipo de establecimiento + provincia + habilitación + respuestas a preguntas del alta).
--
-- RLS por establecimiento con los helpers existentes has_establecimiento_read/write_access
-- (mismo molde que medicion_ruido / medicion_iluminacion). Idempotente.
-- ============================================================

BEGIN;

-- ─── 1. Cabecera: una corrida de auditoría ──────────────────
CREATE TABLE IF NOT EXISTS public.normativa_auditorias (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id       uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  establecimiento_id  uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  fecha               date NOT NULL DEFAULT CURRENT_DATE,
  estado              text NOT NULL DEFAULT 'en_curso',
  notas               text,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.normativa_auditorias DROP CONSTRAINT IF EXISTS chk_normativa_auditorias_estado;
ALTER TABLE public.normativa_auditorias ADD CONSTRAINT chk_normativa_auditorias_estado
  CHECK (estado IN ('borrador', 'en_curso', 'cerrada'));

CREATE INDEX IF NOT EXISTS idx_normativa_auditorias_estab
  ON public.normativa_auditorias (establecimiento_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_normativa_auditorias_consultora
  ON public.normativa_auditorias (consultora_id);

-- ─── 2. Ítems: un requisito (artículo) por norma aplicable ──
-- Snapshot de los textos al momento de la auditoría (norma + artículo) para
-- que el historial quede congelado. norma_id / requisito_id quedan como link
-- blando (SET NULL si el catálogo se edita/borra).
CREATE TABLE IF NOT EXISTS public.normativa_auditoria_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id      uuid NOT NULL REFERENCES public.normativa_auditorias(id) ON DELETE CASCADE,
  norma_id          uuid REFERENCES public.normativa_normas(id) ON DELETE SET NULL,
  requisito_id      uuid REFERENCES public.normativa_requisitos(id) ON DELETE SET NULL,
  estado            text NOT NULL DEFAULT 'pendiente',
  observacion       text,
  evidencia_url     text,
  norma_numero      text,
  norma_titulo      text,
  norma_tipo        text,
  categoria_nombre  text,
  ambito            text,
  articulo          text,
  descripcion_corta text,
  orden             integer,
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.normativa_auditoria_items DROP CONSTRAINT IF EXISTS chk_normativa_auditoria_items_estado;
ALTER TABLE public.normativa_auditoria_items ADD CONSTRAINT chk_normativa_auditoria_items_estado
  CHECK (estado IN ('pendiente', 'cumple', 'no_cumple', 'no_aplica'));

CREATE INDEX IF NOT EXISTS idx_normativa_auditoria_items_auditoria
  ON public.normativa_auditoria_items (auditoria_id);

-- ─── 3. RLS — cabecera (por establecimiento) ────────────────
ALTER TABLE public.normativa_auditorias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "normativa_auditorias: select" ON public.normativa_auditorias;
CREATE POLICY "normativa_auditorias: select" ON public.normativa_auditorias FOR SELECT TO authenticated
  USING (public.has_establecimiento_read_access(establecimiento_id));

DROP POLICY IF EXISTS "normativa_auditorias: insert" ON public.normativa_auditorias;
CREATE POLICY "normativa_auditorias: insert" ON public.normativa_auditorias FOR INSERT TO authenticated
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "normativa_auditorias: update" ON public.normativa_auditorias;
CREATE POLICY "normativa_auditorias: update" ON public.normativa_auditorias FOR UPDATE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "normativa_auditorias: delete" ON public.normativa_auditorias;
CREATE POLICY "normativa_auditorias: delete" ON public.normativa_auditorias FOR DELETE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id));

-- ─── 4. RLS — ítems (tenant derivado de la cabecera) ────────
ALTER TABLE public.normativa_auditoria_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "normativa_auditoria_items: select" ON public.normativa_auditoria_items;
CREATE POLICY "normativa_auditoria_items: select" ON public.normativa_auditoria_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.normativa_auditorias a
    WHERE a.id = auditoria_id AND public.has_establecimiento_read_access(a.establecimiento_id)
  ));

DROP POLICY IF EXISTS "normativa_auditoria_items: insert" ON public.normativa_auditoria_items;
CREATE POLICY "normativa_auditoria_items: insert" ON public.normativa_auditoria_items FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.normativa_auditorias a
    WHERE a.id = auditoria_id AND public.has_establecimiento_write_access(a.establecimiento_id)
  ));

DROP POLICY IF EXISTS "normativa_auditoria_items: update" ON public.normativa_auditoria_items;
CREATE POLICY "normativa_auditoria_items: update" ON public.normativa_auditoria_items FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.normativa_auditorias a
    WHERE a.id = auditoria_id AND public.has_establecimiento_write_access(a.establecimiento_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.normativa_auditorias a
    WHERE a.id = auditoria_id AND public.has_establecimiento_write_access(a.establecimiento_id)
  ));

DROP POLICY IF EXISTS "normativa_auditoria_items: delete" ON public.normativa_auditoria_items;
CREATE POLICY "normativa_auditoria_items: delete" ON public.normativa_auditoria_items FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.normativa_auditorias a
    WHERE a.id = auditoria_id AND public.has_establecimiento_write_access(a.establecimiento_id)
  ));

-- ─── 5. Triggers updated_at ─────────────────────────────────
DROP TRIGGER IF EXISTS set_updated_at ON public.normativa_auditorias;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.normativa_auditorias
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at ON public.normativa_auditoria_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.normativa_auditoria_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

COMMENT ON TABLE public.normativa_auditorias IS
  'Auditoría de Requisitos Legales por establecimiento (versionada). Cada fila es una corrida con fecha + estado. RLS por establecimiento.';
COMMENT ON TABLE public.normativa_auditoria_items IS
  'Ítems de una auditoría legal: un artículo (requisito) por norma aplicable, con snapshot de textos y estado cumple/no_cumple/no_aplica.';

COMMIT;
