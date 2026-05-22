-- Seed: 19 nuevos checklists de formularios (higiene y seguridad)
-- ============================================================

DO $$
DECLARE
  v_checklist_cat_id uuid;
  v_gestion_id       uuid;
  v_section_id       uuid;
  v_item_order       integer;
BEGIN
  v_checklist_cat_id := (SELECT id FROM public.categoria_gestiones WHERE nombre = 'Checklists');

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 1. Checklist AG - Agro
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AG - Agro', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AG - Agro');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-01 ProtecciÃ³n Contra Incendios', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-01 ProtecciÃ³n Contra Incendios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen medios y vÃ­as de escape adecuadas en caso de incendio?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La cantidad y tipo de matafuegos es acorde a la carga de fuego?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen sistemas de detecciÃ³n y extinciÃ³n de incendios?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El depÃ³sito de combustibles cumple con la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se acredita la realizaciÃ³n periÃ³dica de simulacros de evacuaciÃ³n?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se dispone de estanterÃ­as o elementos equivalentes de material no combustible o metÃ¡lico?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se almacenan los productos agroquÃ­micos separados de los inflamables, utilizando materiales no combustibles en los depÃ³sitos?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se evita la realizaciÃ³n de quemas en dÃ­as muy ventosos, considerando la direcciÃ³n de los vientos predominantes?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan previamente los cortafuegos pertinentes?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se controlan regularmente los acopios de materiales que puedan producir fermentaciÃ³n y elevaciÃ³n de temperatura?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-02 Peligro ElÃ©ctrico', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-02 Peligro ElÃ©ctrico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n todos los cableados elÃ©ctricos adecuadamente contenidos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los conectores elÃ©ctricos se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tableros elÃ©ctricos cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las tareas de mantenimiento son efectuadas por personal capacitado y autorizado por la empresa?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptan las medidas de seguridad en locales donde se manipulen sustancias corrosivas, inflamables y/o explosivas o de alto riesgo y en locales hÃºmedos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han adoptado medidas para la protecciÃ³n contra riesgos de contactos directos e indirectos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han adoptado medidas para eliminar la electricidad estÃ¡tica en todas las operaciones donde pueda producirse?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Posee instalaciÃ³n para prevenir sobretensiones producidas por descargas atmosfÃ©ricas (pararrayos)?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Poseen las instalaciones tomas a tierra independientes de la instalada para descargas atmosfÃ©ricas?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-03 ErgonomÃ­a', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-03 ErgonomÃ­a');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones ergonÃ³micas son adecuadas en cuanto a levantamiento y descenso de cargas, empujes y arrastres, transporte de cargas, bipedestaciÃ³n, movimientos repetitivos, posturas forzadas y estrÃ©s de contacto?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan los controles administrativos y se proponen mejoras de ingenierÃ­a?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-04 CaÃ­das a Mismo Nivel', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-04 CaÃ­das a Mismo Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sectores de circulaciÃ³n como pasillos, escaleras y pisos son seguros?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n ausentes las irregularidades que puedan provocar caÃ­das y resbalones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todas las escaleras cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todas las plataformas de trabajo y rampas cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-05 IluminaciÃ³n y SeÃ±alizaciÃ³n', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-05 IluminaciÃ³n y SeÃ±alizaciÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cumple con los requisitos de iluminaciÃ³n establecidos en la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha instalado un sistema de iluminaciÃ³n de emergencia acorde a los requerimientos de la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe marcaciÃ³n visible de pasillos, circulaciones de trÃ¡nsito y lugares de cruce donde circulen cargas suspendidas y otros elementos de transporte?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran seÃ±alizados los caminos de evacuaciÃ³n e indicadas las salidas normales y de emergencia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran identificadas las caÃ±erÃ­as?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-06 Espacios de Trabajo', 5)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-06 Espacios de Trabajo');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe orden y limpieza en los puestos de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen depÃ³sitos de residuos en los puestos de trabajo?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se almacenan los productos respetando la distancia mÃ­nima de 1 m entre la parte superior de las estibas y el techo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sistemas de almacenaje permiten una adecuada circulaciÃ³n y son seguros?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿En los almacenajes a granel, las estibas cuentan con elementos de contenciÃ³n?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-07 VentilaciÃ³n', 6)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-07 VentilaciÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen aberturas que permitan el ingreso de aire?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sistemas de ventilaciÃ³n son adecuados y se encuentran en buen estado de funcionamiento?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-08 Condiciones Edilicias e Infraestructura', 7)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-08 Condiciones Edilicias e Infraestructura');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones edilicias son adecuadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han instrumentado las acciones necesarias para que la vivienda provista por el empleador se mantenga libre de malezas y con fuentes de riesgo elÃ©ctrico, incendio y derrumbe controladas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n ausentes los problemas de humedad y filtraciones?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las estructuras portantes se encuentran en buen estado?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n ausentes rajaduras de consideraciÃ³n que puedan afectar la estabilidad y resistencia edilicia?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El estado de la pintura y revestimientos de la mamposterÃ­a es correcto?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El estado estructural de las barandas, pisos y escaleras es adecuado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe provisiÃ³n de agua potable para el consumo e higiene de los trabajadores?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha evitado el consumo humano del agua destinada a uso industrial?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen baÃ±os aptos higiÃ©nicamente?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen vestuarios aptos higiÃ©nicamente con armarios adecuados e individuales?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen comedores aptos higiÃ©nicamente?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La/s cocina/s reÃºne/n los requisitos establecidos?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los desagÃ¼es industriales se recogen y canalizan por conductos, impidiendo su libre escurrimiento?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha evitado el contacto de lÃ­quidos que puedan reaccionar originando desprendimiento de gases tÃ³xicos o contaminantes?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Son evacuados los efluentes a plantas de tratamiento?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se limpia periÃ³dicamente la planta de tratamiento con las precauciones de protecciÃ³n necesarias para el personal?', v_item_order, 'compliance', true, 17);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-09 ExplosiÃ³n / ASP', 8)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-09 ExplosiÃ³n / ASP');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan los controles e inspecciones periÃ³dicas establecidos en calderas y todo otro aparato sometido a presiÃ³n?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han fijado las instrucciones detalladas con esquemas de la instalaciÃ³n y los procedimientos operativos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n los cilindros con gases a presiÃ³n adecuadamente almacenados, evitando el almacenamiento excesivo, con capuchÃ³n protector y vÃ¡lvula cerrada?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los cilindros de gases son transportados por medios adecuados?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Disponen de vÃ¡lvula de seguridad y disco de ruptura instalados en condiciones correctas de uso?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se dispone de vÃ¡lvulas de bloqueo y parada para emergencias, dispositivos de purga y vÃ¡lvula de retenciÃ³n?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mangueras, reguladores, manÃ³metros, sopletes y vÃ¡lvulas antirretornos se encuentran en buen estado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tubos de acetileno y oxÃ­geno disponen de vÃ¡lvula antiretroceso de llama?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Cuenta el operador con la capacitaciÃ³n y/o habilitaciÃ³n pertinente?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-10 Sustancias QuÃ­micas y Peligrosas', 9)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-10 Sustancias QuÃ­micas y Peligrosas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La fabricaciÃ³n y/o manipuleo de sustancias peligrosas cumplimenta la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las instalaciones y equipos se encuentran protegidos contra el efecto corrosivo de las sustancias empleadas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen dispositivos de alarma acÃºsticos y visuales donde se manipulen sustancias infectantes y/o contaminantes?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha seÃ±alizado y resguardado la zona o los elementos afectados ante casos de derrame de sustancias corrosivas?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran separados los productos incompatibles?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los productos cumplen con el etiquetado de la legislaciÃ³n SGA?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen duchas de emergencia y/o lava ojos en los sectores con productos peligrosos?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿En atmÃ³sferas inflamables la instalaciÃ³n elÃ©ctrica es antiexplosiva?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe un sistema para control de derrames de productos peligrosos?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se confeccionÃ³ un plan de seguridad para casos de emergencia y se colocÃ³ en lugar visible?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-11 Trabajos en Altura y a Distinto Nivel', 10)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-11 Trabajos en Altura y a Distinto Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones de viento, atmÃ³sfera y estado del suelo permiten realizar el trabajo con seguridad?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n colocadas las barreras fÃ­sicas y/o seÃ±alizaciÃ³n requeridas? (Barandas a 1 m y 0,5 m, plataforma ancho mÃ­nimo 60 cm, zÃ³calo de 15 cm.)', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen escaleras adecuadas de ascenso a las estructuras?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra correctamente seÃ±alizada el Ã¡rea de trabajo?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las aberturas y huecos se encuentran protegidos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las estructuras en las cuales se desarrollan las tareas son resistentes y estables?', v_item_order, 'compliance', true, 6);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-12 MÃ¡quinas, Herramientas y Equipos', 11)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-12 MÃ¡quinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los volantes, correas, ejes, mecanismos de transmisiÃ³n, salientes y cigÃ¼eÃ±ales estÃ¡n cubiertos para eliminar la posibilidad de contacto con las partes en movimiento?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los extremos de ejes de transmisiÃ³n que sobresalen en mÃ¡s de un tercio de su diÃ¡metro estÃ¡n protegidos o redondeados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los elementos o partes mÃ³viles que pudieran producir atrapamientos, aplastamientos o cortes estÃ¡n protegidos o cubiertos?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La zona de recorrido de contrapesos, pÃ©ndulos u otros mecanismos oscilantes estÃ¡ protegida mediante cerramiento?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas estÃ¡n provistas de dispositivos de bloqueo para evitar puesta en marcha accidental y de seÃ±alizaciones de peligro e instrucciones en castellano?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas cuentan con medios visibles y de acceso inmediato para que el operador pueda detenerlas rÃ¡pidamente en caso de urgencia?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas estÃ¡n provistas de barreras, barandillas u otros medios de protecciÃ³n cuando razones de seguridad asÃ­ lo exigen?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿En las tareas que requieren trabajar de pie se dispone de plataforma horizontal que permita el apoyo firme y seguro del trabajador?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas estÃ¡n acondicionadas para minimizar las consecuencias de condiciones climÃ¡ticas desfavorables, vibraciones y demÃ¡s agentes de riesgo?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se evita inspeccionar, engrasar, limpiar o reparar partes de mÃ¡quinas o mecanismos de transmisiÃ³n no protegidos mientras estÃ¡n en movimiento?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se evita operar motores a combustiÃ³n interna en lugares sin salida de gases al exterior y sin adecuada renovaciÃ³n de aire?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La salida de escapes de motores a combustiÃ³n interna evacua gases a la mayor altura posible y estÃ¡n provistos de arrestallamas donde existe riesgo de incendio?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las motosierras o sierras de cadena poseen dispositivos de seguridad, defensas para las manos, frenos de cadena y cadena bien afilada?', v_item_order, 'compliance', true, 13);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-13 Ruido', 12)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-13 Ruido');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo de acuerdo a las mediciones realizadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones de infrasonidos y ultrasonidos y se implementan las correcciones necesarias?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-14 VehÃ­culos Industriales y de Transporte', 13)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-14 VehÃ­culos Industriales y de Transporte');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los vehÃ­culos cuentan con los elementos de seguridad requeridos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Disponen de asientos que neutralicen las vibraciones, con respaldo y apoya pies?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Son adecuadas las cabinas de protecciÃ³n para las inclemencias del tiempo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n protegidos para los riesgos de desplazamiento de cargas?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los vehÃ­culos estÃ¡n equipados con luces, frenos, dispositivo de aviso acÃºstico-luminoso, espejos, cinturÃ³n de seguridad, bocina y matafuegos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realiza un control de uso previo?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra seÃ±alizada la carga mÃ¡xima de operaciÃ³n?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El aspecto exterior e interior es adecuado y estÃ¡ libre de deterioros significativos?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajadores se transportan en forma separada de la carga y no estÃ¡n de pie o sentados en lugares no destinados a tal fin?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los vehÃ­culos de transporte de personal poseen barandas laterales y traseras de al menos 1,50 m, bancos y escalera de acceso?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tractores poseen sistema de frenos capaz de detener el desplazamiento en condiciones de carga mÃ¡xima?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tractores sin cabina poseen guardabarros en las ruedas traseras para proteger al conductor?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tractores poseen chavetas con pasadores o seguros que impidan el desenganche accidental de acoples o remolques?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tractores poseen resistencia equivalente o superior a su carga mÃ¡xima en chavetas, seguros, pasadores y enganches?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tractores poseen estructura de protecciÃ³n capaz de resistir el peso total del equipo cuando existe posibilidad de vuelco?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tractores poseen escalera y pasamanos u otro mecanismo que asegure el fÃ¡cil acceso cuando fuese necesario?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tractores poseen seÃ±alizaciÃ³n de riesgos y colores de seguridad como elementos de prevenciÃ³n de accidentes?', v_item_order, 'compliance', true, 17);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-15 Condiciones HigrotÃ©rmicas', 14)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-15 Condiciones HigrotÃ©rmicas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El personal sometido a estrÃ©s por frÃ­o estÃ¡ protegido adecuadamente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrÃ©s por frÃ­o?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El personal sometido a estrÃ©s tÃ©rmico y tensiÃ³n tÃ©rmica estÃ¡ protegido adecuadamente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se protegen los hornos, calderas, etc., para evitar la acciÃ³n del calor?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n aislados y convenientemente ventilados los aparatos capaces de producir frÃ­o con posibilidad de desprendimiento de contaminantes?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrÃ©s tÃ©rmico y tensiÃ³n tÃ©rmica?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-16 Aparatos para Izar', 15)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-16 Aparatos para Izar');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra identificada la carga mÃ¡xima de los equipos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los ascensores y montacargas cumplen los requisitos y condiciones mÃ¡ximas de seguridad en construcciÃ³n, instalaciÃ³n y mantenimiento?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los ganchos de izar poseen traba de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los elementos auxiliares de elevaciÃ³n se encuentran en buen estado (cadenas, perchas, eslingas, fajas, etc.)?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todos los aparatos para izar, aparejos, puentes grÃºa y transportadores cumplen los requisitos y condiciones mÃ¡ximas de seguridad?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han localizado lÃ­neas de tensiÃ³n elÃ©ctrica que puedan producir arco voltaico o contacto con elementos de izaje o carga?', v_item_order, 'compliance', true, 6);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-17 Radiaciones', 16)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-17 Radiaciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajadores y fuentes generadoras de radiaciones ionizantes (ej. rayos X) cuentan con la autorizaciÃ³n del organismo competente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se lleva el control y registro de las dosis individuales?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los valores hallados se encuentran dentro de lo establecido en la normativa vigente?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajadores expuestos a fuentes de radiaciones no ionizantes (ej. soldadura) estÃ¡n debidamente protegidos?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cumple con la normativa vigente para campos magnÃ©ticos estÃ¡ticos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones de radiofrecuencia y/o microondas en los lugares de trabajo?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones de radiaciÃ³n infrarroja?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones de radiaciÃ³n ultravioleta?', v_item_order, 'compliance', true, 8);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-18 Vibraciones', 17)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-18 Vibraciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-19 Riesgo BiolÃ³gico', 18)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-19 Riesgo BiolÃ³gico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se poseen protocolos actualizados para manejo de riesgos biolÃ³gicos?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-20 Trabajos en la VÃ­a PÃºblica / TrÃ¡nsito', 19)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-20 Trabajos en la VÃ­a PÃºblica / TrÃ¡nsito');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajos realizados en la vÃ­a pÃºblica se realizan de forma segura?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se posee alarma sonoro-lumÃ­nica para el ingreso y egreso de los vehÃ­culos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se seÃ±aliza y se vigila la vÃ­a pÃºblica al momento de operar?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los vehÃ­culos que circulan por la vÃ­a pÃºblica cumplen con la reglamentaciÃ³n?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Elementos de ProtecciÃ³n Personal', 20)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Elementos de ProtecciÃ³n Personal');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se provee a todos los trabajadores de los EPP adecuados a los riesgos a los que estÃ¡n expuestos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen seÃ±alizaciones visibles sobre la obligatoriedad del uso de los EPP en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Primeros Auxilios', 21)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Primeros Auxilios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen botiquines de primeros auxilios acorde a los riesgos existentes?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Silos', 22)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Silos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los silos estÃ¡n montados sobre bases apropiadas, garantizan resistencia a las cargas que soportan y tienen apoyos protegidos contra impactos accidentales en Ã¡reas de circulaciÃ³n vehicular?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Cuentan con guardahombres en las escaleras exteriores verticales de acceso a partir de los 2 metros de altura?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n protegidas las aberturas para evitar caÃ­das de los trabajadores?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ventila el silo previo al ingreso para lograr una atmÃ³sfera apta?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n protegidas las aberturas de descarga e interrupciÃ³n del llenado?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se provee de EPP adecuados (cinturÃ³n de seguridad y cabo de vida sujeto a punto fijo exterior) para las tareas a realizar?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se dispone de una persona en el exterior del silo que pueda auxiliar al trabajador en caso de necesidad?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se instrumentan las medidas de precauciÃ³n para evitar incendios y explosiones durante las tareas?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se evita destrabar o demoler las bÃ³vedas formadas por compactaciÃ³n o humedad del material almacenado, ubicÃ¡ndose debajo o encima de las mismas?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se asegura la estabilidad de las estibas de bolsas para evitar desplazamientos y lesiones a los trabajadores?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'ExplotaciÃ³n Forestal', 23)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'ExplotaciÃ³n Forestal');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se eliminan las malezas y tocones al ras del suelo para facilitar el trabajo seguro y la salida rÃ¡pida del Ã¡rea ante la caÃ­da de un Ã¡rbol?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se prevÃ©n y construyen caminos de acceso y salida adecuados al riesgo de caÃ­das o rodamiento de troncos, ramas o elementos pesados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se impide el ingreso de personas ajenas a la zona de desmonte o tala seÃ±alizada? Â¿Los trabajadores que no participan del volteo se mantienen a distancia radial de seguridad igual al doble de la longitud del Ã¡rbol, con cascos?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Para las labores de poda o desrame el empleador proporciona los elementos de trabajo adecuados?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se fijan o posicionan los Ã¡rboles o troncos caÃ­dos en pendiente para evitar que rueden?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sistemas de arrastre y transporte de troncos estÃ¡n programados y ejecutados de forma que no generen riesgo para la seguridad del personal?', v_item_order, 'compliance', true, 6);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Animales', 24)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Animales');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las viviendas de los trabajadores se encuentran aisladas de los galpones de crÃ­a, boxes o establos con presencia de animales?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han implementado medidas para sujetar y controlar los movimientos de los animales en tratamientos sanitarios, vacunaciones, curaciones, descornado y otras tareas que exijan contacto con el trabajador?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los aperos se encuentran en buen estado de conservaciÃ³n para la utilizaciÃ³n de tracciÃ³n animal?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se evita el contacto directo del trabajador con la mucosa, sangre o excrementos de los animales?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Al finalizar tareas en contacto con animales, el trabajador se higieniza antes de fumar o ingerir alimentos o infusiones?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se dispone de un lugar destinado para la ropa que estuvo en contacto con animales, evitando su contacto con ropa limpia?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se incineran los cadÃ¡veres de animales muertos por enfermedades contagiosas o desconocidas, evitando el contacto con el trabajador?', v_item_order, 'compliance', true, 7);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 2. Checklist AC - AdministraciÃ³n y Comercios
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AC - AdministraciÃ³n y Comercios', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AC - AdministraciÃ³n y Comercios');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-01 ProtecciÃ³n Contra Incendios', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-01 ProtecciÃ³n Contra Incendios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen medios y vÃ­as de escape adecuadas en caso de incendio?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La cantidad y tipo de matafuegos es acorde a la carga de fuego?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen sistemas de detecciÃ³n y extinciÃ³n de incendios?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El depÃ³sito de combustibles cumple con la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se acredita la realizaciÃ³n periÃ³dica de simulacros de evacuaciÃ³n?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se dispone de estanterÃ­as o elementos equivalentes de material no combustible o metÃ¡lico?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se separan en forma alternada los materiales combustibles de los no combustibles y los que puedan reaccionar entre sÃ­?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-02 Peligro ElÃ©ctrico', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-02 Peligro ElÃ©ctrico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n todos los cableados elÃ©ctricos adecuadamente contenidos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los conectores elÃ©ctricos se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tableros elÃ©ctricos cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las tareas de mantenimiento son efectuadas por personal capacitado y autorizado por la empresa?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptan las medidas de seguridad en locales donde se manipulen sustancias corrosivas, inflamables y/o explosivas o de alto riesgo y en locales hÃºmedos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han adoptado medidas para la protecciÃ³n contra riesgos de contactos directos e indirectos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han adoptado medidas para eliminar la electricidad estÃ¡tica en todas las operaciones donde pueda producirse?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Posee instalaciÃ³n para prevenir sobretensiones producidas por descargas atmosfÃ©ricas (pararrayos)?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Poseen las instalaciones tomas a tierra independientes de la instalada para descargas atmosfÃ©ricas?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-03 ErgonomÃ­a', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-03 ErgonomÃ­a');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones ergonÃ³micas son adecuadas en cuanto a levantamiento y descenso de cargas, empujes y arrastres, transporte de cargas, bipedestaciÃ³n, movimientos repetitivos, posturas forzadas y estrÃ©s de contacto?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan los controles administrativos y se proponen mejoras de ingenierÃ­a?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-04 CaÃ­das a Mismo Nivel', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-04 CaÃ­das a Mismo Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sectores de circulaciÃ³n como pasillos, escaleras y pisos son seguros?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n ausentes las irregularidades que puedan provocar caÃ­das y resbalones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todas las escaleras cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todas las plataformas de trabajo y rampas cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-05 IluminaciÃ³n y SeÃ±alizaciÃ³n', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-05 IluminaciÃ³n y SeÃ±alizaciÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cumple con los requisitos de iluminaciÃ³n establecidos en la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha instalado un sistema de iluminaciÃ³n de emergencia acorde a los requerimientos de la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe marcaciÃ³n visible de pasillos, circulaciones de trÃ¡nsito y lugares de cruce donde circulen cargas suspendidas y otros elementos de transporte?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran seÃ±alizados los caminos de evacuaciÃ³n e indicadas las salidas normales y de emergencia?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-06 Espacios de Trabajo', 5)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-06 Espacios de Trabajo');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe orden y limpieza en los puestos de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen depÃ³sitos de residuos en los puestos de trabajo?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se almacenan los productos respetando la distancia mÃ­nima de 1 m entre la parte superior de las estibas y el techo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sistemas de almacenaje permiten una adecuada circulaciÃ³n y son seguros?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-07 VentilaciÃ³n', 6)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-07 VentilaciÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen aberturas que permitan el ingreso de aire?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sistemas de ventilaciÃ³n son adecuados y se encuentran en buen estado de funcionamiento?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-08 Condiciones Edilicias e Infraestructura', 7)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-08 Condiciones Edilicias e Infraestructura');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones edilicias son adecuadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n ausentes los problemas de humedad y filtraciones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las estructuras portantes se encuentran en buen estado?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n ausentes rajaduras de consideraciÃ³n que puedan afectar la estabilidad y resistencia edilicia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El estado de la pintura y revestimientos de la mamposterÃ­a es correcto?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El estado estructural de las barandas, pisos y escaleras es adecuado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe provisiÃ³n de agua potable para el consumo e higiene de los trabajadores?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha evitado el consumo humano del agua destinada a uso industrial?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen baÃ±os aptos higiÃ©nicamente?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen vestuarios aptos higiÃ©nicamente con armarios adecuados e individuales?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen comedores aptos higiÃ©nicamente?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La/s cocina/s reÃºne/n los requisitos establecidos?', v_item_order, 'compliance', true, 12);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-09 ExplosiÃ³n / ASP', 8)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-09 ExplosiÃ³n / ASP');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan los controles e inspecciones periÃ³dicas establecidos en calderas y todo otro aparato sometido a presiÃ³n?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n los cilindros con gases a presiÃ³n adecuadamente almacenados, evitando el almacenamiento excesivo, con capuchÃ³n protector y vÃ¡lvula cerrada?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los cilindros de gases son transportados por medios adecuados?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mangueras, reguladores, manÃ³metros, sopletes y vÃ¡lvulas antirretornos se encuentran en buen estado?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-10 Sustancias QuÃ­micas y Peligrosas', 9)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-10 Sustancias QuÃ­micas y Peligrosas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La fabricaciÃ³n y/o manipuleo de sustancias peligrosas cumplimenta la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran separados los productos incompatibles?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los productos cumplen con el etiquetado de la legislaciÃ³n SGA?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-11 Trabajos en Altura y a Distinto Nivel', 10)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-11 Trabajos en Altura y a Distinto Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n colocadas las barreras fÃ­sicas y/o seÃ±alizaciÃ³n requeridas? (Barandas a 1 m y 0,5 m, plataforma ancho mÃ­nimo 60 cm, zÃ³calo de 15 cm.)', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen escaleras adecuadas de ascenso a las estructuras?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra correctamente seÃ±alizada el Ã¡rea de trabajo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las aberturas y huecos se encuentran protegidos?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las estructuras en las cuales se desarrollan las tareas son resistentes y estables?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-12 MÃ¡quinas, Herramientas y Equipos', 11)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-12 MÃ¡quinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las herramientas estÃ¡n en estado de conservaciÃ³n adecuado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La empresa provee herramientas aptas y seguras?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las herramientas corto-punzantes poseen fundas o vainas?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe un lugar destinado para la ubicaciÃ³n ordenada de las herramientas?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las herramientas portÃ¡tiles elÃ©ctricas poseen protecciones para evitar riesgos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todas las mÃ¡quinas y herramientas cuentan con protecciones para evitar riesgos al trabajador?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen dispositivos de parada de emergencia?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han previsto sistemas de bloqueo de las mÃ¡quinas para operaciones de mantenimiento?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas elÃ©ctricas tienen sistema de puesta a tierra?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-13 Ruido', 12)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-13 Ruido');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo de acuerdo a las mediciones realizadas?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-16 Aparatos para Izar', 13)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-16 Aparatos para Izar');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra identificada la carga mÃ¡xima de los equipos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los ascensores y montacargas cumplen los requisitos y condiciones mÃ¡ximas de seguridad en construcciÃ³n, instalaciÃ³n y mantenimiento?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los ganchos de izar poseen traba de seguridad?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-19 Riesgo BiolÃ³gico', 14)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-19 Riesgo BiolÃ³gico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se poseen protocolos actualizados para manejo de riesgos biolÃ³gicos?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-20 Trabajos en la VÃ­a PÃºblica / TrÃ¡nsito', 15)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-20 Trabajos en la VÃ­a PÃºblica / TrÃ¡nsito');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajos realizados en la vÃ­a pÃºblica se realizan de forma segura?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se posee alarma sonoro-lumÃ­nica para el ingreso y egreso de los vehÃ­culos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se seÃ±aliza y se vigila la vÃ­a pÃºblica al momento de operar?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los vehÃ­culos que circulan por la vÃ­a pÃºblica cumplen con la reglamentaciÃ³n?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Elementos de ProtecciÃ³n Personal', 16)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Elementos de ProtecciÃ³n Personal');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se provee a todos los trabajadores de los EPP adecuados a los riesgos a los que estÃ¡n expuestos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen seÃ±alizaciones visibles sobre la obligatoriedad del uso de los EPP en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Primeros Auxilios', 17)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Primeros Auxilios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen botiquines de primeros auxilios acorde a los riesgos existentes?', v_item_order, 'compliance', true, 1);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 3. Checklist CEG - Control de EPP (GestiÃ³n)
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist CEG - Control de EPP (GestiÃ³n)', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist CEG - Control de EPP (GestiÃ³n)');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'GestiÃ³n', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'GestiÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las entregas de los EPP son registradas segÃºn la planilla Res. SRT 299/11 y se encuentran debidamente completas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se posee una Matriz de EPP por puestos de trabajo?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se capacita al personal en el correcto uso y conservaciÃ³n de los EPP?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Uso y ConservaciÃ³n de EPPs', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Uso y ConservaciÃ³n de EPPs');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se entregan todos los EPP de acuerdo a los peligros y riesgos a los cuales el personal estÃ¡ expuesto?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se utilizan correctamente los EPP entregados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El personal que utiliza EPP los guarda, conserva y mantiene de forma adecuada y en buen estado?', v_item_order, 'compliance', true, 3);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 4. Checklist RGO - Relevamiento General de Obra
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist RGO - Relevamiento General de Obra', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist RGO - Relevamiento General de Obra');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-01 ProtecciÃ³n Contra Incendios', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-01 ProtecciÃ³n Contra Incendios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen medios y vÃ­as de escape adecuadas en caso de incendio?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La cantidad y tipo de matafuegos es acorde a la carga de fuego?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajos en caliente se realizan en forma segura?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El depÃ³sito de combustibles cumple con la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se acredita la realizaciÃ³n periÃ³dica de simulacros de evacuaciÃ³n?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se separan en forma alternada los materiales combustibles de los no combustibles y los que puedan reaccionar entre sÃ­?', v_item_order, 'compliance', true, 6);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-02 Peligro ElÃ©ctrico', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-02 Peligro ElÃ©ctrico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n todos los cableados elÃ©ctricos adecuadamente contenidos? (AÃ©reos a no menos de 2,40 m de altura o subterrÃ¡neos.)', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los conectores elÃ©ctricos se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tableros elÃ©ctricos cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las tareas de mantenimiento son efectuadas por personal capacitado y autorizado por la empresa?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptan las medidas de seguridad en locales donde se manipulen sustancias corrosivas, inflamables y/o explosivas o de alto riesgo y en locales hÃºmedos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han adoptado medidas para la protecciÃ³n contra riesgos de contactos directos e indirectos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han adoptado medidas para eliminar la electricidad estÃ¡tica en todas las operaciones donde pueda producirse?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Posee instalaciÃ³n para prevenir sobretensiones producidas por descargas atmosfÃ©ricas (pararrayos)?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Poseen las instalaciones tomas a tierra independientes de la instalada para descargas atmosfÃ©ricas?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-03 ErgonomÃ­a', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-03 ErgonomÃ­a');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones ergonÃ³micas son adecuadas en cuanto a levantamiento y descenso de cargas, empujes y arrastres, transporte de cargas, bipedestaciÃ³n, movimientos repetitivos, posturas forzadas y estrÃ©s de contacto?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan los controles administrativos y se proponen mejoras de ingenierÃ­a?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-04 CaÃ­das a Mismo Nivel', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-04 CaÃ­das a Mismo Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sectores de circulaciÃ³n como pasillos, escaleras y pisos son seguros?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n ausentes las irregularidades que puedan provocar caÃ­das y resbalones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todas las escaleras cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todas las plataformas de trabajo y rampas cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-05 IluminaciÃ³n y SeÃ±alizaciÃ³n', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-05 IluminaciÃ³n y SeÃ±alizaciÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cumple con los requisitos de iluminaciÃ³n establecidos en la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha instalado un sistema de iluminaciÃ³n de emergencia acorde a los requerimientos de la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe marcaciÃ³n visible de pasillos, circulaciones de trÃ¡nsito y lugares de cruce donde circulen cargas suspendidas y otros elementos de transporte?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran seÃ±alizados los caminos de evacuaciÃ³n e indicadas las salidas normales y de emergencia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran identificadas las caÃ±erÃ­as?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-06 Espacios de Trabajo', 5)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-06 Espacios de Trabajo');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe orden y limpieza en los puestos de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen depÃ³sitos de residuos en los puestos de trabajo?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se almacenan los productos respetando la distancia mÃ­nima de 1 m entre la parte superior de las estibas y el techo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sistemas de almacenaje y acopio de materiales permiten una adecuada circulaciÃ³n y son seguros?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-07 VentilaciÃ³n', 6)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-07 VentilaciÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen aberturas que permitan el ingreso de aire?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sistemas de ventilaciÃ³n son adecuados y se encuentran en buen estado de funcionamiento?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-08 Condiciones Edilicias e Infraestructura', 7)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-08 Condiciones Edilicias e Infraestructura');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones edilicias son adecuadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las estructuras portantes se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n ausentes rajaduras de consideraciÃ³n que puedan afectar la estabilidad y resistencia edilicia?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe provisiÃ³n de agua potable para el consumo e higiene de los trabajadores?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen baÃ±os en cantidad apropiada segÃºn la cantidad de trabajadores y son aptos higiÃ©nicamente?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen vestuarios aptos higiÃ©nicamente con armarios adecuados e individuales?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen comedores aptos higiÃ©nicamente?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-09 ExplosiÃ³n / ASP', 8)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-09 ExplosiÃ³n / ASP');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan los controles e inspecciones periÃ³dicas establecidos en calderas y todo otro aparato sometido a presiÃ³n?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n los cilindros con gases a presiÃ³n adecuadamente almacenados, evitando el almacenamiento excesivo, con capuchÃ³n protector y vÃ¡lvula cerrada?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los cilindros de gases son transportados por medios adecuados?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Disponen de vÃ¡lvula de seguridad y disco de ruptura instalados en condiciones correctas de uso?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se dispone de vÃ¡lvulas de bloqueo y parada para emergencias, dispositivos de purga y vÃ¡lvula de retenciÃ³n?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mangueras, reguladores, manÃ³metros, sopletes y vÃ¡lvulas antirretornos se encuentran en buen estado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tubos de acetileno y oxÃ­geno disponen de vÃ¡lvula antiretroceso de llama?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Cuenta el operador con la capacitaciÃ³n y/o habilitaciÃ³n pertinente?', v_item_order, 'compliance', true, 8);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-10 Sustancias QuÃ­micas y Peligrosas', 9)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-10 Sustancias QuÃ­micas y Peligrosas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La fabricaciÃ³n y/o manipuleo de sustancias peligrosas cumplimenta la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha seÃ±alizado y resguardado la zona o los elementos afectados ante casos de derrame de sustancias corrosivas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran separados los productos incompatibles?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los productos cumplen con el etiquetado de la legislaciÃ³n SGA?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen duchas de emergencia y/o lava ojos en los sectores con productos peligrosos?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-11 Trabajos en Altura y a Distinto Nivel', 10)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-11 Trabajos en Altura y a Distinto Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones de viento, atmÃ³sfera y estado del suelo permiten realizar el trabajo con seguridad?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n colocadas las barreras fÃ­sicas y/o seÃ±alizaciÃ³n requeridas? (Barandas a 1 m y 0,5 m, plataforma ancho mÃ­nimo 60 cm, zÃ³calo de 15 cm.)', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen redes salvavidas a 3 m por debajo del plano de trabajo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen escaleras adecuadas de ascenso y descenso a las estructuras?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra correctamente seÃ±alizada el Ã¡rea de trabajo?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las aberturas y huecos se encuentran protegidos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las estructuras en las cuales se desarrollan las tareas son resistentes y estables?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los andamios poseen adecuada rigidez, resistencia y estabilidad, asegurando inmovilidad lateral y vertical?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿En silletas, los asientos son de 0,60 x 0,30 m con topes para evitar golpes contra el muro y la eslinga o soga es pasante por al menos 4 agujeros o puntos?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿En silletas y andamios colgantes se usa cinturÃ³n de seguridad anclado a punto fijo independiente?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las escaleras sobrepasan 1 m el lugar de acceso?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las escaleras de 2 hojas no superan los 6 m de longitud?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las escaleras extensibles poseen superposiciÃ³n de 1 m entre tramos?', v_item_order, 'compliance', true, 13);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-12 MÃ¡quinas, Herramientas y Equipos', 11)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-12 MÃ¡quinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las herramientas estÃ¡n en estado de conservaciÃ³n adecuado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La empresa provee herramientas aptas y seguras?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las herramientas corto-punzantes poseen fundas o vainas?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe un lugar destinado para la ubicaciÃ³n ordenada de las herramientas?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las herramientas portÃ¡tiles elÃ©ctricas poseen protecciones para evitar riesgos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las herramientas neumÃ¡ticas e hidrÃ¡ulicas poseen vÃ¡lvulas de cierre automÃ¡tico al dejar de accionarlas?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todas las mÃ¡quinas y herramientas cuentan con protecciones para evitar riesgos al trabajador?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen dispositivos de parada de emergencia?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas elÃ©ctricas tienen sistema de puesta a tierra?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se utilizan pantallas para la proyecciÃ³n de partÃ­culas y chispas al soldar?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las salientes y partes mÃ³viles de mÃ¡quinas y/o instalaciones cuentan con seÃ±alizaciÃ³n y protecciÃ³n?', v_item_order, 'compliance', true, 11);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-13 Ruido', 12)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-13 Ruido');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo de acuerdo a las mediciones realizadas?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-14 VehÃ­culos Industriales', 13)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-14 VehÃ­culos Industriales');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los vehÃ­culos cuentan con los elementos de seguridad requeridos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Disponen de asientos que neutralicen las vibraciones, con respaldo y apoya pies?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Son adecuadas las cabinas de protecciÃ³n para las inclemencias del tiempo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Son adecuadas las cabinas para proteger del riesgo de vuelco?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n protegidos para los riesgos de desplazamiento de cargas?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los vehÃ­culos estÃ¡n equipados con luces, frenos, dispositivo de aviso acÃºstico-luminoso, espejos, cinturÃ³n de seguridad, bocina y matafuegos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realiza un control de uso previo?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra seÃ±alizada la carga mÃ¡xima de operaciÃ³n?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El aspecto exterior e interior es adecuado y estÃ¡ libre de deterioros significativos?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se usa cÃ³digo de seÃ±ales para comunicarse y el Ã¡rea de desplazamiento estÃ¡ seÃ±alizada, prohibiendo el paso de personas durante la tarea?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-15 Condiciones HigrotÃ©rmicas', 14)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-15 Condiciones HigrotÃ©rmicas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El personal sometido a estrÃ©s por frÃ­o estÃ¡ protegido adecuadamente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrÃ©s por frÃ­o?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El personal sometido a estrÃ©s tÃ©rmico y tensiÃ³n tÃ©rmica estÃ¡ protegido adecuadamente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrÃ©s tÃ©rmico y tensiÃ³n tÃ©rmica?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-16 Aparatos para Izar', 15)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-16 Aparatos para Izar');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra identificada la carga mÃ¡xima de los equipos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los ascensores y montacargas cumplen los requisitos y condiciones mÃ¡ximas de seguridad en construcciÃ³n, instalaciÃ³n y mantenimiento?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los huecos se encuentran protegidos con mallas o rejas para evitar caÃ­da de personas o cosas?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los ganchos de izar poseen traba de seguridad?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los elementos auxiliares de elevaciÃ³n se encuentran en buen estado (cadenas, perchas, eslingas, fajas, etc.)?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todos los aparatos para izar, aparejos, puentes grÃºa y transportadores cumplen los requisitos y condiciones mÃ¡ximas de seguridad?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han localizado lÃ­neas de tensiÃ³n elÃ©ctrica que puedan producir arco voltaico o contacto con elementos de izaje o carga?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Es necesario realizar un Plan de Izaje?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La condiciÃ³n del suelo es segura?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-17 Radiaciones', 16)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-17 Radiaciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se lleva el control y registro de las dosis individuales?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los valores hallados se encuentran dentro de lo establecido en la normativa vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajadores expuestos a fuentes de radiaciones no ionizantes (ej. soldadura) estÃ¡n debidamente protegidos?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-18 Vibraciones', 17)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-18 Vibraciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-19 Riesgo BiolÃ³gico', 18)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-19 Riesgo BiolÃ³gico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se poseen protocolos actualizados para manejo de riesgos biolÃ³gicos?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-20 Trabajos en la VÃ­a PÃºblica / TrÃ¡nsito', 19)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-20 Trabajos en la VÃ­a PÃºblica / TrÃ¡nsito');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajos realizados en la vÃ­a pÃºblica se realizan de forma segura?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se posee alarma sonoro-lumÃ­nica para el ingreso y egreso de los vehÃ­culos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se seÃ±aliza y se vigila la vÃ­a pÃºblica al momento de operar?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los vehÃ­culos que circulan por la vÃ­a pÃºblica cumplen con la reglamentaciÃ³n?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Elementos de ProtecciÃ³n Personal', 20)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Elementos de ProtecciÃ³n Personal');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se provee a todos los trabajadores de los EPP adecuados a los riesgos a los que estÃ¡n expuestos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen seÃ±alizaciones visibles sobre la obligatoriedad del uso de los EPP en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Primeros Auxilios', 21)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Primeros Auxilios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen botiquines de primeros auxilios acorde a los riesgos existentes?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Trabajos de DemoliciÃ³n y ExcavaciÃ³n', 22)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Trabajos de DemoliciÃ³n y ExcavaciÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se interrumpieron los servicios de gas, luz y electricidad previo al inicio de los trabajos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se respeta la distancia de seguridad de la zona de demoliciÃ³n?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizÃ³ el apuntalamiento de muros medianeros?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones de seguridad son verificadas por un responsable habilitado antes de comenzar cada jornada y queda documentado?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se verificÃ³ la resistencia del suelo en los bordes de la excavaciÃ³n?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Ante riesgo de desprendimientos se colocaron tablaestacas o entibados?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se utilizan escaleras para excavaciones con profundidad mayor a 1 m?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajadores en el fondo de pozo mantienen una distancia mÃ­nima de la mÃ¡quina igual a 2 veces el largo del brazo?', v_item_order, 'compliance', true, 8);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Trabajos con HormigÃ³n', 23)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Trabajos con HormigÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los materiales utilizados en encofrados son de buena calidad?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los apuntalamientos de madera tienen un mÃ¡ximo de un empalme por puntal?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las operaciones de pretensados estÃ¡n protegidas por pantallas?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las caÃ±erÃ­as de bombeo estÃ¡n sÃ³lidamente amarradas y cuentan con vÃ¡lvula de escape de aire?', v_item_order, 'compliance', true, 4);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 5. Checklist DO - DocumentaciÃ³n
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist DO - DocumentaciÃ³n', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist DO - DocumentaciÃ³n');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'GestiÃ³n', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'GestiÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El Legajo de Higiene y Seguridad se encuentra actualizado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe un Programa de GestiÃ³n de HyS vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe un Programa de Seguimiento de Observaciones y Acciones?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con la EvaluaciÃ³n de Riesgos actualizada?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con la Matriz de EPP actualizada?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se llevan los registros de entrega de EPP conforme a la Res. SRT 299/11?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se elaboran los Informes de GestiÃ³n de HyS?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan investigaciones de accidentes y se llevan estadÃ­sticas actualizadas?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran los controles y recorridas de HyS?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con procedimientos e instructivos de HyS vigentes?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Presentaciones / Inscripciones', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Presentaciones / Inscripciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra presentado el RGRL ante la ART?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra presentado el RAR ante la ART?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizÃ³ el Aviso de Obra?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El Programa de Seguridad estÃ¡ aprobado por la ART y la nÃ³mina de trabajadores estÃ¡ actualizada?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cumple con la presentaciÃ³n exigida por la Res. SRT 81/19 sobre agentes cancerÃ­genos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran al dÃ­a las demÃ¡s presentaciones ante ART, organismos provinciales y municipales?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El Afiche de la ART se encuentra colocado en lugar visible?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los ascensores y montacargas cuentan con la documentaciÃ³n reglamentaria vigente?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con el anÃ¡lisis fÃ­sico-quÃ­mico y bacteriolÃ³gico de agua actualizado?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizÃ³ la limpieza de tanques con la frecuencia reglamentaria?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizÃ³ la desinsectaciÃ³n con la frecuencia reglamentaria?', v_item_order, 'compliance', true, 11);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Mediciones', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Mediciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran vigentes las mediciones de iluminaciÃ³n?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran vigentes las mediciones de ruido?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran vigentes las mediciones de carga tÃ©rmica?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran vigentes las mediciones de ergonomÃ­a?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran vigentes las mediciones de PAT (puesta a tierra)?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran vigentes las mediciones de vibraciones?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran vigentes las mediciones de ASP (atmÃ³sferas con riesgo de explosiÃ³n)?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran vigentes las mediciones de medio ambiente laboral?', v_item_order, 'compliance', true, 8);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'ProtecciÃ³n contra Incendios', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'ProtecciÃ³n contra Incendios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con Plan de EvacuaciÃ³n actualizado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los roles de emergencia se encuentran actualizados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se acredita la realizaciÃ³n de simulacros con la frecuencia requerida?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con el Registro IFCI actualizado (solo CABA)?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizÃ³ el cÃ¡lculo de carga de fuego?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Sustancias QuÃ­micas', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Sustancias QuÃ­micas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con las Fichas de Datos de Seguridad (FDS) de todos los productos peligrosos utilizados?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los productos peligrosos cumplen con el etiquetado requerido?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Capacitaciones', 5)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Capacitaciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe un Programa de CapacitaciÃ³n anual vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se llevan los registros de capacitaciÃ³n actualizados?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Registros de Mantenimiento', 6)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Registros de Mantenimiento');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe un Programa de Mantenimiento vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se llevan los registros de mantenimiento actualizados?', v_item_order, 'compliance', true, 2);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 6. Checklist IE - Instalaciones ElÃ©ctricas
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IE - Instalaciones ElÃ©ctricas', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IE - Instalaciones ElÃ©ctricas');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'General - Tableros', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'General - Tableros');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tableros cumplen con las condiciones de seguridad requeridas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El estado general del gabinete es adecuado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El gabinete cuenta con puesta a tierra?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La seÃ±alizaciÃ³n del tablero es correcta y estÃ¡ completa?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las protecciones (disyuntores y llaves termomagnÃ©ticas) son adecuadas y estÃ¡n en buen estado?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las bandejas portacables se encuentran en buen estado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tomacorrientes se encuentran en buen estado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los interruptores se encuentran en buen estado?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mediciones de puesta a tierra y continuidad estÃ¡n realizadas y dentro de los valores admisibles?', v_item_order, 'compliance', true, 9);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 7. Checklist AU - Autoelevadores
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AU - Autoelevadores', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AU - Autoelevadores');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'General', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'General');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El aspecto general exterior del autoelevador es adecuado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los neumÃ¡ticos / ruedas se encuentran en buen estado (estado, presiÃ³n, bulones)?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La jaula antivuelco se encuentra en buen estado?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las luces funcionan correctamente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los espejos retrovisores laterales derecho e izquierdo estÃ¡n presentes y en buen estado?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El sistema de escape / arrestallamas se encuentra en buen estado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El nivel de aceite es el adecuado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El nivel de agua es el adecuado?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El nivel de lÃ­quido de frenos es el adecuado?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La baterÃ­a y sus conexiones se encuentran en buen estado?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La direcciÃ³n funciona correctamente?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los frenos funcionan correctamente?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El freno de mano / emergencia funciona correctamente?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El mÃ¡stil se encuentra en buen estado?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las uÃ±as / horquillas se encuentran en buen estado?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El aspecto general interior es adecuado?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El asiento se encuentra en buen estado?', v_item_order, 'compliance', true, 17);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El cinturÃ³n de seguridad estÃ¡ presente y en buen estado?', v_item_order, 'compliance', true, 18);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La bocina funciona correctamente?', v_item_order, 'compliance', true, 19);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La alarma sonora de retroceso funciona correctamente?', v_item_order, 'compliance', true, 20);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El matafuego estÃ¡ presente, con presiÃ³n adecuada y sin vencimiento?', v_item_order, 'compliance', true, 21);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las placas indicadoras de carga estÃ¡n presentes y son legibles?', v_item_order, 'compliance', true, 22);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 8. Checklist RGI - Relevamiento General de Industria
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist RGI - Relevamiento General de Industria', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist RGI - Relevamiento General de Industria');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-01 ProtecciÃ³n Contra Incendios', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-01 ProtecciÃ³n Contra Incendios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen medios y vÃ­as de escape adecuadas en caso de incendio?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La cantidad y tipo de matafuegos es acorde a la carga de fuego?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen sistemas de detecciÃ³n y extinciÃ³n de incendios?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El depÃ³sito de combustibles cumple con la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se acredita la realizaciÃ³n periÃ³dica de simulacros de evacuaciÃ³n?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se dispone de estanterÃ­as o elementos equivalentes de material no combustible o metÃ¡lico?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se separan en forma alternada los materiales combustibles de los no combustibles y los que puedan reaccionar entre sÃ­?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-02 Peligro ElÃ©ctrico', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-02 Peligro ElÃ©ctrico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n todos los cableados elÃ©ctricos adecuadamente contenidos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los conectores elÃ©ctricos se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tableros elÃ©ctricos cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las tareas de mantenimiento son efectuadas por personal capacitado y autorizado por la empresa?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptan las medidas de seguridad en locales donde se manipulen sustancias corrosivas, inflamables y/o explosivas o de alto riesgo y en locales hÃºmedos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han adoptado medidas para la protecciÃ³n contra riesgos de contactos directos e indirectos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han adoptado medidas para eliminar la electricidad estÃ¡tica en todas las operaciones donde pueda producirse?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Posee instalaciÃ³n para prevenir sobretensiones producidas por descargas atmosfÃ©ricas (pararrayos)?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Poseen las instalaciones tomas a tierra independientes de la instalada para descargas atmosfÃ©ricas?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-03 ErgonomÃ­a', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-03 ErgonomÃ­a');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones ergonÃ³micas son adecuadas en cuanto a levantamiento y descenso de cargas, empujes y arrastres, transporte de cargas, bipedestaciÃ³n, movimientos repetitivos, posturas forzadas y estrÃ©s de contacto?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan los controles administrativos y se proponen mejoras de ingenierÃ­a?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-04 CaÃ­das a Mismo Nivel', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-04 CaÃ­das a Mismo Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sectores de circulaciÃ³n como pasillos, escaleras y pisos son seguros?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n ausentes las irregularidades que puedan provocar caÃ­das y resbalones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todas las escaleras cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todas las plataformas de trabajo y rampas cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-05 IluminaciÃ³n y SeÃ±alizaciÃ³n', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-05 IluminaciÃ³n y SeÃ±alizaciÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cumple con los requisitos de iluminaciÃ³n establecidos en la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha instalado un sistema de iluminaciÃ³n de emergencia acorde a los requerimientos de la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe marcaciÃ³n visible de pasillos, circulaciones de trÃ¡nsito y lugares de cruce donde circulen cargas suspendidas y otros elementos de transporte?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran seÃ±alizados los caminos de evacuaciÃ³n e indicadas las salidas normales y de emergencia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran identificadas las caÃ±erÃ­as?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-06 Espacios de Trabajo', 5)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-06 Espacios de Trabajo');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe orden y limpieza en los puestos de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen depÃ³sitos de residuos en los puestos de trabajo?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se almacenan los productos respetando la distancia mÃ­nima de 1 m entre la parte superior de las estibas y el techo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sistemas de almacenaje permiten una adecuada circulaciÃ³n y son seguros?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿En los almacenajes a granel, las estibas cuentan con elementos de contenciÃ³n?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-07 VentilaciÃ³n', 6)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-07 VentilaciÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen aberturas que permitan el ingreso de aire?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los sistemas de ventilaciÃ³n son adecuados y se encuentran en buen estado de funcionamiento?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-08 Condiciones Edilicias e Infraestructura', 7)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-08 Condiciones Edilicias e Infraestructura');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones edilicias son adecuadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n ausentes los problemas de humedad y filtraciones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las estructuras portantes se encuentran en buen estado?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n ausentes rajaduras de consideraciÃ³n que puedan afectar la estabilidad y resistencia edilicia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El estado de la pintura y revestimientos de la mamposterÃ­a es correcto?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El estado estructural de las barandas, pisos y escaleras es adecuado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe provisiÃ³n de agua potable para el consumo e higiene de los trabajadores?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha evitado el consumo humano del agua destinada a uso industrial?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen baÃ±os aptos higiÃ©nicamente?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen vestuarios aptos higiÃ©nicamente con armarios adecuados e individuales?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen comedores aptos higiÃ©nicamente?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La/s cocina/s reÃºne/n los requisitos establecidos?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los desagÃ¼es industriales se recogen y canalizan por conductos, impidiendo su libre escurrimiento?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha evitado el contacto de lÃ­quidos que puedan reaccionar originando desprendimiento de gases tÃ³xicos o contaminantes?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Son evacuados los efluentes a plantas de tratamiento?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se limpia periÃ³dicamente la planta de tratamiento con las precauciones de protecciÃ³n necesarias para el personal?', v_item_order, 'compliance', true, 16);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-09 ExplosiÃ³n / ASP', 8)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-09 ExplosiÃ³n / ASP');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan los controles e inspecciones periÃ³dicas establecidos en calderas y todo otro aparato sometido a presiÃ³n?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han fijado las instrucciones detalladas con esquemas de la instalaciÃ³n y los procedimientos operativos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n los cilindros con gases a presiÃ³n adecuadamente almacenados, evitando el almacenamiento excesivo, con capuchÃ³n protector y vÃ¡lvula cerrada?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los cilindros de gases son transportados por medios adecuados?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Disponen de vÃ¡lvula de seguridad y disco de ruptura instalados en condiciones correctas de uso?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se dispone de vÃ¡lvulas de bloqueo y parada para emergencias, dispositivos de purga y vÃ¡lvula de retenciÃ³n?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mangueras, reguladores, manÃ³metros, sopletes y vÃ¡lvulas antirretornos se encuentran en buen estado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tubos de acetileno y oxÃ­geno disponen de vÃ¡lvula antiretroceso de llama?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Cuenta el operador con la capacitaciÃ³n y/o habilitaciÃ³n pertinente?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-10 Sustancias QuÃ­micas y Peligrosas', 9)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-10 Sustancias QuÃ­micas y Peligrosas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La fabricaciÃ³n y/o manipuleo de sustancias peligrosas cumplimenta la legislaciÃ³n vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las instalaciones y equipos se encuentran protegidos contra el efecto corrosivo de las sustancias empleadas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen dispositivos de alarma acÃºsticos y visuales donde se manipulen sustancias infectantes y/o contaminantes?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha seÃ±alizado y resguardado la zona o los elementos afectados ante casos de derrame de sustancias corrosivas?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentran separados los productos incompatibles?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los productos cumplen con el etiquetado de la legislaciÃ³n SGA?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen duchas de emergencia y/o lava ojos en los sectores con productos peligrosos?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿En atmÃ³sferas inflamables la instalaciÃ³n elÃ©ctrica es antiexplosiva?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe un sistema para control de derrames de productos peligrosos?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se confeccionÃ³ un plan de seguridad para casos de emergencia y se colocÃ³ en lugar visible?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-11 Trabajos en Altura y a Distinto Nivel', 10)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-11 Trabajos en Altura y a Distinto Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones de viento, atmÃ³sfera y estado del suelo permiten realizar el trabajo con seguridad?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n colocadas las barreras fÃ­sicas y/o seÃ±alizaciÃ³n requeridas? (Barandas a 1 m y 0,5 m, plataforma ancho mÃ­nimo 60 cm, zÃ³calo de 15 cm.)', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen escaleras adecuadas de ascenso a las estructuras?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra correctamente seÃ±alizada el Ã¡rea de trabajo?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las aberturas y huecos se encuentran protegidos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las estructuras en las cuales se desarrollan las tareas son resistentes y estables?', v_item_order, 'compliance', true, 6);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-12 MÃ¡quinas, Herramientas y Equipos', 11)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-12 MÃ¡quinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los volantes, correas, ejes, mecanismos de transmisiÃ³n, salientes y cigÃ¼eÃ±ales estÃ¡n cubiertos para eliminar la posibilidad de contacto con las partes en movimiento?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los extremos de ejes de transmisiÃ³n que sobresalen en mÃ¡s de un tercio de su diÃ¡metro estÃ¡n protegidos o redondeados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los elementos o partes mÃ³viles que pudieran producir atrapamientos, aplastamientos o cortes estÃ¡n protegidos o cubiertos?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La zona de recorrido de contrapesos, pÃ©ndulos u otros mecanismos oscilantes estÃ¡ protegida mediante cerramiento?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas estÃ¡n provistas de dispositivos de bloqueo para evitar puesta en marcha accidental y de seÃ±alizaciones de peligro e instrucciones en castellano?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas cuentan con medios visibles y de acceso inmediato para que el operador pueda detenerlas rÃ¡pidamente en caso de urgencia?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas estÃ¡n provistas de barreras, barandillas u otros medios de protecciÃ³n cuando razones de seguridad asÃ­ lo exigen?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿En las tareas que requieren trabajar de pie se dispone de plataforma horizontal que permita el apoyo firme y seguro del trabajador?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas estÃ¡n acondicionadas para minimizar las consecuencias de condiciones climÃ¡ticas desfavorables, vibraciones y demÃ¡s agentes de riesgo?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se evita inspeccionar, engrasar, limpiar o reparar partes de mÃ¡quinas o mecanismos de transmisiÃ³n no protegidos mientras estÃ¡n en movimiento?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se evita operar motores a combustiÃ³n interna en lugares sin salida de gases al exterior y sin adecuada renovaciÃ³n de aire?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La salida de escapes de motores a combustiÃ³n interna evacua gases a la mayor altura posible y estÃ¡n provistos de arrestallamas donde existe riesgo de incendio?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las motosierras o sierras de cadena poseen dispositivos de seguridad, defensas para las manos, frenos de cadena y cadena bien afilada?', v_item_order, 'compliance', true, 13);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-13 Ruido', 12)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-13 Ruido');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo de acuerdo a las mediciones realizadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones de infrasonidos y ultrasonidos y se implementan las correcciones necesarias?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-14 VehÃ­culos Industriales', 13)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-14 VehÃ­culos Industriales');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los vehÃ­culos cuentan con los elementos de seguridad requeridos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Disponen de asientos que neutralicen las vibraciones, con respaldo y apoya pies?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Son adecuadas las cabinas de protecciÃ³n para las inclemencias del tiempo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Son adecuadas las cabinas para proteger del riesgo de vuelco?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n protegidos para los riesgos de desplazamiento de cargas?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los vehÃ­culos estÃ¡n equipados con luces, frenos, dispositivo de aviso acÃºstico-luminoso, espejos, cinturÃ³n de seguridad, bocina y matafuegos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realiza un control de uso previo?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra seÃ±alizada la carga mÃ¡xima de operaciÃ³n?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El aspecto exterior e interior es adecuado y estÃ¡ libre de deterioros significativos?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-15 Condiciones HigrotÃ©rmicas', 14)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-15 Condiciones HigrotÃ©rmicas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El personal sometido a estrÃ©s por frÃ­o estÃ¡ protegido adecuadamente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrÃ©s por frÃ­o?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El personal sometido a estrÃ©s tÃ©rmico y tensiÃ³n tÃ©rmica estÃ¡ protegido adecuadamente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se protegen los hornos, calderas, etc., para evitar la acciÃ³n del calor?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿EstÃ¡n aislados y convenientemente ventilados los aparatos capaces de producir frÃ­o con posibilidad de desprendimiento de contaminantes?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrÃ©s tÃ©rmico y tensiÃ³n tÃ©rmica?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-16 Aparatos para Izar', 15)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-16 Aparatos para Izar');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra identificada la carga mÃ¡xima de los equipos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los ascensores y montacargas cumplen los requisitos y condiciones mÃ¡ximas de seguridad en construcciÃ³n, instalaciÃ³n y mantenimiento?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los ganchos de izar poseen traba de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los elementos auxiliares de elevaciÃ³n se encuentran en buen estado (cadenas, perchas, eslingas, fajas, etc.)?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todos los aparatos para izar, aparejos, puentes grÃºa y transportadores cumplen los requisitos y condiciones mÃ¡ximas de seguridad?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han localizado lÃ­neas de tensiÃ³n elÃ©ctrica que puedan producir arco voltaico o contacto con elementos de izaje o carga?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los huecos se encuentran protegidos con mallas o rejas para evitar caÃ­da de personas o cosas?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Es necesario realizar un Plan de Izaje?', v_item_order, 'compliance', true, 8);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-17 Radiaciones', 16)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-17 Radiaciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajadores y fuentes generadoras de radiaciones ionizantes (ej. rayos X) cuentan con la autorizaciÃ³n del organismo competente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se lleva el control y registro de las dosis individuales?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los valores hallados se encuentran dentro de lo establecido en la normativa vigente?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajadores expuestos a fuentes de radiaciones no ionizantes (ej. soldadura) estÃ¡n debidamente protegidos?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cumple con la normativa vigente para campos magnÃ©ticos estÃ¡ticos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones de radiofrecuencia y/o microondas en los lugares de trabajo?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones de radiaciÃ³n infrarroja?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones de radiaciÃ³n ultravioleta?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones de radiaciÃ³n infrarroja?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran las mediciones de radiaciÃ³n ultravioleta?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cumple con la normativa vigente para campos magnÃ©ticos estÃ¡ticos?', v_item_order, 'compliance', true, 11);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-18 Vibraciones', 17)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-18 Vibraciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-19 Riesgo BiolÃ³gico', 18)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-19 Riesgo BiolÃ³gico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se poseen protocolos actualizados para manejo de riesgos biolÃ³gicos?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-20 Trabajos en la VÃ­a PÃºblica / TrÃ¡nsito', 19)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-20 Trabajos en la VÃ­a PÃºblica / TrÃ¡nsito');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los trabajos realizados en la vÃ­a pÃºblica se realizan de forma segura?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se posee alarma sonoro-lumÃ­nica para el ingreso y egreso de los vehÃ­culos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se seÃ±aliza y se vigila la vÃ­a pÃºblica al momento de operar?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los vehÃ­culos que circulan por la vÃ­a pÃºblica cumplen con la reglamentaciÃ³n?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Elementos de ProtecciÃ³n Personal', 20)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Elementos de ProtecciÃ³n Personal');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se provee a todos los trabajadores de los EPP adecuados a los riesgos a los que estÃ¡n expuestos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen seÃ±alizaciones visibles sobre la obligatoriedad del uso de los EPP en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Primeros Auxilios', 21)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Primeros Auxilios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen botiquines de primeros auxilios acorde a los riesgos existentes?', v_item_order, 'compliance', true, 1);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 9. Checklist VL - VehÃ­culos Livianos
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist VL - VehÃ­culos Livianos', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist VL - VehÃ­culos Livianos');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-20 Trabajos en la VÃ­a PÃºblica / TrÃ¡nsito', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-20 Trabajos en la VÃ­a PÃºblica / TrÃ¡nsito');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El aspecto general exterior del vehÃ­culo es adecuado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El parabrisas se encuentra en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El limpiaparabrisas funciona correctamente?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los neumÃ¡ticos colocados se encuentran en buen estado?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El neumÃ¡tico de auxilio se encuentra en buen estado?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las luces externas funcionan correctamente?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los espejos retrovisores laterales derecho e izquierdo estÃ¡n presentes y en buen estado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El sistema de escape / arrestallamas se encuentra en buen estado?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La jaula antivuelco se encuentra en buen estado?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El vehÃ­culo cuenta con cintas reflectivas en buen estado?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El vehÃ­culo tiene indicaciÃ³n visible de velocidad mÃ¡xima?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El vehÃ­culo tiene indicaciÃ³n visible del nÃºmero interno de unidad?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El aspecto general interior del vehÃ­culo es adecuado?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los asientos cuentan con apoyacabezas en buen estado?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los cinturones de seguridad estÃ¡n presentes y en buen estado?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los espejos retrovisores interiores estÃ¡n presentes y en buen estado?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La bocina funciona correctamente?', v_item_order, 'compliance', true, 17);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La alarma sonora de retroceso funciona correctamente?', v_item_order, 'compliance', true, 18);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los frenos de pie funcionan correctamente?', v_item_order, 'compliance', true, 19);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El freno de mano funciona correctamente?', v_item_order, 'compliance', true, 20);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La visibilidad de la cabina delantera y trasera es adecuada?', v_item_order, 'compliance', true, 21);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El tacÃ³grafo se encuentra presente y en funcionamiento?', v_item_order, 'compliance', true, 22);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El matafuego externo estÃ¡ presente, con presiÃ³n adecuada y sin vencimiento?', v_item_order, 'compliance', true, 23);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El matafuego interno estÃ¡ presente, con presiÃ³n adecuada y sin vencimiento?', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n estÃ¡ presente y completo?', v_item_order, 'compliance', true, 25);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las balizas de pie estÃ¡n presentes y en buen estado?', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los banderines de advertencia estÃ¡n presentes y en buen estado?', v_item_order, 'compliance', true, 27);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La linterna estÃ¡ presente y en funcionamiento?', v_item_order, 'compliance', true, 28);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El chaleco reflectivo estÃ¡ presente y en buen estado?', v_item_order, 'compliance', true, 29);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El kit de supervivencia estÃ¡ presente y completo?', v_item_order, 'compliance', true, 30);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El criquet y la cruz o llave de ruedas estÃ¡n presentes y en buen estado?', v_item_order, 'compliance', true, 31);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La cuarta de remolque estÃ¡ presente y en buen estado?', v_item_order, 'compliance', true, 32);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 10. Checklist BO - BotiquÃ­n
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist BO - BotiquÃ­n', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist BO - BotiquÃ­n');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'General', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'General');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con crema para quemaduras (mÃ­nimo 1 unidad)?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con crema hidratante para piel x 200 ml (mÃ­nimo 1 unidad)?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con agua oxigenada x 500 cc (mÃ­nimo 1 unidad)?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con povidona iodada (desinfectante) x 60 ml (mÃ­nimo 1 unidad)?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con curitas (mÃ­nimo 20 unidades)?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con gasas hipoalergÃ©nicas de 10 cm x 10 cm en sobres (mÃ­nimo 100 unidades)?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con vendas tipo cambric de 10 cm x 3 m (mÃ­nimo 3 unidades)?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con cinta adhesiva tipo 3M (mÃ­nimo 1 unidad)?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con cinta de tela de 1 a 5 cm de ancho (mÃ­nimo 1 unidad)?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con paquete de algodÃ³n chico (mÃ­nimo 1 unidad)?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con mÃ¡scara para reanimaciÃ³n cardiopulmonar con vÃ¡lvula unidireccional (mÃ­nimo 1 unidad)?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con tijera chica (mÃ­nimo 1 unidad)?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con pinza (mÃ­nimo 1 unidad)?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con termÃ³metro (mÃ­nimo 1 unidad)?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con guantes de lÃ¡tex o polietileno (mÃ­nimo 2 pares)?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con bolsas para desechos de materiales usados o contaminados?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n cuenta con folleto de primeros auxilios?', v_item_order, 'compliance', true, 17);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 11. Checklist AM - Acta InspecciÃ³n Ministerio de Trabajo (Dec. 351/79)
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AM - Acta InspecciÃ³n Ministerio de Trabajo (Dec. 351/79)', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AM - Acta InspecciÃ³n Ministerio de Trabajo (Dec. 351/79)');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'General', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'General');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el listado de personal?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se exhibe el afiche informativo de la ART a la que se encuentra afiliado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta la constancia de afiliaciÃ³n a la ART con listado de personal actualizado?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el mapa de riesgos de los puestos de trabajo del establecimiento?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el Relevamiento General de Riesgos Laborales (RGRL) visado por la ART?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el relevamiento de sustancias cancerÃ­genas (Res. SRT 81/19)?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el Registro de Difenilos Policlorados (PCB) (Res. SRT 81/19)?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el Registro de Agentes de Riesgo (RAR) con nÃ³mina de personal expuesto?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La nÃ³mina de personal expuesto (NPE) presentada ante la ART guarda verosimilitud con la actividad del establecimiento?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presentan las constancias de realizaciÃ³n de exÃ¡menes mÃ©dicos preocupacionales del personal?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presentan las constancias de realizaciÃ³n de exÃ¡menes mÃ©dicos periÃ³dicos especÃ­ficos de acuerdo a los agentes de riesgo presentes en el ambiente laboral?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presentan las constancias del responsable del Servicio de Higiene y Seguridad matriculado en la Provincia de Buenos Aires y el registro de horas profesionales asignadas conforme a la Ley 19.587?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con auxiliares en Higiene y Seguridad con tÃ­tulo de tÃ©cnico reconocido por autoridad competente en cantidad acorde al personal equivalente?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta la constancia del Servicio de Medicina del Trabajo y las horas profesionales asignadas conforme a la Ley 19.587?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se provee agua potable con estudio fÃ­sico-quÃ­mico y bacteriolÃ³gico con la frecuencia requerida?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se mantienen adecuadas condiciones edilicias en el establecimiento (paredes, techos, construcciones)?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se provee al personal de servicios sanitarios adecuados e independientes para cada sexo en cantidad proporcional al nÃºmero de trabajadores?', v_item_order, 'compliance', true, 17);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se provee de vestuarios aptos higiÃ©nicamente y armarios individuales?', v_item_order, 'compliance', true, 18);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se provee de comedores y cocinas aptos higiÃ©nicamente?', v_item_order, 'compliance', true, 19);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se mantiene orden y limpieza en los puestos de trabajo?', v_item_order, 'compliance', true, 20);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el certificado de control de plagas y desinfecciÃ³n del establecimiento?', v_item_order, 'compliance', true, 21);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con adecuada seÃ±alizaciÃ³n y protecciÃ³n en las instalaciones?', v_item_order, 'compliance', true, 22);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cumplen las condiciones de seguridad en escaleras, plataformas de trabajo y rampas?', v_item_order, 'compliance', true, 23);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realiza mediciÃ³n, registro y control de la calidad y renovaciÃ³n del aire en los puestos de trabajo?', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cumple con la extracciÃ³n localizada de aire en lugares con presencia de contaminaciÃ³n?', v_item_order, 'compliance', true, 25);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan mediciones en los puestos y lugares de trabajo mediante protocolo de iluminaciÃ³n?', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con luces de emergencia?', v_item_order, 'compliance', true, 27);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realiza el estudio de ruido en los puestos de trabajo mediante protocolo?', v_item_order, 'compliance', true, 28);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan mediciÃ³n, registro y control de vibraciones en los puestos de trabajo?', v_item_order, 'compliance', true, 29);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan la determinaciÃ³n, cuantificaciÃ³n y registro de los valores de carga tÃ©rmica?', v_item_order, 'compliance', true, 30);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se realizan la determinaciÃ³n, mediciÃ³n, registro y control de contaminantes ambientales con su correspondiente protocolo?', v_item_order, 'compliance', true, 31);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El cableado elÃ©ctrico se encuentra adecuadamente contenido?', v_item_order, 'compliance', true, 32);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con puesta a tierra?', v_item_order, 'compliance', true, 33);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con interruptor diferencial en el tablero principal y seccionales?', v_item_order, 'compliance', true, 34);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el protocolo de mediciÃ³n de puesta a tierra?', v_item_order, 'compliance', true, 35);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registran los resultados del mantenimiento de las instalaciones elÃ©ctricas?', v_item_order, 'compliance', true, 36);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con seÃ±alizaciÃ³n y protecciÃ³n en las partes mÃ³viles de mÃ¡quinas, herramientas y/o elementos de las instalaciones?', v_item_order, 'compliance', true, 37);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con dispositivos de parada de emergencia?', v_item_order, 'compliance', true, 38);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas y herramientas portÃ¡tiles elÃ©ctricas cuentan con protecciÃ³n adecuada?', v_item_order, 'compliance', true, 39);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra identificada la carga mÃ¡xima en aparatos para izar, ascensores y montacargas?', v_item_order, 'compliance', true, 40);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los ganchos de izar cuentan con trabas de seguridad?', v_item_order, 'compliance', true, 41);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los ascensores y/o montacargas cuentan con cerraduras electromecÃ¡nicas en la puerta exterior para impedir su apertura cuando no estÃ¡n en el piso?', v_item_order, 'compliance', true, 42);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los autoelevadores cuentan con los dispositivos de seguridad requeridos (luces de retroceso, alarma de retroceso, cinturÃ³n de seguridad, matafuegos)?', v_item_order, 'compliance', true, 43);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los conductores de autoelevadores cuentan con credencial habilitante y capacitaciÃ³n?', v_item_order, 'compliance', true, 44);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los aparatos sometidos a presiÃ³n interna cuentan con identificaciÃ³n que indique fabricante, fecha, nÃºmero de serie, presiÃ³n de trabajo, presiÃ³n de prueba y presiÃ³n de diseÃ±o?', v_item_order, 'compliance', true, 45);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los recipientes, tubos, cilindros, tambores y otros que contengan gases licuados a presiÃ³n se almacenan en forma correcta en el interior de los locales?', v_item_order, 'compliance', true, 46);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presentan los registros de pruebas y ensayos de aparatos sometidos a presiÃ³n interna?', v_item_order, 'compliance', true, 47);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presentan las hojas de seguridad de las sustancias quÃ­micas (FDS)?', v_item_order, 'compliance', true, 48);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta la clasificaciÃ³n y etiquetado de productos quÃ­micos?', v_item_order, 'compliance', true, 49);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con sistema de contenciÃ³n (bateas) y control de derrames de productos peligrosos?', v_item_order, 'compliance', true, 50);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presentan las constancias de formaciÃ³n, capacitaciÃ³n y registro de acciones de unidades entrenadas para el control de emergencias, lucha contra incendios y evacuaciones?', v_item_order, 'compliance', true, 51);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el estudio de carga de fuego?', v_item_order, 'compliance', true, 52);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con extintores con carga vigente acordes al riesgo (cantidad y clase), colocados en un punto de fÃ¡cil acceso?', v_item_order, 'compliance', true, 53);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se dispone de planos de evacuaciÃ³n distribuidos por el establecimiento?', v_item_order, 'compliance', true, 54);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con medios de escape o vÃ­as de evacuaciÃ³n ante una emergencia?', v_item_order, 'compliance', true, 55);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se cuenta con un sistema de estiba seguro y adecuada circulaciÃ³n, respetando la distancia mÃ­nima de 1 m entre la parte superior de las estibas y el techo?', v_item_order, 'compliance', true, 56);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La instalaciÃ³n elÃ©ctrica en atmÃ³sferas inflamables es antiexplosiva?', v_item_order, 'compliance', true, 57);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se registra la entrega de EPP y ropa de trabajo en planilla conforme a la Res. SRT 299/11?', v_item_order, 'compliance', true, 58);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se verifica el uso de EPP por parte del personal?', v_item_order, 'compliance', true, 59);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta un programa de capacitaciÃ³n anual?', v_item_order, 'compliance', true, 60);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presentan los registros y constancias del dictado de capacitaciones sobre riesgos generales y especÃ­ficos?', v_item_order, 'compliance', true, 61);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se entregan a los trabajadores normas y procedimientos para el desarrollo del trabajo sin riesgos para la salud?', v_item_order, 'compliance', true, 62);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se posee botiquÃ­n de primeros auxilios?', v_item_order, 'compliance', true, 63);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el protocolo de ergonomÃ­a acorde a los puestos de trabajo sensibles a riesgos?', v_item_order, 'compliance', true, 64);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta informe certificado por un matriculado idÃ³neo sobre el estado de las caÃ±erÃ­as, acoples y uniones de la instalaciÃ³n de gas?', v_item_order, 'compliance', true, 65);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El asesor a cargo del Servicio de HyS realizÃ³ la investigaciÃ³n del accidente grave o mortal sufrido por un trabajador?', v_item_order, 'compliance', true, 66);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta copia de la documentaciÃ³n solicitada?', v_item_order, 'compliance', true, 67);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 12. Checklist AS - Aparatos Sometidos a PresiÃ³n
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AS - Aparatos Sometidos a PresiÃ³n', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AS - Aparatos Sometidos a PresiÃ³n');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'ExplosiÃ³n / ASP', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'ExplosiÃ³n / ASP');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe un registro interno de los controles y revisiones efectuados por la empresa o proveedor habilitado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El emplazamiento de los aparatos estÃ¡ alejado de fuentes de calor y correctamente ventilado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Disponen de vÃ¡lvula de seguridad y disco de ruptura instalados y en condiciones correctas de uso?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se llevan a cabo operaciones de mantenimiento de acuerdo a un programa establecido, con fechas de verificaciÃ³n y vencimientos?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los operarios estÃ¡n instruidos en el manejo seguro del equipo? Â¿En el caso de compresores existe una persona exclusiva encargada?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El compresor estÃ¡ situado al aire libre o en un local con aislamiento acÃºstico, ventilado, resistente al fuego y alejado de Ã¡reas de trabajo?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se dispone de vÃ¡lvulas de bloqueo y parada para emergencias, dispositivos de purga (agua, aceite) y vÃ¡lvula de retenciÃ³n?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las tuberÃ­as auxiliares estÃ¡n bien sujetas para evitar vibraciones y desprendimientos?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los recipientes de gases estÃ¡n bien sujetos, alejados de focos calorÃ­ficos y ubicados en Ã¡reas delimitadas y protegidas?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las conducciones de gases se mantienen en buen estado (sin corrosiÃ³n, buena sujeciÃ³n, vainas pasamuros, etc.)?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tubos de gases almacenados, incluidos los vacÃ­os, estÃ¡n provistos de capuchÃ³n o protector y tienen la vÃ¡lvula cerrada?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tubos de gases se transportan en carros o baterÃ­as adecuadas?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los tubos de acetileno y oxÃ­geno disponen de vÃ¡lvula antiretroceso de llama?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe un programa de mantenimiento preventivo y de formaciÃ³n sobre los peligros que puedan producirse?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los gases (caÃ±erÃ­as, cilindros, capuchÃ³n, etc.) estÃ¡n identificados segÃºn los colores correspondientes a la norma IRAM 2641?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se evita el almacenamiento excesivo de aparatos sometidos a presiÃ³n (cilindros, etc.)?', v_item_order, 'compliance', true, 16);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 13. Checklist OL - Orden y Limpieza
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist OL - Orden y Limpieza', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist OL - Orden y Limpieza');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Local', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Local');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las escaleras y plataformas estÃ¡n limpias, en buen estado y libres de obstÃ¡culos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las paredes estÃ¡n limpias y en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las ventanas estÃ¡n limpias sin impedir la entrada de luz natural?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El sistema de iluminaciÃ³n estÃ¡ mantenido de forma eficiente y limpia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las seÃ±ales de seguridad estÃ¡n visibles y correctamente distribuidas?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Suelos y Pasillos', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Suelos y Pasillos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los suelos estÃ¡n limpios, secos, sin desperdicios ni material innecesario?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las vÃ­as de circulaciÃ³n de personas y vehÃ­culos estÃ¡n diferenciadas y seÃ±alizadas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los pasillos y zonas de trÃ¡nsito estÃ¡n libres de obstÃ¡culos?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Almacenaje', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Almacenaje');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las Ã¡reas de almacenamiento y deposiciÃ³n de materiales estÃ¡n seÃ±alizadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los materiales y sustancias almacenadas se encuentran correctamente identificados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los materiales estÃ¡n apilados en su sitio sin invadir zonas de paso?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'MÃ¡quinas, Herramientas y Equipos', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'MÃ¡quinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas y equipos se encuentran limpios y libres en su entorno de todo material innecesario?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas y equipos estÃ¡n libres de filtraciones innecesarias de aceites y grasas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las mÃ¡quinas y equipos poseen las protecciones adecuadas y los dispositivos de seguridad en funcionamiento?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las herramientas estÃ¡n almacenadas en cajas o paneles adecuados, con un lugar asignado para cada una?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las herramientas se guardan limpias de aceite y grasa?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las herramientas elÃ©ctricas tienen el cableado y las conexiones en buen estado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las herramientas estÃ¡n en condiciones seguras para el trabajo, sin defectos ni oxidaciÃ³n?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Residuos', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Residuos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los contenedores estÃ¡n colocados prÃ³ximos y accesibles a los lugares de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los contenedores estÃ¡n claramente identificados de acuerdo al tipo de residuo (especial, reciclable, etc.)?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se evita el rebose de los contenedores?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La zona alrededor de los contenedores de residuos estÃ¡ limpia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen medios de limpieza a disposiciÃ³n del personal del Ã¡rea?', v_item_order, 'compliance', true, 5);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 14. Checklist IZ - Izaje de Cargas
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IZ - Izaje de Cargas', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IZ - Izaje de Cargas');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Aparatos para Izar', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Aparatos para Izar');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se verificÃ³ el izaje a efectuarse segÃºn radio de giro, peso y tabla de carga?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se agregaron al cÃ¡lculo del peso todos los elementos de izaje (perchas, pastecas, etc.)?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se encuentra seÃ±alizada la carga mÃ¡xima en el equipo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Hay elementos dentro de la carga que puedan desplazarse durante el izaje y se han tomado medidas para evitarlo?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han delimitado y vallado las Ã¡reas de izaje?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se ha designado a la persona a cargo del izaje (nombre, apellido, puesto y calificaciones)?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se solicitÃ³ el registro de mantenimiento del equipo (propio y/o por ente de certificaciÃ³n) y se encuentra apto?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se solicitaron los certificados de las fajas y las eslingas?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La carga es suficientemente frÃ¡gil como para requerir una estructura de refuerzo o sujeciÃ³n desde varios puntos para evitar daÃ±os?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La estructura de refuerzo fue diseÃ±ada por un ingeniero competente, cuenta con cÃ¡lculos teÃ³ricos y fue probada con la carga?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han inspeccionado todos los elementos de izaje (argollas, ganchos, eslingas, grilletes, cÃ¡ncamos, cables de la grÃºa, etc.) conforme a las normas de inspecciÃ³n?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se evitaron en las eslingas Ã¡ngulos menores de 45Â° respecto a la horizontal y se seleccionaron de modo que soporten el aumento de cargas por los Ã¡ngulos?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La sujeciÃ³n estÃ¡ dispuesta de modo que el gancho de la grÃºa quede directamente por encima del centro de gravedad de la carga?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se utilizan protectores (ej. medias caÃ±as) en los lugares donde los bordes agudos de la carga puedan ocasionar daÃ±os en las eslingas?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se controlÃ³ la existencia de obstrucciones aÃ©reas electrificadas dentro del radio de giro de la grÃºa?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se han localizado lÃ­neas de alta o media tensiÃ³n elÃ©ctrica que puedan producir arco voltaico o contacto con alguna parte de la grÃºa?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se debe realizar un ATS o Permiso de Trabajo de acuerdo al tipo de izaje?', v_item_order, 'compliance', true, 17);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se dispone de iluminaciÃ³n adecuada en caso de que la operaciÃ³n de izaje deba prolongarse fuera del horario de luz diurna?', v_item_order, 'compliance', true, 18);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El personal de sujeciÃ³n puede controlar y manipular en forma segura la carga a lo largo de todo el trayecto del izaje?', v_item_order, 'compliance', true, 19);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las condiciones meteorolÃ³gicas son aptas para efectuar la operaciÃ³n de izaje?', v_item_order, 'compliance', true, 20);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 15. Checklist SQ - Sustancias QuÃ­micas
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist SQ - Sustancias QuÃ­micas', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist SQ - Sustancias QuÃ­micas');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Almacenamiento', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Almacenamiento');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todos los productos quÃ­micos se encuentran correctamente almacenados?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿En atmÃ³sferas inflamables la instalaciÃ³n elÃ©ctrica es antiexplosiva?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe un sistema para el control de posibles derrames de productos peligrosos?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'ManipulaciÃ³n', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'ManipulaciÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La manipulaciÃ³n de productos quÃ­micos es segura y se poseen elementos y espacios de trabajo adecuados?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existen duchas de emergencia y/o lava ojos en los sectores donde se manipulan productos quÃ­micos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se entregan los EPP al personal y se utilizan y conservan correctamente?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'GestiÃ³n', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'GestiÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se poseen las Fichas de Datos de Seguridad (FDS) de todos los productos quÃ­micos existentes, conforme al Sistema SGA?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Todos los recipientes que contienen productos quÃ­micos estÃ¡n etiquetados conforme al Sistema SGA?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se confeccionÃ³ un plan de seguridad para casos de emergencia y se colocÃ³ en lugar visible?', v_item_order, 'compliance', true, 3);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 16. Checklist CC - Control de Contratistas
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist CC - Control de Contratistas', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist CC - Control de Contratistas');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'DocumentaciÃ³n - Empresas contratistas CON personal en relaciÃ³n de dependencia', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'DocumentaciÃ³n - Empresas contratistas CON personal en relaciÃ³n de dependencia');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el Certificado de Cobertura de ART vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta la ClÃ¡usula de No RepeticiÃ³n completa?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el Aviso de Obra presentado ante su ART?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el Programa de Seguridad aprobado por su ART?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presentan las constancias de capacitaciÃ³n del personal (actualizadas)?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el registro de entrega de EPP segÃºn planilla Res. SRT 299/11?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta la matrÃ­cula del Profesional Responsable de Higiene y Seguridad de la empresa?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presentan los registros de visitas y cumplimiento de horas profesionales del Responsable de HyS?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se informÃ³ el centro mÃ©dico o prestador de la ART mÃ¡s cercano al lugar de trabajo para traslado de accidentados?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta la EvaluaciÃ³n de Riesgos de acuerdo a los trabajos a realizar y/o ATS y/o Permisos de Trabajo?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta otra documentaciÃ³n requerida?', v_item_order, 'compliance', true, 11);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'DocumentaciÃ³n - AutÃ³nomos o monotributistas SIN personal en relaciÃ³n de dependencia', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'DocumentaciÃ³n - AutÃ³nomos o monotributistas SIN personal en relaciÃ³n de dependencia');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el certificado de cobertura de pÃ³liza de accidentes personales por muerte e invalidez total y permanente, y gastos farmacÃ©uticos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta la ClÃ¡usula de No RepeticiÃ³n completa?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta un procedimiento escrito para las tareas a realizar indicando una metodologÃ­a de trabajo seguro?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presentan las constancias de capacitaciÃ³n (actualizadas)?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta el registro de entrega de EPP segÃºn planilla Res. SRT 299/11?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta la matrÃ­cula del Profesional Responsable de Higiene y Seguridad del autÃ³nomo/monotributista?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presentan los registros de visitas y cumplimiento de horas profesionales del Responsable de HyS?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se informÃ³ el centro mÃ©dico de la obra social o prepaga mÃ¡s cercano al lugar de trabajo para traslado de accidentados?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se presenta otra documentaciÃ³n requerida?', v_item_order, 'compliance', true, 9);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 17. Checklist RE - Red de Incendio
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist RE - Red de Incendio', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist RE - Red de Incendio');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Nichos Hidrantes', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Nichos Hidrantes');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los nichos y gabinetes son accesibles y estÃ¡n seÃ±alizados?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los nichos y gabinetes se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los nichos y gabinetes estÃ¡n completos (mangueras, lanzas, accesorios)?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La conexiÃ³n a la red de agua estÃ¡ en buen estado y la manguera correctamente armada/enrollada?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Alarmas y DetecciÃ³n', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Alarmas y DetecciÃ³n');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los pulsadores de alarma son accesibles y estÃ¡n seÃ±alizados?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los pulsadores de alarma se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El sistema de alarma funciona correctamente y es audible en todas las Ã¡reas y sectores?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los detectores de incendio estÃ¡n instalados en todas las Ã¡reas necesarias?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los detectores de incendio se encuentran operativos y libres de polvo o suciedad que pueda afectar su funcionamiento?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Control y Mantenimiento', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Control y Mantenimiento');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se controla la instalaciÃ³n de forma periÃ³dica?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se poseen los registros y documentaciÃ³n necesaria de acuerdo a la normativa vigente aplicable (planos, QR, etc.)?', v_item_order, 'compliance', true, 2);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 18. Checklist VI - Visita de Locales
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist VI - Visita de Locales', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist VI - Visita de Locales');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Condiciones Operativas de Higiene y Seguridad - Local', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Condiciones Operativas de Higiene y Seguridad - Local');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los extintores cumplen con la cantidad, tipo, ubicaciÃ³n y estado requeridos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Existe alarma y/o modo de aviso para emergencias en funcionamiento?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las luces de emergencia cumplen con la cantidad, ubicaciÃ³n y estado requeridos?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El botiquÃ­n de primeros auxilios estÃ¡ presente y completo?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La iluminaciÃ³n y seÃ±alizaciÃ³n son adecuadas (estado de luminarias, protecciÃ³n anticaÃ­da, seÃ±alizaciones de seguridad de riesgo elÃ©ctrico, salidas y otras)?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La instalaciÃ³n elÃ©ctrica es adecuada (tableros, conductores, tomacorrientes, protecciones elÃ©ctricas)?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El sistema de extracciÃ³n de campana y ventilaciÃ³n del local funciona correctamente y se encuentra en adecuadas condiciones de mantenimiento y limpieza?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los espacios de trabajo cuentan con orden y limpieza adecuados, y los desniveles, pisos y escaleras fijas estÃ¡n en buen estado?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los EPP estÃ¡n disponibles, se utilizan correctamente y se encuentran en buen estado de conservaciÃ³n?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿La instalaciÃ³n de gas se encuentra en buen estado y con mantenimiento adecuado?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las demÃ¡s condiciones y aspectos del local son adecuados?', v_item_order, 'compliance', true, 11);
  END IF;

  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  -- 19. Checklist MQ - MÃ¡quinas, Herramientas y Equipos
  -- â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist MQ - MÃ¡quinas, Herramientas y Equipos', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist MQ - MÃ¡quinas, Herramientas y Equipos');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Control de MÃ¡quinas, Herramientas y Equipos', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Control de MÃ¡quinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El estado general es adecuado (limpieza, conductores, interruptores, fichas, carcasa, etc.)?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las protecciones mecÃ¡nicas estÃ¡n presentes y en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las protecciones elÃ©ctricas estÃ¡n presentes y en buen estado?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Son aptas, seguras y adecuadas para las tareas que se realizan?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Cuentan con paradas de emergencia operativas?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Cuentan con bloqueos y/o cortes automÃ¡ticos operativos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los accesorios y elementos auxiliares son adecuados (llaves de ajuste, prolongaciones, etc.)?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿El almacenamiento y/o guardado es correcto?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Las seÃ±alizaciones, placas e informaciÃ³n son legibles?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Se utilizan los EPP correspondientes durante su operaciÃ³n?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, 'Â¿Los demÃ¡s aspectos relevantes son adecuados?', v_item_order, 'compliance', true, 11);
  END IF;

END $$;
-- ActualizaciÃ³n de precios y lÃ­mites de usuarios por plan
--
-- Precios: mitad del precio por paquete equivalente de Genesis Broker
--   Profesional Independiente: $16.450/mes  (antes $16.900)
--   Consultora Chica:          $21.250/mes  (antes $26.320)
--   Consultora Grande:         $26.650/mes  (antes $34.000)
--
-- Usuarios por plan:
--   Profesional Independiente: 1 admin, 0 colaboradores
--   Consultora Chica:          1 admin, 3 colaboradores
--   Consultora Grande:         2 admins, 5 colaboradores

UPDATE public.plans SET
  precio_mensual_neto = 16450.00,
  precio_anual_neto   = 157920.00,   -- 16450 Ã— 12 Ã— 0.80
  max_colaboradores   = 0
WHERE slug = 'profesional-independiente';

UPDATE public.plans SET
  precio_mensual_neto = 21250.00,
  precio_anual_neto   = 204000.00,   -- 21250 Ã— 12 Ã— 0.80
  max_colaboradores   = 3
WHERE slug = 'consultora-chica';

UPDATE public.plans SET
  precio_mensual_neto = 26650.00,
  precio_anual_neto   = 255840.00,   -- 26650 Ã— 12 Ã— 0.80
  max_colaboradores   = 5
WHERE slug = 'consultora-grande';

