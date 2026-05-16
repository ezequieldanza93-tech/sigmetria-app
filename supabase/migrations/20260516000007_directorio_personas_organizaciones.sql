-- ============================================================
-- Sigmetría — Directorio de Personas y Organizaciones
-- Reemplaza la tabla empleados con un directorio unificado.
-- Jerarquía resultante:
--   consultora → empresa → establecimiento → persona / organización
-- ============================================================


-- ============================================================
-- 1. tipo_personas — catálogo maestro de tipos de persona
-- ============================================================
CREATE TABLE public.tipo_personas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tipo_personas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipo_personas: select" ON public.tipo_personas FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tipo_personas: insert" ON public.tipo_personas FOR INSERT
  WITH CHECK (is_developer());

CREATE POLICY "tipo_personas: update" ON public.tipo_personas FOR UPDATE
  USING (is_developer());

CREATE POLICY "tipo_personas: delete" ON public.tipo_personas FOR DELETE
  USING (is_developer());

INSERT INTO public.tipo_personas (nombre) VALUES
  ('Empleado'),
  ('Cliente'),
  ('Familiar'),
  ('Vecino'),
  ('Inspector'),
  ('Auditor');


-- ============================================================
-- 2. tipo_organizaciones — catálogo maestro de tipos de organización
-- ============================================================
CREATE TABLE public.tipo_organizaciones (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text NOT NULL UNIQUE,
  descripcion text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tipo_organizaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipo_organizaciones: select" ON public.tipo_organizaciones FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "tipo_organizaciones: insert" ON public.tipo_organizaciones FOR INSERT
  WITH CHECK (is_developer());

CREATE POLICY "tipo_organizaciones: update" ON public.tipo_organizaciones FOR UPDATE
  USING (is_developer());

CREATE POLICY "tipo_organizaciones: delete" ON public.tipo_organizaciones FOR DELETE
  USING (is_developer());

INSERT INTO public.tipo_organizaciones (nombre) VALUES
  ('Proveedor'),
  ('Subcontratista'),
  ('Agente Gubernamental'),
  ('Marca');


-- ============================================================
-- 3. organizaciones — empresas externas / terceros
-- ============================================================
CREATE TABLE public.organizaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          text NOT NULL,
  tipo_id         uuid NOT NULL REFERENCES public.tipo_organizaciones(id),
  email           text,
  telefono        text,
  notas           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.organizaciones ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro activo de la consultora
CREATE POLICY "organizaciones: select" ON public.organizaciones FOR SELECT
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
    )
  );

-- INSERT: miembros con rol operativo (no viewer)
CREATE POLICY "organizaciones: insert" ON public.organizaciones FOR INSERT
  WITH CHECK (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );

-- UPDATE: miembros con rol operativo (no viewer)
CREATE POLICY "organizaciones: update" ON public.organizaciones FOR UPDATE
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch', 'colaborador')
    )
  );

-- DELETE: solo admins
CREATE POLICY "organizaciones: delete" ON public.organizaciones FOR DELETE
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.consultora_members cm
      WHERE cm.user_id = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    )
  );


-- ============================================================
-- 4. organizacion_establecimiento — junction organizaciones ↔ establecimientos
-- ============================================================
CREATE TABLE public.organizacion_establecimiento (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizacion_id    uuid NOT NULL REFERENCES public.organizaciones(id) ON DELETE CASCADE,
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organizacion_id, establecimiento_id)
);

ALTER TABLE public.organizacion_establecimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "organizacion_establecimiento: select" ON public.organizacion_establecimiento FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));

CREATE POLICY "organizacion_establecimiento: insert" ON public.organizacion_establecimiento FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "organizacion_establecimiento: delete" ON public.organizacion_establecimiento FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));


-- ============================================================
-- 5. directorio_personas — tabla unificada de personas
-- ============================================================
CREATE TABLE public.directorio_personas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id         uuid NOT NULL REFERENCES public.tipo_personas(id),
  nombre          text NOT NULL,
  apellido        text NOT NULL,
  dni             text,
  fecha_nacimiento date,
  fecha_ingreso   date,
  legajo          text,
  telefono        text,
  email           text,
  organizacion_id uuid REFERENCES public.organizaciones(id) ON DELETE SET NULL,
  notas           text,
  is_active       boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.directorio_personas ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 6. persona_establecimiento — junction directorio_personas ↔ establecimientos
-- ============================================================
CREATE TABLE public.persona_establecimiento (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id         uuid NOT NULL REFERENCES public.directorio_personas(id) ON DELETE CASCADE,
  establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (persona_id, establecimiento_id)
);

ALTER TABLE public.persona_establecimiento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "persona_establecimiento: select" ON public.persona_establecimiento FOR SELECT
  USING (has_establecimiento_read_access(establecimiento_id));

CREATE POLICY "persona_establecimiento: insert" ON public.persona_establecimiento FOR INSERT
  WITH CHECK (has_establecimiento_write_access(establecimiento_id));

CREATE POLICY "persona_establecimiento: delete" ON public.persona_establecimiento FOR DELETE
  USING (has_establecimiento_write_access(establecimiento_id));


-- ============================================================
-- 7. Migrar datos: empleados → directorio_personas (preserva IDs)
-- ============================================================
INSERT INTO public.directorio_personas (
  id, tipo_id, nombre, apellido, dni,
  fecha_ingreso, is_active, created_at, updated_at
)
SELECT
  e.id,
  tp.id,
  e.nombre,
  e.apellido,
  e.dni,
  e.fecha_ingreso,
  e.is_active,
  e.created_at,
  e.updated_at
FROM public.empleados e
CROSS JOIN public.tipo_personas tp
WHERE tp.nombre = 'Empleado';


-- ============================================================
-- 8. Actualizar FK en empleado_puesto: empleado_id → persona_id
-- ============================================================
ALTER TABLE public.empleado_puesto DROP CONSTRAINT IF EXISTS empleado_puesto_empleado_id_fkey;
ALTER TABLE public.empleado_puesto DROP CONSTRAINT IF EXISTS empleado_puesto_empleado_id_puesto_id_key;
ALTER TABLE public.empleado_puesto RENAME COLUMN empleado_id TO persona_id;
ALTER TABLE public.empleado_puesto ADD CONSTRAINT empleado_puesto_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES public.directorio_personas(id) ON DELETE CASCADE;
ALTER TABLE public.empleado_puesto ADD CONSTRAINT empleado_puesto_persona_id_puesto_id_key
  UNIQUE (persona_id, puesto_id);


-- ============================================================
-- 9. Poblar persona_establecimiento desde asignaciones de puesto existentes
-- ============================================================
INSERT INTO public.persona_establecimiento (persona_id, establecimiento_id)
SELECT DISTINCT ep.persona_id, se.establecimiento_id
FROM public.empleado_puesto ep
JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
ON CONFLICT DO NOTHING;


-- ============================================================
-- 10. Actualizar FK en empleado_documentos: empleado_id → persona_id
-- ============================================================

-- Primero eliminamos las políticas RLS que referencian empleado_id
DROP POLICY IF EXISTS "empleado_documentos: select" ON public.empleado_documentos;
DROP POLICY IF EXISTS "empleado_documentos: insert" ON public.empleado_documentos;
DROP POLICY IF EXISTS "empleado_documentos: update" ON public.empleado_documentos;
DROP POLICY IF EXISTS "empleado_documentos: delete" ON public.empleado_documentos;

-- Renombramos la columna
ALTER TABLE public.empleado_documentos DROP CONSTRAINT IF EXISTS empleado_documentos_empleado_id_fkey;
ALTER TABLE public.empleado_documentos RENAME COLUMN empleado_id TO persona_id;
ALTER TABLE public.empleado_documentos ADD CONSTRAINT empleado_documentos_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES public.directorio_personas(id) ON DELETE CASCADE;

-- Recreamos RLS con persona_id
CREATE POLICY "empleado_documentos: select" ON public.empleado_documentos FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.persona_id = empleado_documentos.persona_id
        AND has_establecimiento_read_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_documentos: insert" ON public.empleado_documentos FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.persona_id = empleado_documentos.persona_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_documentos: update" ON public.empleado_documentos FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.persona_id = empleado_documentos.persona_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

CREATE POLICY "empleado_documentos: delete" ON public.empleado_documentos FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.persona_id = empleado_documentos.persona_id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );


-- ============================================================
-- 11. Actualizar FK en capacitacion_asistentes: empleado_id → persona_id
-- ============================================================
ALTER TABLE public.capacitacion_asistentes DROP CONSTRAINT IF EXISTS capacitacion_asistentes_empleado_id_fkey;
ALTER TABLE public.capacitacion_asistentes DROP CONSTRAINT IF EXISTS capacitacion_asistentes_capacitacion_id_empleado_id_key;
ALTER TABLE public.capacitacion_asistentes RENAME COLUMN empleado_id TO persona_id;
ALTER TABLE public.capacitacion_asistentes ADD CONSTRAINT capacitacion_asistentes_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES public.directorio_personas(id) ON DELETE CASCADE;
ALTER TABLE public.capacitacion_asistentes ADD CONSTRAINT capacitacion_asistentes_capacitacion_id_persona_id_key
  UNIQUE (capacitacion_id, persona_id);


-- ============================================================
-- 12. Actualizar FK en siniestros: empleado_id → persona_id
-- ============================================================
ALTER TABLE public.siniestros DROP CONSTRAINT IF EXISTS siniestros_empleado_id_fkey;
ALTER TABLE public.siniestros RENAME COLUMN empleado_id TO persona_id;
ALTER TABLE public.siniestros ADD CONSTRAINT siniestros_persona_id_fkey
  FOREIGN KEY (persona_id) REFERENCES public.directorio_personas(id) ON DELETE SET NULL;


-- ============================================================
-- 13. RLS para directorio_personas
--     Acceso derivado vía persona_establecimiento O vía empleado_puesto → puestos → sectores
-- ============================================================

-- SELECT: developer, o acceso de lectura al establecimiento via cualquiera de las dos cadenas
CREATE POLICY "directorio_personas: select" ON public.directorio_personas FOR SELECT
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.persona_establecimiento pe
      WHERE pe.persona_id = directorio_personas.id
        AND has_establecimiento_read_access(pe.establecimiento_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.persona_id = directorio_personas.id
        AND has_establecimiento_read_access(se.establecimiento_id)
    )
  );

-- INSERT: acceso controlado a nivel de junction; cualquier miembro operativo puede crear personas
CREATE POLICY "directorio_personas: insert" ON public.directorio_personas FOR INSERT
  WITH CHECK (true);

-- UPDATE: mismo criterio que SELECT pero con acceso de escritura
CREATE POLICY "directorio_personas: update" ON public.directorio_personas FOR UPDATE
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.persona_establecimiento pe
      WHERE pe.persona_id = directorio_personas.id
        AND has_establecimiento_write_access(pe.establecimiento_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.persona_id = directorio_personas.id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );

-- DELETE: mismo criterio que UPDATE
CREATE POLICY "directorio_personas: delete" ON public.directorio_personas FOR DELETE
  USING (
    is_developer()
    OR EXISTS (
      SELECT 1 FROM public.persona_establecimiento pe
      WHERE pe.persona_id = directorio_personas.id
        AND has_establecimiento_write_access(pe.establecimiento_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.empleado_puesto ep
      JOIN public.puestos_de_trabajo pt ON pt.id = ep.puesto_id
      JOIN public.sectores_establecimiento se ON se.id = pt.sector_id
      WHERE ep.persona_id = directorio_personas.id
        AND has_establecimiento_write_access(se.establecimiento_id)
    )
  );


-- ============================================================
-- 14. Eliminar tabla empleados (datos ya migrados)
-- ============================================================
DROP POLICY IF EXISTS "empleados: select" ON public.empleados;
DROP POLICY IF EXISTS "empleados: insert" ON public.empleados;
DROP POLICY IF EXISTS "empleados: update" ON public.empleados;
DROP POLICY IF EXISTS "empleados: delete" ON public.empleados;
DROP TABLE public.empleados;
