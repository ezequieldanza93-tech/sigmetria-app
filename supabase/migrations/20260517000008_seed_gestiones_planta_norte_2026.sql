-- ============================================================
-- Seed: 6 gestiones × 12 meses 2026 — Planta Norte / Demo Empresa S.A.
-- ============================================================

DO $$
DECLARE
  v_est_id  uuid;
  v_g_id    uuid;
  v_ge_id   uuid;
  v_gestiones text[] := ARRAY[
    'Checklist Estandares del Sitio',
    'Capacitación: Riesgos Generales y Uso de EPP',
    'Inducción de Higiene Seguridad & Bienestar',
    'Auditoría Interna NC',
    'Inspección de Organismo de Control sin Sanción',
    'Simulacro: Emergencias'
  ];
  v_days    int[]  := ARRAY[5, 10, 15, 20, 23, 28];
  i         int;
  mes       int;
BEGIN
  SELECT e.id INTO v_est_id
  FROM establecimientos e
  JOIN empresas emp ON emp.id = e.empresa_id
  WHERE e.nombre ILIKE '%Planta Norte%'
    AND emp.razon_social ILIKE '%Demo Empresa%'
  LIMIT 1;

  IF v_est_id IS NULL THEN
    RAISE NOTICE 'Establecimiento "Planta Norte" no encontrado — saltando seed.';
    RETURN;
  END IF;

  FOR i IN 1..array_length(v_gestiones, 1) LOOP
    SELECT id INTO v_g_id
    FROM gestiones
    WHERE nombre = v_gestiones[i]
    LIMIT 1;

    IF v_g_id IS NULL THEN
      RAISE NOTICE 'Gestión "%" no encontrada — saltando.', v_gestiones[i];
      CONTINUE;
    END IF;

    INSERT INTO gestion_establecimiento (gestion_id, establecimiento_id)
    VALUES (v_g_id, v_est_id)
    ON CONFLICT (gestion_id, establecimiento_id) DO NOTHING;

    SELECT id INTO v_ge_id
    FROM gestion_establecimiento
    WHERE gestion_id = v_g_id AND establecimiento_id = v_est_id;

    FOR mes IN 1..12 LOOP
      INSERT INTO registro_gestiones (gestion_establecimiento_id, fecha_planificada)
      VALUES (v_ge_id, make_date(2026, mes, v_days[i]));
    END LOOP;
  END LOOP;
END $$;
