-- ============================================================
-- EPP UNIFICADO — Variantes (talle/color) + Assets (fotos/fichas) + Proveedor
-- Migration: 20260721000001
--
-- Objetivo: que la librería "Elementos de Protección" (tabla `productos`) sea el
-- ÚNICO hogar del EPP, integrando los catálogos de proveedores (hasta ahora en las
-- tablas scraper_*). Un casco es un casco venga de Airtable o de un catálogo.
--
--   - Variantes: color/talle del MISMO modelo NO duplican el producto; son filas
--     de producto_variantes. Se eligen al entrar al producto.
--   - Assets: galería de fotos múltiples + fichas técnicas PDF por producto.
--   - Proveedor: de qué catálogo viene (Caran/Duty/Libus…), distinto de la marca.
--
-- Patrón híbrido idéntico a `productos`: consultora_id NULL = base de Sigmetría.
-- Las tablas hijas heredan la visibilidad/edición del producto padre.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Proveedor + código + traza de origen a nivel producto
-- ------------------------------------------------------------
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS proveedor_id uuid REFERENCES organizaciones_externas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS codigo text,
  ADD COLUMN IF NOT EXISTS url_origen text;

CREATE INDEX IF NOT EXISTS productos_proveedor_id_idx ON productos(proveedor_id);

COMMENT ON COLUMN productos.proveedor_id IS 'Catálogo/proveedor de origen (Caran, Duty, Libus…). Distinto de marca_id.';
COMMENT ON COLUMN productos.codigo IS 'Código/SKU del proveedor a nivel modelo (cuando no se desglosa por variante).';
COMMENT ON COLUMN productos.url_origen IS 'URL del producto en el catálogo del proveedor (traza/idempotencia del scraper).';

-- ------------------------------------------------------------
-- 2. Variantes (color/talle del mismo modelo) — NO duplican el producto
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producto_variantes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  sku         text,
  codigo      text,
  talle       text,
  color       text,
  atributos   jsonb NOT NULL DEFAULT '{}'::jsonb,
  orden       int  NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS producto_variantes_producto_id_idx ON producto_variantes(producto_id);
-- Dentro de un producto no se repite la misma combinación talle+color (NULLs → '').
CREATE UNIQUE INDEX IF NOT EXISTS producto_variantes_combo_uq
  ON producto_variantes(producto_id, COALESCE(talle, ''), COALESCE(color, ''));

COMMENT ON TABLE producto_variantes IS 'Variantes (talle/color) de un producto EPP. El producto NO se duplica por variante.';

-- ------------------------------------------------------------
-- 3. Assets múltiples: galería de fotos + fichas técnicas PDF
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS producto_assets (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id  uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo         text NOT NULL CHECK (tipo IN ('foto', 'ficha_tecnica')),
  bucket       text NOT NULL,
  path_storage text NOT NULL,
  url_origen   text,
  filename     text,
  mime_type    text,
  tamano_bytes bigint,
  orden        int NOT NULL DEFAULT 0,
  is_principal boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS producto_assets_producto_id_idx ON producto_assets(producto_id);
CREATE UNIQUE INDEX IF NOT EXISTS producto_assets_path_uq ON producto_assets(producto_id, path_storage);

COMMENT ON TABLE producto_assets IS 'Galería de fotos y fichas técnicas (PDF) de un producto EPP. tipo: foto | ficha_tecnica.';

-- ------------------------------------------------------------
-- 4. RLS híbrida — las hijas heredan la regla del producto padre
--    (mismo CASE de consultora_id NULL → developer / propio → members)
-- ------------------------------------------------------------
ALTER TABLE producto_variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_assets    ENABLE ROW LEVEL SECURITY;

-- producto_variantes
CREATE POLICY "producto_variantes: select" ON producto_variantes
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM productos p
    WHERE p.id = producto_variantes.producto_id
      AND (p.consultora_id IS NULL OR is_active_member_of(p.consultora_id))
  ));

CREATE POLICY "producto_variantes: write" ON producto_variantes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM productos p
    WHERE p.id = producto_variantes.producto_id
      AND (CASE WHEN p.consultora_id IS NULL THEN is_developer()
           ELSE p.consultora_id IN (
             SELECT consultora_id FROM consultoras_members
             WHERE user_id = auth.uid() AND is_active = true
               AND role IN ('full_access_main','full_access_branch','colaborador')
           ) END)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM productos p
    WHERE p.id = producto_variantes.producto_id
      AND (CASE WHEN p.consultora_id IS NULL THEN is_developer()
           ELSE p.consultora_id IN (
             SELECT consultora_id FROM consultoras_members
             WHERE user_id = auth.uid() AND is_active = true
               AND role IN ('full_access_main','full_access_branch','colaborador')
           ) END)
  ));

-- producto_assets
CREATE POLICY "producto_assets: select" ON producto_assets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM productos p
    WHERE p.id = producto_assets.producto_id
      AND (p.consultora_id IS NULL OR is_active_member_of(p.consultora_id))
  ));

CREATE POLICY "producto_assets: write" ON producto_assets
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM productos p
    WHERE p.id = producto_assets.producto_id
      AND (CASE WHEN p.consultora_id IS NULL THEN is_developer()
           ELSE p.consultora_id IN (
             SELECT consultora_id FROM consultoras_members
             WHERE user_id = auth.uid() AND is_active = true
               AND role IN ('full_access_main','full_access_branch','colaborador')
           ) END)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM productos p
    WHERE p.id = producto_assets.producto_id
      AND (CASE WHEN p.consultora_id IS NULL THEN is_developer()
           ELSE p.consultora_id IN (
             SELECT consultora_id FROM consultoras_members
             WHERE user_id = auth.uid() AND is_active = true
               AND role IN ('full_access_main','full_access_branch','colaborador')
           ) END)
  ));

-- ------------------------------------------------------------
-- 5. Bucket público para fichas técnicas de EPP (las fotos siguen en productos-epp)
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('productos-epp-fichas', 'productos-epp-fichas', true)
ON CONFLICT (id) DO NOTHING;
