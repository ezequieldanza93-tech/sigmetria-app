-- 20260801000004_consultoras_color_marca.sql
-- Color de marca de la consultora para los PDF (white-label suave).
-- Decisión Ezequiel (2026-06-26): disponible para TODAS las consultoras (sin
-- gating por plan) y aplicado en TODOS los PDF (protocolos + contrato +
-- presupuesto). Reemplaza el verde de Sigmetría (#2E7D33 / #4CAF50).
--   · color_marca_primario   → acento principal (headers, bordes, títulos).
--   · color_marca_secundario → acento secundario opcional (degradés/realces).
-- NULL = usar el verde de Sigmetría por defecto.

ALTER TABLE public.consultoras
  ADD COLUMN IF NOT EXISTS color_marca_primario  text,
  ADD COLUMN IF NOT EXISTS color_marca_secundario text;

COMMENT ON COLUMN public.consultoras.color_marca_primario  IS 'Color primario de marca (hex #RRGGBB) para los PDF; NULL = verde Sigmetría.';
COMMENT ON COLUMN public.consultoras.color_marca_secundario IS 'Color secundario de marca (hex #RRGGBB) opcional para los PDF; NULL = derivado del primario / Sigmetría.';

-- Validación de formato hex (#RRGGBB). NULL permitido (= default Sigmetría).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultoras_color_primario_hex') THEN
    ALTER TABLE public.consultoras
      ADD CONSTRAINT consultoras_color_primario_hex
      CHECK (color_marca_primario IS NULL OR color_marca_primario ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'consultoras_color_secundario_hex') THEN
    ALTER TABLE public.consultoras
      ADD CONSTRAINT consultoras_color_secundario_hex
      CHECK (color_marca_secundario IS NULL OR color_marca_secundario ~ '^#[0-9A-Fa-f]{6}$');
  END IF;
END $$;
