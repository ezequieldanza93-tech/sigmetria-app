-- Orden jerárquico del menú de categorías (pirámide legal; Nacional antes que Provincial)
UPDATE public.normativa_categorias SET orden = CASE nombre
  WHEN 'Leyes Nacionales' THEN 1
  WHEN 'Leyes Provinciales' THEN 2
  WHEN 'Decretos Nacionales' THEN 3
  WHEN 'Decretos Provinciales' THEN 4
  WHEN 'Resoluciones Nacionales' THEN 5
  WHEN 'Resoluciones Provinciales' THEN 6
  WHEN 'Disposiciones' THEN 7
  WHEN 'Laudos' THEN 8
  WHEN 'Reglamentos Construcción' THEN 9
  WHEN 'Ordenanzas Municipales' THEN 10
  WHEN 'Otros Requisitos' THEN 11
  ELSE 99 END
WHERE consultora_id IS NULL;
