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

  -- ═══════════════════════════════════════════════════════════════
  -- 1. Checklist AG - Agro
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AG - Agro', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AG - Agro');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-01 Protección Contra Incendios', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-01 Protección Contra Incendios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen medios y vías de escape adecuadas en caso de incendio?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La cantidad y tipo de matafuegos es acorde a la carga de fuego?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen sistemas de detección y extinción de incendios?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El depósito de combustibles cumple con la legislación vigente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se acredita la realización periódica de simulacros de evacuación?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se dispone de estanterías o elementos equivalentes de material no combustible o metálico?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se almacenan los productos agroquímicos separados de los inflamables, utilizando materiales no combustibles en los depósitos?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se evita la realización de quemas en días muy ventosos, considerando la dirección de los vientos predominantes?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan previamente los cortafuegos pertinentes?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se controlan regularmente los acopios de materiales que puedan producir fermentación y elevación de temperatura?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-02 Peligro Eléctrico', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-02 Peligro Eléctrico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están todos los cableados eléctricos adecuadamente contenidos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los conectores eléctricos se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tableros eléctricos cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las tareas de mantenimiento son efectuadas por personal capacitado y autorizado por la empresa?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptan las medidas de seguridad en locales donde se manipulen sustancias corrosivas, inflamables y/o explosivas o de alto riesgo y en locales húmedos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han adoptado medidas para la protección contra riesgos de contactos directos e indirectos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han adoptado medidas para eliminar la electricidad estática en todas las operaciones donde pueda producirse?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Posee instalación para prevenir sobretensiones producidas por descargas atmosféricas (pararrayos)?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Poseen las instalaciones tomas a tierra independientes de la instalada para descargas atmosféricas?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-03 Ergonomía', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-03 Ergonomía');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones ergonómicas son adecuadas en cuanto a levantamiento y descenso de cargas, empujes y arrastres, transporte de cargas, bipedestación, movimientos repetitivos, posturas forzadas y estrés de contacto?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan los controles administrativos y se proponen mejoras de ingeniería?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-04 Caídas a Mismo Nivel', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-04 Caídas a Mismo Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sectores de circulación como pasillos, escaleras y pisos son seguros?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están ausentes las irregularidades que puedan provocar caídas y resbalones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todas las escaleras cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todas las plataformas de trabajo y rampas cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-05 Iluminación y Señalización', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-05 Iluminación y Señalización');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cumple con los requisitos de iluminación establecidos en la legislación vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha instalado un sistema de iluminación de emergencia acorde a los requerimientos de la legislación vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe marcación visible de pasillos, circulaciones de tránsito y lugares de cruce donde circulen cargas suspendidas y otros elementos de transporte?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran señalizados los caminos de evacuación e indicadas las salidas normales y de emergencia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran identificadas las cañerías?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-06 Espacios de Trabajo', 5)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-06 Espacios de Trabajo');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe orden y limpieza en los puestos de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen depósitos de residuos en los puestos de trabajo?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se almacenan los productos respetando la distancia mínima de 1 m entre la parte superior de las estibas y el techo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sistemas de almacenaje permiten una adecuada circulación y son seguros?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿En los almacenajes a granel, las estibas cuentan con elementos de contención?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-07 Ventilación', 6)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-07 Ventilación');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen aberturas que permitan el ingreso de aire?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sistemas de ventilación son adecuados y se encuentran en buen estado de funcionamiento?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-08 Condiciones Edilicias e Infraestructura', 7)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-08 Condiciones Edilicias e Infraestructura');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones edilicias son adecuadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han instrumentado las acciones necesarias para que la vivienda provista por el empleador se mantenga libre de malezas y con fuentes de riesgo eléctrico, incendio y derrumbe controladas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están ausentes los problemas de humedad y filtraciones?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las estructuras portantes se encuentran en buen estado?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están ausentes rajaduras de consideración que puedan afectar la estabilidad y resistencia edilicia?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El estado de la pintura y revestimientos de la mampostería es correcto?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El estado estructural de las barandas, pisos y escaleras es adecuado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe provisión de agua potable para el consumo e higiene de los trabajadores?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha evitado el consumo humano del agua destinada a uso industrial?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen baños aptos higiénicamente?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen vestuarios aptos higiénicamente con armarios adecuados e individuales?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen comedores aptos higiénicamente?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La/s cocina/s reúne/n los requisitos establecidos?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los desagües industriales se recogen y canalizan por conductos, impidiendo su libre escurrimiento?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha evitado el contacto de líquidos que puedan reaccionar originando desprendimiento de gases tóxicos o contaminantes?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Son evacuados los efluentes a plantas de tratamiento?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se limpia periódicamente la planta de tratamiento con las precauciones de protección necesarias para el personal?', v_item_order, 'compliance', true, 17);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-09 Explosión / ASP', 8)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-09 Explosión / ASP');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan los controles e inspecciones periódicas establecidos en calderas y todo otro aparato sometido a presión?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han fijado las instrucciones detalladas con esquemas de la instalación y los procedimientos operativos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están los cilindros con gases a presión adecuadamente almacenados, evitando el almacenamiento excesivo, con capuchón protector y válvula cerrada?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los cilindros de gases son transportados por medios adecuados?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Disponen de válvula de seguridad y disco de ruptura instalados en condiciones correctas de uso?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se dispone de válvulas de bloqueo y parada para emergencias, dispositivos de purga y válvula de retención?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las mangueras, reguladores, manómetros, sopletes y válvulas antirretornos se encuentran en buen estado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tubos de acetileno y oxígeno disponen de válvula antiretroceso de llama?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Cuenta el operador con la capacitación y/o habilitación pertinente?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-10 Sustancias Químicas y Peligrosas', 9)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-10 Sustancias Químicas y Peligrosas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La fabricación y/o manipuleo de sustancias peligrosas cumplimenta la legislación vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las instalaciones y equipos se encuentran protegidos contra el efecto corrosivo de las sustancias empleadas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen dispositivos de alarma acústicos y visuales donde se manipulen sustancias infectantes y/o contaminantes?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha señalizado y resguardado la zona o los elementos afectados ante casos de derrame de sustancias corrosivas?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran separados los productos incompatibles?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los productos cumplen con el etiquetado de la legislación SGA?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen duchas de emergencia y/o lava ojos en los sectores con productos peligrosos?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿En atmósferas inflamables la instalación eléctrica es antiexplosiva?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe un sistema para control de derrames de productos peligrosos?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se confeccionó un plan de seguridad para casos de emergencia y se colocó en lugar visible?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-11 Trabajos en Altura y a Distinto Nivel', 10)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-11 Trabajos en Altura y a Distinto Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones de viento, atmósfera y estado del suelo permiten realizar el trabajo con seguridad?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están colocadas las barreras físicas y/o señalización requeridas? (Barandas a 1 m y 0,5 m, plataforma ancho mínimo 60 cm, zócalo de 15 cm.)', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen escaleras adecuadas de ascenso a las estructuras?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra correctamente señalizada el área de trabajo?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las aberturas y huecos se encuentran protegidos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las estructuras en las cuales se desarrollan las tareas son resistentes y estables?', v_item_order, 'compliance', true, 6);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-12 Máquinas, Herramientas y Equipos', 11)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-12 Máquinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los volantes, correas, ejes, mecanismos de transmisión, salientes y cigüeñales están cubiertos para eliminar la posibilidad de contacto con las partes en movimiento?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los extremos de ejes de transmisión que sobresalen en más de un tercio de su diámetro están protegidos o redondeados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los elementos o partes móviles que pudieran producir atrapamientos, aplastamientos o cortes están protegidos o cubiertos?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La zona de recorrido de contrapesos, péndulos u otros mecanismos oscilantes está protegida mediante cerramiento?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas están provistas de dispositivos de bloqueo para evitar puesta en marcha accidental y de señalizaciones de peligro e instrucciones en castellano?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas cuentan con medios visibles y de acceso inmediato para que el operador pueda detenerlas rápidamente en caso de urgencia?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas están provistas de barreras, barandillas u otros medios de protección cuando razones de seguridad así lo exigen?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿En las tareas que requieren trabajar de pie se dispone de plataforma horizontal que permita el apoyo firme y seguro del trabajador?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas están acondicionadas para minimizar las consecuencias de condiciones climáticas desfavorables, vibraciones y demás agentes de riesgo?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se evita inspeccionar, engrasar, limpiar o reparar partes de máquinas o mecanismos de transmisión no protegidos mientras están en movimiento?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se evita operar motores a combustión interna en lugares sin salida de gases al exterior y sin adecuada renovación de aire?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La salida de escapes de motores a combustión interna evacua gases a la mayor altura posible y están provistos de arrestallamas donde existe riesgo de incendio?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las motosierras o sierras de cadena poseen dispositivos de seguridad, defensas para las manos, frenos de cadena y cadena bien afilada?', v_item_order, 'compliance', true, 13);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-13 Ruido', 12)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-13 Ruido');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo de acuerdo a las mediciones realizadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones de infrasonidos y ultrasonidos y se implementan las correcciones necesarias?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-14 Vehículos Industriales y de Transporte', 13)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-14 Vehículos Industriales y de Transporte');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los vehículos cuentan con los elementos de seguridad requeridos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Disponen de asientos que neutralicen las vibraciones, con respaldo y apoya pies?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Son adecuadas las cabinas de protección para las inclemencias del tiempo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están protegidos para los riesgos de desplazamiento de cargas?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los vehículos están equipados con luces, frenos, dispositivo de aviso acústico-luminoso, espejos, cinturón de seguridad, bocina y matafuegos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realiza un control de uso previo?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra señalizada la carga máxima de operación?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El aspecto exterior e interior es adecuado y está libre de deterioros significativos?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajadores se transportan en forma separada de la carga y no están de pie o sentados en lugares no destinados a tal fin?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los vehículos de transporte de personal poseen barandas laterales y traseras de al menos 1,50 m, bancos y escalera de acceso?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tractores poseen sistema de frenos capaz de detener el desplazamiento en condiciones de carga máxima?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tractores sin cabina poseen guardabarros en las ruedas traseras para proteger al conductor?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tractores poseen chavetas con pasadores o seguros que impidan el desenganche accidental de acoples o remolques?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tractores poseen resistencia equivalente o superior a su carga máxima en chavetas, seguros, pasadores y enganches?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tractores poseen estructura de protección capaz de resistir el peso total del equipo cuando existe posibilidad de vuelco?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tractores poseen escalera y pasamanos u otro mecanismo que asegure el fácil acceso cuando fuese necesario?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tractores poseen señalización de riesgos y colores de seguridad como elementos de prevención de accidentes?', v_item_order, 'compliance', true, 17);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-15 Condiciones Higrotérmicas', 14)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-15 Condiciones Higrotérmicas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El personal sometido a estrés por frío está protegido adecuadamente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrés por frío?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El personal sometido a estrés térmico y tensión térmica está protegido adecuadamente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se protegen los hornos, calderas, etc., para evitar la acción del calor?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están aislados y convenientemente ventilados los aparatos capaces de producir frío con posibilidad de desprendimiento de contaminantes?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrés térmico y tensión térmica?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-16 Aparatos para Izar', 15)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-16 Aparatos para Izar');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra identificada la carga máxima de los equipos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los ascensores y montacargas cumplen los requisitos y condiciones máximas de seguridad en construcción, instalación y mantenimiento?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los ganchos de izar poseen traba de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los elementos auxiliares de elevación se encuentran en buen estado (cadenas, perchas, eslingas, fajas, etc.)?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todos los aparatos para izar, aparejos, puentes grúa y transportadores cumplen los requisitos y condiciones máximas de seguridad?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han localizado líneas de tensión eléctrica que puedan producir arco voltaico o contacto con elementos de izaje o carga?', v_item_order, 'compliance', true, 6);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-17 Radiaciones', 16)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-17 Radiaciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajadores y fuentes generadoras de radiaciones ionizantes (ej. rayos X) cuentan con la autorización del organismo competente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se lleva el control y registro de las dosis individuales?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los valores hallados se encuentran dentro de lo establecido en la normativa vigente?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajadores expuestos a fuentes de radiaciones no ionizantes (ej. soldadura) están debidamente protegidos?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cumple con la normativa vigente para campos magnéticos estáticos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones de radiofrecuencia y/o microondas en los lugares de trabajo?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones de radiación infrarroja?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones de radiación ultravioleta?', v_item_order, 'compliance', true, 8);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-18 Vibraciones', 17)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-18 Vibraciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-19 Riesgo Biológico', 18)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-19 Riesgo Biológico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se poseen protocolos actualizados para manejo de riesgos biológicos?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-20 Trabajos en la Vía Pública / Tránsito', 19)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-20 Trabajos en la Vía Pública / Tránsito');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajos realizados en la vía pública se realizan de forma segura?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se posee alarma sonoro-lumínica para el ingreso y egreso de los vehículos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se señaliza y se vigila la vía pública al momento de operar?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los vehículos que circulan por la vía pública cumplen con la reglamentación?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Elementos de Protección Personal', 20)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Elementos de Protección Personal');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se provee a todos los trabajadores de los EPP adecuados a los riesgos a los que están expuestos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen señalizaciones visibles sobre la obligatoriedad del uso de los EPP en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Primeros Auxilios', 21)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Primeros Auxilios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen botiquines de primeros auxilios acorde a los riesgos existentes?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Silos', 22)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Silos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los silos están montados sobre bases apropiadas, garantizan resistencia a las cargas que soportan y tienen apoyos protegidos contra impactos accidentales en áreas de circulación vehicular?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Cuentan con guardahombres en las escaleras exteriores verticales de acceso a partir de los 2 metros de altura?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están protegidas las aberturas para evitar caídas de los trabajadores?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ventila el silo previo al ingreso para lograr una atmósfera apta?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están protegidas las aberturas de descarga e interrupción del llenado?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se provee de EPP adecuados (cinturón de seguridad y cabo de vida sujeto a punto fijo exterior) para las tareas a realizar?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se dispone de una persona en el exterior del silo que pueda auxiliar al trabajador en caso de necesidad?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se instrumentan las medidas de precaución para evitar incendios y explosiones durante las tareas?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se evita destrabar o demoler las bóvedas formadas por compactación o humedad del material almacenado, ubicándose debajo o encima de las mismas?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se asegura la estabilidad de las estibas de bolsas para evitar desplazamientos y lesiones a los trabajadores?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Explotación Forestal', 23)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Explotación Forestal');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se eliminan las malezas y tocones al ras del suelo para facilitar el trabajo seguro y la salida rápida del área ante la caída de un árbol?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se prevén y construyen caminos de acceso y salida adecuados al riesgo de caídas o rodamiento de troncos, ramas o elementos pesados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se impide el ingreso de personas ajenas a la zona de desmonte o tala señalizada? ¿Los trabajadores que no participan del volteo se mantienen a distancia radial de seguridad igual al doble de la longitud del árbol, con cascos?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Para las labores de poda o desrame el empleador proporciona los elementos de trabajo adecuados?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se fijan o posicionan los árboles o troncos caídos en pendiente para evitar que rueden?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sistemas de arrastre y transporte de troncos están programados y ejecutados de forma que no generen riesgo para la seguridad del personal?', v_item_order, 'compliance', true, 6);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Animales', 24)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Animales');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las viviendas de los trabajadores se encuentran aisladas de los galpones de cría, boxes o establos con presencia de animales?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han implementado medidas para sujetar y controlar los movimientos de los animales en tratamientos sanitarios, vacunaciones, curaciones, descornado y otras tareas que exijan contacto con el trabajador?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los aperos se encuentran en buen estado de conservación para la utilización de tracción animal?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se evita el contacto directo del trabajador con la mucosa, sangre o excrementos de los animales?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Al finalizar tareas en contacto con animales, el trabajador se higieniza antes de fumar o ingerir alimentos o infusiones?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se dispone de un lugar destinado para la ropa que estuvo en contacto con animales, evitando su contacto con ropa limpia?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se incineran los cadáveres de animales muertos por enfermedades contagiosas o desconocidas, evitando el contacto con el trabajador?', v_item_order, 'compliance', true, 7);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 2. Checklist AC - Administración y Comercios
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AC - Administración y Comercios', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AC - Administración y Comercios');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-01 Protección Contra Incendios', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-01 Protección Contra Incendios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen medios y vías de escape adecuadas en caso de incendio?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La cantidad y tipo de matafuegos es acorde a la carga de fuego?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen sistemas de detección y extinción de incendios?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El depósito de combustibles cumple con la legislación vigente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se acredita la realización periódica de simulacros de evacuación?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se dispone de estanterías o elementos equivalentes de material no combustible o metálico?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se separan en forma alternada los materiales combustibles de los no combustibles y los que puedan reaccionar entre sí?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-02 Peligro Eléctrico', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-02 Peligro Eléctrico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están todos los cableados eléctricos adecuadamente contenidos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los conectores eléctricos se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tableros eléctricos cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las tareas de mantenimiento son efectuadas por personal capacitado y autorizado por la empresa?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptan las medidas de seguridad en locales donde se manipulen sustancias corrosivas, inflamables y/o explosivas o de alto riesgo y en locales húmedos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han adoptado medidas para la protección contra riesgos de contactos directos e indirectos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han adoptado medidas para eliminar la electricidad estática en todas las operaciones donde pueda producirse?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Posee instalación para prevenir sobretensiones producidas por descargas atmosféricas (pararrayos)?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Poseen las instalaciones tomas a tierra independientes de la instalada para descargas atmosféricas?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-03 Ergonomía', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-03 Ergonomía');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones ergonómicas son adecuadas en cuanto a levantamiento y descenso de cargas, empujes y arrastres, transporte de cargas, bipedestación, movimientos repetitivos, posturas forzadas y estrés de contacto?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan los controles administrativos y se proponen mejoras de ingeniería?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-04 Caídas a Mismo Nivel', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-04 Caídas a Mismo Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sectores de circulación como pasillos, escaleras y pisos son seguros?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están ausentes las irregularidades que puedan provocar caídas y resbalones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todas las escaleras cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todas las plataformas de trabajo y rampas cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-05 Iluminación y Señalización', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-05 Iluminación y Señalización');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cumple con los requisitos de iluminación establecidos en la legislación vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha instalado un sistema de iluminación de emergencia acorde a los requerimientos de la legislación vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe marcación visible de pasillos, circulaciones de tránsito y lugares de cruce donde circulen cargas suspendidas y otros elementos de transporte?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran señalizados los caminos de evacuación e indicadas las salidas normales y de emergencia?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-06 Espacios de Trabajo', 5)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-06 Espacios de Trabajo');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe orden y limpieza en los puestos de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen depósitos de residuos en los puestos de trabajo?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se almacenan los productos respetando la distancia mínima de 1 m entre la parte superior de las estibas y el techo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sistemas de almacenaje permiten una adecuada circulación y son seguros?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-07 Ventilación', 6)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-07 Ventilación');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen aberturas que permitan el ingreso de aire?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sistemas de ventilación son adecuados y se encuentran en buen estado de funcionamiento?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-08 Condiciones Edilicias e Infraestructura', 7)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-08 Condiciones Edilicias e Infraestructura');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones edilicias son adecuadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están ausentes los problemas de humedad y filtraciones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las estructuras portantes se encuentran en buen estado?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están ausentes rajaduras de consideración que puedan afectar la estabilidad y resistencia edilicia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El estado de la pintura y revestimientos de la mampostería es correcto?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El estado estructural de las barandas, pisos y escaleras es adecuado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe provisión de agua potable para el consumo e higiene de los trabajadores?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha evitado el consumo humano del agua destinada a uso industrial?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen baños aptos higiénicamente?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen vestuarios aptos higiénicamente con armarios adecuados e individuales?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen comedores aptos higiénicamente?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La/s cocina/s reúne/n los requisitos establecidos?', v_item_order, 'compliance', true, 12);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-09 Explosión / ASP', 8)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-09 Explosión / ASP');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan los controles e inspecciones periódicas establecidos en calderas y todo otro aparato sometido a presión?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están los cilindros con gases a presión adecuadamente almacenados, evitando el almacenamiento excesivo, con capuchón protector y válvula cerrada?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los cilindros de gases son transportados por medios adecuados?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las mangueras, reguladores, manómetros, sopletes y válvulas antirretornos se encuentran en buen estado?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-10 Sustancias Químicas y Peligrosas', 9)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-10 Sustancias Químicas y Peligrosas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La fabricación y/o manipuleo de sustancias peligrosas cumplimenta la legislación vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran separados los productos incompatibles?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los productos cumplen con el etiquetado de la legislación SGA?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-11 Trabajos en Altura y a Distinto Nivel', 10)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-11 Trabajos en Altura y a Distinto Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están colocadas las barreras físicas y/o señalización requeridas? (Barandas a 1 m y 0,5 m, plataforma ancho mínimo 60 cm, zócalo de 15 cm.)', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen escaleras adecuadas de ascenso a las estructuras?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra correctamente señalizada el área de trabajo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las aberturas y huecos se encuentran protegidos?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las estructuras en las cuales se desarrollan las tareas son resistentes y estables?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-12 Máquinas, Herramientas y Equipos', 11)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-12 Máquinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las herramientas están en estado de conservación adecuado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La empresa provee herramientas aptas y seguras?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las herramientas corto-punzantes poseen fundas o vainas?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe un lugar destinado para la ubicación ordenada de las herramientas?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las herramientas portátiles eléctricas poseen protecciones para evitar riesgos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todas las máquinas y herramientas cuentan con protecciones para evitar riesgos al trabajador?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen dispositivos de parada de emergencia?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han previsto sistemas de bloqueo de las máquinas para operaciones de mantenimiento?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas eléctricas tienen sistema de puesta a tierra?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-13 Ruido', 12)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-13 Ruido');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo de acuerdo a las mediciones realizadas?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-16 Aparatos para Izar', 13)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-16 Aparatos para Izar');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra identificada la carga máxima de los equipos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los ascensores y montacargas cumplen los requisitos y condiciones máximas de seguridad en construcción, instalación y mantenimiento?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los ganchos de izar poseen traba de seguridad?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-19 Riesgo Biológico', 14)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-19 Riesgo Biológico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se poseen protocolos actualizados para manejo de riesgos biológicos?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-20 Trabajos en la Vía Pública / Tránsito', 15)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-20 Trabajos en la Vía Pública / Tránsito');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajos realizados en la vía pública se realizan de forma segura?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se posee alarma sonoro-lumínica para el ingreso y egreso de los vehículos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se señaliza y se vigila la vía pública al momento de operar?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los vehículos que circulan por la vía pública cumplen con la reglamentación?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Elementos de Protección Personal', 16)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Elementos de Protección Personal');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se provee a todos los trabajadores de los EPP adecuados a los riesgos a los que están expuestos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen señalizaciones visibles sobre la obligatoriedad del uso de los EPP en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Primeros Auxilios', 17)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Primeros Auxilios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen botiquines de primeros auxilios acorde a los riesgos existentes?', v_item_order, 'compliance', true, 1);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 3. Checklist CEG - Control de EPP (Gestión)
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist CEG - Control de EPP (Gestión)', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist CEG - Control de EPP (Gestión)');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Gestión', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Gestión');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las entregas de los EPP son registradas según la planilla Res. SRT 299/11 y se encuentran debidamente completas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se posee una Matriz de EPP por puestos de trabajo?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se capacita al personal en el correcto uso y conservación de los EPP?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Uso y Conservación de EPPs', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Uso y Conservación de EPPs');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se entregan todos los EPP de acuerdo a los peligros y riesgos a los cuales el personal está expuesto?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se utilizan correctamente los EPP entregados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El personal que utiliza EPP los guarda, conserva y mantiene de forma adecuada y en buen estado?', v_item_order, 'compliance', true, 3);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 4. Checklist RGO - Relevamiento General de Obra
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist RGO - Relevamiento General de Obra', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist RGO - Relevamiento General de Obra');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-01 Protección Contra Incendios', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-01 Protección Contra Incendios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen medios y vías de escape adecuadas en caso de incendio?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La cantidad y tipo de matafuegos es acorde a la carga de fuego?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajos en caliente se realizan en forma segura?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El depósito de combustibles cumple con la legislación vigente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se acredita la realización periódica de simulacros de evacuación?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se separan en forma alternada los materiales combustibles de los no combustibles y los que puedan reaccionar entre sí?', v_item_order, 'compliance', true, 6);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-02 Peligro Eléctrico', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-02 Peligro Eléctrico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están todos los cableados eléctricos adecuadamente contenidos? (Aéreos a no menos de 2,40 m de altura o subterráneos.)', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los conectores eléctricos se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tableros eléctricos cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las tareas de mantenimiento son efectuadas por personal capacitado y autorizado por la empresa?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptan las medidas de seguridad en locales donde se manipulen sustancias corrosivas, inflamables y/o explosivas o de alto riesgo y en locales húmedos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han adoptado medidas para la protección contra riesgos de contactos directos e indirectos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han adoptado medidas para eliminar la electricidad estática en todas las operaciones donde pueda producirse?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Posee instalación para prevenir sobretensiones producidas por descargas atmosféricas (pararrayos)?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Poseen las instalaciones tomas a tierra independientes de la instalada para descargas atmosféricas?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-03 Ergonomía', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-03 Ergonomía');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones ergonómicas son adecuadas en cuanto a levantamiento y descenso de cargas, empujes y arrastres, transporte de cargas, bipedestación, movimientos repetitivos, posturas forzadas y estrés de contacto?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan los controles administrativos y se proponen mejoras de ingeniería?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-04 Caídas a Mismo Nivel', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-04 Caídas a Mismo Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sectores de circulación como pasillos, escaleras y pisos son seguros?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están ausentes las irregularidades que puedan provocar caídas y resbalones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todas las escaleras cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todas las plataformas de trabajo y rampas cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-05 Iluminación y Señalización', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-05 Iluminación y Señalización');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cumple con los requisitos de iluminación establecidos en la legislación vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha instalado un sistema de iluminación de emergencia acorde a los requerimientos de la legislación vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe marcación visible de pasillos, circulaciones de tránsito y lugares de cruce donde circulen cargas suspendidas y otros elementos de transporte?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran señalizados los caminos de evacuación e indicadas las salidas normales y de emergencia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran identificadas las cañerías?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-06 Espacios de Trabajo', 5)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-06 Espacios de Trabajo');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe orden y limpieza en los puestos de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen depósitos de residuos en los puestos de trabajo?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se almacenan los productos respetando la distancia mínima de 1 m entre la parte superior de las estibas y el techo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sistemas de almacenaje y acopio de materiales permiten una adecuada circulación y son seguros?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-07 Ventilación', 6)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-07 Ventilación');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen aberturas que permitan el ingreso de aire?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sistemas de ventilación son adecuados y se encuentran en buen estado de funcionamiento?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-08 Condiciones Edilicias e Infraestructura', 7)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-08 Condiciones Edilicias e Infraestructura');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones edilicias son adecuadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las estructuras portantes se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están ausentes rajaduras de consideración que puedan afectar la estabilidad y resistencia edilicia?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe provisión de agua potable para el consumo e higiene de los trabajadores?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen baños en cantidad apropiada según la cantidad de trabajadores y son aptos higiénicamente?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen vestuarios aptos higiénicamente con armarios adecuados e individuales?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen comedores aptos higiénicamente?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-09 Explosión / ASP', 8)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-09 Explosión / ASP');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan los controles e inspecciones periódicas establecidos en calderas y todo otro aparato sometido a presión?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están los cilindros con gases a presión adecuadamente almacenados, evitando el almacenamiento excesivo, con capuchón protector y válvula cerrada?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los cilindros de gases son transportados por medios adecuados?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Disponen de válvula de seguridad y disco de ruptura instalados en condiciones correctas de uso?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se dispone de válvulas de bloqueo y parada para emergencias, dispositivos de purga y válvula de retención?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las mangueras, reguladores, manómetros, sopletes y válvulas antirretornos se encuentran en buen estado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tubos de acetileno y oxígeno disponen de válvula antiretroceso de llama?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Cuenta el operador con la capacitación y/o habilitación pertinente?', v_item_order, 'compliance', true, 8);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-10 Sustancias Químicas y Peligrosas', 9)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-10 Sustancias Químicas y Peligrosas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La fabricación y/o manipuleo de sustancias peligrosas cumplimenta la legislación vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha señalizado y resguardado la zona o los elementos afectados ante casos de derrame de sustancias corrosivas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran separados los productos incompatibles?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los productos cumplen con el etiquetado de la legislación SGA?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen duchas de emergencia y/o lava ojos en los sectores con productos peligrosos?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-11 Trabajos en Altura y a Distinto Nivel', 10)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-11 Trabajos en Altura y a Distinto Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones de viento, atmósfera y estado del suelo permiten realizar el trabajo con seguridad?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están colocadas las barreras físicas y/o señalización requeridas? (Barandas a 1 m y 0,5 m, plataforma ancho mínimo 60 cm, zócalo de 15 cm.)', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen redes salvavidas a 3 m por debajo del plano de trabajo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen escaleras adecuadas de ascenso y descenso a las estructuras?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra correctamente señalizada el área de trabajo?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las aberturas y huecos se encuentran protegidos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las estructuras en las cuales se desarrollan las tareas son resistentes y estables?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los andamios poseen adecuada rigidez, resistencia y estabilidad, asegurando inmovilidad lateral y vertical?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿En silletas, los asientos son de 0,60 x 0,30 m con topes para evitar golpes contra el muro y la eslinga o soga es pasante por al menos 4 agujeros o puntos?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿En silletas y andamios colgantes se usa cinturón de seguridad anclado a punto fijo independiente?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las escaleras sobrepasan 1 m el lugar de acceso?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las escaleras de 2 hojas no superan los 6 m de longitud?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las escaleras extensibles poseen superposición de 1 m entre tramos?', v_item_order, 'compliance', true, 13);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-12 Máquinas, Herramientas y Equipos', 11)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-12 Máquinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las herramientas están en estado de conservación adecuado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La empresa provee herramientas aptas y seguras?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las herramientas corto-punzantes poseen fundas o vainas?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe un lugar destinado para la ubicación ordenada de las herramientas?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las herramientas portátiles eléctricas poseen protecciones para evitar riesgos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las herramientas neumáticas e hidráulicas poseen válvulas de cierre automático al dejar de accionarlas?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todas las máquinas y herramientas cuentan con protecciones para evitar riesgos al trabajador?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen dispositivos de parada de emergencia?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas eléctricas tienen sistema de puesta a tierra?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se utilizan pantallas para la proyección de partículas y chispas al soldar?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las salientes y partes móviles de máquinas y/o instalaciones cuentan con señalización y protección?', v_item_order, 'compliance', true, 11);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-13 Ruido', 12)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-13 Ruido');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo de acuerdo a las mediciones realizadas?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-14 Vehículos Industriales', 13)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-14 Vehículos Industriales');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los vehículos cuentan con los elementos de seguridad requeridos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Disponen de asientos que neutralicen las vibraciones, con respaldo y apoya pies?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Son adecuadas las cabinas de protección para las inclemencias del tiempo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Son adecuadas las cabinas para proteger del riesgo de vuelco?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están protegidos para los riesgos de desplazamiento de cargas?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los vehículos están equipados con luces, frenos, dispositivo de aviso acústico-luminoso, espejos, cinturón de seguridad, bocina y matafuegos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realiza un control de uso previo?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra señalizada la carga máxima de operación?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El aspecto exterior e interior es adecuado y está libre de deterioros significativos?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se usa código de señales para comunicarse y el área de desplazamiento está señalizada, prohibiendo el paso de personas durante la tarea?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-15 Condiciones Higrotérmicas', 14)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-15 Condiciones Higrotérmicas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El personal sometido a estrés por frío está protegido adecuadamente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrés por frío?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El personal sometido a estrés térmico y tensión térmica está protegido adecuadamente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrés térmico y tensión térmica?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-16 Aparatos para Izar', 15)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-16 Aparatos para Izar');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra identificada la carga máxima de los equipos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los ascensores y montacargas cumplen los requisitos y condiciones máximas de seguridad en construcción, instalación y mantenimiento?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los huecos se encuentran protegidos con mallas o rejas para evitar caída de personas o cosas?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los ganchos de izar poseen traba de seguridad?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los elementos auxiliares de elevación se encuentran en buen estado (cadenas, perchas, eslingas, fajas, etc.)?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todos los aparatos para izar, aparejos, puentes grúa y transportadores cumplen los requisitos y condiciones máximas de seguridad?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han localizado líneas de tensión eléctrica que puedan producir arco voltaico o contacto con elementos de izaje o carga?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Es necesario realizar un Plan de Izaje?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La condición del suelo es segura?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-17 Radiaciones', 16)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-17 Radiaciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se lleva el control y registro de las dosis individuales?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los valores hallados se encuentran dentro de lo establecido en la normativa vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajadores expuestos a fuentes de radiaciones no ionizantes (ej. soldadura) están debidamente protegidos?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-18 Vibraciones', 17)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-18 Vibraciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-19 Riesgo Biológico', 18)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-19 Riesgo Biológico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se poseen protocolos actualizados para manejo de riesgos biológicos?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-20 Trabajos en la Vía Pública / Tránsito', 19)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-20 Trabajos en la Vía Pública / Tránsito');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajos realizados en la vía pública se realizan de forma segura?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se posee alarma sonoro-lumínica para el ingreso y egreso de los vehículos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se señaliza y se vigila la vía pública al momento de operar?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los vehículos que circulan por la vía pública cumplen con la reglamentación?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Elementos de Protección Personal', 20)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Elementos de Protección Personal');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se provee a todos los trabajadores de los EPP adecuados a los riesgos a los que están expuestos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen señalizaciones visibles sobre la obligatoriedad del uso de los EPP en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Primeros Auxilios', 21)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Primeros Auxilios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen botiquines de primeros auxilios acorde a los riesgos existentes?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Trabajos de Demolición y Excavación', 22)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Trabajos de Demolición y Excavación');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se interrumpieron los servicios de gas, luz y electricidad previo al inicio de los trabajos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se respeta la distancia de seguridad de la zona de demolición?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizó el apuntalamiento de muros medianeros?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones de seguridad son verificadas por un responsable habilitado antes de comenzar cada jornada y queda documentado?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se verificó la resistencia del suelo en los bordes de la excavación?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Ante riesgo de desprendimientos se colocaron tablaestacas o entibados?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se utilizan escaleras para excavaciones con profundidad mayor a 1 m?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajadores en el fondo de pozo mantienen una distancia mínima de la máquina igual a 2 veces el largo del brazo?', v_item_order, 'compliance', true, 8);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Trabajos con Hormigón', 23)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Trabajos con Hormigón');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los materiales utilizados en encofrados son de buena calidad?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los apuntalamientos de madera tienen un máximo de un empalme por puntal?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las operaciones de pretensados están protegidas por pantallas?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las cañerías de bombeo están sólidamente amarradas y cuentan con válvula de escape de aire?', v_item_order, 'compliance', true, 4);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 5. Checklist DO - Documentación
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist DO - Documentación', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist DO - Documentación');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Gestión', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Gestión');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El Legajo de Higiene y Seguridad se encuentra actualizado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe un Programa de Gestión de HyS vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe un Programa de Seguimiento de Observaciones y Acciones?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con la Evaluación de Riesgos actualizada?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con la Matriz de EPP actualizada?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se llevan los registros de entrega de EPP conforme a la Res. SRT 299/11?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se elaboran los Informes de Gestión de HyS?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan investigaciones de accidentes y se llevan estadísticas actualizadas?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran los controles y recorridas de HyS?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con procedimientos e instructivos de HyS vigentes?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Presentaciones / Inscripciones', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Presentaciones / Inscripciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra presentado el RGRL ante la ART?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra presentado el RAR ante la ART?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizó el Aviso de Obra?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El Programa de Seguridad está aprobado por la ART y la nómina de trabajadores está actualizada?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cumple con la presentación exigida por la Res. SRT 81/19 sobre agentes cancerígenos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran al día las demás presentaciones ante ART, organismos provinciales y municipales?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El Afiche de la ART se encuentra colocado en lugar visible?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los ascensores y montacargas cuentan con la documentación reglamentaria vigente?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con el análisis físico-químico y bacteriológico de agua actualizado?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizó la limpieza de tanques con la frecuencia reglamentaria?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizó la desinsectación con la frecuencia reglamentaria?', v_item_order, 'compliance', true, 11);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Mediciones', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Mediciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran vigentes las mediciones de iluminación?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran vigentes las mediciones de ruido?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran vigentes las mediciones de carga térmica?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran vigentes las mediciones de ergonomía?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran vigentes las mediciones de PAT (puesta a tierra)?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran vigentes las mediciones de vibraciones?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran vigentes las mediciones de ASP (atmósferas con riesgo de explosión)?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran vigentes las mediciones de medio ambiente laboral?', v_item_order, 'compliance', true, 8);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Protección contra Incendios', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Protección contra Incendios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con Plan de Evacuación actualizado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los roles de emergencia se encuentran actualizados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se acredita la realización de simulacros con la frecuencia requerida?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con el Registro IFCI actualizado (solo CABA)?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizó el cálculo de carga de fuego?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Sustancias Químicas', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Sustancias Químicas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con las Fichas de Datos de Seguridad (FDS) de todos los productos peligrosos utilizados?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los productos peligrosos cumplen con el etiquetado requerido?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Capacitaciones', 5)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Capacitaciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe un Programa de Capacitación anual vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se llevan los registros de capacitación actualizados?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Registros de Mantenimiento', 6)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Registros de Mantenimiento');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe un Programa de Mantenimiento vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se llevan los registros de mantenimiento actualizados?', v_item_order, 'compliance', true, 2);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 6. Checklist IE - Instalaciones Eléctricas
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist IE - Instalaciones Eléctricas', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist IE - Instalaciones Eléctricas');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'General - Tableros', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'General - Tableros');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tableros cumplen con las condiciones de seguridad requeridas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El estado general del gabinete es adecuado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El gabinete cuenta con puesta a tierra?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La señalización del tablero es correcta y está completa?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las protecciones (disyuntores y llaves termomagnéticas) son adecuadas y están en buen estado?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las bandejas portacables se encuentran en buen estado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tomacorrientes se encuentran en buen estado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los interruptores se encuentran en buen estado?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las mediciones de puesta a tierra y continuidad están realizadas y dentro de los valores admisibles?', v_item_order, 'compliance', true, 9);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 7. Checklist AU - Autoelevadores
  -- ═══════════════════════════════════════════════════════════════
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
      VALUES (v_section_id, '¿El aspecto general exterior del autoelevador es adecuado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los neumáticos / ruedas se encuentran en buen estado (estado, presión, bulones)?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La jaula antivuelco se encuentra en buen estado?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las luces funcionan correctamente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los espejos retrovisores laterales derecho e izquierdo están presentes y en buen estado?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El sistema de escape / arrestallamas se encuentra en buen estado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El nivel de aceite es el adecuado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El nivel de agua es el adecuado?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El nivel de líquido de frenos es el adecuado?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La batería y sus conexiones se encuentran en buen estado?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La dirección funciona correctamente?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los frenos funcionan correctamente?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El freno de mano / emergencia funciona correctamente?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El mástil se encuentra en buen estado?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las uñas / horquillas se encuentran en buen estado?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El aspecto general interior es adecuado?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El asiento se encuentra en buen estado?', v_item_order, 'compliance', true, 17);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El cinturón de seguridad está presente y en buen estado?', v_item_order, 'compliance', true, 18);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La bocina funciona correctamente?', v_item_order, 'compliance', true, 19);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La alarma sonora de retroceso funciona correctamente?', v_item_order, 'compliance', true, 20);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El matafuego está presente, con presión adecuada y sin vencimiento?', v_item_order, 'compliance', true, 21);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las placas indicadoras de carga están presentes y son legibles?', v_item_order, 'compliance', true, 22);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 8. Checklist RGI - Relevamiento General de Industria
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist RGI - Relevamiento General de Industria', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist RGI - Relevamiento General de Industria');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-01 Protección Contra Incendios', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-01 Protección Contra Incendios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen medios y vías de escape adecuadas en caso de incendio?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La cantidad y tipo de matafuegos es acorde a la carga de fuego?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen sistemas de detección y extinción de incendios?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El depósito de combustibles cumple con la legislación vigente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se acredita la realización periódica de simulacros de evacuación?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se dispone de estanterías o elementos equivalentes de material no combustible o metálico?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se separan en forma alternada los materiales combustibles de los no combustibles y los que puedan reaccionar entre sí?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-02 Peligro Eléctrico', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-02 Peligro Eléctrico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están todos los cableados eléctricos adecuadamente contenidos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los conectores eléctricos se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tableros eléctricos cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las tareas de mantenimiento son efectuadas por personal capacitado y autorizado por la empresa?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptan las medidas de seguridad en locales donde se manipulen sustancias corrosivas, inflamables y/o explosivas o de alto riesgo y en locales húmedos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han adoptado medidas para la protección contra riesgos de contactos directos e indirectos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han adoptado medidas para eliminar la electricidad estática en todas las operaciones donde pueda producirse?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Posee instalación para prevenir sobretensiones producidas por descargas atmosféricas (pararrayos)?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Poseen las instalaciones tomas a tierra independientes de la instalada para descargas atmosféricas?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-03 Ergonomía', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-03 Ergonomía');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones ergonómicas son adecuadas en cuanto a levantamiento y descenso de cargas, empujes y arrastres, transporte de cargas, bipedestación, movimientos repetitivos, posturas forzadas y estrés de contacto?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan los controles administrativos y se proponen mejoras de ingeniería?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-04 Caídas a Mismo Nivel', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-04 Caídas a Mismo Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sectores de circulación como pasillos, escaleras y pisos son seguros?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están ausentes las irregularidades que puedan provocar caídas y resbalones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todas las escaleras cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todas las plataformas de trabajo y rampas cumplen con las condiciones de seguridad?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-05 Iluminación y Señalización', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-05 Iluminación y Señalización');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cumple con los requisitos de iluminación establecidos en la legislación vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha instalado un sistema de iluminación de emergencia acorde a los requerimientos de la legislación vigente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe marcación visible de pasillos, circulaciones de tránsito y lugares de cruce donde circulen cargas suspendidas y otros elementos de transporte?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran señalizados los caminos de evacuación e indicadas las salidas normales y de emergencia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran identificadas las cañerías?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-06 Espacios de Trabajo', 5)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-06 Espacios de Trabajo');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe orden y limpieza en los puestos de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen depósitos de residuos en los puestos de trabajo?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se almacenan los productos respetando la distancia mínima de 1 m entre la parte superior de las estibas y el techo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sistemas de almacenaje permiten una adecuada circulación y son seguros?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿En los almacenajes a granel, las estibas cuentan con elementos de contención?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-07 Ventilación', 6)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-07 Ventilación');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen aberturas que permitan el ingreso de aire?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los sistemas de ventilación son adecuados y se encuentran en buen estado de funcionamiento?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'G-08 Condiciones Edilicias e Infraestructura', 7)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'G-08 Condiciones Edilicias e Infraestructura');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones edilicias son adecuadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están ausentes los problemas de humedad y filtraciones?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las estructuras portantes se encuentran en buen estado?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están ausentes rajaduras de consideración que puedan afectar la estabilidad y resistencia edilicia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El estado de la pintura y revestimientos de la mampostería es correcto?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El estado estructural de las barandas, pisos y escaleras es adecuado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe provisión de agua potable para el consumo e higiene de los trabajadores?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha evitado el consumo humano del agua destinada a uso industrial?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen baños aptos higiénicamente?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen vestuarios aptos higiénicamente con armarios adecuados e individuales?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen comedores aptos higiénicamente?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La/s cocina/s reúne/n los requisitos establecidos?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los desagües industriales se recogen y canalizan por conductos, impidiendo su libre escurrimiento?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha evitado el contacto de líquidos que puedan reaccionar originando desprendimiento de gases tóxicos o contaminantes?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Son evacuados los efluentes a plantas de tratamiento?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se limpia periódicamente la planta de tratamiento con las precauciones de protección necesarias para el personal?', v_item_order, 'compliance', true, 16);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-09 Explosión / ASP', 8)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-09 Explosión / ASP');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan los controles e inspecciones periódicas establecidos en calderas y todo otro aparato sometido a presión?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han fijado las instrucciones detalladas con esquemas de la instalación y los procedimientos operativos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están los cilindros con gases a presión adecuadamente almacenados, evitando el almacenamiento excesivo, con capuchón protector y válvula cerrada?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los cilindros de gases son transportados por medios adecuados?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Disponen de válvula de seguridad y disco de ruptura instalados en condiciones correctas de uso?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se dispone de válvulas de bloqueo y parada para emergencias, dispositivos de purga y válvula de retención?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las mangueras, reguladores, manómetros, sopletes y válvulas antirretornos se encuentran en buen estado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tubos de acetileno y oxígeno disponen de válvula antiretroceso de llama?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Cuenta el operador con la capacitación y/o habilitación pertinente?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-10 Sustancias Químicas y Peligrosas', 9)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-10 Sustancias Químicas y Peligrosas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La fabricación y/o manipuleo de sustancias peligrosas cumplimenta la legislación vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las instalaciones y equipos se encuentran protegidos contra el efecto corrosivo de las sustancias empleadas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen dispositivos de alarma acústicos y visuales donde se manipulen sustancias infectantes y/o contaminantes?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha señalizado y resguardado la zona o los elementos afectados ante casos de derrame de sustancias corrosivas?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentran separados los productos incompatibles?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los productos cumplen con el etiquetado de la legislación SGA?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen duchas de emergencia y/o lava ojos en los sectores con productos peligrosos?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿En atmósferas inflamables la instalación eléctrica es antiexplosiva?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe un sistema para control de derrames de productos peligrosos?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se confeccionó un plan de seguridad para casos de emergencia y se colocó en lugar visible?', v_item_order, 'compliance', true, 10);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-11 Trabajos en Altura y a Distinto Nivel', 10)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-11 Trabajos en Altura y a Distinto Nivel');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones de viento, atmósfera y estado del suelo permiten realizar el trabajo con seguridad?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están colocadas las barreras físicas y/o señalización requeridas? (Barandas a 1 m y 0,5 m, plataforma ancho mínimo 60 cm, zócalo de 15 cm.)', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen escaleras adecuadas de ascenso a las estructuras?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra correctamente señalizada el área de trabajo?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las aberturas y huecos se encuentran protegidos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las estructuras en las cuales se desarrollan las tareas son resistentes y estables?', v_item_order, 'compliance', true, 6);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-12 Máquinas, Herramientas y Equipos', 11)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-12 Máquinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los volantes, correas, ejes, mecanismos de transmisión, salientes y cigüeñales están cubiertos para eliminar la posibilidad de contacto con las partes en movimiento?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los extremos de ejes de transmisión que sobresalen en más de un tercio de su diámetro están protegidos o redondeados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los elementos o partes móviles que pudieran producir atrapamientos, aplastamientos o cortes están protegidos o cubiertos?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La zona de recorrido de contrapesos, péndulos u otros mecanismos oscilantes está protegida mediante cerramiento?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas están provistas de dispositivos de bloqueo para evitar puesta en marcha accidental y de señalizaciones de peligro e instrucciones en castellano?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas cuentan con medios visibles y de acceso inmediato para que el operador pueda detenerlas rápidamente en caso de urgencia?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas están provistas de barreras, barandillas u otros medios de protección cuando razones de seguridad así lo exigen?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿En las tareas que requieren trabajar de pie se dispone de plataforma horizontal que permita el apoyo firme y seguro del trabajador?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas están acondicionadas para minimizar las consecuencias de condiciones climáticas desfavorables, vibraciones y demás agentes de riesgo?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se evita inspeccionar, engrasar, limpiar o reparar partes de máquinas o mecanismos de transmisión no protegidos mientras están en movimiento?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se evita operar motores a combustión interna en lugares sin salida de gases al exterior y sin adecuada renovación de aire?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La salida de escapes de motores a combustión interna evacua gases a la mayor altura posible y están provistos de arrestallamas donde existe riesgo de incendio?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las motosierras o sierras de cadena poseen dispositivos de seguridad, defensas para las manos, frenos de cadena y cadena bien afilada?', v_item_order, 'compliance', true, 13);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-13 Ruido', 12)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-13 Ruido');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo de acuerdo a las mediciones realizadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones de infrasonidos y ultrasonidos y se implementan las correcciones necesarias?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-14 Vehículos Industriales', 13)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-14 Vehículos Industriales');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los vehículos cuentan con los elementos de seguridad requeridos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Disponen de asientos que neutralicen las vibraciones, con respaldo y apoya pies?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Son adecuadas las cabinas de protección para las inclemencias del tiempo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Son adecuadas las cabinas para proteger del riesgo de vuelco?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están protegidos para los riesgos de desplazamiento de cargas?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los vehículos están equipados con luces, frenos, dispositivo de aviso acústico-luminoso, espejos, cinturón de seguridad, bocina y matafuegos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realiza un control de uso previo?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra señalizada la carga máxima de operación?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El aspecto exterior e interior es adecuado y está libre de deterioros significativos?', v_item_order, 'compliance', true, 9);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-15 Condiciones Higrotérmicas', 14)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-15 Condiciones Higrotérmicas');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El personal sometido a estrés por frío está protegido adecuadamente?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrés por frío?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El personal sometido a estrés térmico y tensión térmica está protegido adecuadamente?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se protegen los hornos, calderas, etc., para evitar la acción del calor?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Están aislados y convenientemente ventilados los aparatos capaces de producir frío con posibilidad de desprendimiento de contaminantes?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos de trabajo del personal sometido a estrés térmico y tensión térmica?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-16 Aparatos para Izar', 15)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-16 Aparatos para Izar');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra identificada la carga máxima de los equipos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los ascensores y montacargas cumplen los requisitos y condiciones máximas de seguridad en construcción, instalación y mantenimiento?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los ganchos de izar poseen traba de seguridad?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los elementos auxiliares de elevación se encuentran en buen estado (cadenas, perchas, eslingas, fajas, etc.)?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todos los aparatos para izar, aparejos, puentes grúa y transportadores cumplen los requisitos y condiciones máximas de seguridad?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han localizado líneas de tensión eléctrica que puedan producir arco voltaico o contacto con elementos de izaje o carga?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los huecos se encuentran protegidos con mallas o rejas para evitar caída de personas o cosas?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Es necesario realizar un Plan de Izaje?', v_item_order, 'compliance', true, 8);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-17 Radiaciones', 16)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-17 Radiaciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajadores y fuentes generadoras de radiaciones ionizantes (ej. rayos X) cuentan con la autorización del organismo competente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se lleva el control y registro de las dosis individuales?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los valores hallados se encuentran dentro de lo establecido en la normativa vigente?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajadores expuestos a fuentes de radiaciones no ionizantes (ej. soldadura) están debidamente protegidos?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cumple con la normativa vigente para campos magnéticos estáticos?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones de radiofrecuencia y/o microondas en los lugares de trabajo?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones de radiación infrarroja?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones de radiación ultravioleta?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones de radiación infrarroja?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran las mediciones de radiación ultravioleta?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cumple con la normativa vigente para campos magnéticos estáticos?', v_item_order, 'compliance', true, 11);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-18 Vibraciones', 17)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-18 Vibraciones');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se adoptaron las correcciones en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-19 Riesgo Biológico', 18)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-19 Riesgo Biológico');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se poseen protocolos actualizados para manejo de riesgos biológicos?', v_item_order, 'compliance', true, 1);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-20 Trabajos en la Vía Pública / Tránsito', 19)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-20 Trabajos en la Vía Pública / Tránsito');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los trabajos realizados en la vía pública se realizan de forma segura?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se posee alarma sonoro-lumínica para el ingreso y egreso de los vehículos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se señaliza y se vigila la vía pública al momento de operar?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los vehículos que circulan por la vía pública cumplen con la reglamentación?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Elementos de Protección Personal', 20)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Elementos de Protección Personal');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se provee a todos los trabajadores de los EPP adecuados a los riesgos a los que están expuestos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen señalizaciones visibles sobre la obligatoriedad del uso de los EPP en los puestos y/o lugares de trabajo?', v_item_order, 'compliance', true, 2);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Primeros Auxilios', 21)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Primeros Auxilios');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen botiquines de primeros auxilios acorde a los riesgos existentes?', v_item_order, 'compliance', true, 1);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 9. Checklist VL - Vehículos Livianos
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist VL - Vehículos Livianos', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist VL - Vehículos Livianos');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'E-20 Trabajos en la Vía Pública / Tránsito', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'E-20 Trabajos en la Vía Pública / Tránsito');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El aspecto general exterior del vehículo es adecuado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El parabrisas se encuentra en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El limpiaparabrisas funciona correctamente?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los neumáticos colocados se encuentran en buen estado?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El neumático de auxilio se encuentra en buen estado?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las luces externas funcionan correctamente?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los espejos retrovisores laterales derecho e izquierdo están presentes y en buen estado?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El sistema de escape / arrestallamas se encuentra en buen estado?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La jaula antivuelco se encuentra en buen estado?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El vehículo cuenta con cintas reflectivas en buen estado?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El vehículo tiene indicación visible de velocidad máxima?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El vehículo tiene indicación visible del número interno de unidad?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El aspecto general interior del vehículo es adecuado?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los asientos cuentan con apoyacabezas en buen estado?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los cinturones de seguridad están presentes y en buen estado?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los espejos retrovisores interiores están presentes y en buen estado?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La bocina funciona correctamente?', v_item_order, 'compliance', true, 17);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La alarma sonora de retroceso funciona correctamente?', v_item_order, 'compliance', true, 18);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los frenos de pie funcionan correctamente?', v_item_order, 'compliance', true, 19);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El freno de mano funciona correctamente?', v_item_order, 'compliance', true, 20);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La visibilidad de la cabina delantera y trasera es adecuada?', v_item_order, 'compliance', true, 21);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El tacógrafo se encuentra presente y en funcionamiento?', v_item_order, 'compliance', true, 22);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El matafuego externo está presente, con presión adecuada y sin vencimiento?', v_item_order, 'compliance', true, 23);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El matafuego interno está presente, con presión adecuada y sin vencimiento?', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín está presente y completo?', v_item_order, 'compliance', true, 25);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las balizas de pie están presentes y en buen estado?', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los banderines de advertencia están presentes y en buen estado?', v_item_order, 'compliance', true, 27);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La linterna está presente y en funcionamiento?', v_item_order, 'compliance', true, 28);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El chaleco reflectivo está presente y en buen estado?', v_item_order, 'compliance', true, 29);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El kit de supervivencia está presente y completo?', v_item_order, 'compliance', true, 30);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El criquet y la cruz o llave de ruedas están presentes y en buen estado?', v_item_order, 'compliance', true, 31);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La cuarta de remolque está presente y en buen estado?', v_item_order, 'compliance', true, 32);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 10. Checklist BO - Botiquín
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist BO - Botiquín', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist BO - Botiquín');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'General', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'General');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con crema para quemaduras (mínimo 1 unidad)?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con crema hidratante para piel x 200 ml (mínimo 1 unidad)?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con agua oxigenada x 500 cc (mínimo 1 unidad)?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con povidona iodada (desinfectante) x 60 ml (mínimo 1 unidad)?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con curitas (mínimo 20 unidades)?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con gasas hipoalergénicas de 10 cm x 10 cm en sobres (mínimo 100 unidades)?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con vendas tipo cambric de 10 cm x 3 m (mínimo 3 unidades)?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con cinta adhesiva tipo 3M (mínimo 1 unidad)?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con cinta de tela de 1 a 5 cm de ancho (mínimo 1 unidad)?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con paquete de algodón chico (mínimo 1 unidad)?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con máscara para reanimación cardiopulmonar con válvula unidireccional (mínimo 1 unidad)?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con tijera chica (mínimo 1 unidad)?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con pinza (mínimo 1 unidad)?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con termómetro (mínimo 1 unidad)?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con guantes de látex o polietileno (mínimo 2 pares)?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con bolsas para desechos de materiales usados o contaminados?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín cuenta con folleto de primeros auxilios?', v_item_order, 'compliance', true, 17);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 11. Checklist AM - Acta Inspección Ministerio de Trabajo (Dec. 351/79)
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AM - Acta Inspección Ministerio de Trabajo (Dec. 351/79)', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AM - Acta Inspección Ministerio de Trabajo (Dec. 351/79)');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'General', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'General');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el listado de personal?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se exhibe el afiche informativo de la ART a la que se encuentra afiliado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta la constancia de afiliación a la ART con listado de personal actualizado?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el mapa de riesgos de los puestos de trabajo del establecimiento?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el Relevamiento General de Riesgos Laborales (RGRL) visado por la ART?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el relevamiento de sustancias cancerígenas (Res. SRT 81/19)?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el Registro de Difenilos Policlorados (PCB) (Res. SRT 81/19)?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el Registro de Agentes de Riesgo (RAR) con nómina de personal expuesto?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La nómina de personal expuesto (NPE) presentada ante la ART guarda verosimilitud con la actividad del establecimiento?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presentan las constancias de realización de exámenes médicos preocupacionales del personal?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presentan las constancias de realización de exámenes médicos periódicos específicos de acuerdo a los agentes de riesgo presentes en el ambiente laboral?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presentan las constancias del responsable del Servicio de Higiene y Seguridad matriculado en la Provincia de Buenos Aires y el registro de horas profesionales asignadas conforme a la Ley 19.587?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con auxiliares en Higiene y Seguridad con título de técnico reconocido por autoridad competente en cantidad acorde al personal equivalente?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta la constancia del Servicio de Medicina del Trabajo y las horas profesionales asignadas conforme a la Ley 19.587?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se provee agua potable con estudio físico-químico y bacteriológico con la frecuencia requerida?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se mantienen adecuadas condiciones edilicias en el establecimiento (paredes, techos, construcciones)?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se provee al personal de servicios sanitarios adecuados e independientes para cada sexo en cantidad proporcional al número de trabajadores?', v_item_order, 'compliance', true, 17);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se provee de vestuarios aptos higiénicamente y armarios individuales?', v_item_order, 'compliance', true, 18);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se provee de comedores y cocinas aptos higiénicamente?', v_item_order, 'compliance', true, 19);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se mantiene orden y limpieza en los puestos de trabajo?', v_item_order, 'compliance', true, 20);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el certificado de control de plagas y desinfección del establecimiento?', v_item_order, 'compliance', true, 21);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con adecuada señalización y protección en las instalaciones?', v_item_order, 'compliance', true, 22);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cumplen las condiciones de seguridad en escaleras, plataformas de trabajo y rampas?', v_item_order, 'compliance', true, 23);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realiza medición, registro y control de la calidad y renovación del aire en los puestos de trabajo?', v_item_order, 'compliance', true, 24);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cumple con la extracción localizada de aire en lugares con presencia de contaminación?', v_item_order, 'compliance', true, 25);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan mediciones en los puestos y lugares de trabajo mediante protocolo de iluminación?', v_item_order, 'compliance', true, 26);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con luces de emergencia?', v_item_order, 'compliance', true, 27);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realiza el estudio de ruido en los puestos de trabajo mediante protocolo?', v_item_order, 'compliance', true, 28);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan medición, registro y control de vibraciones en los puestos de trabajo?', v_item_order, 'compliance', true, 29);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan la determinación, cuantificación y registro de los valores de carga térmica?', v_item_order, 'compliance', true, 30);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se realizan la determinación, medición, registro y control de contaminantes ambientales con su correspondiente protocolo?', v_item_order, 'compliance', true, 31);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El cableado eléctrico se encuentra adecuadamente contenido?', v_item_order, 'compliance', true, 32);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con puesta a tierra?', v_item_order, 'compliance', true, 33);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con interruptor diferencial en el tablero principal y seccionales?', v_item_order, 'compliance', true, 34);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el protocolo de medición de puesta a tierra?', v_item_order, 'compliance', true, 35);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registran los resultados del mantenimiento de las instalaciones eléctricas?', v_item_order, 'compliance', true, 36);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con señalización y protección en las partes móviles de máquinas, herramientas y/o elementos de las instalaciones?', v_item_order, 'compliance', true, 37);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con dispositivos de parada de emergencia?', v_item_order, 'compliance', true, 38);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas y herramientas portátiles eléctricas cuentan con protección adecuada?', v_item_order, 'compliance', true, 39);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra identificada la carga máxima en aparatos para izar, ascensores y montacargas?', v_item_order, 'compliance', true, 40);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los ganchos de izar cuentan con trabas de seguridad?', v_item_order, 'compliance', true, 41);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los ascensores y/o montacargas cuentan con cerraduras electromecánicas en la puerta exterior para impedir su apertura cuando no están en el piso?', v_item_order, 'compliance', true, 42);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los autoelevadores cuentan con los dispositivos de seguridad requeridos (luces de retroceso, alarma de retroceso, cinturón de seguridad, matafuegos)?', v_item_order, 'compliance', true, 43);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los conductores de autoelevadores cuentan con credencial habilitante y capacitación?', v_item_order, 'compliance', true, 44);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los aparatos sometidos a presión interna cuentan con identificación que indique fabricante, fecha, número de serie, presión de trabajo, presión de prueba y presión de diseño?', v_item_order, 'compliance', true, 45);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los recipientes, tubos, cilindros, tambores y otros que contengan gases licuados a presión se almacenan en forma correcta en el interior de los locales?', v_item_order, 'compliance', true, 46);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presentan los registros de pruebas y ensayos de aparatos sometidos a presión interna?', v_item_order, 'compliance', true, 47);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presentan las hojas de seguridad de las sustancias químicas (FDS)?', v_item_order, 'compliance', true, 48);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta la clasificación y etiquetado de productos químicos?', v_item_order, 'compliance', true, 49);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con sistema de contención (bateas) y control de derrames de productos peligrosos?', v_item_order, 'compliance', true, 50);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presentan las constancias de formación, capacitación y registro de acciones de unidades entrenadas para el control de emergencias, lucha contra incendios y evacuaciones?', v_item_order, 'compliance', true, 51);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el estudio de carga de fuego?', v_item_order, 'compliance', true, 52);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con extintores con carga vigente acordes al riesgo (cantidad y clase), colocados en un punto de fácil acceso?', v_item_order, 'compliance', true, 53);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se dispone de planos de evacuación distribuidos por el establecimiento?', v_item_order, 'compliance', true, 54);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con medios de escape o vías de evacuación ante una emergencia?', v_item_order, 'compliance', true, 55);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se cuenta con un sistema de estiba seguro y adecuada circulación, respetando la distancia mínima de 1 m entre la parte superior de las estibas y el techo?', v_item_order, 'compliance', true, 56);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La instalación eléctrica en atmósferas inflamables es antiexplosiva?', v_item_order, 'compliance', true, 57);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se registra la entrega de EPP y ropa de trabajo en planilla conforme a la Res. SRT 299/11?', v_item_order, 'compliance', true, 58);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se verifica el uso de EPP por parte del personal?', v_item_order, 'compliance', true, 59);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta un programa de capacitación anual?', v_item_order, 'compliance', true, 60);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presentan los registros y constancias del dictado de capacitaciones sobre riesgos generales y específicos?', v_item_order, 'compliance', true, 61);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se entregan a los trabajadores normas y procedimientos para el desarrollo del trabajo sin riesgos para la salud?', v_item_order, 'compliance', true, 62);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se posee botiquín de primeros auxilios?', v_item_order, 'compliance', true, 63);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el protocolo de ergonomía acorde a los puestos de trabajo sensibles a riesgos?', v_item_order, 'compliance', true, 64);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta informe certificado por un matriculado idóneo sobre el estado de las cañerías, acoples y uniones de la instalación de gas?', v_item_order, 'compliance', true, 65);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El asesor a cargo del Servicio de HyS realizó la investigación del accidente grave o mortal sufrido por un trabajador?', v_item_order, 'compliance', true, 66);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta copia de la documentación solicitada?', v_item_order, 'compliance', true, 67);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 12. Checklist AS - Aparatos Sometidos a Presión
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist AS - Aparatos Sometidos a Presión', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist AS - Aparatos Sometidos a Presión');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Explosión / ASP', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Explosión / ASP');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe un registro interno de los controles y revisiones efectuados por la empresa o proveedor habilitado?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El emplazamiento de los aparatos está alejado de fuentes de calor y correctamente ventilado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Disponen de válvula de seguridad y disco de ruptura instalados y en condiciones correctas de uso?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se llevan a cabo operaciones de mantenimiento de acuerdo a un programa establecido, con fechas de verificación y vencimientos?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los operarios están instruidos en el manejo seguro del equipo? ¿En el caso de compresores existe una persona exclusiva encargada?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El compresor está situado al aire libre o en un local con aislamiento acústico, ventilado, resistente al fuego y alejado de áreas de trabajo?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se dispone de válvulas de bloqueo y parada para emergencias, dispositivos de purga (agua, aceite) y válvula de retención?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las tuberías auxiliares están bien sujetas para evitar vibraciones y desprendimientos?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los recipientes de gases están bien sujetos, alejados de focos caloríficos y ubicados en áreas delimitadas y protegidas?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las conducciones de gases se mantienen en buen estado (sin corrosión, buena sujeción, vainas pasamuros, etc.)?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tubos de gases almacenados, incluidos los vacíos, están provistos de capuchón o protector y tienen la válvula cerrada?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tubos de gases se transportan en carros o baterías adecuadas?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los tubos de acetileno y oxígeno disponen de válvula antiretroceso de llama?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe un programa de mantenimiento preventivo y de formación sobre los peligros que puedan producirse?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los gases (cañerías, cilindros, capuchón, etc.) están identificados según los colores correspondientes a la norma IRAM 2641?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se evita el almacenamiento excesivo de aparatos sometidos a presión (cilindros, etc.)?', v_item_order, 'compliance', true, 16);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 13. Checklist OL - Orden y Limpieza
  -- ═══════════════════════════════════════════════════════════════
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
      VALUES (v_section_id, '¿Las escaleras y plataformas están limpias, en buen estado y libres de obstáculos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las paredes están limpias y en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las ventanas están limpias sin impedir la entrada de luz natural?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El sistema de iluminación está mantenido de forma eficiente y limpia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las señales de seguridad están visibles y correctamente distribuidas?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Suelos y Pasillos', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Suelos y Pasillos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los suelos están limpios, secos, sin desperdicios ni material innecesario?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las vías de circulación de personas y vehículos están diferenciadas y señalizadas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los pasillos y zonas de tránsito están libres de obstáculos?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Almacenaje', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Almacenaje');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las áreas de almacenamiento y deposición de materiales están señalizadas?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los materiales y sustancias almacenadas se encuentran correctamente identificados?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los materiales están apilados en su sitio sin invadir zonas de paso?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Máquinas, Herramientas y Equipos', 3)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Máquinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas y equipos se encuentran limpios y libres en su entorno de todo material innecesario?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas y equipos están libres de filtraciones innecesarias de aceites y grasas?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las máquinas y equipos poseen las protecciones adecuadas y los dispositivos de seguridad en funcionamiento?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las herramientas están almacenadas en cajas o paneles adecuados, con un lugar asignado para cada una?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las herramientas se guardan limpias de aceite y grasa?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las herramientas eléctricas tienen el cableado y las conexiones en buen estado?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las herramientas están en condiciones seguras para el trabajo, sin defectos ni oxidación?', v_item_order, 'compliance', true, 7);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Residuos', 4)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Residuos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los contenedores están colocados próximos y accesibles a los lugares de trabajo?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los contenedores están claramente identificados de acuerdo al tipo de residuo (especial, reciclable, etc.)?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se evita el rebose de los contenedores?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La zona alrededor de los contenedores de residuos está limpia?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen medios de limpieza a disposición del personal del área?', v_item_order, 'compliance', true, 5);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 14. Checklist IZ - Izaje de Cargas
  -- ═══════════════════════════════════════════════════════════════
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
      VALUES (v_section_id, '¿Se verificó el izaje a efectuarse según radio de giro, peso y tabla de carga?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se agregaron al cálculo del peso todos los elementos de izaje (perchas, pastecas, etc.)?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se encuentra señalizada la carga máxima en el equipo?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Hay elementos dentro de la carga que puedan desplazarse durante el izaje y se han tomado medidas para evitarlo?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han delimitado y vallado las áreas de izaje?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se ha designado a la persona a cargo del izaje (nombre, apellido, puesto y calificaciones)?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se solicitó el registro de mantenimiento del equipo (propio y/o por ente de certificación) y se encuentra apto?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se solicitaron los certificados de las fajas y las eslingas?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La carga es suficientemente frágil como para requerir una estructura de refuerzo o sujeción desde varios puntos para evitar daños?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La estructura de refuerzo fue diseñada por un ingeniero competente, cuenta con cálculos teóricos y fue probada con la carga?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han inspeccionado todos los elementos de izaje (argollas, ganchos, eslingas, grilletes, cáncamos, cables de la grúa, etc.) conforme a las normas de inspección?', v_item_order, 'compliance', true, 11);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se evitaron en las eslingas ángulos menores de 45° respecto a la horizontal y se seleccionaron de modo que soporten el aumento de cargas por los ángulos?', v_item_order, 'compliance', true, 12);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La sujeción está dispuesta de modo que el gancho de la grúa quede directamente por encima del centro de gravedad de la carga?', v_item_order, 'compliance', true, 13);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se utilizan protectores (ej. medias cañas) en los lugares donde los bordes agudos de la carga puedan ocasionar daños en las eslingas?', v_item_order, 'compliance', true, 14);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se controló la existencia de obstrucciones aéreas electrificadas dentro del radio de giro de la grúa?', v_item_order, 'compliance', true, 15);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se han localizado líneas de alta o media tensión eléctrica que puedan producir arco voltaico o contacto con alguna parte de la grúa?', v_item_order, 'compliance', true, 16);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se debe realizar un ATS o Permiso de Trabajo de acuerdo al tipo de izaje?', v_item_order, 'compliance', true, 17);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se dispone de iluminación adecuada en caso de que la operación de izaje deba prolongarse fuera del horario de luz diurna?', v_item_order, 'compliance', true, 18);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El personal de sujeción puede controlar y manipular en forma segura la carga a lo largo de todo el trayecto del izaje?', v_item_order, 'compliance', true, 19);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las condiciones meteorológicas son aptas para efectuar la operación de izaje?', v_item_order, 'compliance', true, 20);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 15. Checklist SQ - Sustancias Químicas
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist SQ - Sustancias Químicas', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist SQ - Sustancias Químicas');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Almacenamiento', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Almacenamiento');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todos los productos químicos se encuentran correctamente almacenados?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿En atmósferas inflamables la instalación eléctrica es antiexplosiva?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe un sistema para el control de posibles derrames de productos peligrosos?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Manipulación', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Manipulación');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La manipulación de productos químicos es segura y se poseen elementos y espacios de trabajo adecuados?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existen duchas de emergencia y/o lava ojos en los sectores donde se manipulan productos químicos?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se entregan los EPP al personal y se utilizan y conservan correctamente?', v_item_order, 'compliance', true, 3);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Gestión', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Gestión');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se poseen las Fichas de Datos de Seguridad (FDS) de todos los productos químicos existentes, conforme al Sistema SGA?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Todos los recipientes que contienen productos químicos están etiquetados conforme al Sistema SGA?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se confeccionó un plan de seguridad para casos de emergencia y se colocó en lugar visible?', v_item_order, 'compliance', true, 3);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 16. Checklist CC - Control de Contratistas
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist CC - Control de Contratistas', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist CC - Control de Contratistas');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Documentación - Empresas contratistas CON personal en relación de dependencia', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Documentación - Empresas contratistas CON personal en relación de dependencia');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el Certificado de Cobertura de ART vigente?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta la Cláusula de No Repetición completa?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el Aviso de Obra presentado ante su ART?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el Programa de Seguridad aprobado por su ART?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presentan las constancias de capacitación del personal (actualizadas)?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el registro de entrega de EPP según planilla Res. SRT 299/11?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta la matrícula del Profesional Responsable de Higiene y Seguridad de la empresa?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presentan los registros de visitas y cumplimiento de horas profesionales del Responsable de HyS?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se informó el centro médico o prestador de la ART más cercano al lugar de trabajo para traslado de accidentados?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta la Evaluación de Riesgos de acuerdo a los trabajos a realizar y/o ATS y/o Permisos de Trabajo?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta otra documentación requerida?', v_item_order, 'compliance', true, 11);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Documentación - Autónomos o monotributistas SIN personal en relación de dependencia', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Documentación - Autónomos o monotributistas SIN personal en relación de dependencia');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el certificado de cobertura de póliza de accidentes personales por muerte e invalidez total y permanente, y gastos farmacéuticos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta la Cláusula de No Repetición completa?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta un procedimiento escrito para las tareas a realizar indicando una metodología de trabajo seguro?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presentan las constancias de capacitación (actualizadas)?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta el registro de entrega de EPP según planilla Res. SRT 299/11?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta la matrícula del Profesional Responsable de Higiene y Seguridad del autónomo/monotributista?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presentan los registros de visitas y cumplimiento de horas profesionales del Responsable de HyS?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se informó el centro médico de la obra social o prepaga más cercano al lugar de trabajo para traslado de accidentados?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se presenta otra documentación requerida?', v_item_order, 'compliance', true, 9);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 17. Checklist RE - Red de Incendio
  -- ═══════════════════════════════════════════════════════════════
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
      VALUES (v_section_id, '¿Los nichos y gabinetes son accesibles y están señalizados?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los nichos y gabinetes se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los nichos y gabinetes están completos (mangueras, lanzas, accesorios)?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La conexión a la red de agua está en buen estado y la manguera correctamente armada/enrollada?', v_item_order, 'compliance', true, 4);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Alarmas y Detección', 1)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Alarmas y Detección');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los pulsadores de alarma son accesibles y están señalizados?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los pulsadores de alarma se encuentran en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El sistema de alarma funciona correctamente y es audible en todas las áreas y sectores?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los detectores de incendio están instalados en todas las áreas necesarias?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los detectores de incendio se encuentran operativos y libres de polvo o suciedad que pueda afectar su funcionamiento?', v_item_order, 'compliance', true, 5);
  END IF;

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Control y Mantenimiento', 2)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Control y Mantenimiento');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se controla la instalación de forma periódica?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se poseen los registros y documentación necesaria de acuerdo a la normativa vigente aplicable (planos, QR, etc.)?', v_item_order, 'compliance', true, 2);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 18. Checklist VI - Visita de Locales
  -- ═══════════════════════════════════════════════════════════════
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
      VALUES (v_section_id, '¿Los extintores cumplen con la cantidad, tipo, ubicación y estado requeridos?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Existe alarma y/o modo de aviso para emergencias en funcionamiento?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las luces de emergencia cumplen con la cantidad, ubicación y estado requeridos?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El botiquín de primeros auxilios está presente y completo?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La iluminación y señalización son adecuadas (estado de luminarias, protección anticaída, señalizaciones de seguridad de riesgo eléctrico, salidas y otras)?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La instalación eléctrica es adecuada (tableros, conductores, tomacorrientes, protecciones eléctricas)?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El sistema de extracción de campana y ventilación del local funciona correctamente y se encuentra en adecuadas condiciones de mantenimiento y limpieza?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los espacios de trabajo cuentan con orden y limpieza adecuados, y los desniveles, pisos y escaleras fijas están en buen estado?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los EPP están disponibles, se utilizan correctamente y se encuentran en buen estado de conservación?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿La instalación de gas se encuentra en buen estado y con mantenimiento adecuado?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las demás condiciones y aspectos del local son adecuados?', v_item_order, 'compliance', true, 11);
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- 19. Checklist MQ - Máquinas, Herramientas y Equipos
  -- ═══════════════════════════════════════════════════════════════
  INSERT INTO public.gestiones (nombre, categoria_id)
    VALUES ('Checklist MQ - Máquinas, Herramientas y Equipos', v_checklist_cat_id)
    ON CONFLICT (nombre) DO NOTHING;
  v_gestion_id := (SELECT id FROM public.gestiones WHERE nombre = 'Checklist MQ - Máquinas, Herramientas y Equipos');

  INSERT INTO public.formulario_secciones (gestion_id, title, order_index)
    VALUES (v_gestion_id, 'Control de Máquinas, Herramientas y Equipos', 0)
    ON CONFLICT (gestion_id, title) DO NOTHING;
  v_section_id := (SELECT id FROM public.formulario_secciones WHERE gestion_id = v_gestion_id AND title = 'Control de Máquinas, Herramientas y Equipos');

  IF NOT EXISTS (SELECT 1 FROM public.formulario_items WHERE section_id = v_section_id) THEN
    v_item_order := 0;

    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El estado general es adecuado (limpieza, conductores, interruptores, fichas, carcasa, etc.)?', v_item_order, 'compliance', true, 1);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las protecciones mecánicas están presentes y en buen estado?', v_item_order, 'compliance', true, 2);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las protecciones eléctricas están presentes y en buen estado?', v_item_order, 'compliance', true, 3);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Son aptas, seguras y adecuadas para las tareas que se realizan?', v_item_order, 'compliance', true, 4);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Cuentan con paradas de emergencia operativas?', v_item_order, 'compliance', true, 5);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Cuentan con bloqueos y/o cortes automáticos operativos?', v_item_order, 'compliance', true, 6);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los accesorios y elementos auxiliares son adecuados (llaves de ajuste, prolongaciones, etc.)?', v_item_order, 'compliance', true, 7);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿El almacenamiento y/o guardado es correcto?', v_item_order, 'compliance', true, 8);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Las señalizaciones, placas e información son legibles?', v_item_order, 'compliance', true, 9);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Se utilizan los EPP correspondientes durante su operación?', v_item_order, 'compliance', true, 10);
    v_item_order := v_item_order + 1;
    INSERT INTO public.formulario_items (section_id, question, order_index, response_type, required, numero_item)
      VALUES (v_section_id, '¿Los demás aspectos relevantes son adecuados?', v_item_order, 'compliance', true, 11);
  END IF;

END $$;