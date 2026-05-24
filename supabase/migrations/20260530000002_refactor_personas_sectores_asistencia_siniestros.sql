-- ============================================================
-- Sigmetría HyS — Refactor integral: Personas, Sectores,
-- Asistencia, Siniestros, Inspecciones, Denuncias
--
-- FASE 2: Separación de entidades + trazabilidad
-- FASE 3: Prevención de duplicados (constraints + índices)
-- FASE 4: Relaciones laborales (fechas alta/baja)
-- FASE 5: Datos adicionales de persona
-- FASE 6: Múltiples archivos por documento
-- FASE 7: Matrícula como documento
-- FASE 8: Sectores con puestos/procesos/trabajadores automáticos
-- FASE 10: tipos_horas + timezone Argentina
-- FASE 11: Siniestros — flujo con días perdidos automáticos
-- FASE 12: Inspecciones — observaciones, entes, estados
-- ============================================================


-- ============================================================
-- FASE 2: Trazabilidad — quién creó cada persona
-- ============================================================
ALTER TABLE public.personas_directorio
  ADD COLUMN IF NOT EXISTS created_in_consultora_id uuid
    REFERENCES public.consultoras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_personas_directorio_consultora
  ON public.personas_directorio (created_in_consultora_id);


-- ============================================================
-- FASE 3: Prevención de duplicados
-- ============================================================

-- Personas: índice único para duplicados exactos (nombre + apellido + dni)
-- Solo aplica cuando DNI no es null
CREATE UNIQUE INDEX IF NOT EXISTS idx_personas_duplicado_exacto
  ON public.personas_directorio (nombre, apellido, dni)
  WHERE dni IS NOT NULL AND is_active = true;

-- Organizaciones externas: único por CUIT cuando existe
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_ext_cuit_unique
  ON public.organizaciones_externas (cuit)
  WHERE cuit IS NOT NULL AND is_active = true;

-- Índice para búsqueda por razón social (organizaciones_externas no tiene razón social,
-- usamos nombre como equivalente)
CREATE INDEX IF NOT EXISTS idx_org_ext_nombre_trgm
  ON public.organizaciones_externas USING gin (nombre gin_trgm_ops);

-- Asegurar extensión pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


-- ============================================================
-- FASE 4: Relaciones laborales — fechas alta/baja en puestos_personas
-- ============================================================
ALTER TABLE public.puestos_personas
  ADD COLUMN IF NOT EXISTS fecha_alta date,
  ADD COLUMN IF NOT EXISTS fecha_baja date,
  ADD COLUMN IF NOT EXISTS motivo_baja text,
  ADD COLUMN IF NOT EXISTS tipo_relacion text
    CHECK (tipo_relacion IN ('permanente', 'temporal', 'contratista', 'pasante'));

-- Actualizar fecha_alta con el valor existente de fecha_desde
UPDATE public.puestos_personas
  SET fecha_alta = fecha_desde
  WHERE fecha_alta IS NULL AND fecha_desde IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_puestos_personas_fecha_baja
  ON public.puestos_personas (fecha_baja)
  WHERE fecha_baja IS NULL;


-- ============================================================
-- FASE 5: Datos adicionales de persona
-- ============================================================
ALTER TABLE public.personas_directorio
  ADD COLUMN IF NOT EXISTS direccion text,
  ADD COLUMN IF NOT EXISTS talle_calzado text,
  ADD COLUMN IF NOT EXISTS talle_pantalon text,
  ADD COLUMN IF NOT EXISTS talle_remera text,
  ADD COLUMN IF NOT EXISTS talle_camisa text,
  ADD COLUMN IF NOT EXISTS talle_buzo text,
  ADD COLUMN IF NOT EXISTS talle_campera text,
  ADD COLUMN IF NOT EXISTS beneficiario_seguro text,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre text,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono text;


-- ============================================================
-- FASE 6: Múltiples archivos por documento (hasta 5)
-- ============================================================
ALTER TABLE public.personas_documentos
  ADD COLUMN IF NOT EXISTS archivo_urls text[] DEFAULT '{}';

-- Migrar archivo_url existente al nuevo array
UPDATE public.personas_documentos
  SET archivo_urls = ARRAY[archivo_url]
  WHERE archivo_url IS NOT NULL AND COALESCE(array_length(archivo_urls, 1), 0) = 0;


-- ============================================================
-- FASE 7: Agregar tipo_documento para matrícula profesional
-- y eliminar ATS/Permisos como documentos de persona
-- ============================================================

-- Marcar ATS y Permiso Trabajo Seguro como no aplicables a personas
-- (se manejan como gestiones)
INSERT INTO public.documento_tipos_reglas (documento_tipo_id, nivel, entidad_tipo)
SELECT dt.id, 'establecimiento', 'gestion'
FROM public.documentos_tipos dt
WHERE dt.nombre IN ('ATS', 'Permiso de Trabajo Seguro')
  AND NOT EXISTS (
    SELECT 1 FROM public.documento_tipos_reglas dtr
    WHERE dtr.documento_tipo_id = dt.id AND dtr.entidad_tipo = 'gestion'
  );

-- Si existe la columna nivel, actualizar ATS y PTS para no aparecer como documentos de persona
UPDATE public.documentos_tipos dt
SET nivel = 'establecimiento'
WHERE dt.nombre IN ('ATS', 'Permiso de Trabajo Seguro')
  AND dt.nivel = 'persona';


-- ============================================================
-- FASE 8: Sectores — vista materializada de trabajadores activos
-- ============================================================

-- Función para calcular trabajadores activos de un sector
CREATE OR REPLACE FUNCTION public.contar_trabajadores_activos_sector(p_sector_id uuid)
RETURNS int
LANGUAGE sql STABLE
AS $$
  SELECT COUNT(DISTINCT pp.persona_id)::int
  FROM public.puestos_personas pp
  JOIN public.puestos_de_trabajo pt ON pt.id = pp.puesto_id
  WHERE pt.sector_id = p_sector_id
    AND pp.fecha_baja IS NULL;
$$;

-- Actualizar cantidad_trabajadores en sectores basado en puestos_personas activas
-- Trigger function para mantener sincronizado
CREATE OR REPLACE FUNCTION public.sync_sector_trabajadores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sector_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT sector_id INTO v_sector_id FROM public.puestos_de_trabajo WHERE id = OLD.puesto_id;
  ELSE
    SELECT sector_id INTO v_sector_id FROM public.puestos_de_trabajo WHERE id = NEW.puesto_id;
  END IF;

  IF v_sector_id IS NOT NULL THEN
    UPDATE public.establecimientos_sectores
    SET cantidad_trabajadores = public.contar_trabajadores_activos_sector(v_sector_id)
    WHERE id = v_sector_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Trigger en puestos_personas: sync sector count
DROP TRIGGER IF EXISTS trg_sync_sector_trabajadores ON public.puestos_personas;
CREATE TRIGGER trg_sync_sector_trabajadores
  AFTER INSERT OR UPDATE OR DELETE ON public.puestos_personas
  FOR EACH ROW EXECUTE FUNCTION public.sync_sector_trabajadores();

-- Inicializar counts existentes
UPDATE public.establecimientos_sectores es
SET cantidad_trabajadores = (
  SELECT COUNT(DISTINCT pp.persona_id)::int
  FROM public.puestos_personas pp
  JOIN public.puestos_de_trabajo pt ON pt.id = pp.puesto_id
  WHERE pt.sector_id = es.id
    AND pp.fecha_baja IS NULL
);


-- ============================================================
-- FASE 10: tipos_horas + timezone Argentina
-- ============================================================

-- Tabla Librería: tipos de horas para asistencia
CREATE TABLE IF NOT EXISTS public.tipos_horas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL UNIQUE,
  descripcion text,
  color      text DEFAULT '#6366f1',
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_horas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tipos_horas: select" ON public.tipos_horas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "tipos_horas: insert" ON public.tipos_horas
  FOR INSERT TO authenticated WITH CHECK (is_developer());

CREATE POLICY "tipos_horas: update" ON public.tipos_horas
  FOR UPDATE TO authenticated USING (is_developer());

CREATE POLICY "tipos_horas: delete" ON public.tipos_horas
  FOR DELETE TO authenticated USING (is_developer());

-- Seed data
INSERT INTO public.tipos_horas (nombre, descripcion, color) VALUES
  ('Horas Normales', 'Jornada laboral estándar', '#22c55e'),
  ('Horas ART', 'Horas por atención ART', '#ef4444'),
  ('Vacaciones', 'Período de vacaciones', '#3b82f6'),
  ('Feriados', 'Día feriado', '#f59e0b'),
  ('Horas por Lluvia', 'Suspensión por lluvia', '#06b6d4'),
  ('Licencia Médica No Laboral', 'Licencia por enfermedad sin relación laboral', '#a855f7'),
  ('Licencia por Examen', 'Horas destinadas a rendir examen', '#ec4899'),
  ('Licencia por Maternidad', 'Licencia por maternidad/paternidad', '#8b5cf6'),
  ('Capacitación', 'Horas destinadas a capacitación interna o externa', '#14b8a6')
ON CONFLICT (nombre) DO NOTHING;

-- Agregar tipo_hora_id a asistencia_diaria
ALTER TABLE public.asistencia_diaria
  ADD COLUMN IF NOT EXISTS tipo_hora_id uuid
    REFERENCES public.tipos_horas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_asistencia_tipo_hora
  ON public.asistencia_diaria (tipo_hora_id);

-- Timezone: asegurar que todas las tablas usan timestamptz (ya lo hacen)
-- La app debe enviar en UTC, y convertir a -03:00 en display
-- Comentario: tabla asistencia_diaria ya usa timestamptz para hora_entrada/hora_salida

-- Agregar columna timezone al establecimiento para referencia
ALTER TABLE public.establecimientos
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'America/Argentina/Buenos_Aires';


-- ============================================================
-- FASE 11: Siniestros — días perdidos automáticos + arquitetura
-- ============================================================

-- Agregar columnas para cálculo automático de días perdidos
ALTER TABLE public.siniestros
  ADD COLUMN IF NOT EXISTS hora_ocurrencia time,
  ADD COLUMN IF NOT EXISTS tipo_persona text
    CHECK (tipo_persona IN ('trabajador_interno', 'trabajador_externo'))
    DEFAULT 'trabajador_interno',
  ADD COLUMN IF NOT EXISTS fecha_baja_medica date,
  ADD COLUMN IF NOT EXISTS fecha_alta_medica date,
  ADD COLUMN IF NOT EXISTS dias_perdidos_calculados int GENERATED ALWAYS AS (
    CASE
      WHEN fecha_baja_medica IS NOT NULL AND fecha_alta_medica IS NOT NULL
        THEN (fecha_alta_medica - fecha_baja_medica)
      ELSE NULL
    END
  ) STORED,
  ADD COLUMN IF NOT EXISTS tiene_denuncia_adjunta boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiene_evolucion_medica boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ente_investigador text,
  ADD COLUMN IF NOT EXISTS fecha_investigacion date,
  ADD COLUMN IF NOT EXISTS causa_inmediata text,
  ADD COLUMN IF NOT EXISTS causa_basica text;

-- Nota: dias_perdidos manual se mantiene por ahora como editable,
-- pero la columna calculada da la referencia automática


-- ============================================================
-- FASE 12: Inspecciones — observaciones, entes reguladores, estados
-- ============================================================

-- Tabla de entes reguladores (librería)
CREATE TABLE IF NOT EXISTS public.entes_reguladores (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text NOT NULL UNIQUE,
  abreviatura text,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.entes_reguladores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "entes_reguladores: select" ON public.entes_reguladores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "entes_reguladores: insert" ON public.entes_reguladores
  FOR INSERT TO authenticated WITH CHECK (is_developer());

CREATE POLICY "entes_reguladores: update" ON public.entes_reguladores
  FOR UPDATE TO authenticated USING (is_developer());

CREATE POLICY "entes_reguladores: delete" ON public.entes_reguladores
  FOR DELETE TO authenticated USING (is_developer());

-- Seed
INSERT INTO public.entes_reguladores (nombre, abreviatura) VALUES
  ('Ministerio de Trabajo', 'MT'),
  ('Superintendencia de Riesgos del Trabajo', 'SRT'),
  ('Gobierno de la Ciudad de Buenos Aires', 'GCBA'),
  ('Municipalidad', 'Muni'),
  ('Instituto de Estadística y Registro de la Industria de la Construcción', 'IERIC'),
  ('Unión Obrajera de la República Argentina', 'UOCRA'),
  ('Administración Federal de Ingresos Públicos', 'AFIP'),
  ('Secretaría de Ambiente', 'SA'),
  ('RENATEA', 'RENATEA')
ON CONFLICT (nombre) DO NOTHING;

-- Agregar columnas a inspecciones
ALTER TABLE public.inspecciones
  ADD COLUMN IF NOT EXISTS ente_regulador_id uuid
    REFERENCES public.entes_reguladores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ente_especificar text,
  ADD COLUMN IF NOT EXISTS adjuntos_urls text[] DEFAULT '{}';

-- Tabla de observaciones de inspección
CREATE TABLE IF NOT EXISTS public.inspecciones_observaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspeccion_id   uuid NOT NULL REFERENCES public.inspecciones(id) ON DELETE CASCADE,
  descripcion     text NOT NULL,
  resuelta        boolean NOT NULL DEFAULT false,
  fecha_resolucion timestamptz,
  resuelto_por    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inspecciones_observaciones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inspecciones_observaciones: select" ON public.inspecciones_observaciones
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inspecciones i
      JOIN public.establecimientos e ON e.id = i.establecimiento_id
      WHERE i.id = inspeccion_id
        AND has_establecimiento_read_access(e.id)
    )
  );

CREATE POLICY "inspecciones_observaciones: insert" ON public.inspecciones_observaciones
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.inspecciones i
      JOIN public.establecimientos e ON e.id = i.establecimiento_id
      WHERE i.id = inspeccion_id
        AND has_establecimiento_write_access(e.id)
    )
  );

CREATE POLICY "inspecciones_observaciones: update" ON public.inspecciones_observaciones
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inspecciones i
      JOIN public.establecimientos e ON e.id = i.establecimiento_id
      WHERE i.id = inspeccion_id
        AND has_establecimiento_write_access(e.id)
    )
  );

CREATE POLICY "inspecciones_observaciones: delete" ON public.inspecciones_observaciones
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.inspecciones i
      JOIN public.establecimientos e ON e.id = i.establecimiento_id
      WHERE i.id = inspeccion_id
        AND has_establecimiento_write_access(e.id)
    )
  );

-- Función para determinar estado visual de inspección basado en observaciones
CREATE OR REPLACE FUNCTION public.inspeccion_estado_visual(p_inspeccion_id uuid)
RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT
    CASE
      WHEN COUNT(*) FILTER (WHERE resuelta = false) = 0 THEN 'verde'
      WHEN COUNT(*) FILTER (WHERE resuelta = true) > 0
           AND COUNT(*) FILTER (WHERE resuelta = false) > 0 THEN 'amarillo'
      ELSE 'rojo'
    END
  FROM public.inspecciones_observaciones
  WHERE inspeccion_id = p_inspeccion_id;
$$;


-- ============================================================
-- FASE 13: Denuncias y Feedback — adjuntos + inline directory
-- ============================================================

-- Agregar adjuntos a denuncias
ALTER TABLE public.denuncias
  ADD COLUMN IF NOT EXISTS adjuntos_urls text[] DEFAULT '{}';

-- Feedback: agregar persona_id desde directorio
ALTER TABLE public.establecimientos_feedback_clientes
  ADD COLUMN IF NOT EXISTS persona_id uuid
    REFERENCES public.personas_directorio(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS adjuntos_urls text[] DEFAULT '{}';
