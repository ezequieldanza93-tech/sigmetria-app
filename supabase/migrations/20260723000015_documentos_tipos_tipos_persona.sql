-- ============================================================
-- Matriz documento_tipo ↔ tipo de persona (legajo por tipo de persona)
-- ============================================================
-- El catálogo dice QUÉ documentos son de nivel persona / persona_empresa /
-- persona_establecimiento, pero NO a qué TIPO de persona aplican. Esta matriz
-- resuelve "según el tipo de persona, pedir la documentación necesaria":
-- al armar el legajo de una persona se filtran los docs persona-level por su
-- personas_directorio.tipo_id usando esta tabla.
--
-- Semántica: SIN filas para un tipo de persona = ese tipo NO requiere docs
-- persona-level (ej: Clientes, Vecinos, Inspectores no llevan legajo HSE).
-- Espeja el patrón de documentos_tipos_tipos_establecimiento.
--
-- Seed default (editable después): el grueso del legajo va a "Trabajadores";
-- matrículas/encomienda profesional van a "Profesionales".
-- Idempotente: CREATE TABLE IF NOT EXISTS; INSERT ... ON CONFLICT DO NOTHING.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.documentos_tipos_tipos_persona (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_tipo_id uuid NOT NULL REFERENCES public.documentos_tipos(id) ON DELETE CASCADE,
  tipo_persona_id   uuid NOT NULL REFERENCES public.personas_tipos(id) ON DELETE CASCADE,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (documento_tipo_id, tipo_persona_id)
);

CREATE INDEX IF NOT EXISTS idx_dttp_doc  ON public.documentos_tipos_tipos_persona(documento_tipo_id);
CREATE INDEX IF NOT EXISTS idx_dttp_tipo ON public.documentos_tipos_tipos_persona(tipo_persona_id);

ALTER TABLE public.documentos_tipos_tipos_persona ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier usuario autenticado (catálogo global, igual que la matriz de estab).
DROP POLICY IF EXISTS "dttp_select" ON public.documentos_tipos_tipos_persona;
CREATE POLICY "dttp_select" ON public.documentos_tipos_tipos_persona
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- WRITE: solo staff/developer.
DROP POLICY IF EXISTS "dttp_write" ON public.documentos_tipos_tipos_persona;
CREATE POLICY "dttp_write" ON public.documentos_tipos_tipos_persona
  FOR ALL USING (is_developer()) WITH CHECK (is_developer());

-- ─── Seed default (match por nombre de doc + nombre de tipo de persona) ───
INSERT INTO public.documentos_tipos_tipos_persona (documento_tipo_id, tipo_persona_id)
SELECT dt.id, pt.id
FROM (VALUES
  -- Trabajadores: legajo del empleado
  ('Alta Temprana',                                       'Trabajadores'),
  ('Análisis de Trabajo Seguro (ATS)',                    'Trabajadores'),
  ('Constancia de CUIL',                                  'Trabajadores'),
  ('Examen Preocupacional Apto',                          'Trabajadores'),
  ('Foto DNI (Frente y Dorso)',                           'Trabajadores'),
  ('Licencia de Conducir Profesional',                    'Trabajadores'),
  ('Pago Monotributo',                                    'Trabajadores'),
  ('Permiso de Trabajo Seguro (PTS)',                     'Trabajadores'),
  ('Planilla de Entrega de EPP',                          'Trabajadores'),
  ('Registro de Capacitación Teórico/Práctica (10 Hs)',   'Trabajadores'),
  ('Registro de Inducción',                               'Trabajadores'),
  ('Seguro de Accidentes Personales (SAP)',               'Trabajadores'),
  ('Tarjeta IERIC',                                       'Trabajadores'),
  -- Profesionales: matrículas / encomienda del responsable HyS
  ('Encomienda Profesional',                              'Profesionales'),
  ('Matrícula Auxiliar H;S&B',                            'Profesionales'),
  ('Matrícula Responsable de H;S&B',                      'Profesionales')
) AS m(doc_nombre, tipo_persona_nombre)
JOIN public.documentos_tipos dt ON dt.nombre = m.doc_nombre
JOIN public.personas_tipos pt   ON pt.nombre = m.tipo_persona_nombre
ON CONFLICT (documento_tipo_id, tipo_persona_id) DO NOTHING;
