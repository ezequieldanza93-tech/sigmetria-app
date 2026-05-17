-- 3-level gestiones hierarchy: grupo (C1) → categoria (C2) → gestion (C3)
-- Adds grupo_gestiones table, adds grupo_id FK to categoria_gestiones,
-- cleans up placeholder seeds, and inserts full HSB dataset.
--
-- Typos corrected from source data:
--   "Controles Opertativos" → "Controles Operativos"
--   "Planificaciónes"       → "Planificaciones"
--   "Stackeholders"         → "Stakeholders"
--   "Reuniónes Interna"     → "Reuniones Interna"
--   Double/trailing spaces in Checklist names cleaned.

-- ============================================================
-- Step 1: Remove placeholder seeds from initial migration
-- ============================================================
DELETE FROM public.gestiones
  WHERE nombre IN ('Check', 'Permisos de Trabajo', 'Capacitaciones', 'Reuniones', 'Comité Mixto');

DELETE FROM public.categoria_gestiones
  WHERE nombre IN ('Controles Operativos', 'Formaciones');


-- ============================================================
-- Step 2: grupo_gestiones table (C1 — management oversight)
-- ============================================================
CREATE TABLE public.grupo_gestiones (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     text        NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grupo_gestiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grupo_gestiones: select" ON public.grupo_gestiones
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "grupo_gestiones: insert" ON public.grupo_gestiones
  FOR INSERT TO authenticated WITH CHECK (is_developer());

CREATE POLICY "grupo_gestiones: update" ON public.grupo_gestiones
  FOR UPDATE TO authenticated USING (is_developer());


-- ============================================================
-- Step 3: Add grupo_id FK to categoria_gestiones (nullable first)
-- ============================================================
ALTER TABLE public.categoria_gestiones
  ADD COLUMN grupo_id uuid REFERENCES public.grupo_gestiones(id);


-- ============================================================
-- Step 4: Seed grupos (C1)
-- ============================================================
INSERT INTO public.grupo_gestiones (nombre) VALUES
  ('Auditorías'),
  ('Contexto'),
  ('Controles Operativos'),
  ('Formaciones'),
  ('Inspecciones y Denuncias'),
  ('Matriz de Apoyo'),
  ('Matrices de Riesgos'),
  ('Objetivos'),
  ('Planificaciones'),
  ('Reportes'),
  ('Reuniones')
ON CONFLICT (nombre) DO NOTHING;


-- ============================================================
-- Step 5: Seed categorias (C2) — link each to its grupo
-- ============================================================

-- Auditorías
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT t.nombre, (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Auditorías')
FROM (VALUES
  ('Auditoría de RRLL'),
  ('Auditoría Externa de Certificación'),
  ('Auditoría Externa Periódica'),
  ('Auditoría Interna')
) AS t(nombre)
ON CONFLICT (nombre) DO UPDATE SET grupo_id = EXCLUDED.grupo_id;

-- Contexto
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT t.nombre, (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Contexto')
FROM (VALUES
  ('Feedback Clientes'),
  ('Matrices Contexto')
) AS t(nombre)
ON CONFLICT (nombre) DO UPDATE SET grupo_id = EXCLUDED.grupo_id;

-- Controles Operativos
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT t.nombre, (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Controles Operativos')
FROM (VALUES
  ('Checklists'),
  ('Formularios'),
  ('Mediciones y Cálculos'),
  ('Permisos de Trabajo')
) AS t(nombre)
ON CONFLICT (nombre) DO UPDATE SET grupo_id = EXCLUDED.grupo_id;

-- Formaciones
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT t.nombre, (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Formaciones')
FROM (VALUES
  ('Campañas de Salud'),
  ('Capacitaciones'),
  ('Entrenamientos'),
  ('Inducciones'),
  ('Simulacros')
) AS t(nombre)
ON CONFLICT (nombre) DO UPDATE SET grupo_id = EXCLUDED.grupo_id;

-- Inspecciones y Denuncias
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT t.nombre, (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Inspecciones y Denuncias')
FROM (VALUES
  ('Denuncias'),
  ('Inspecciones')
) AS t(nombre)
ON CONFLICT (nombre) DO UPDATE SET grupo_id = EXCLUDED.grupo_id;

-- Matriz de Apoyo
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT t.nombre, (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Matriz de Apoyo')
FROM (VALUES
  ('Matrices de Comunicación')
) AS t(nombre)
ON CONFLICT (nombre) DO UPDATE SET grupo_id = EXCLUDED.grupo_id;

-- Matrices de Riesgos
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT t.nombre, (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Matrices de Riesgos')
FROM (VALUES
  ('Matrices de Stakeholders'),
  ('Matrices IPERC')
) AS t(nombre)
ON CONFLICT (nombre) DO UPDATE SET grupo_id = EXCLUDED.grupo_id;

-- Objetivos
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT t.nombre, (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Objetivos')
FROM (VALUES
  ('Objetivos y Stakeholders')
) AS t(nombre)
ON CONFLICT (nombre) DO UPDATE SET grupo_id = EXCLUDED.grupo_id;

-- Planificaciones
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT t.nombre, (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Planificaciones')
FROM (VALUES
  ('Planes'),
  ('Programas')
) AS t(nombre)
ON CONFLICT (nombre) DO UPDATE SET grupo_id = EXCLUDED.grupo_id;

-- Reportes
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT t.nombre, (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Reportes')
FROM (VALUES
  ('Reportes Semanales Acciones Inmediatas'),
  ('Reportes Semanales Oportunidades de Mejora')
) AS t(nombre)
ON CONFLICT (nombre) DO UPDATE SET grupo_id = EXCLUDED.grupo_id;

-- Reuniones (pre-existed from initial seed — just adds grupo_id)
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT t.nombre, (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Reuniones')
FROM (VALUES
  ('Reuniones')
) AS t(nombre)
ON CONFLICT (nombre) DO UPDATE SET grupo_id = EXCLUDED.grupo_id;


-- ============================================================
-- Step 6: Enforce grupo_id NOT NULL (all rows now have a value)
-- ============================================================
ALTER TABLE public.categoria_gestiones
  ALTER COLUMN grupo_id SET NOT NULL;


-- ============================================================
-- Step 7: Seed gestiones (C3)
-- ============================================================

-- Auditoría de RRLL
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Auditoría de RRLL')
FROM (VALUES
  ('Auditoría de RRLL'),
  ('Auditoría de RRLL No Cumple'),
  ('Auditoría de RRLL Cumple'),
  ('Auditoría de RRLL No Aplica')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Auditoría Externa de Certificación
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Auditoría Externa de Certificación')
FROM (VALUES
  ('Auditoría Externa de Certificación NC'),
  ('Auditoría Externa de Certificación OM')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Auditoría Externa Periódica
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Auditoría Externa Periódica')
FROM (VALUES
  ('Auditoría Externa Periódica NC'),
  ('Auditoría Externa Periódica OM')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Auditoría Interna
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Auditoría Interna')
FROM (VALUES
  ('Auditoría Interna NC'),
  ('Auditoría Interna OM')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Feedback Clientes
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Feedback Clientes')
FROM (VALUES
  ('Feedback Positivo Cliente'),
  ('Feedback Negativo Cliente')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Matrices Contexto
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Matrices Contexto')
FROM (VALUES
  ('Matriz Análisis de Contexto y Stakeholders')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Checklists (66)
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Checklists')
FROM (VALUES
  ('Checklist Equipo de Trabajo en Altura'),
  ('Checklist Inicio de Obra'),
  ('Checklist Maquinaria de Hormigón'),
  ('Checklist Instalaciones Temporales General'),
  ('Checklist Estandares del Sitio'),
  ('Checklist Maquinaria Vial'),
  ('Checklist Puesta en Marcha de la Obra'),
  ('Checklist Equipamiento de Izajes'),
  ('Checklist Aparatos Sometidos a Presión'),
  ('Checklist Infraestructura de Apoyo'),
  ('Checklist Maquinas Manuales'),
  ('Checklist MV - Retroexcavadora'),
  ('Checklist IT - Tablero Eléctrico'),
  ('Checklist IT - Generador Eléctrico'),
  ('Checklist ES - Elementos de Seguridad'),
  ('Checklist ES - Señalética de Obra'),
  ('Checklist ES - Clasificación de Residuos'),
  ('Checklist IA - Servicios Sanitarios'),
  ('Checklist IA - Vestuarios'),
  ('Checklist IA - Comedor'),
  ('Checklist IA - Pañol'),
  ('Checklist IA - Oficina Jefatura'),
  ('Checklist IA - Bienestar Sereno'),
  ('Checklist IA - Control de Acceso y Vigilancia'),
  ('Checklist IA - Depósito de Productos Inflamables/ Explosivos'),
  ('Checklist IA - Depósito de Aparatos Sometidos a Presión'),
  ('Checklist MS - Demolición'),
  ('Checklist MS - Limpieza de Terreno'),
  ('Checklist MS - Excavación'),
  ('Checklist MS - Submuración'),
  ('Checklist MV - Camión Volcador'),
  ('Checklist MV - Excavadora'),
  ('Checklist MV - Cargadora Frontal'),
  ('Checklist MV - Motoniveladora'),
  ('Checklist MV - Rodillo Compactador'),
  ('Checklist MS - Llenado de Platéa'),
  ('Checklist MH - Hormigonera'),
  ('Checklist MH - Camión Mixer Hormigón'),
  ('Checklist MH - Bomba de Hormigón'),
  ('Checklist MH - Pluma Brazo Distribuidor Hormigón'),
  ('Checklist MH - Cortadora de Hierro'),
  ('Checklist MH - Dobladora de Hierro'),
  ('Checklist MH - Vibrador Eléctrico'),
  ('Checklist MM - Martillo Eléctrico Demoledor'),
  ('Checklist MM - Sierra Circular'),
  ('Checklist MM - Amoladora de Banco'),
  ('Checklist MM - Sierra Sensitiva'),
  ('Checklist MM - Soldadora Eléctrica'),
  ('Checklist MM - Amoladora Portátil'),
  ('Checklist MM - Taladro/ Rotopercutor'),
  ('Checklist EI - Elementos de Izaje'),
  ('Checklist ASP - Compresor'),
  ('Checklist EI - Grúa Torre'),
  ('Checklist EI - Grúa Móvil'),
  ('Checklist EI - Hidrogrúa'),
  ('Checklist EI - Malacate manual'),
  ('Checklist EI - Motor Guinche'),
  ('Checklist ASP - Cilindros a Presión'),
  ('Checklist ETA - Silleta'),
  ('Checklist ETA - Sistema de Arresto de Caídas Personales'),
  ('Checklist ETA - Trabajos en Poste'),
  ('Checklist ETA - PEMP (Plataformas Elevadoras Móviles de Personas)'),
  ('Checklist ETA - Andamios Colgantes'),
  ('Checklist ETA - Andamios Fijos/Móviles'),
  ('Checklist ES - Extintores'),
  ('Checklist IA - Extintores')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Formularios
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Formularios')
FROM (VALUES
  ('Formulario Preconstrucción'),
  ('Formulario 300A OSHAS (Resumen Anual)'),
  ('Formulario 300 OSHAS (Registro)')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Mediciones y Cálculos
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Mediciones y Cálculos')
FROM (VALUES
  ('Protocolo PAT'),
  ('Memoria de Cálculo Estructuras Temporales'),
  ('Memoria de Cálculo Plataformas Temporales'),
  ('Memoria de Cálculo Elementos de Izaje'),
  ('Memoria de Cálculo Puntos de Anclaje'),
  ('Análisis Bactereológico del Agua'),
  ('Análisis Fisicoquímico del Agua'),
  ('Protocolo de Ergonomía'),
  ('Protocolo de Iluminación'),
  ('Protocolo de Ruido'),
  ('Protocolo de Carga Térmica'),
  ('Certificación de Anclajes')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Permisos de Trabajo
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Permisos de Trabajo')
FROM (VALUES
  ('Permiso de Trabajo Seguro - Excavación')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Campañas de Salud
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Campañas de Salud')
FROM (VALUES
  ('Campaña de HIV Sida y otras Enfermedades de Transmisión Sexual'),
  ('Campaña de Drogas de Abuso'),
  ('Campaña de Vida Saludable'),
  ('Campaña de Primeros Auxilios y RCP'),
  ('Campaña de Prevención Cardiovascular'),
  ('Campaña de Efectos del Tabaco a la Salud')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Capacitaciones (31)
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Capacitaciones')
FROM (VALUES
  ('Capacitación: Matriz IPERC'),
  ('Capacitación: Riesgos Generales y Uso de EPP'),
  ('Capacitación: Clases de Fuego y Uso de Extintores'),
  ('Capacitación: Brigada de Emergencias'),
  ('Capacitación: Manipulación de Sustancias Químicas'),
  ('Capacitación: Trabajo en Altura'),
  ('Capacitación: Uso Seguro de Máquinas y Herramientas'),
  ('Capacitación: Izajes Seguros'),
  ('Capacitación: Trabajo Seguro en Andamios'),
  ('Capacitación: Trabajo Seguro en Silletas'),
  ('Capacitación: Trabajo Seguro en Balancines'),
  ('Capacitación: Trabajo Seguro en PEMP'),
  ('Capacitación: Control de Ruido - Polvo - Vibraciones'),
  ('Capacitación: Sistema de Gestión de HS&B ISO 45001:2018'),
  ('Capacitación: Procedimientos de Emergencia'),
  ('Capacitación: Primeros Auxilios y RCP'),
  ('Capacitación: Riesgo Eléctrico'),
  ('Capacitación: Trabajo Seguro en Caliente'),
  ('Capacitación: Trabajo Seguro en Espacios Confinados'),
  ('Capacitación: Trabajos de Demolición'),
  ('Capacitación: Trabajo en Excavaciones y Zanjas'),
  ('Capacitación: Orden y Limpieza - Metodología 5S'),
  ('Capacitación: Ergonomía y Manipulación Manual de Cargas'),
  ('Capacitación: Trabajo Seguro con Autoelevadores'),
  ('Capacitación: Trabajo Seguro con Maquinaria Pesada'),
  ('Capacitación: Seguridad Vial'),
  ('Capacitación: Elección de Guantes y Protección de Manos'),
  ('Capacitación: Trabajo Seguro con Oxicorte'),
  ('Capacitación: Trabajo Seguro de Herrería'),
  ('Capacitación: Gestión de HS&B - Norma ISO 45001:2018'),
  ('Capacitación: Otras')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Entrenamientos
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Entrenamientos')
FROM (VALUES
  ('Entrenamiento: Uso de Extintores')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Inducciones
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Inducciones')
FROM (VALUES
  ('Inducción de Higiene Seguridad & Bienestar')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Simulacros
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Simulacros')
FROM (VALUES
  ('Informe Simulacro'),
  ('Video Simulacro'),
  ('Simulacro: Emergencias'),
  ('Simulacro: Rescate en Altura')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Inspecciones
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Inspecciones')
FROM (VALUES
  ('Inspección de Organismo de Control sin Sanción'),
  ('Inspección de Organismo de Control con Sanción')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Denuncias
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Denuncias')
FROM (VALUES
  ('Denuncia Organismos')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Matrices de Comunicación
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Matrices de Comunicación')
FROM (VALUES
  ('Matriz de Comunicación Amarilla 2025')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Matrices de Stakeholders
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Matrices de Stakeholders')
FROM (VALUES
  ('Matriz Comparativa de Proveedores')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Matrices IPERC
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Matrices IPERC')
FROM (VALUES
  ('Registros Matrices IPERC')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Objetivos y Stakeholders
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Objetivos y Stakeholders')
FROM (VALUES
  ('Tablero de Objetivos'),
  ('Incidente'),
  ('Accidente Laboral Moderado'),
  ('Iniciativa Vecinos'),
  ('Actividad Comunitaria'),
  ('Accidente Laboral Leve'),
  ('Accidente Laboral Grave'),
  ('Residuos Reciclables Recuperados'),
  ('Cantidad de Integrantes Activos'),
  ('Solicitud Vecino/ Stakeholders'),
  ('Horas Trabajadas'),
  ('Horas ART'),
  ('Horas Certificado Médico'),
  ('Trabajadores Cubiertos'),
  ('Accidente Initinere'),
  ('Incidente Laboral')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Planes
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Planes')
FROM (VALUES
  ('Plan de Emergencias'),
  ('Plan de Campañas de Salud')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Programas
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Programas')
FROM (VALUES
  ('Programa - Capacitación y Entrenamiento de Respuesta Ante Emergencia'),
  ('Programa - Formaciones de HSB'),
  ('Programa - Auditorías'),
  ('Programa - Reuniones de Comité Mixto'),
  ('Programa - Reuniones Interna Equipo H,S&B'),
  ('Programa - Reuniones de Seguimiento de Hallazgos H,S&B')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Reportes Semanales Acciones Inmediatas
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Reportes Semanales Acciones Inmediatas')
FROM (VALUES
  ('Reporte de Acciones Inmediatas'),
  ('Reportes de Acción Inmediata Críticas'),
  ('Reportes de Acción Inmediata Altas'),
  ('Reportes de Acción Inmediata Medias')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Reportes Semanales Oportunidades de Mejora
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Reportes Semanales Oportunidades de Mejora')
FROM (VALUES
  ('Reporte de Oportunidades de Mejora')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;

-- Reuniones
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Reuniones')
FROM (VALUES
  ('Salidas Revisión por la Dirección'),
  ('Reunión del Comité Mixto de HS&B'),
  ('Presentación de Revisión Por la Dirección'),
  ('Agenda Revisión por la Dirección'),
  ('Reunión Interna Equipo H,S&B'),
  ('Reunión Seguimiento de Hallazgos H,S&B')
) AS t(nombre)
ON CONFLICT (nombre) DO NOTHING;
