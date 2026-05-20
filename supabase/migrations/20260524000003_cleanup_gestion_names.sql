-- Limpiar nombres de gestiones: remover prefijo que repite el nombre de la categoría
-- Cada UPDATE tiene un guard NOT EXISTS para evitar violaciones de unique constraint

-- 1. Checklists → remover "Checklist "
UPDATE public.gestiones g
SET nombre = TRIM(SUBSTRING(g.nombre FROM 10))
FROM public.gestiones_categorias c
WHERE g.categoria_id = c.id
  AND c.nombre = 'Checklists'
  AND g.nombre ILIKE 'Checklist %'
  AND NOT EXISTS (
    SELECT 1 FROM public.gestiones g2
    WHERE g2.nombre = TRIM(SUBSTRING(g.nombre FROM 10)) AND g2.id != g.id
  );

-- 2. Capacitaciones → remover "Capacitación: "
UPDATE public.gestiones g
SET nombre = TRIM(SUBSTRING(g.nombre FROM 14))
FROM public.gestiones_categorias c
WHERE g.categoria_id = c.id
  AND c.nombre = 'Capacitaciones'
  AND g.nombre ILIKE 'Capacitación: %'
  AND NOT EXISTS (
    SELECT 1 FROM public.gestiones g2
    WHERE g2.nombre = TRIM(SUBSTRING(g.nombre FROM 14)) AND g2.id != g.id
  );

-- 3. Campañas de Salud → remover "Campaña de "
UPDATE public.gestiones g
SET nombre = TRIM(SUBSTRING(g.nombre FROM 12))
FROM public.gestiones_categorias c
WHERE g.categoria_id = c.id
  AND c.nombre = 'Campañas de Salud'
  AND g.nombre ILIKE 'Campaña de %'
  AND NOT EXISTS (
    SELECT 1 FROM public.gestiones g2
    WHERE g2.nombre = TRIM(SUBSTRING(g.nombre FROM 12)) AND g2.id != g.id
  );

-- 4. Formularios → remover "Formulario "
UPDATE public.gestiones g
SET nombre = TRIM(SUBSTRING(g.nombre FROM 11))
FROM public.gestiones_categorias c
WHERE g.categoria_id = c.id
  AND c.nombre = 'Formularios'
  AND g.nombre ILIKE 'Formulario %'
  AND NOT EXISTS (
    SELECT 1 FROM public.gestiones g2
    WHERE g2.nombre = TRIM(SUBSTRING(g.nombre FROM 11)) AND g2.id != g.id
  );

-- 5. Simulacros → remover "Simulacro: " (no tocar "Informe Simulacro" ni "Video Simulacro")
UPDATE public.gestiones g
SET nombre = TRIM(SUBSTRING(g.nombre FROM 11))
FROM public.gestiones_categorias c
WHERE g.categoria_id = c.id
  AND c.nombre = 'Simulacros'
  AND g.nombre ILIKE 'Simulacro: %'
  AND NOT EXISTS (
    SELECT 1 FROM public.gestiones g2
    WHERE g2.nombre = TRIM(SUBSTRING(g.nombre FROM 11)) AND g2.id != g.id
  );

-- 6. Planes → remover "Plan de "
UPDATE public.gestiones g
SET nombre = TRIM(SUBSTRING(g.nombre FROM 9))
FROM public.gestiones_categorias c
WHERE g.categoria_id = c.id
  AND c.nombre = 'Planes'
  AND g.nombre ILIKE 'Plan de %'
  AND NOT EXISTS (
    SELECT 1 FROM public.gestiones g2
    WHERE g2.nombre = TRIM(SUBSTRING(g.nombre FROM 9)) AND g2.id != g.id
  );

-- 7. Inducciones → remover "Inducción de "
UPDATE public.gestiones g
SET nombre = TRIM(SUBSTRING(g.nombre FROM 14))
FROM public.gestiones_categorias c
WHERE g.categoria_id = c.id
  AND c.nombre = 'Inducciones'
  AND g.nombre ILIKE 'Inducción de %'
  AND NOT EXISTS (
    SELECT 1 FROM public.gestiones g2
    WHERE g2.nombre = TRIM(SUBSTRING(g.nombre FROM 14)) AND g2.id != g.id
  );

-- 8. Entrenamientos → remover "Entrenamiento: "
UPDATE public.gestiones g
SET nombre = TRIM(SUBSTRING(g.nombre FROM 15))
FROM public.gestiones_categorias c
WHERE g.categoria_id = c.id
  AND c.nombre = 'Entrenamientos'
  AND g.nombre ILIKE 'Entrenamiento: %'
  AND NOT EXISTS (
    SELECT 1 FROM public.gestiones g2
    WHERE g2.nombre = TRIM(SUBSTRING(g.nombre FROM 15)) AND g2.id != g.id
  );

-- 9. Programas → remover "Programa - "
UPDATE public.gestiones g
SET nombre = TRIM(SUBSTRING(g.nombre FROM 11))
FROM public.gestiones_categorias c
WHERE g.categoria_id = c.id
  AND c.nombre = 'Programas'
  AND g.nombre ILIKE 'Programa - %'
  AND NOT EXISTS (
    SELECT 1 FROM public.gestiones g2
    WHERE g2.nombre = TRIM(SUBSTRING(g.nombre FROM 11)) AND g2.id != g.id
  );
