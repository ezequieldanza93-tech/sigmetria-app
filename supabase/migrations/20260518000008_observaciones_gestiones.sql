-- ============================================================
-- Migration: clasificacion_observaciones + alter observaciones_gestiones
--
-- clasificacion_observaciones: catálogo de tipos de riesgo que
--   puede generar una observación (Eléctrico, Locativo, etc.)
--
-- observaciones_gestiones: ya existía en migration 010 pero le
--   faltaban clasificacion_id y responsable_id
-- ============================================================


-- ── 1. Catálogo de clasificaciones ──────────────────────────────────────────

CREATE TABLE public.clasificacion_observaciones (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      text        NOT NULL UNIQUE,
  descripcion text,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clasificacion_observaciones ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden leer
CREATE POLICY "clasificacion_observaciones: select"
  ON public.clasificacion_observaciones
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Solo developers pueden insertar / actualizar
CREATE POLICY "clasificacion_observaciones: insert"
  ON public.clasificacion_observaciones
  FOR INSERT TO authenticated
  WITH CHECK (is_developer());

CREATE POLICY "clasificacion_observaciones: update"
  ON public.clasificacion_observaciones
  FOR UPDATE TO authenticated
  USING (is_developer());

-- Índice de búsqueda por nombre
CREATE INDEX clasificacion_observaciones_nombre_idx
  ON public.clasificacion_observaciones (nombre);

-- Seed inicial — tipos de riesgo habituales en H&S
INSERT INTO public.clasificacion_observaciones (nombre, descripcion) VALUES
  ('Riesgo Eléctrico',       'Instalaciones, equipos o prácticas que pueden provocar electrocución o incendio'),
  ('Riesgo Locativo',        'Estado de las instalaciones, pisos, techos, accesos o estructuras'),
  ('Orden y Limpieza',       'Desorden, acumulación de materiales o falta de higiene en el área'),
  ('Riesgo Mecánico',        'Partes móviles, herramientas o equipos sin protección'),
  ('Riesgo Ergonómico',      'Posturas forzadas, levantamiento manual de cargas o movimientos repetitivos'),
  ('Riesgo Físico',          'Ruido, iluminación deficiente, temperatura extrema o radiaciones'),
  ('Riesgo Químico',         'Exposición a sustancias peligrosas, inflamables o tóxicas'),
  ('Riesgo Biológico',       'Exposición a agentes biológicos, vectores o residuos patogénicos'),
  ('Uso de EPP',             'Falta o uso inadecuado de elementos de protección personal'),
  ('Trabajos en Altura',     'Actividades a más de 2 m sin protección colectiva o individual adecuada'),
  ('Incendio / Emergencia',  'Extintores, salidas de emergencia, señalización o planes de evacuación'),
  ('Acto Inseguro',          'Comportamiento del trabajador que genera o incrementa el riesgo'),
  ('Condición Insegura',     'Estado del entorno físico que genera riesgo independientemente del trabajador'),
  ('Medio Ambiente',         'Impacto ambiental, residuos, efluentes o emisiones'),
  ('Documentación',          'Registros faltantes, vencidos o incorrectamente completados');


-- ── 2. Columnas adicionales en observaciones_gestiones ──────────────────────
--
--   clasificacion_id  → tipo de riesgo que genera la observación
--   responsable_id    → persona responsable de subsanar
--   (la tabla ya tiene responsable_cierre_id para quien aprueba el cierre)

ALTER TABLE public.observaciones_gestiones
  ADD COLUMN IF NOT EXISTS clasificacion_id uuid
    REFERENCES public.clasificacion_observaciones(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsable_id uuid
    REFERENCES public.directorio_personas(id) ON DELETE SET NULL;

-- Índices de búsqueda frecuente
CREATE INDEX IF NOT EXISTS obs_gest_clasificacion_idx
  ON public.observaciones_gestiones (clasificacion_id);

CREATE INDEX IF NOT EXISTS obs_gest_responsable_idx
  ON public.observaciones_gestiones (responsable_id);

CREATE INDEX IF NOT EXISTS obs_gest_registro_idx
  ON public.observaciones_gestiones (registro_gestion_id);
