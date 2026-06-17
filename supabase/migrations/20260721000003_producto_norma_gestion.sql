-- ============================================================
-- Relaciones N:N de un producto (equipo de medición) con la normativa legal
-- y con las gestiones que le aplican.
-- Migration: 20260721000003
-- ============================================================

CREATE TABLE IF NOT EXISTS producto_norma (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  norma_id    uuid NOT NULL REFERENCES normativa_normas(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (producto_id, norma_id)
);
CREATE INDEX IF NOT EXISTS producto_norma_producto_idx ON producto_norma(producto_id);
CREATE INDEX IF NOT EXISTS producto_norma_norma_idx ON producto_norma(norma_id);

CREATE TABLE IF NOT EXISTS producto_gestion (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id uuid NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  gestion_id  uuid NOT NULL REFERENCES gestiones(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (producto_id, gestion_id)
);
CREATE INDEX IF NOT EXISTS producto_gestion_producto_idx ON producto_gestion(producto_id);
CREATE INDEX IF NOT EXISTS producto_gestion_gestion_idx ON producto_gestion(gestion_id);

-- RLS híbrida heredada del producto padre (mismo patrón que producto_categoria_map).
ALTER TABLE producto_norma   ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_gestion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "producto_norma: select" ON producto_norma FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM productos p WHERE p.id = producto_norma.producto_id
                 AND (p.consultora_id IS NULL OR is_active_member_of(p.consultora_id))));
CREATE POLICY "producto_norma: write" ON producto_norma FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM productos p WHERE p.id = producto_norma.producto_id
                 AND (CASE WHEN p.consultora_id IS NULL THEN is_developer()
                      ELSE p.consultora_id IN (SELECT consultora_id FROM consultoras_members
                        WHERE user_id=auth.uid() AND is_active=true AND role IN ('full_access_main','full_access_branch','colaborador')) END)))
  WITH CHECK (EXISTS (SELECT 1 FROM productos p WHERE p.id = producto_norma.producto_id
                 AND (CASE WHEN p.consultora_id IS NULL THEN is_developer()
                      ELSE p.consultora_id IN (SELECT consultora_id FROM consultoras_members
                        WHERE user_id=auth.uid() AND is_active=true AND role IN ('full_access_main','full_access_branch','colaborador')) END)));

CREATE POLICY "producto_gestion: select" ON producto_gestion FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM productos p WHERE p.id = producto_gestion.producto_id
                 AND (p.consultora_id IS NULL OR is_active_member_of(p.consultora_id))));
CREATE POLICY "producto_gestion: write" ON producto_gestion FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM productos p WHERE p.id = producto_gestion.producto_id
                 AND (CASE WHEN p.consultora_id IS NULL THEN is_developer()
                      ELSE p.consultora_id IN (SELECT consultora_id FROM consultoras_members
                        WHERE user_id=auth.uid() AND is_active=true AND role IN ('full_access_main','full_access_branch','colaborador')) END)))
  WITH CHECK (EXISTS (SELECT 1 FROM productos p WHERE p.id = producto_gestion.producto_id
                 AND (CASE WHEN p.consultora_id IS NULL THEN is_developer()
                      ELSE p.consultora_id IN (SELECT consultora_id FROM consultoras_members
                        WHERE user_id=auth.uid() AND is_active=true AND role IN ('full_access_main','full_access_branch','colaborador')) END)));
