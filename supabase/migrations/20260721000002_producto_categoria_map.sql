-- ============================================================
-- Clasificación N:N producto ↔ categoría
-- Migration: 20260721000002
--
-- Un producto puede pertenecer a VARIAS categorías (un traje impermeable puede
-- ser "Protección del Cuerpo" y "Trabajo en Altura"; un guante dieléctrico,
-- "Miembros Superiores" y "Riesgo Eléctrico"). La tabla `producto_categoria_map`
-- es la fuente de verdad multi-categoría; `productos.categoria_id` se mantiene
-- como la categoría PRINCIPAL (compat con el card y el form actual).
-- ============================================================

CREATE TABLE IF NOT EXISTS producto_categoria_map (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id  uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  categoria_id uuid NOT NULL REFERENCES productos_categorias(id) ON DELETE CASCADE,
  es_principal boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (producto_id, categoria_id)
);

CREATE INDEX IF NOT EXISTS producto_categoria_map_producto_idx  ON producto_categoria_map(producto_id);
CREATE INDEX IF NOT EXISTS producto_categoria_map_categoria_idx ON producto_categoria_map(categoria_id);

-- RLS híbrida heredada del producto padre (mismo patrón que producto_variantes/assets).
ALTER TABLE producto_categoria_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY "producto_categoria_map: select" ON producto_categoria_map
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM productos p
    WHERE p.id = producto_categoria_map.producto_id
      AND (p.consultora_id IS NULL OR is_active_member_of(p.consultora_id))
  ));

CREATE POLICY "producto_categoria_map: write" ON producto_categoria_map
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM productos p
    WHERE p.id = producto_categoria_map.producto_id
      AND (CASE WHEN p.consultora_id IS NULL THEN is_developer()
           ELSE p.consultora_id IN (
             SELECT consultora_id FROM consultoras_members
             WHERE user_id = auth.uid() AND is_active = true
               AND role IN ('full_access_main','full_access_branch','colaborador')
           ) END)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM productos p
    WHERE p.id = producto_categoria_map.producto_id
      AND (CASE WHEN p.consultora_id IS NULL THEN is_developer()
           ELSE p.consultora_id IN (
             SELECT consultora_id FROM consultoras_members
             WHERE user_id = auth.uid() AND is_active = true
               AND role IN ('full_access_main','full_access_branch','colaborador')
           ) END)
  ));

-- Seed: la categoría actual de cada producto entra como PRINCIPAL (preserva lo existente).
INSERT INTO producto_categoria_map (producto_id, categoria_id, es_principal)
SELECT id, categoria_id, true FROM productos WHERE categoria_id IS NOT NULL
ON CONFLICT (producto_id, categoria_id) DO NOTHING;
