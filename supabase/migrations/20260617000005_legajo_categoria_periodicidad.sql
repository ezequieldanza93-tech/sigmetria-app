-- ============================================================
-- Legajo Técnico: categoría (6 fijas) + periodicidad de renovación
-- ============================================================
-- El catálogo GLOBAL documentos_tipos solo distinguía 3 niveles por booleanos
-- (aplica_empresa/establecimiento/empleado) y NO tenía período de renovación.
-- La estructura pedida del Legajo Técnico tiene 6 CATEGORÍAS fijas (nivel ×
-- contexto) y cada documento una RENOVACIÓN. Lo modelamos como atributos del
-- catálogo (fijo, igual para todas las consultoras).
--
--   categoria_legajo (6 fijas):
--     empresa | empresa_por_establecimiento | empresa_gestiones |
--     establecimiento | persona | persona_por_establecimiento
--   (empresa_gestiones NO se asigna a tipos: esa sección del legajo se nutre de
--    gestiones_registros (mostrar_lt). Se incluye en el CHECK por completitud.)
--
--   periodicidad: mensual | semanal | semestral | anual | cada_6_anios |
--     no_vence | vto_aviso_obra | vto_inicio_obra | por_gestion | fecha_vto
--     (NULL = aún sin clasificar; los "faltantes" se completan después.)
--
-- Idempotente: ADD COLUMN IF NOT EXISTS; constraints con DROP IF EXISTS.
-- ============================================================

-- ─── 1. Columnas ────────────────────────────────────────────
ALTER TABLE public.documentos_tipos ADD COLUMN IF NOT EXISTS categoria_legajo text;
ALTER TABLE public.documentos_tipos ADD COLUMN IF NOT EXISTS periodicidad text;

-- ─── 2. Backfill de categoría desde los booleanos de nivel ──
-- Default: el nivel base. Las sub-categorías "por establecimiento" se ajustan
-- explícitamente abajo según la estructura del Legajo Técnico.
UPDATE public.documentos_tipos SET categoria_legajo = 'empresa'         WHERE aplica_empresa         AND categoria_legajo IS NULL;
UPDATE public.documentos_tipos SET categoria_legajo = 'establecimiento' WHERE aplica_establecimiento AND categoria_legajo IS NULL;
UPDATE public.documentos_tipos SET categoria_legajo = 'persona'         WHERE aplica_empleado        AND categoria_legajo IS NULL;

-- ─── 3. Clasificación explícita (estructura del Legajo Técnico) ──
-- Mapeo nombre-de-tabla-del-usuario → tipo del catálogo (por id). Solo se setean
-- los que matchean con confianza; los "faltantes" quedan para cargar después.

-- empresas (global)
UPDATE public.documentos_tipos SET categoria_legajo='empresa', periodicidad='anual'   WHERE id='a3c761bd-a076-4f12-98d7-5789c6a127a1'; -- Poliza Contrato ART
UPDATE public.documentos_tipos SET categoria_legajo='empresa', periodicidad='mensual' WHERE id='d70b6350-fb43-4631-b2fc-ca17f1cbf195'; -- Nómina ART
UPDATE public.documentos_tipos SET categoria_legajo='empresa', periodicidad='mensual' WHERE id='308ba596-b33a-4a22-9550-cba53b52a29f'; -- Seguro de Vida Obligatorio (SVO)
UPDATE public.documentos_tipos SET categoria_legajo='empresa', periodicidad='mensual' WHERE id='4c60b6e9-c2ef-47c5-b70d-e00b405d9eb8'; -- IERIC (Nómina de IERIC)
UPDATE public.documentos_tipos SET categoria_legajo='empresa', periodicidad='mensual' WHERE id='5cc59dd0-ef58-43d9-ad92-a39041c6c32c'; -- Constancia de AFIP (=ARCA)

-- empresas por Establecimiento
UPDATE public.documentos_tipos SET categoria_legajo='empresa_por_establecimiento', periodicidad='mensual'        WHERE id='6c81429b-703a-419b-8e2a-6b4a7c54d97d'; -- Cláusula de No Repetición (CNR)
UPDATE public.documentos_tipos SET categoria_legajo='empresa_por_establecimiento', periodicidad='vto_aviso_obra' WHERE id='69bea5bb-a278-4e81-826c-0cf39de4c41a'; -- Programa de Seguridad
UPDATE public.documentos_tipos SET categoria_legajo='empresa_por_establecimiento', periodicidad='vto_inicio_obra' WHERE id='ae0ebabf-a07f-4efd-8832-c91a96f99a7e'; -- Aviso de Obra (AIO)
UPDATE public.documentos_tipos SET categoria_legajo='empresa_por_establecimiento', periodicidad='anual'          WHERE id='aa581d40-8fdc-4a85-bfc5-b7e043254c6e'; -- Matrícula Responsable de H;S&B
UPDATE public.documentos_tipos SET categoria_legajo='empresa_por_establecimiento', periodicidad='semanal'        WHERE id='9fc7207b-212c-4e29-b380-ebf43796c891'; -- Registro Visita HyS (Constancia de Visita)

-- Establecimiento
UPDATE public.documentos_tipos SET categoria_legajo='establecimiento', periodicidad='cada_6_anios' WHERE id='dbc0a924-5fd2-41c3-9eee-e6b8e599290c'; -- Estudio de Impacto Ambiental
UPDATE public.documentos_tipos SET categoria_legajo='establecimiento', periodicidad='semestral'    WHERE id='8adbef95-f305-41a9-adde-99ccaa9b324e'; -- Análisis Bacteriológico del Agua
UPDATE public.documentos_tipos SET categoria_legajo='establecimiento', periodicidad='anual'        WHERE id='fdb896c9-2a2b-4ff4-a0c0-5035385675fa'; -- Análisis Fisicoquímico del Agua
UPDATE public.documentos_tipos SET categoria_legajo='establecimiento', periodicidad='mensual'      WHERE id='2f66fa0e-2aba-44f8-81ec-45dc551acd23'; -- Servicio de Desratización
-- FUZZY (confirmar): "Medición PAT" ≈ "Protocolo PAT - 2"
UPDATE public.documentos_tipos SET categoria_legajo='establecimiento', periodicidad='anual'        WHERE id='1a4e4197-cbdd-4ff5-81d2-bb7fc62000e3'; -- Protocolo PAT - 2 (Medición PAT)

-- personas (global)
UPDATE public.documentos_tipos SET categoria_legajo='persona', periodicidad='fecha_vto' WHERE id='2eeba1fd-83ef-4575-af61-77839a8cc2de'; -- Foto DNI (Frente y Dorso)
UPDATE public.documentos_tipos SET categoria_legajo='persona', periodicidad='fecha_vto' WHERE id='b1637ed0-9056-4c79-ace4-a72924bc23a1'; -- Licencia de Conducir Profesional

-- personas por Establecimiento
UPDATE public.documentos_tipos SET categoria_legajo='persona_por_establecimiento', periodicidad='no_vence'  WHERE id='9aa26f2f-67a1-4809-99e3-e0ea08994101'; -- Alta Temprana
UPDATE public.documentos_tipos SET categoria_legajo='persona_por_establecimiento', periodicidad='semestral' WHERE id='bbebf3a9-c335-4988-aff9-e43794678a85'; -- Planilla de Entrega de EPP

-- ─── 4. Constraints (después del backfill) ──────────────────
ALTER TABLE public.documentos_tipos DROP CONSTRAINT IF EXISTS chk_categoria_legajo;
ALTER TABLE public.documentos_tipos ADD CONSTRAINT chk_categoria_legajo CHECK (
  categoria_legajo IS NULL OR categoria_legajo IN (
    'empresa','empresa_por_establecimiento','empresa_gestiones',
    'establecimiento','persona','persona_por_establecimiento'
  )
);

ALTER TABLE public.documentos_tipos DROP CONSTRAINT IF EXISTS chk_periodicidad;
ALTER TABLE public.documentos_tipos ADD CONSTRAINT chk_periodicidad CHECK (
  periodicidad IS NULL OR periodicidad IN (
    'mensual','semanal','semestral','anual','cada_6_anios',
    'no_vence','vto_aviso_obra','vto_inicio_obra','por_gestion','fecha_vto'
  )
);

-- ─── 5. Comentarios ─────────────────────────────────────────
COMMENT ON COLUMN public.documentos_tipos.categoria_legajo IS
  'Categoría fija del Legajo Técnico (nivel × contexto). 6 valores; empresa_gestiones se nutre de gestiones_registros, no de tipos.';
COMMENT ON COLUMN public.documentos_tipos.periodicidad IS
  'Período de renovación FIJO del documento (global). NULL = sin clasificar aún.';
