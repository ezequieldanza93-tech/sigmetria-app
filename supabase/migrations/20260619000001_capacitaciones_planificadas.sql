-- ============================================================
-- Capacitaciones planificadas: gestión ↔ curso + participantes con token
-- ============================================================
-- Aditivo e idempotente. NO toca tablas existentes (cursos, capacitaciones vieja,
-- gestiones_registros). Integra el LMS (módulo cursos) con las gestiones.
--
-- Modelo (adaptado al esquema de sigmetria, que usa gestiones_registros
-- PARTICIONADA por fecha_planificada + gestiones_establecimientos):
--   capacitacion_sesiones      = instancia ejecutada de un curso, anclada a un
--                                establecimiento, ligada (opcional y suelta) al
--                                registro de gestión que la originó.
--   capacitacion_participantes = personas convocadas; cada una con un `token`
--                                para tomar el curso/evaluación SIN login.
--
-- Seguridad del token: el acceso sin login NO se hace por RLS de anon. Se hace por
-- server actions con service-role que validan el token. Estas tablas solo las
-- ve/edita personal AUTENTICADO con acceso al establecimiento (helpers
-- has_establecimiento_read/write_access). anon NO tiene acceso directo.
-- ============================================================

-- ─── 1. Sesiones ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.capacitacion_sesiones (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curso_id                    uuid NOT NULL REFERENCES public.cursos(id) ON DELETE RESTRICT,
  establecimiento_id          uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  empresa_id                  uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  -- Vínculo con la gestión planificada (modelo sigmetria):
  gestion_establecimiento_id  uuid REFERENCES public.gestiones_establecimientos(id) ON DELETE SET NULL,
  -- Referencia SUELTA al registro puntual (gestiones_registros está particionada
  -- por fecha_planificada con PK compuesta → no se puede FK dura; guardamos id+fecha).
  registro_gestion_id         uuid,
  rg_fecha_planificada        date,
  titulo                      text,
  instructor_persona_id       uuid REFERENCES public.personas_directorio(id) ON DELETE SET NULL,
  instructor_externo          text,
  fecha                       date,
  modalidad                   text NOT NULL DEFAULT 'elearning',
  estado                      text NOT NULL DEFAULT 'borrador',
  nota_aprobacion             smallint,
  comentario                  text,
  created_by                  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.capacitacion_sesiones DROP CONSTRAINT IF EXISTS chk_cap_sesiones_modalidad;
ALTER TABLE public.capacitacion_sesiones ADD CONSTRAINT chk_cap_sesiones_modalidad
  CHECK (modalidad IN ('elearning','presencial'));
ALTER TABLE public.capacitacion_sesiones DROP CONSTRAINT IF EXISTS chk_cap_sesiones_estado;
ALTER TABLE public.capacitacion_sesiones ADD CONSTRAINT chk_cap_sesiones_estado
  CHECK (estado IN ('borrador','abierta','cerrada'));
CREATE INDEX IF NOT EXISTS idx_cap_sesiones_establecimiento ON public.capacitacion_sesiones (establecimiento_id);
CREATE INDEX IF NOT EXISTS idx_cap_sesiones_curso ON public.capacitacion_sesiones (curso_id);

-- ─── 2. Participantes (token sin login) ─────────────────────
CREATE TABLE IF NOT EXISTS public.capacitacion_participantes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id       uuid NOT NULL REFERENCES public.capacitacion_sesiones(id) ON DELETE CASCADE,
  persona_id      uuid REFERENCES public.personas_directorio(id) ON DELETE SET NULL,
  nombre          text,
  email           text,
  token           text NOT NULL UNIQUE,
  token_expira    timestamptz,
  estado          text NOT NULL DEFAULT 'pendiente',
  puntaje         smallint,
  aprobado        boolean NOT NULL DEFAULT false,
  intentos        smallint NOT NULL DEFAULT 0,
  respuestas      jsonb,
  asignacion_id   uuid REFERENCES public.curso_asignaciones(id) ON DELETE SET NULL,
  certificado_id  uuid REFERENCES public.cursos_certificados(id) ON DELETE SET NULL,
  iniciado_at     timestamptz,
  completado_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.capacitacion_participantes DROP CONSTRAINT IF EXISTS chk_cap_part_estado;
ALTER TABLE public.capacitacion_participantes ADD CONSTRAINT chk_cap_part_estado
  CHECK (estado IN ('pendiente','en_progreso','aprobado','reprobado'));
CREATE INDEX IF NOT EXISTS idx_cap_part_sesion ON public.capacitacion_participantes (sesion_id);
CREATE INDEX IF NOT EXISTS idx_cap_part_token ON public.capacitacion_participantes (token);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cap_part_sesion_persona
  ON public.capacitacion_participantes (sesion_id, persona_id) WHERE persona_id IS NOT NULL;

-- ─── 3. Trigger updated_at (solo si existe el helper) ───────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'trigger_set_updated_at'
             AND pronamespace = 'public'::regnamespace) THEN
    DROP TRIGGER IF EXISTS set_updated_at ON public.capacitacion_sesiones;
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.capacitacion_sesiones
      FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();
  END IF;
END $$;

-- ─── 4. RLS (tenant por establecimiento; anon NO accede acá) ─
ALTER TABLE public.capacitacion_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacitacion_participantes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cap_sesiones: select" ON public.capacitacion_sesiones;
CREATE POLICY "cap_sesiones: select" ON public.capacitacion_sesiones FOR SELECT TO authenticated
  USING (public.has_establecimiento_read_access(establecimiento_id));
DROP POLICY IF EXISTS "cap_sesiones: insert" ON public.capacitacion_sesiones;
CREATE POLICY "cap_sesiones: insert" ON public.capacitacion_sesiones FOR INSERT TO authenticated
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));
DROP POLICY IF EXISTS "cap_sesiones: update" ON public.capacitacion_sesiones;
CREATE POLICY "cap_sesiones: update" ON public.capacitacion_sesiones FOR UPDATE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));
DROP POLICY IF EXISTS "cap_sesiones: delete" ON public.capacitacion_sesiones;
CREATE POLICY "cap_sesiones: delete" ON public.capacitacion_sesiones FOR DELETE TO authenticated
  USING (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "cap_part: select" ON public.capacitacion_participantes;
CREATE POLICY "cap_part: select" ON public.capacitacion_participantes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.capacitacion_sesiones s
                 WHERE s.id = sesion_id AND public.has_establecimiento_read_access(s.establecimiento_id)));
DROP POLICY IF EXISTS "cap_part: insert" ON public.capacitacion_participantes;
CREATE POLICY "cap_part: insert" ON public.capacitacion_participantes FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.capacitacion_sesiones s
                      WHERE s.id = sesion_id AND public.has_establecimiento_write_access(s.establecimiento_id)));
DROP POLICY IF EXISTS "cap_part: update" ON public.capacitacion_participantes;
CREATE POLICY "cap_part: update" ON public.capacitacion_participantes FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.capacitacion_sesiones s
                 WHERE s.id = sesion_id AND public.has_establecimiento_write_access(s.establecimiento_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM public.capacitacion_sesiones s
                      WHERE s.id = sesion_id AND public.has_establecimiento_write_access(s.establecimiento_id)));
DROP POLICY IF EXISTS "cap_part: delete" ON public.capacitacion_participantes;
CREATE POLICY "cap_part: delete" ON public.capacitacion_participantes FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.capacitacion_sesiones s
                 WHERE s.id = sesion_id AND public.has_establecimiento_write_access(s.establecimiento_id)));

COMMENT ON TABLE public.capacitacion_sesiones IS 'Instancia de capacitacion: ejecucion de un curso ligada (suelta) a una gestion planificada (gestiones_registros particionada), anclada a un establecimiento.';
COMMENT ON TABLE public.capacitacion_participantes IS 'Participantes de una sesion de capacitacion. token = acceso sin login, validado server-side con service-role (no por RLS de anon).';
