-- ============================================================
-- Limpieza del catálogo de gestiones
--
-- 1. Eliminar Inspecciones del catálogo (van al tab dedicado)
-- 2. Eliminar gestiones de accidentes/incidentes (van a Siniestros)
-- 3. Auditorías: quitar variantes NC/OM/Cumple — dejar una por categoría
-- 4. Reportes: reemplazar dos categorías por "Reportes Fotográficos del Sitio"
--
-- La cadena de CASCADE DELETE es:
--   gestiones → gestion_establecimiento → registro_gestiones → observaciones_gestiones
-- ============================================================


-- ── 1. Inspecciones — eliminar categoría y sus gestiones ────
-- Las inspecciones de organismos viven en el tab Inspecciones (tabla `inspecciones`).

DELETE FROM public.gestiones
  WHERE nombre IN (
    'Inspección de Organismo de Control sin Sanción',
    'Inspección de Organismo de Control con Sanción'
  );

DELETE FROM public.categoria_gestiones WHERE nombre = 'Inspecciones';

-- El grupo "Inspecciones y Denuncias" queda solo con "Denuncias"; lo renombramos.
UPDATE public.grupo_gestiones
  SET nombre = 'Denuncias'
  WHERE nombre = 'Inspecciones y Denuncias';


-- ── 2. Accidentes e incidentes — sacar de Objetivos y Stakeholders ──
-- Estos eventos pertenecen al tab Siniestros (tabla `siniestros`).

DELETE FROM public.gestiones
  WHERE nombre IN (
    'Incidente',
    'Incidente Laboral',
    'Accidente Laboral Leve',
    'Accidente Laboral Moderado',
    'Accidente Laboral Grave',
    'Accidente Initinere'
  );


-- ── 3. Auditorías — quitar variantes NC/OM/Cumple/No Aplica ─────────
-- Eliminar todas las variantes sufijadas.

DELETE FROM public.gestiones
  WHERE nombre IN (
    'Auditoría de RRLL No Cumple',
    'Auditoría de RRLL Cumple',
    'Auditoría de RRLL No Aplica',
    'Auditoría Externa de Certificación NC',
    'Auditoría Externa de Certificación OM',
    'Auditoría Externa Periódica NC',
    'Auditoría Externa Periódica OM',
    'Auditoría Interna NC',
    'Auditoría Interna OM'
  );

-- Las categorías que perdieron sus únicos registros necesitan al menos uno (nombre limpio).
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT t.nombre, (SELECT id FROM public.categoria_gestiones WHERE nombre = t.cat)
FROM (VALUES
  ('Auditoría Externa de Certificación', 'Auditoría Externa de Certificación'),
  ('Auditoría Externa Periódica',        'Auditoría Externa Periódica'),
  ('Auditoría Interna',                  'Auditoría Interna')
) AS t(nombre, cat)
ON CONFLICT (nombre) DO NOTHING;
-- "Auditoría de RRLL" ya existe con nombre limpio → no se toca.


-- ── 4. Reportes — reemplazar por "Reportes Fotográficos del Sitio" ──

-- Eliminar gestiones de las dos categorías viejas.
DELETE FROM public.gestiones
  WHERE nombre IN (
    'Reporte de Acciones Inmediatas',
    'Reportes de Acción Inmediata Críticas',
    'Reportes de Acción Inmediata Altas',
    'Reportes de Acción Inmediata Medias',
    'Reporte de Oportunidades de Mejora'
  );

-- Eliminar las dos categorías viejas.
DELETE FROM public.categoria_gestiones
  WHERE nombre IN (
    'Reportes Semanales Acciones Inmediatas',
    'Reportes Semanales Oportunidades de Mejora'
  );

-- Crear nueva categoría y gestión.
INSERT INTO public.categoria_gestiones (nombre, grupo_id)
SELECT 'Reportes Fotográficos del Sitio',
       (SELECT id FROM public.grupo_gestiones WHERE nombre = 'Reportes')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO public.gestiones (nombre, categoria_id)
SELECT 'Reportes Fotográficos del Sitio',
       (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Reportes Fotográficos del Sitio')
ON CONFLICT (nombre) DO NOTHING;
