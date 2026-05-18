CREATE TABLE unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  simbolo text NOT NULL,
  categoria text NOT NULL DEFAULT 'cantidad',
  descripcion text,
  is_active bool NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO unidades (nombre, simbolo, categoria) VALUES
  ('Gramo', 'g', 'masa'),
  ('Kilogramo', 'kg', 'masa'),
  ('Mililitro', 'ml', 'volumen'),
  ('Litro', 'l', 'volumen'),
  ('Unidad', 'unidad', 'cantidad'),
  ('Par', 'par', 'cantidad'),
  ('Caja', 'caja', 'cantidad'),
  ('Rollo', 'rollo', 'cantidad'),
  ('Metro', 'metro', 'longitud');

ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos pueden ver unidades activas"
  ON unidades FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Solo developer modifica unidades"
  ON unidades FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role = 'developer'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND system_role = 'developer'));

ALTER TABLE productos ADD COLUMN unidad_id uuid REFERENCES unidades(id) ON DELETE SET NULL;

UPDATE productos p
SET unidad_id = u.id
FROM unidades u
WHERE p.unidad::text = u.simbolo
  AND p.unidad IS NOT NULL;

ALTER TABLE productos DROP COLUMN unidad;

ALTER TABLE mediciones ADD COLUMN unidad_id uuid REFERENCES unidades(id) ON DELETE RESTRICT;

UPDATE mediciones m
SET unidad_id = u.id
FROM unidades u
WHERE m.unidad::text = u.simbolo;

ALTER TABLE mediciones DROP COLUMN unidad;

DROP TYPE IF EXISTS unidad_medida;

CREATE INDEX idx_prod_unidad ON productos(unidad_id) WHERE unidad_id IS NOT NULL;
CREATE INDEX idx_med_unidad ON mediciones(unidad_id) WHERE unidad_id IS NOT NULL;
