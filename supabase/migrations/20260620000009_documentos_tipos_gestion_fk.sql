-- Los documentos del legajo (nivel establecimiento) pasan a ser FK de gestiones.
-- 1) columna gestion_id en documentos_tipos.
-- 2) los que matchean una gestión existente: link + se unifica el nombre del doc al de
--    la gestión (decisión de Ezequiel).
-- 3) los que no existen como gestión: se crean en grupo "Documentos LT" / categoría
--    "Otra Documentación" (global, consultora_id NULL) y se linkean.

BEGIN;

ALTER TABLE public.documentos_tipos
  ADD COLUMN IF NOT EXISTS gestion_id uuid REFERENCES public.gestiones(id) ON DELETE SET NULL;

-- ─── Match a gestión existente (link + unificar nombre) ──────
UPDATE public.documentos_tipos SET gestion_id = '7a8b1881-003f-4419-8e1c-6f3523d67548'
  WHERE id = 'fdb896c9-2a2b-4ff4-a0c0-5035385675fa'; -- Análisis Fisicoquímico del Agua (ya coincide)
UPDATE public.documentos_tipos SET gestion_id = '53b2c966-3275-48aa-a543-57a62b7519d7', nombre = 'Cálculo de Carga de Fuego'
  WHERE id = '167169c0-c406-4cbe-b6cc-53d5db406ca0'; -- Carga de Fuego
UPDATE public.documentos_tipos SET gestion_id = 'e2aa4d0c-25e4-4fbc-83e7-9d082ac8c116', nombre = 'Plan de Emergencias'
  WHERE id = 'b047c995-48d6-44c8-99d3-1d41665ef754'; -- Plan de Emergencia
UPDATE public.documentos_tipos SET gestion_id = '1e492bac-50bb-46f4-bb3c-d3034f29e08f', nombre = 'Protocolo de Carga Térmica'
  WHERE id = '02861e62-a055-4dac-9146-c6507f35abae';
UPDATE public.documentos_tipos SET gestion_id = '2e23b8b1-7558-4ea7-8d0c-0290df9eac9c', nombre = 'Protocolo de Ergonomía'
  WHERE id = 'ac69925e-adc4-486d-b49b-2314d237f04a';
UPDATE public.documentos_tipos SET gestion_id = '8eef6646-74c9-476b-81b2-7a2b307b509f', nombre = 'Protocolo de Iluminación'
  WHERE id = '13eecaf4-d13d-4b26-9b6b-fcea755fb43d';
UPDATE public.documentos_tipos SET gestion_id = '1a3a4b3a-d4ac-4254-bd9c-6d9fa62ac094', nombre = 'Protocolo de Ruido'
  WHERE id = '7fd97faa-a0cc-4a45-8e3d-b52a3ed5ddc1';
UPDATE public.documentos_tipos SET gestion_id = '85785fc8-38da-425e-92d5-be448fb47693', nombre = 'Protocolo PAT'
  WHERE id = '1a4e4197-cbdd-4ff5-81d2-bb7fc62000e3';
UPDATE public.documentos_tipos SET gestion_id = '88c37166-cdbf-4640-80dc-7dd24d9b07ab', nombre = 'Responsabilidad Civil'
  WHERE id = 'bed8c0ad-bc8a-4720-a3d1-e7419e23e9ef'; -- Seguro Responsabilidad Civil

-- ─── Crear las que no existen (grupo + categoría + gestiones) y linkear ──
DO $$
DECLARE
  v_grupo uuid;
  v_cat uuid;
  v_gestion uuid;
  v_row record;
BEGIN
  SELECT id INTO v_grupo FROM public.gestiones_grupos WHERE nombre = 'Documentos LT' AND consultora_id IS NULL LIMIT 1;
  IF v_grupo IS NULL THEN
    INSERT INTO public.gestiones_grupos (nombre, consultora_id) VALUES ('Documentos LT', NULL) RETURNING id INTO v_grupo;
  END IF;

  SELECT id INTO v_cat FROM public.gestiones_categorias WHERE nombre = 'Otra Documentación' AND grupo_id = v_grupo LIMIT 1;
  IF v_cat IS NULL THEN
    INSERT INTO public.gestiones_categorias (nombre, grupo_id, consultora_id) VALUES ('Otra Documentación', v_grupo, NULL) RETURNING id INTO v_cat;
  END IF;

  FOR v_row IN SELECT * FROM (VALUES
    ('8adbef95-f305-41a9-adde-99ccaa9b324e'::uuid, 'Análisis Bacteriológico del Agua'),
    ('e760bf5a-18ae-416f-b756-a8e44055377b'::uuid, 'Constancia de Recarga de Extintores'),
    ('dbc0a924-5fd2-41c3-9eee-e6b8e599290c'::uuid, 'Estudio de Impacto Ambiental'),
    ('844992b9-d462-4857-86c8-76b737b4a295'::uuid, 'Estudio de Ventilación'),
    ('4f35dd8f-b077-42fb-a67e-a19f1eaef6ec'::uuid, 'Medición de Contaminantes en el Aire'),
    ('2f66fa0e-2aba-44f8-81ec-45dc551acd23'::uuid, 'Servicio de Desratización')
  ) AS t(doc_id, nombre) LOOP
    SELECT id INTO v_gestion FROM public.gestiones WHERE nombre = v_row.nombre AND categoria_id = v_cat LIMIT 1;
    IF v_gestion IS NULL THEN
      INSERT INTO public.gestiones (nombre, categoria_id, consultora_id, tipo_ejecucion, tiene_entregable)
      VALUES (v_row.nombre, v_cat, NULL, 'estandar', true) RETURNING id INTO v_gestion;
    END IF;
    UPDATE public.documentos_tipos SET gestion_id = v_gestion WHERE id = v_row.doc_id;
  END LOOP;
END $$;

COMMIT;
