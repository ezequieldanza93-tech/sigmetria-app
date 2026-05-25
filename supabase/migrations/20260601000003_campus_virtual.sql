-- ============================================================
-- CAMPUS VIRTUAL — LMS interno (cursos, quizzes, certificados)
-- ============================================================

-- Extend enum de firmas para certificados de cursos
ALTER TYPE public.firma_entidad_tipo ADD VALUE IF NOT EXISTS 'curso_certificado';

-- ============================================================
-- TABLAS
-- ============================================================

CREATE TABLE IF NOT EXISTS cursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id uuid REFERENCES public.consultoras(id) ON DELETE CASCADE,
  autor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descripcion_corta text,
  descripcion_larga text,
  portada_url text,
  categoria text,
  nivel text CHECK (nivel IN ('basico', 'intermedio', 'avanzado')) DEFAULT 'basico',
  idioma text DEFAULT 'es',
  duracion_estimada_minutos int,
  vencimiento_meses int,
  vigente_desde date,
  vigente_hasta date,
  estado text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'publicado', 'archivado')),
  es_publico boolean GENERATED ALWAYS AS (consultora_id IS NULL) STORED,
  version int NOT NULL DEFAULT 1,
  configuracion_quiz jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cursos_consultora_idx ON cursos (consultora_id);
CREATE INDEX IF NOT EXISTS cursos_estado_idx ON cursos (estado);
CREATE INDEX IF NOT EXISTS cursos_publico_idx ON cursos (es_publico) WHERE estado = 'publicado';

CREATE TABLE IF NOT EXISTS curso_modulos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  orden int NOT NULL,
  titulo text NOT NULL,
  descripcion text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (curso_id, orden)
);

CREATE INDEX IF NOT EXISTS curso_modulos_curso_idx ON curso_modulos (curso_id);

CREATE TABLE IF NOT EXISTS curso_lecciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  modulo_id uuid NOT NULL REFERENCES curso_modulos(id) ON DELETE CASCADE,
  orden int NOT NULL,
  titulo text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('video', 'pdf', 'texto', 'embed')),
  contenido_url text,
  contenido_texto text,
  duracion_minutos int,
  descargable boolean NOT NULL DEFAULT false,
  anti_skip boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (modulo_id, orden)
);

CREATE INDEX IF NOT EXISTS curso_lecciones_modulo_idx ON curso_lecciones (modulo_id);

CREATE TABLE IF NOT EXISTS curso_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  modulo_id uuid REFERENCES curso_modulos(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  porcentaje_aprobacion smallint NOT NULL DEFAULT 70 CHECK (porcentaje_aprobacion BETWEEN 0 AND 100),
  max_intentos int DEFAULT 3,
  tiempo_limite_minutos int,
  randomizar_preguntas boolean NOT NULL DEFAULT true,
  mostrar_correctas boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS curso_quizzes_curso_idx ON curso_quizzes (curso_id);

CREATE TABLE IF NOT EXISTS curso_preguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES curso_quizzes(id) ON DELETE CASCADE,
  orden int NOT NULL,
  enunciado text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('multiple_choice', 'multiple_select', 'true_false', 'short_text')),
  puntaje numeric(4,2) NOT NULL DEFAULT 1,
  explicacion text,
  short_text_respuesta text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, orden)
);

CREATE INDEX IF NOT EXISTS curso_preguntas_quiz_idx ON curso_preguntas (quiz_id);

CREATE TABLE IF NOT EXISTS curso_opciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pregunta_id uuid NOT NULL REFERENCES curso_preguntas(id) ON DELETE CASCADE,
  orden int NOT NULL,
  texto text NOT NULL,
  es_correcta boolean NOT NULL DEFAULT false,
  UNIQUE (pregunta_id, orden)
);

CREATE INDEX IF NOT EXISTS curso_opciones_pregunta_idx ON curso_opciones (pregunta_id);

CREATE TABLE IF NOT EXISTS curso_asignaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  persona_id uuid NOT NULL REFERENCES public.directorio_personas(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  establecimiento_id uuid REFERENCES public.establecimientos(id) ON DELETE SET NULL,
  asignado_por_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  fecha_asignacion timestamptz NOT NULL DEFAULT now(),
  fecha_limite date,
  obligatorio boolean NOT NULL DEFAULT false,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'en_curso', 'aprobado', 'vencido', 'desasignado')),
  fecha_inicio timestamptz,
  fecha_aprobacion timestamptz,
  progreso_porcentaje smallint NOT NULL DEFAULT 0 CHECK (progreso_porcentaje BETWEEN 0 AND 100),
  ultimo_acceso timestamptz,
  curso_version int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (curso_id, persona_id, fecha_asignacion)
);

CREATE INDEX IF NOT EXISTS curso_asignaciones_curso_idx ON curso_asignaciones (curso_id);
CREATE INDEX IF NOT EXISTS curso_asignaciones_persona_idx ON curso_asignaciones (persona_id);
CREATE INDEX IF NOT EXISTS curso_asignaciones_empresa_idx ON curso_asignaciones (empresa_id);
CREATE INDEX IF NOT EXISTS curso_asignaciones_estado_idx ON curso_asignaciones (estado) WHERE estado IN ('pendiente', 'en_curso');
CREATE INDEX IF NOT EXISTS curso_asignaciones_fecha_limite_idx ON curso_asignaciones (fecha_limite) WHERE estado NOT IN ('aprobado', 'desasignado');

CREATE TABLE IF NOT EXISTS curso_progreso_lecciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id uuid NOT NULL REFERENCES curso_asignaciones(id) ON DELETE CASCADE,
  leccion_id uuid NOT NULL REFERENCES curso_lecciones(id) ON DELETE CASCADE,
  completada boolean NOT NULL DEFAULT false,
  minutos_vistos numeric(6,1) NOT NULL DEFAULT 0,
  ultima_vez timestamptz NOT NULL DEFAULT now(),
  UNIQUE (asignacion_id, leccion_id)
);

CREATE INDEX IF NOT EXISTS curso_progreso_asignacion_idx ON curso_progreso_lecciones (asignacion_id);

CREATE TABLE IF NOT EXISTS curso_intentos_quiz (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id uuid NOT NULL REFERENCES curso_asignaciones(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES curso_quizzes(id) ON DELETE CASCADE,
  numero_intento int NOT NULL,
  fecha_inicio timestamptz NOT NULL DEFAULT now(),
  fecha_fin timestamptz,
  puntaje_obtenido numeric(5,2),
  puntaje_total numeric(5,2),
  porcentaje numeric(5,2),
  aprobado boolean,
  respuestas jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (asignacion_id, quiz_id, numero_intento)
);

CREATE INDEX IF NOT EXISTS curso_intentos_asignacion_idx ON curso_intentos_quiz (asignacion_id);
CREATE INDEX IF NOT EXISTS curso_intentos_quiz_idx ON curso_intentos_quiz (quiz_id);

CREATE TABLE IF NOT EXISTS cursos_certificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asignacion_id uuid REFERENCES curso_asignaciones(id) ON DELETE CASCADE,
  codigo_validacion text NOT NULL UNIQUE,
  firma_id uuid REFERENCES public.firmas(id) ON DELETE SET NULL,
  pdf_path text,
  pdf_url text,
  fecha_emision timestamptz NOT NULL DEFAULT now(),
  fecha_vencimiento date,
  invalidado boolean NOT NULL DEFAULT false,
  motivo_invalidacion text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cursos_certificados_codigo_idx ON cursos_certificados (codigo_validacion);
CREATE INDEX IF NOT EXISTS cursos_certificados_asignacion_idx ON cursos_certificados (asignacion_id);

CREATE TABLE IF NOT EXISTS cursos_obligatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  scope_tipo text NOT NULL CHECK (scope_tipo IN ('empresa', 'establecimiento', 'sector', 'puesto')),
  scope_id uuid NOT NULL,
  vigente_desde date NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta date,
  fecha_limite_dias int,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cursos_obligatorios_curso_idx ON cursos_obligatorios (curso_id);
CREATE INDEX IF NOT EXISTS cursos_obligatorios_scope_idx ON cursos_obligatorios (scope_tipo, scope_id);

CREATE TABLE IF NOT EXISTS cursos_versiones_material (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id uuid NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
  version int NOT NULL,
  snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (curso_id, version)
);

CREATE INDEX IF NOT EXISTS cursos_versiones_curso_idx ON cursos_versiones_material (curso_id, version DESC);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
  END IF;
END $$;

CREATE TRIGGER IF NOT EXISTS cursos_updated_at BEFORE UPDATE ON cursos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER IF NOT EXISTS curso_modulos_updated_at BEFORE UPDATE ON curso_modulos FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER IF NOT EXISTS curso_lecciones_updated_at BEFORE UPDATE ON curso_lecciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER IF NOT EXISTS curso_quizzes_updated_at BEFORE UPDATE ON curso_quizzes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER IF NOT EXISTS curso_asignaciones_updated_at BEFORE UPDATE ON curso_asignaciones FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE cursos ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_lecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_preguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_opciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_asignaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_progreso_lecciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE curso_intentos_quiz ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos_certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos_obligatorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE cursos_versiones_material ENABLE ROW LEVEL SECURITY;

-- CURSOS: SELECT
DROP POLICY IF EXISTS "cursos: select public or own consultora" ON cursos;
CREATE POLICY "cursos: select public or own consultora" ON cursos
  FOR SELECT TO authenticated
  USING (
    consultora_id IS NULL
    OR consultora_id IN (
      SELECT cm.consultora_id FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid() AND cm.is_active = true
    )
    OR is_super_admin()
  );

-- CURSOS: INSERT
DROP POLICY IF EXISTS "cursos: insert" ON cursos;
CREATE POLICY "cursos: insert" ON cursos
  FOR INSERT TO authenticated
  WITH CHECK (
    (consultora_id IS NULL AND is_super_admin())
    OR (consultora_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.consultora_id = cursos.consultora_id
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    ))
  );

-- CURSOS: UPDATE
DROP POLICY IF EXISTS "cursos: update" ON cursos;
CREATE POLICY "cursos: update" ON cursos
  FOR UPDATE TO authenticated
  USING (
    (consultora_id IS NULL AND is_super_admin())
    OR (consultora_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.consultora_id = cursos.consultora_id
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    ))
  );

-- CURSOS: DELETE
DROP POLICY IF EXISTS "cursos: delete" ON cursos;
CREATE POLICY "cursos: delete" ON cursos
  FOR DELETE TO authenticated
  USING (
    (consultora_id IS NULL AND is_super_admin())
    OR (consultora_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.consultora_id = cursos.consultora_id
        AND cm.is_active = true
        AND cm.role = 'full_access_main'
    ))
  );

-- CURSO_MODULOS: SELECT (cualquiera que pueda ver el curso)
DROP POLICY IF EXISTS "curso_modulos: select" ON curso_modulos;
CREATE POLICY "curso_modulos: select" ON curso_modulos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_modulos.curso_id));

-- CURSO_MODULOS: WRITE
DROP POLICY IF EXISTS "curso_modulos: write" ON curso_modulos;
CREATE POLICY "curso_modulos: write" ON curso_modulos
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cursos c WHERE c.id = curso_modulos.curso_id
    AND ((c.consultora_id IS NULL AND is_super_admin())
      OR (c.consultora_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.consultora_id = c.consultora_id
          AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
      )))
  ));

-- CURSO_LECCIONES
DROP POLICY IF EXISTS "curso_lecciones: select" ON curso_lecciones;
CREATE POLICY "curso_lecciones: select" ON curso_lecciones
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM curso_modulos m JOIN cursos c ON c.id = m.curso_id WHERE m.id = curso_lecciones.modulo_id));

DROP POLICY IF EXISTS "curso_lecciones: write" ON curso_lecciones;
CREATE POLICY "curso_lecciones: write" ON curso_lecciones
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM curso_modulos m JOIN cursos c ON c.id = m.curso_id WHERE m.id = curso_lecciones.modulo_id
    AND ((c.consultora_id IS NULL AND is_super_admin())
      OR (c.consultora_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.consultora_id = c.consultora_id
          AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
      )))
  ));

-- CURSO_QUIZZES
DROP POLICY IF EXISTS "curso_quizzes: select" ON curso_quizzes;
CREATE POLICY "curso_quizzes: select" ON curso_quizzes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_quizzes.curso_id));

DROP POLICY IF EXISTS "curso_quizzes: write" ON curso_quizzes;
CREATE POLICY "curso_quizzes: write" ON curso_quizzes
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cursos c WHERE c.id = curso_quizzes.curso_id
    AND ((c.consultora_id IS NULL AND is_super_admin())
      OR (c.consultora_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.consultora_id = c.consultora_id
          AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
      )))
  ));

-- CURSO_PREGUNTAS
DROP POLICY IF EXISTS "curso_preguntas: select" ON curso_preguntas;
CREATE POLICY "curso_preguntas: select" ON curso_preguntas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM curso_quizzes q JOIN cursos c ON c.id = q.curso_id WHERE q.id = curso_preguntas.quiz_id));

DROP POLICY IF EXISTS "curso_preguntas: write" ON curso_preguntas;
CREATE POLICY "curso_preguntas: write" ON curso_preguntas
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM curso_quizzes q JOIN cursos c ON c.id = q.curso_id WHERE q.id = curso_preguntas.quiz_id
    AND ((c.consultora_id IS NULL AND is_super_admin())
      OR (c.consultora_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.consultora_id = c.consultora_id
          AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
      )))
  ));

-- CURSO_OPCIONES
DROP POLICY IF EXISTS "curso_opciones: select" ON curso_opciones;
CREATE POLICY "curso_opciones: select" ON curso_opciones
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM curso_preguntas p JOIN curso_quizzes q ON q.id = p.quiz_id
    JOIN cursos c ON c.id = q.curso_id WHERE p.id = curso_opciones.pregunta_id
  ));

DROP POLICY IF EXISTS "curso_opciones: write" ON curso_opciones;
CREATE POLICY "curso_opciones: write" ON curso_opciones
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM curso_preguntas p JOIN curso_quizzes q ON q.id = p.quiz_id
    JOIN cursos c ON c.id = q.curso_id WHERE p.id = curso_opciones.pregunta_id
    AND ((c.consultora_id IS NULL AND is_super_admin())
      OR (c.consultora_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.consultora_id = c.consultora_id
          AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
      )))
  ));

-- CURSO_ASIGNACIONES: SELECT
DROP POLICY IF EXISTS "curso_asignaciones: select" ON curso_asignaciones;
CREATE POLICY "curso_asignaciones: select" ON curso_asignaciones
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.directorio_personas dp
      WHERE dp.id = curso_asignaciones.persona_id
        AND dp.created_in_consultora_id IN (
          SELECT cm.consultora_id FROM public.consultoras_members cm
          WHERE cm.user_id = auth.uid() AND cm.is_active = true
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.directorio_personas dp
      WHERE dp.id = curso_asignaciones.persona_id AND dp.usuario_id = auth.uid()
    )
  );

-- CURSO_ASIGNACIONES: WRITE (consultora admin)
DROP POLICY IF EXISTS "curso_asignaciones: write consultora" ON curso_asignaciones;
CREATE POLICY "curso_asignaciones: write consultora" ON curso_asignaciones
  FOR ALL TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM public.directorio_personas dp
      JOIN public.consultoras_members cm ON cm.consultora_id = dp.created_in_consultora_id
      WHERE dp.id = curso_asignaciones.persona_id
        AND cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    )
  );

-- CURSO_PROGRESO_LECCIONES
DROP POLICY IF EXISTS "curso_progreso: select consultora or own" ON curso_progreso_lecciones;
CREATE POLICY "curso_progreso: select consultora or own" ON curso_progreso_lecciones
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM curso_asignaciones ca
      JOIN public.directorio_personas dp ON dp.id = ca.persona_id
      WHERE ca.id = curso_progreso_lecciones.asignacion_id
        AND (dp.usuario_id = auth.uid()
          OR dp.created_in_consultora_id IN (
            SELECT cm.consultora_id FROM public.consultoras_members cm
            WHERE cm.user_id = auth.uid() AND cm.is_active = true
          ))
    )
  );

DROP POLICY IF EXISTS "curso_progreso: insert/update own" ON curso_progreso_lecciones;
CREATE POLICY "curso_progreso: insert/update own" ON curso_progreso_lecciones
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM curso_asignaciones ca
      JOIN public.directorio_personas dp ON dp.id = ca.persona_id
      WHERE ca.id = curso_progreso_lecciones.asignacion_id AND dp.usuario_id = auth.uid()
    )
  );

-- CURSO_INTENTOS_QUIZ
DROP POLICY IF EXISTS "curso_intentos: select" ON curso_intentos_quiz;
CREATE POLICY "curso_intentos: select" ON curso_intentos_quiz
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM curso_asignaciones ca
      JOIN public.directorio_personas dp ON dp.id = ca.persona_id
      WHERE ca.id = curso_intentos_quiz.asignacion_id
        AND (dp.usuario_id = auth.uid()
          OR dp.created_in_consultora_id IN (
            SELECT cm.consultora_id FROM public.consultoras_members cm
            WHERE cm.user_id = auth.uid() AND cm.is_active = true
          ))
    )
  );

DROP POLICY IF EXISTS "curso_intentos: insert own" ON curso_intentos_quiz;
CREATE POLICY "curso_intentos: insert own" ON curso_intentos_quiz
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM curso_asignaciones ca
      JOIN public.directorio_personas dp ON dp.id = ca.persona_id
      WHERE ca.id = curso_intentos_quiz.asignacion_id AND dp.usuario_id = auth.uid()
    )
  );

-- CURSOS_CERTIFICADOS
DROP POLICY IF EXISTS "cursos_certificados: select" ON cursos_certificados;
CREATE POLICY "cursos_certificados: select" ON cursos_certificados
  FOR SELECT TO authenticated
  USING (
    is_super_admin()
    OR EXISTS (
      SELECT 1 FROM curso_asignaciones ca
      JOIN public.directorio_personas dp ON dp.id = ca.persona_id
      WHERE ca.id = cursos_certificados.asignacion_id
        AND (dp.usuario_id = auth.uid()
          OR dp.created_in_consultora_id IN (
            SELECT cm.consultora_id FROM public.consultoras_members cm
            WHERE cm.user_id = auth.uid() AND cm.is_active = true
          ))
    )
  );

-- CURSOS_OBLIGATORIOS
DROP POLICY IF EXISTS "cursos_obligatorios: select" ON cursos_obligatorios;
CREATE POLICY "cursos_obligatorios: select" ON cursos_obligatorios
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "cursos_obligatorios: write" ON cursos_obligatorios;
CREATE POLICY "cursos_obligatorios: write" ON cursos_obligatorios
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cursos c WHERE c.id = cursos_obligatorios.curso_id
    AND ((c.consultora_id IS NULL AND is_super_admin())
      OR (c.consultora_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.consultora_id = c.consultora_id
          AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
      )))
  ));

-- CURSOS_VERSIONES_MATERIAL
DROP POLICY IF EXISTS "cursos_versiones: select" ON cursos_versiones_material;
CREATE POLICY "cursos_versiones: select" ON cursos_versiones_material
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cursos c WHERE c.id = cursos_versiones_material.curso_id));

DROP POLICY IF EXISTS "cursos_versiones: write" ON cursos_versiones_material;
CREATE POLICY "cursos_versiones: write" ON cursos_versiones_material
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM cursos c WHERE c.id = cursos_versiones_material.curso_id
    AND ((c.consultora_id IS NULL AND is_super_admin())
      OR (c.consultora_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid() AND cm.consultora_id = c.consultora_id
          AND cm.is_active = true AND cm.role IN ('full_access_main', 'full_access_branch')
      )))
  ));

-- ============================================================
-- FUNCIONES HELPER
-- ============================================================

CREATE OR REPLACE FUNCTION cursos_cumplimiento_empresa(p_empresa_id uuid)
RETURNS TABLE(
  total_asignaciones bigint,
  aprobadas bigint,
  pendientes bigint,
  vencidas bigint,
  porcentaje numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH stats AS (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE estado = 'aprobado') AS apr,
      COUNT(*) FILTER (WHERE estado IN ('pendiente', 'en_curso')) AS pen,
      COUNT(*) FILTER (WHERE estado = 'vencido') AS venc
    FROM curso_asignaciones
    WHERE empresa_id = p_empresa_id AND obligatorio = true AND estado != 'desasignado'
  )
  SELECT total, apr, pen, venc,
    CASE WHEN total = 0 THEN 100 ELSE ROUND((apr::numeric / total::numeric) * 100, 1) END
  FROM stats;
$$;

GRANT EXECUTE ON FUNCTION cursos_cumplimiento_empresa(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION marcar_cursos_vencidos()
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  cnt int;
BEGIN
  UPDATE curso_asignaciones
  SET estado = 'vencido', updated_at = now()
  WHERE estado IN ('pendiente', 'en_curso')
    AND fecha_limite IS NOT NULL
    AND fecha_limite < CURRENT_DATE;
  GET DIAGNOSTICS cnt = ROW_COUNT;
  RETURN cnt;
END;
$$;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('cursos-material', 'cursos-material', false, 524288000, ARRAY['video/mp4', 'video/webm', 'application/pdf', 'image/png', 'image/jpeg', 'image/webp']),
  ('cursos-portadas', 'cursos-portadas', true, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp']),
  ('cursos-certificados', 'cursos-certificados', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public             = EXCLUDED.public,
  file_size_limit    = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- RLS para storage buckets
DROP POLICY IF EXISTS "cursos: material insert" ON storage.objects;
CREATE POLICY "cursos: material insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('cursos-material', 'cursos-portadas', 'cursos-certificados')
    AND (bucket_id = 'cursos-portadas' OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
        AND cm.consultora_id = storage_path_consultora_id(name)
    ))
  );

DROP POLICY IF EXISTS "cursos: material update" ON storage.objects;
CREATE POLICY "cursos: material update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id IN ('cursos-material', 'cursos-portadas', 'cursos-certificados')
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
        AND cm.consultora_id = storage_path_consultora_id(name)
    )
  );

DROP POLICY IF EXISTS "cursos: material delete" ON storage.objects;
CREATE POLICY "cursos: material delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id IN ('cursos-material', 'cursos-portadas', 'cursos-certificados')
    AND EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id = auth.uid()
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
        AND cm.consultora_id = storage_path_consultora_id(name)
    )
  );

DROP POLICY IF EXISTS "cursos: material read" ON storage.objects;
CREATE POLICY "cursos: material read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id IN ('cursos-material', 'cursos-portadas', 'cursos-certificados')
    AND (
      bucket_id = 'cursos-portadas'
      OR EXISTS (
        SELECT 1 FROM public.consultoras_members cm
        WHERE cm.user_id = auth.uid()
          AND cm.is_active = true
          AND cm.consultora_id = storage_path_consultora_id(name)
      )
    )
  );
