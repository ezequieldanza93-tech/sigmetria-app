-- Tabla de colegios/consejos profesionales que emiten matrículas de HyS en Argentina
CREATE TABLE colegios_profesionales (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sigla         text NOT NULL UNIQUE,
  nombre        text NOT NULL,
  provincia     text NOT NULL,
  ley_numero    text,
  jurisdiccion  text NOT NULL DEFAULT 'provincial' CHECK (jurisdiccion IN ('provincial', 'nacional')),
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE colegios_profesionales IS 'Colegios y consejos profesionales habilitados para emitir matrículas de Higiene y Seguridad en el Trabajo en Argentina.';

-- RLS: lectura pública dentro de sesión autenticada
ALTER TABLE colegios_profesionales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "autenticado puede leer colegios" ON colegios_profesionales
  FOR SELECT TO authenticated USING (true);

-- Seed: 14 colegios provinciales específicos de HyS
INSERT INTO colegios_profesionales (sigla, nombre, provincia, ley_numero, jurisdiccion) VALUES
  ('CPHYST',      'Colegio de Profesionales de la Higiene y Seguridad en el Trabajo de la Provincia de Buenos Aires', 'Buenos Aires',  '15.105',  'provincial'),
  ('CUPHST',      'Colegio Único de Profesionales de la Higiene y Seguridad en el Trabajo de la Provincia de Catamarca',  'Catamarca',     '5.509',   'provincial'),
  ('CPHSTCH',     'Colegio Profesional de Higiene y Seguridad en el Trabajo del Chaco',                                  'Chaco',         NULL,      'provincial'),
  ('COHSECH',     'Colegio de Profesionales de Higiene y Seguridad en el Trabajo del Chubut',                            'Chubut',        'X-35',    'provincial'),
  ('COPHISEC',    'Colegio Profesional de Higiene y Seguridad de la Provincia de Córdoba',                               'Córdoba',       '10.666',  'provincial'),
  ('CPHSSO-CO',   'Colegio Profesional de Higiene, Seguridad y Salud Ocupacional de la Provincia de Corrientes',         'Corrientes',    '6.679',   'provincial'),
  ('CLTHySO-ER',  'Colegio de Licenciados y Técnicos de Higiene, Seguridad y Salud Ocupacional de la Provincia de Entre Ríos', 'Entre Ríos', '11.048', 'provincial'),
  ('CLTHySLR',    'Consejo de Licenciados y Técnicos Superiores en Higiene y Seguridad en el Trabajo de La Rioja',       'La Rioja',      '10.136',  'provincial'),
  ('CPHySeM',     'Colegio Profesional de Higiene y Seguridad en el Trabajo de la Provincia de Misiones',                'Misiones',      'IX-12',   'provincial'),
  ('CPHST-SJ',    'Consejo de Profesionales de Higiene y Seguridad en el Trabajo de San Juan',                           'San Juan',      NULL,      'provincial'),
  ('CHS',         'Colegio de Profesionales de Higiene y Seguridad en el Trabajo de San Luis',                           'San Luis',      NULL,      'provincial'),
  ('CTHySSC',     'Colegio de Trabajadores de la Higiene y Seguridad de la Provincia de Santa Cruz',                     'Santa Cruz',    NULL,      'provincial'),
  ('CPHSSO-SF',   'Colegio Profesional de Higiene, Seguridad y Salud Ocupacional de la Provincia de Santa Fe',           'Santa Fe',      '13.907',  'provincial'),
  ('CLTSHST-TU',  'Colegio de Licenciados y Técnicos Superiores en Higiene y Seguridad en el Trabajo de Tucumán',        'Tucumán',       '9.557',   'provincial'),
  -- CABA (asociación civil; no hay colegio público, ley vetada)
  ('COPHISEMA',   'Colegio Profesional de Higiene, Seguridad y Medio Ambiente',                                          'CABA',          NULL,      'provincial'),
  -- Consejos de jurisdicción nacional (matriculan HyS en CABA / jurisdicción federal)
  ('COPIME',      'Consejo Profesional de Ingeniería Mecánica y Electricista',                                           'Nacional',      NULL,      'nacional'),
  ('COPIQ',       'Consejo Profesional de Ingeniería Química',                                                           'Nacional',      NULL,      'nacional'),
  ('CPII',        'Consejo Profesional de Ingeniería Industrial',                                                        'Nacional',      NULL,      'nacional');

-- FK en matriculas
ALTER TABLE matriculas
  ADD COLUMN colegio_profesional_id uuid REFERENCES colegios_profesionales(id);

CREATE INDEX idx_matriculas_colegio_profesional_id ON matriculas (colegio_profesional_id)
  WHERE colegio_profesional_id IS NOT NULL;
