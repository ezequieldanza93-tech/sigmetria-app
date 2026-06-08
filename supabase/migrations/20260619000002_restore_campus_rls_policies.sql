-- ============================================================
-- Restaurar políticas RLS del Campus Virtual que desaparecieron
-- ============================================================
-- CONTEXTO / ROOT CAUSE:
-- La migración 20260601000003_campus_virtual.sql creó RLS + políticas para todo
-- el LMS. En la base viva, las tablas cuyas políticas referencian is_super_admin()
-- quedaron con RLS HABILITADA y CERO políticas (deny-all para `authenticated`):
--   cursos, curso_modulos, curso_lecciones, curso_quizzes, curso_preguntas,
--   curso_opciones, cursos_obligatorios, cursos_versiones_material
-- Las tablas que NO usan is_super_admin() conservaron sus políticas
-- (curso_asignaciones, curso_progreso_lecciones, curso_intentos_quiz,
--  cursos_certificados). El patrón indica que las políticas dependientes se
-- perdieron en alguna intervención manual de RLS posterior (no hay DROP ...
-- CASCADE en ninguna migración). Sin estas políticas, ningún usuario autenticado
-- puede leer cursos → el Campus Virtual y el dropdown de "Ejecutar capacitación"
-- aparecen vacíos aunque existan cursos publicados.
--
-- Este script re-crea SOLO las políticas faltantes, idénticas al diseño original
-- de campus_virtual, de forma idempotente (DROP IF EXISTS + CREATE).
-- No toca tablas ni datos. Aditivo y seguro de re-aplicar.
-- ============================================================

-- ─── CURSOS ─────────────────────────────────────────────────
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

-- ─── CURSO_MODULOS ──────────────────────────────────────────
DROP POLICY IF EXISTS "curso_modulos: select" ON curso_modulos;
CREATE POLICY "curso_modulos: select" ON curso_modulos
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM cursos c WHERE c.id = curso_modulos.curso_id));

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

-- ─── CURSO_LECCIONES ────────────────────────────────────────
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

-- ─── CURSO_QUIZZES ──────────────────────────────────────────
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

-- ─── CURSO_PREGUNTAS ────────────────────────────────────────
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

-- ─── CURSO_OPCIONES ─────────────────────────────────────────
-- NOTA: la policy SELECT NO filtra es_correcta. La protección del campo
-- es_correcta se hace en el server (las server actions públicas nunca lo exponen).
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

-- ─── CURSOS_OBLIGATORIOS ────────────────────────────────────
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

-- ─── CURSOS_VERSIONES_MATERIAL ──────────────────────────────
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
