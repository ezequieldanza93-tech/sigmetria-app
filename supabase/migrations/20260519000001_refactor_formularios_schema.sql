-- Refactor: remove formularios + categorias_formularios, wire FKs directly to gestiones
-- Also add numero_item to formulario_items, and seed all checklist data

-- ============================================================
-- STEP 1: Drop trigger/function for removed table
-- ============================================================
DROP TRIGGER IF EXISTS trg_formularios_updated_at ON public.formularios;
DROP FUNCTION IF EXISTS public.update_formularios_updated_at;

-- ============================================================
-- STEP 2: Remove FK + column from formulario_secciones
-- ============================================================
ALTER TABLE public.formulario_secciones
  DROP CONSTRAINT IF EXISTS formulario_secciones_formulario_id_fkey;

DROP INDEX IF EXISTS public.idx_formulario_secciones_formulario_id;

ALTER TABLE public.formulario_secciones
  DROP COLUMN formulario_id,
  ADD COLUMN gestion_id uuid NOT NULL REFERENCES public.gestiones(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_formulario_secciones_gestion_id
  ON public.formulario_secciones (gestion_id);

-- Each gestion can have at most one section with a given title
ALTER TABLE public.formulario_secciones
  ADD CONSTRAINT formulario_secciones_gestion_title_key UNIQUE (gestion_id, title);

-- ============================================================
-- STEP 3: Remove FK + column from formulario_respuestas
-- ============================================================
ALTER TABLE public.formulario_respuestas
  DROP CONSTRAINT IF EXISTS formulario_respuestas_formulario_id_fkey;

DROP INDEX IF EXISTS public.idx_formulario_respuestas_formulario_id;

ALTER TABLE public.formulario_respuestas
  DROP COLUMN formulario_id,
  ADD COLUMN gestion_id uuid NOT NULL REFERENCES public.gestiones(id),
  ADD COLUMN establecimiento_id uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_formulario_respuestas_gestion_id
  ON public.formulario_respuestas (gestion_id);
CREATE INDEX IF NOT EXISTS idx_formulario_respuestas_establecimiento_id
  ON public.formulario_respuestas (establecimiento_id);

-- ============================================================
-- STEP 4: Drop policies + tables: formularios, categorias_formularios
-- ============================================================
DROP POLICY IF EXISTS "formularios: select" ON public.formularios;
DROP POLICY IF EXISTS "formularios: insert" ON public.formularios;
DROP POLICY IF EXISTS "formularios: update" ON public.formularios;
DROP POLICY IF EXISTS "formularios: delete" ON public.formularios;

DROP POLICY IF EXISTS "categorias_formularios: select" ON public.categorias_formularios;
DROP POLICY IF EXISTS "categorias_formularios: insert" ON public.categorias_formularios;
DROP POLICY IF EXISTS "categorias_formularios: update" ON public.categorias_formularios;
DROP POLICY IF EXISTS "categorias_formularios: delete" ON public.categorias_formularios;

DROP TABLE IF EXISTS public.formularios CASCADE;
DROP TABLE IF EXISTS public.categorias_formularios CASCADE;

-- ============================================================
-- STEP 5: Add numero_item to formulario_items
-- ============================================================
ALTER TABLE public.formulario_items
  ADD COLUMN numero_item integer;

CREATE INDEX IF NOT EXISTS idx_formulario_items_numero_item
  ON public.formulario_items (numero_item);

-- ============================================================
-- STEP 6: Seed all checklist forms, sections, and items
-- ============================================================

DO $$
DECLARE
  v_checklist_cat_id uuid;
  v_gestion_id       uuid;
  v_form_id          uuid;
  v_section_id       uuid;
  v_item_order       integer;
BEGIN
  -- Get the Checklists categoria_gestiones id
  v_checklist_cat_id := (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Checklists');

  -- ═══════════════════════════════════════════════════════════════
  -- Helper: ensure gestion exists and return id
  -- ═══════════════════════════════════════════════════════════════
  -- (We use a simple pattern: INSERT ON CONFLICT, then SELECT)

  -- ═══════════════════════════════════════════════════════════════
  -- 1. Checklist ASP - Cilindros a Presión
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist ASP - Cilindros a Presión', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist ASP - Cilindros a Presión');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist ASP - Cilindros a Presión', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist ASP - Cilindros a Presión');

  -- Only seed if section was just created
  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Nombre del equipo / Código único', v_item_order, 'compliance', true, 1);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca', v_item_order, 'compliance', true, 2);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Modelo', v_item_order, 'compliance', true, 3);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Número de serie', v_item_order, 'compliance', true, 4);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Año de fabricación', v_item_order, 'compliance', true, 5);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad / Volumen (litros)', v_item_order, 'compliance', true, 6);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Presión de Trabajo (bar)', v_item_order, 'compliance', true, 7);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Fecha de última prueba hidráulica', v_item_order, 'compliance', true, 8);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Manómetro funcionando', v_item_order, 'compliance', true, 9);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Válvula de seguridad operativa', v_item_order, 'compliance', true, 9);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Válvula de purga operativa', v_item_order, 'compliance', true, 10);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Estado de mangueras y conexiones', v_item_order, 'compliance', true, 11);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Manguera de conexión eléctrica', v_item_order, 'compliance', true, 11);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Presión de servicio', v_item_order, 'compliance', true, NULL);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Presión de Prueba', v_item_order, 'compliance', true, NULL);

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Fecha de ultima prueba', v_item_order, 'compliance', true, NULL);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 2. Checklist ASP - Soldadura Eléctrica
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist ASP - Soldadura Eléctrica', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist ASP - Soldadura Eléctrica');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist ASP - Soldadura Eléctrica', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist ASP - Soldadura Eléctrica');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Nombre del equipo / Código único', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Modelo', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Número de serie', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Año de fabricación', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Tipo de soldadura (eléctrica / punto / etc.)', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Potencia / Amperaje', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca y modelo de electrodos', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Estado de pinza porta electrodo', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Estado de cable de masa', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Estado de cable de alimentación', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Medidor de consumo eléctrico', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Ventilación del área de trabajo', v_item_order, 'compliance', true, 11);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 3. Checklist ASP - Soldadura Oxi-Acetilénica
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist ASP - Soldadura Oxi-Acetilénica', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist ASP - Soldadura Oxi-Acetilénica');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist ASP - Soldadura Oxi-Acetilénica', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist ASP - Soldadura Oxi-Acetilénica');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Nombre del equipo / Código único', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Modelo', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Número de serie', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Año de fabricación', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Tipo de soldadura (oxi-acetilénica)', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Presión de trabajo (bar)', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Mangueras y conexiones', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Boquillas / Soplete', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Válvulas antirretorno', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Estado de los manómetros', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Fugas en las conexiones', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Estado de los cilindros', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Almacenamiento de cilindros', v_item_order, 'compliance', true, 11);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 4. Checklist ASP - Esmeril Angular
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist ASP - Esmeril Angular', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist ASP - Esmeril Angular');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist ASP - Esmeril Angular', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist ASP - Esmeril Angular');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Nombre del equipo / Código único', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Modelo', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Número de serie', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Año de fabricación', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Diámetro del disco (pulgadas)', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Velocidad máxima (RPM)', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Tipo de disco (corte / desbaste)', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Protector de disco en buen estado', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Interruptor de seguridad operativo', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cable de alimentación en buen estado', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Empuñadura auxiliar presente', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Discos de repuesto almacenados correctamente', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Faja de transporte de material', v_item_order, 'compliance', true, NULL);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 5. Checklist ASP - Cizalla y Dobladora
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist ASP - Cizalla y Dobladora', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist ASP - Cizalla y Dobladora');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist ASP - Cizalla y Dobladora', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist ASP - Cizalla y Dobladora');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Nombre del equipo / Código único', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Modelo', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Número de serie', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Año de fabricación', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad de corte (mm)', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad de doblado (mm)', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Tipo de accionamiento (manual / hidráulico / eléctrico)', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cuchillas en buen estado', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Sistema de sujeción operativo', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Sistema de seguridad (resguardo)', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Faja de transporte de material', v_item_order, 'compliance', true, NULL);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 6. Checklist AP - Trabajos en Altura
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AP - Trabajos en Altura', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AP - Trabajos en Altura');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist AP - Trabajos en Altura', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist AP - Trabajos en Altura');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Nombre del equipo / Código único', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Modelo', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Número de serie', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Año de fabricación', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Altura máxima de trabajo (m)', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad de carga (kg)', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Estado de barandas y plataforma', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Puntos de anclaje en buen estado', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Sistema de frenado / bloqueo operativo', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Escalera de acceso en buen estado', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Estabilizadores extendidos y apoyados', v_item_order, 'compliance', true, 11);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 7. Checklist AP - Escaleras Manuales
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AP - Escaleras Manuales', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AP - Escaleras Manuales');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist AP - Escaleras Manuales', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist AP - Escaleras Manuales');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Nombre del equipo / Código único', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Modelo', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Número de serie', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Año de fabricación', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Tipo de escalera (telescópica / tijera / fibra / aluminio)', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Altura máxima (m)', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad de carga (kg)', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Peldaños en buen estado', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Zapatas antideslizantes presentes', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Sistema de apertura / bloqueo operativo', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Faja de transporte de material', v_item_order, 'compliance', true, NULL);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 8. Checklist AP - Andamios
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AP - Andamios', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AP - Andamios');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist AP - Andamios', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist AP - Andamios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Nombre del equipo / Código único', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Modelo', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Número de serie', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Año de fabricación', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Altura máxima (m)', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad de carga (kg/m²)', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Plataforma de trabajo completa', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Barandas y rodapiés instalados', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Arriostramientos diagonales colocados', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Base nivelada y apoyada sobre durmientes', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Acceso seguro (escalera de gato)', v_item_order, 'compliance', true, 11);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 9. Checklist AP - Canasto para Izaje
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AP - Canasto para Izaje', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AP - Canasto para Izaje');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist AP - Canasto para Izaje', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist AP - Canasto para Izaje');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Nombre del equipo / Código único', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Modelo', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Número de serie', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Año de fabricación', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad de carga (kg)', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Dimensiones (ancho x largo x alto)', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Peso propio (kg)', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Barandas perimetrales en buen estado', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Piso antideslizante', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Puntos de izaje certificados', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Compuerta de acceso con seguro', v_item_order, 'compliance', true, 11);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 10. Checklist AP - Cuchara para Izaje
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AP - Cuchara para Izaje', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AP - Cuchara para Izaje');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist AP - Cuchara para Izaje', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist AP - Cuchara para Izaje');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Nombre del equipo / Código único', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Modelo', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Número de serie', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Año de fabricación', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad de carga (kg)', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Volumen (m³)', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Peso propio (kg)', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cuchara sin deformaciones', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Puntos de izaje certificados', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Sistema de cierre / retención operativo', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Gancho seguro y con pestillo', v_item_order, 'compliance', true, 11);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 11. Checklist AP - Arneses y Líneas de Vida
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AP - Arneses y Líneas de Vida', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AP - Arneses y Líneas de Vida');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist AP - Arneses y Líneas de Vida', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist AP - Arneses y Líneas de Vida');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Nombre del equipo / Código único', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Marca', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Modelo', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Número de serie', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Año de fabricación', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Tipo de arnés (cuerpo completo / cintura)', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad de carga (kg)', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Longitud de línea de vida (m)', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cintas y costuras sin desgaste', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Hebillas y ajustes operativos', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Mosquetón con seguro operativo', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Absorbedor de energía presente', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Faja de transporte de material', v_item_order, 'compliance', true, NULL);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 12. Checklist EQ - Elementos de Izaje
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist EQ - Elementos de Izaje', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist EQ - Elementos de Izaje');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist EQ - Elementos de Izaje', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist EQ - Elementos de Izaje');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cubierta superior instalada para proteger de la intemperie', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de Capacidad Máxima (Carga)', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Frena y retiene la carga en cualquier posición', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Sistema de Freno operativo', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cadena de carga sin nudos ni eslabones rotos', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Ganchos con pestillo de seguridad', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Gancho del cuerpo del equipo', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cable de acero sin roturas', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Equipos almacenados en lugar seco y seguro', v_item_order, 'compliance', true, 6);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 13. Checklist EQ - Cables de Acero
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist EQ - Cables de Acero', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist EQ - Cables de Acero');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist EQ - Cables de Acero', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist EQ - Cables de Acero');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad Máxima (Carga)', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Almas y cables rotos', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Desgaste', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Corrosión', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Deformaciones', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Ganchos con pestillo de seguridad', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Estado de los terminales (gazas / mordillos)', v_item_order, 'compliance', true, 7);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 14. Checklist EQ - Eslingas
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist EQ - Eslingas', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist EQ - Eslingas');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist EQ - Eslingas', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist EQ - Eslingas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad Máxima (Carga)', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Desgaste', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cortes y desgarros', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Decoloración por rayos UV / químicos', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Costuras dañadas', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Ganchos con pestillo de seguridad', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Argolla / anilla central con desgaste', v_item_order, 'compliance', true, 7);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 15. Checklist EQ - Grilletes
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist EQ - Grilletes', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist EQ - Grilletes');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist EQ - Grilletes', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist EQ - Grilletes');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad Máxima (Carga)', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Deformaciones', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Desgaste', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Corrosión', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Rosca del bulón en buen estado', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Bulón pasa libremente', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Chaveta / pasador de seguridad presente', v_item_order, 'compliance', true, 7);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 16. Checklist EQ - Ganchos
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist EQ - Ganchos', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist EQ - Ganchos');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist EQ - Ganchos', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist EQ - Ganchos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad Máxima (Carga)', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Deformaciones', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Desgaste', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Corrosión', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Pestillo de seguridad operativo', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Abertura de la garganta dentro de lo normal', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Gancho de seguridad con pestillo', v_item_order, 'compliance', true, 7);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 17. Checklist EQ - Cáncamos
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist EQ - Cáncamos', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist EQ - Cáncamos');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist EQ - Cáncamos', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist EQ - Cáncamos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad Máxima (Carga)', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Deformaciones', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Desgaste', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Corrosión', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Rosca en buen estado', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Giro libre del cáncamo', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Gancho de seguridad con pestillo', v_item_order, 'compliance', true, 7);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 18. Checklist EQ - Pestal
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist EQ - Pestal', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist EQ - Pestal');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist EQ - Pestal', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist EQ - Pestal');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Capacidad Máxima (Carga)', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Deformaciones', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Desgaste', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Corrosión', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Pestillo de seguridad operativo', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Gancho de seguridad con pestillo', v_item_order, 'compliance', true, 6);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 19. Checklist ES - Señalética de Obra
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist ES - Señalética de Obra', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist ES - Señalética de Obra');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist ES - Señalética de Obra', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist ES - Señalética de Obra');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cartel de obra visible', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de acceso a la obra', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de prohibido el paso a toda persona ajena a la obra', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de uso obligatorio de EPP', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de salida de camiones', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de zonas de peligro', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de límite de velocidad', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señal de uso de casco', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cartel de acceso a oficinas', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cartel de acceso a baños químicos', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cartel de acceso a comedor', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cartel de acceso a vestuarios', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cartel de acceso a depósito de inflamables', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cartel de acceso a almacenamiento de residuos', v_item_order, 'compliance', true, NULL);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 20. Checklist ES - Señalética Vial
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist ES - Señalética Vial', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist ES - Señalética Vial');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist ES - Señalética Vial', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist ES - Señalética Vial');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de acceso vehicular', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de salida vehicular', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de prohibido estacionar', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de límite de velocidad', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de zona de carga y descarga', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de paso peatonal', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de zona de circulación de maquinaria', v_item_order, 'compliance', true, 7);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 21. Checklist IA - Control de Acceso
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IA - Control de Acceso', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IA - Control de Acceso');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist IA - Control de Acceso', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist IA - Control de Acceso');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Registro de Ingreso y Egreso', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Control de Acceso Vehicular', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización', v_item_order, 'compliance', true, 22);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Orden y Limpieza', v_item_order, 'compliance', true, 23);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Iluminación', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Ventilación', v_item_order, 'compliance', true, 25);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Protección Contra Incendios', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de Depósito de Inflamables', v_item_order, 'compliance', true, 27);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 22. Checklist IA - Depósito de Inflamables
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IA - Depósito de Inflamables', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IA - Depósito de Inflamables');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist IA - Depósito de Inflamables', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist IA - Depósito de Inflamables');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Techo', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Paredes', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Piso', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Cerco Perimetral', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Defensa Metálica', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización', v_item_order, 'compliance', true, 22);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Orden y Limpieza', v_item_order, 'compliance', true, 23);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Iluminación', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Ventilación', v_item_order, 'compliance', true, 25);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Protección Contra Incendios', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de Depósito de Inflamables', v_item_order, 'compliance', true, 27);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 23. Checklist IA - Bienestar Sereno
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IA - Bienestar Sereno', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IA - Bienestar Sereno');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist IA - Bienestar Sereno', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist IA - Bienestar Sereno');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Dejar calzado en la entrada', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Zona de descanso limpia y ordenada', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Colchón limpio y en buen estado', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Se cuenta con agua caliente', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Se cuenta con Kit de Limpieza', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Se cuenta con elementos para combatir incendios', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización', v_item_order, 'compliance', true, 22);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Orden y Limpieza', v_item_order, 'compliance', true, 23);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Iluminación', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Ventilación', v_item_order, 'compliance', true, 25);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Protección Contra Incendios', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de Depósito de Inflamables', v_item_order, 'compliance', true, 27);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 24. Checklist IA - Grupo Electrógeno
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IA - Grupo Electrógeno', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IA - Grupo Electrógeno');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist IA - Grupo Electrógeno', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist IA - Grupo Electrógeno');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización', v_item_order, 'compliance', true, 22);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Orden y Limpieza', v_item_order, 'compliance', true, 23);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Iluminación', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Ventilación', v_item_order, 'compliance', true, 25);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Protección Contra Incendios', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de Depósito de Inflamables', v_item_order, 'compliance', true, 27);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 25. Checklist IA - Baños Químicos
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IA - Baños Químicos', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IA - Baños Químicos');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist IA - Baños Químicos', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist IA - Baños Químicos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización', v_item_order, 'compliance', true, 22);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Orden y Limpieza', v_item_order, 'compliance', true, 23);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Iluminación', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Ventilación', v_item_order, 'compliance', true, 25);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Protección Contra Incendios', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de Depósito de Inflamables', v_item_order, 'compliance', true, 27);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 26. Checklist IA - Almacenamiento de Residuos
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IA - Almacenamiento de Residuos', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IA - Almacenamiento de Residuos');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist IA - Almacenamiento de Residuos', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist IA - Almacenamiento de Residuos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Iluminación', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Protección Contra Incendios', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de Depósito de Inflamables', v_item_order, 'compliance', true, 27);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Residuos Clase I', v_item_order, 'compliance', true, 28);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Residuos Clase II', v_item_order, 'compliance', true, 29);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Residuos Patogénicos', v_item_order, 'compliance', true, 30);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Residuos Radiactivos', v_item_order, 'compliance', true, 31);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Peligrosos', v_item_order, 'compliance', true, 32);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'No Peligrosos', v_item_order, 'compliance', true, 33);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Escombros', v_item_order, 'compliance', true, 34);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 27. Checklist IA - Almacenamiento
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IA - Almacenamiento', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IA - Almacenamiento');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist IA - Almacenamiento', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist IA - Almacenamiento');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Trifásicos', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Monofásicos', v_item_order, 'compliance', true, NULL);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 28. Checklist IA - Acopio de Tierras y Escombros
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IA - Acopio de Tierras y Escombros', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IA - Acopio de Tierras y Escombros');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist IA - Acopio de Tierras y Escombros', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist IA - Acopio de Tierras y Escombros');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Trifásicos', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Monofásicos', v_item_order, 'compliance', true, NULL);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 29. Checklist IA - Zona de Acopio de Materiales
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IA - Zona de Acopio de Materiales', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IA - Zona de Acopio de Materiales');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist IA - Zona de Acopio de Materiales', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist IA - Zona de Acopio de Materiales');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Trifásicos', v_item_order, 'compliance', true, NULL);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Monofásicos', v_item_order, 'compliance', true, NULL);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 30. Checklist IA - Oficinas
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IA - Oficinas', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IA - Oficinas');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist IA - Oficinas', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist IA - Oficinas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Iluminación', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Ventilación', v_item_order, 'compliance', true, 25);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Protección Contra Incendios', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de Depósito de Inflamables', v_item_order, 'compliance', true, 27);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 31. Checklist IA - Comedor
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IA - Comedor', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IA - Comedor');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Checklist IA - Comedor', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Checklist IA - Comedor');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Iluminación', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Ventilación', v_item_order, 'compliance', true, 25);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Protección Contra Incendios', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Señalización de Depósito de Inflamables', v_item_order, 'compliance', true, 27);
  END IF;

END $$;
