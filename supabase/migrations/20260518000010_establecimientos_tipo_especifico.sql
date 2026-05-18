-- ============================================================
-- Migration: campos específicos por tipo de establecimiento
--
-- Construcción:
--   demolicion, excavacion, submuración, alturas >6m,
--   equipamiento de izaje, tipo de contratista
--
-- Industria:
--   agentes cancerígenos, sustancias químicas, vibraciones,
--   radiaciones, descripción de productos
-- ============================================================

ALTER TABLE public.establecimientos
  -- ── Construcción ────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS tiene_demolicion            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_excavacion            boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_submuración           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_alturas_mayores_6m    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_equipamiento_izaje    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tipo_contratista            text
    CHECK (tipo_contratista IS NULL OR tipo_contratista IN ('35/98', '51/97', '319/99')),

  -- ── Industria ────────────────────────────────────────────────
  ADD COLUMN IF NOT EXISTS tiene_agentes_cancerigenos  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_sustancias_quimicas   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_exposicion_vibraciones boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_exposicion_radiaciones boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS descripcion_productos       text;
