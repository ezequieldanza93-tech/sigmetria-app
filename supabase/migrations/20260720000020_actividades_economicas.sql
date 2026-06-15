-- =============================================================================
-- Actividades económicas CIIU Rev.4 — Lista provisional de 21 secciones
--
-- NOTA PROVISIONAL: Este catálogo contiene únicamente las 21 secciones de la
-- Clasificación Industrial Internacional Uniforme (CIIU) Revisión 4 de la ONU.
-- El CLAE completo de AFIP (Clasificador de Actividades Económicas, ~1300 rubros)
-- puede importarse en el futuro reemplazando este seed con los códigos AFIP.
-- Ver: https://www.afip.gob.ar/institucional/acercadeafip/organizacion/secretarias/
-- =============================================================================

-- Tabla catálogo de actividades económicas
CREATE TABLE IF NOT EXISTS actividades_economicas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  nombre      text NOT NULL,
  seccion     text NULL,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE actividades_economicas IS
  'Catálogo de actividades económicas CIIU Rev.4. Provisional: solo 21 secciones. '
  'El CLAE completo de AFIP puede importarse en el futuro.';

-- Columna nueva en establecimientos (nullable, FK suave — no rompe registros existentes)
ALTER TABLE establecimientos
  ADD COLUMN IF NOT EXISTS actividad_id uuid REFERENCES actividades_economicas(id) ON DELETE SET NULL;

COMMENT ON COLUMN establecimientos.actividad_id IS
  'FK al catálogo actividades_economicas. Reemplaza el texto libre actividad_principal. '
  'Ambas columnas coexisten para compatibilidad hacia atrás.';

-- Índice para búsquedas/joins por actividad
CREATE INDEX IF NOT EXISTS idx_establecimientos_actividad_id
  ON establecimientos (actividad_id)
  WHERE actividad_id IS NOT NULL;

-- =============================================================================
-- SEED: 21 secciones CIIU Rev.4 (A–U) — nombres oficiales en español
-- =============================================================================
INSERT INTO actividades_economicas (codigo, nombre, seccion) VALUES
  ('A', 'Agricultura, ganadería, caza, silvicultura y pesca',                                                              'A'),
  ('B', 'Explotación de minas y canteras',                                                                                  'B'),
  ('C', 'Industrias manufactureras',                                                                                        'C'),
  ('D', 'Suministro de electricidad, gas, vapor y aire acondicionado',                                                      'D'),
  ('E', 'Suministro de agua, evacuación de aguas residuales, gestión de desechos y saneamiento',                           'E'),
  ('F', 'Construcción',                                                                                                     'F'),
  ('G', 'Comercio al por mayor y al por menor; reparación de vehículos automotores y motocicletas',                        'G'),
  ('H', 'Transporte y almacenamiento',                                                                                     'H'),
  ('I', 'Alojamiento y servicios de comida',                                                                               'I'),
  ('J', 'Información y comunicación',                                                                                      'J'),
  ('K', 'Actividades financieras y de seguros',                                                                            'K'),
  ('L', 'Actividades inmobiliarias',                                                                                       'L'),
  ('M', 'Actividades profesionales, científicas y técnicas',                                                               'M'),
  ('N', 'Actividades de servicios administrativos y de apoyo',                                                             'N'),
  ('O', 'Administración pública y defensa; planes de seguridad social de afiliación obligatoria',                          'O'),
  ('P', 'Enseñanza',                                                                                                       'P'),
  ('Q', 'Servicios sociales y relacionados con la salud humana',                                                           'Q'),
  ('R', 'Artes, entretenimiento y recreación',                                                                             'R'),
  ('S', 'Otras actividades de servicios',                                                                                  'S'),
  ('T', 'Actividades de los hogares como empleadores',                                                                     'T'),
  ('U', 'Actividades de organizaciones y órganos extraterritoriales',                                                      'U')
ON CONFLICT (codigo) DO NOTHING;
