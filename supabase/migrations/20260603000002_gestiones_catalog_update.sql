-- ============================================================
-- Sigmetría HyS — Actualización catálogo de gestiones
-- Renombra "Reportes Fotográficos del Sitio" a "Observación en recorrida de campo"
-- Agrega "Informe Fotográfico del Establecimiento"
-- Crea grupo "Control Operativo" y categoría "Reporte"
-- ============================================================

-- 1. Grupo: "Control Operativo"
INSERT INTO public.gestiones_grupos (nombre)
VALUES ('Control Operativo')
ON CONFLICT (nombre) DO NOTHING;

-- 2. Categoría: "Reporte" bajo "Control Operativo"
INSERT INTO public.gestiones_categorias (nombre, grupo_id)
SELECT 'Reporte', id
FROM public.gestiones_grupos
WHERE nombre = 'Control Operativo'
ON CONFLICT (nombre) DO UPDATE
  SET grupo_id = (SELECT id FROM public.gestiones_grupos WHERE nombre = 'Control Operativo');

-- 3. Renombrar gestión y moverla a la nueva categoría
UPDATE public.gestiones
SET
  nombre       = 'Observación en recorrida de campo',
  categoria_id = (SELECT id FROM public.gestiones_categorias WHERE nombre = 'Reporte')
WHERE nombre = 'Reportes Fotográficos del Sitio';

-- 4. Limpiar categoría vieja (ya vacía) — sólo si no tiene gestiones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.gestiones g
    JOIN public.gestiones_categorias c ON c.id = g.categoria_id
    WHERE c.nombre = 'Reportes Fotográficos del Sitio'
  ) THEN
    DELETE FROM public.gestiones_categorias WHERE nombre = 'Reportes Fotográficos del Sitio';
  END IF;
END $$;

-- 5. Nueva gestión: "Informe Fotográfico del Establecimiento"
INSERT INTO public.gestiones (nombre, categoria_id)
SELECT 'Informe Fotográfico del Establecimiento',
       (SELECT id FROM public.gestiones_categorias WHERE nombre = 'Reporte')
ON CONFLICT (nombre) DO NOTHING;
