-- ============================================================
-- Sistema de Autoprotección (SAP) CABA — Ley 5920 · GESTIÓN + NORMA
-- ============================================================
-- 1. Habilita un nuevo tipo_ejecucion de gestión: 'presentacion_autoproteccion'
--    (dispara el wizard del SAP desde la agenda del establecimiento).
-- 2. Crea el grupo "Presentaciones" (no existía), la categoría "Defensa Civil
--    (CABA)" y la gestión "Sistema de Autoprotección (CABA) — Ley 5920".
-- 3. Carga la Ley 5920 en la Matriz de Requisitos Legales (base nacional
--    compartida, consultora_id NULL) con su aplicabilidad: jurisdicción = CABA,
--    requiere habilitación, excluye obras de construcción. + requisitos clave.
--
-- Idempotente (guardas por nombre/numero/code).
-- ============================================================

-- ─── 1. Nuevo tipo_ejecucion para gestiones ─────────────────
ALTER TABLE public.gestiones DROP CONSTRAINT IF EXISTS chk_gestiones_tipo_ejecucion;
ALTER TABLE public.gestiones ADD CONSTRAINT chk_gestiones_tipo_ejecucion
  CHECK (tipo_ejecucion IN (
    'estandar','reporte_fotografico','medicion_iluminacion','medicion_ruido',
    'medicion_carga_termica','calculo_carga_fuego','medicion_pat',
    'presentacion_autoproteccion'
  ));

-- ─── 2 + 3. Seed catálogo gestión + norma ───────────────────
DO $$
DECLARE
  v_grupo_id          uuid;
  v_categoria_id      uuid;
  v_gestion_id        uuid;
  v_categoria_norma_id uuid;
  v_norma_id          uuid;
  v_caba         uuid := '4172a435-628c-4c51-96ea-284b24ee6ceb';  -- provincia CABA
  v_construccion uuid := '86fd17d6-7e26-4b21-b5db-2b9fafbb449f';  -- establecimientos_tipos CONSTRUCCION
BEGIN
  -- Grupo "Presentaciones"
  SELECT id INTO v_grupo_id FROM public.gestiones_grupos WHERE nombre = 'Presentaciones';
  IF v_grupo_id IS NULL THEN
    INSERT INTO public.gestiones_grupos (nombre) VALUES ('Presentaciones') RETURNING id INTO v_grupo_id;
  END IF;

  -- Categoría "Defensa Civil (CABA)"
  SELECT id INTO v_categoria_id FROM public.gestiones_categorias
    WHERE nombre = 'Defensa Civil (CABA)' AND grupo_id = v_grupo_id;
  IF v_categoria_id IS NULL THEN
    INSERT INTO public.gestiones_categorias (nombre, grupo_id, descripcion)
    VALUES ('Defensa Civil (CABA)', v_grupo_id,
            'Presentaciones ante la Dirección General de Defensa Civil de la Ciudad de Buenos Aires.')
    RETURNING id INTO v_categoria_id;
  END IF;

  -- Gestión "Sistema de Autoprotección (CABA) — Ley 5920"
  SELECT id INTO v_gestion_id FROM public.gestiones
    WHERE nombre = 'Sistema de Autoprotección (CABA) — Ley 5920';
  IF v_gestion_id IS NULL THEN
    INSERT INTO public.gestiones (nombre, categoria_id, descripcion, tiene_entregable, tipo_ejecucion)
    VALUES ('Sistema de Autoprotección (CABA) — Ley 5920', v_categoria_id,
            'Trámite guiado del Sistema de Autoprotección obligatorio en CABA (Ley 5920). Aplica solo a establecimientos en CABA, con habilitación, que no sean obras de construcción.',
            true, 'presentacion_autoproteccion')
    RETURNING id INTO v_gestion_id;
  ELSE
    UPDATE public.gestiones
      SET categoria_id = v_categoria_id, tipo_ejecucion = 'presentacion_autoproteccion', tiene_entregable = true
      WHERE id = v_gestion_id;
  END IF;

  -- Categoría de la norma (matriz)
  SELECT id INTO v_categoria_norma_id FROM public.normativa_categorias
    WHERE nombre = 'Defensa Civil / Autoprotección (CABA)' AND consultora_id IS NULL;
  IF v_categoria_norma_id IS NULL THEN
    INSERT INTO public.normativa_categorias (consultora_id, nombre, ambito, orden)
    VALUES (NULL, 'Defensa Civil / Autoprotección (CABA)', 'Provincial', 100)
    RETURNING id INTO v_categoria_norma_id;
  END IF;

  -- Norma Ley 5920 (base nacional compartida)
  SELECT id INTO v_norma_id FROM public.normativa_normas
    WHERE consultora_id IS NULL AND tipo = 'Ley' AND numero = '5920';
  IF v_norma_id IS NULL THEN
    INSERT INTO public.normativa_normas
      (consultora_id, categoria_id, tipo, numero, anio, titulo, nombre_completo, organismo,
       ambito, estado, descripcion, aplica_a_todos, provincia_id, requiere_habilitacion)
    VALUES
      (NULL, v_categoria_norma_id, 'Ley', '5920', 2017,
       'Sistema de Autoprotección',
       'Ley 5920 (CABA) — Sistema de Autoprotección (reglam. DI-2025-331-GCABA-DGDCIV)',
       'Legislatura CABA / DG Defensa Civil', 'Provincial', 'Vigente',
       'Crea el Sistema de Autoprotección, obligatorio en CABA para edificios/establecimientos/predios con afluencia de público. Reglamentada por la Disposición DI-2025-331-GCABA-DGDCIV y sus 7 anexos. Clasifica en Grupos 1/2/3 (Anexo I): el Grupo 1 presenta DDJJ (Anexo II); los Grupos 2 y 3 presentan el SAP completo (Anexo III-A) firmado por profesional inscripto. Aplica solo a establecimientos en CABA, con habilitación, que no sean obras de construcción.',
       true, v_caba, true)
    RETURNING id INTO v_norma_id;
  ELSE
    UPDATE public.normativa_normas
      SET provincia_id = v_caba, requiere_habilitacion = true,
          categoria_id = v_categoria_norma_id, ambito = 'Provincial'
      WHERE id = v_norma_id;
  END IF;

  -- Aplicabilidad: excluir obras de construcción
  INSERT INTO public.normativa_normas_tipos_establecimiento (norma_id, tipo_establecimiento_id, modo)
  VALUES (v_norma_id, v_construccion, 'excluye')
  ON CONFLICT (norma_id, tipo_establecimiento_id) DO UPDATE SET modo = 'excluye';

  -- Requisitos clave (idempotente: limpiar y recargar los del prefijo L5920-)
  DELETE FROM public.normativa_requisitos WHERE norma_id = v_norma_id AND code LIKE 'L5920-%';
  INSERT INTO public.normativa_requisitos (norma_id, articulo, descripcion_corta, descripcion_oficial, code, orden) VALUES
    (v_norma_id, 'Art. 1', 'Creación y obligatoriedad en CABA',
     'Créase el Sistema de Autoprotección de aplicación obligatoria en el ámbito de la Ciudad Autónoma de Buenos Aires.', 'L5920-01', 10),
    (v_norma_id, 'Art. 2', 'Alcance, vigencia 2 años y reválida',
     'Alcanza a edificios/establecimientos/predios con afluencia de público; voluntario para vivienda. La aprobación tiene vigencia de 2 años; ciertos usos (4º párrafo) no admiten reválida abreviada.', 'L5920-02', 20),
    (v_norma_id, 'Art. 3', 'Umbral 500 m² / DDJJ',
     'Los establecimientos de hasta 500 m² (sin subsuelo con actividad y no listados) cumplen mediante Declaración Jurada (Anexo II).', 'L5920-03', 30),
    (v_norma_id, 'Art. 3 bis', 'Posterior al Plano Conforme a Obra',
     'El SAP se lleva a cabo con posterioridad al registro del Plano Conforme a Obra o del Plano de Instalación contra Incendio, en caso de corresponder.', 'L5920-04', 40),
    (v_norma_id, 'Art. 5', 'Contenido mínimo del SAP y simulacros',
     'Define el contenido obligatorio del SAP (Grupos 2 y 3) y exige como mínimo 2 simulacros por año.', 'L5920-05', 50),
    (v_norma_id, 'Art. 6', 'Registro de Profesionales',
     'El SAP de Grupos 2 y 3 debe ser elaborado por un profesional inscripto en el Registro de Profesionales (Anexo VI).', 'L5920-06', 60),
    (v_norma_id, 'Art. 7', 'Carácter de declaración jurada',
     'Toda la documentación presentada reviste carácter de declaración jurada.', 'L5920-07', 70),
    (v_norma_id, 'DI-2025-331', 'Reglamentación y anexos',
     'Normas complementarias, aclaratorias y operativas: Anexo I (clasificación), II (DDJJ G1), III-A (requisitos SAP), III-B (DDJJ reválida), IV (eventos), V (excepción cultural), VI (registro profesionales), VII (sanciones).', 'L5920-08', 80);
END $$;

-- ─── Comentario ─────────────────────────────────────────────
COMMENT ON CONSTRAINT chk_gestiones_tipo_ejecucion ON public.gestiones IS
  'Tipos de ejecución de gestión. presentacion_autoproteccion = wizard del SAP (Ley 5920 CABA).';
