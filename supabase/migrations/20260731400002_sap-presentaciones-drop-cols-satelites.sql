-- =============================================================
-- Elimina de sap_presentaciones las columnas migradas a satélites
-- =============================================================
-- PREREQUISITO: 20260731400001 ya aplicada (tablas satélite creadas,
-- datos migrados, código de la app apuntando a las nuevas tablas).
-- Las columnas del Bloque E (profesional_*) se CONSERVAN — son snapshots.
-- =============================================================

ALTER TABLE public.sap_presentaciones
  -- Bloque A — local e infraestructura → sap_presentaciones_local
  DROP COLUMN IF EXISTS uso_id,
  DROP COLUMN IF EXISTS superficie_cubierta_m2,
  DROP COLUMN IF EXISTS superficie_aire_libre_m2,
  DROP COLUMN IF EXISTS pisos_elevados,
  DROP COLUMN IF EXISTS tiene_subsuelo,
  DROP COLUMN IF EXISTS cantidad_subsuelos,
  DROP COLUMN IF EXISTS actividad_en_subsuelo,
  DROP COLUMN IF EXISTS tiene_inflamables,
  DROP COLUMN IF EXISTS litros_inflamables,
  DROP COLUMN IF EXISTS tiene_baterias_litio,
  DROP COLUMN IF EXISTS kg_baterias_litio,
  DROP COLUMN IF EXISTS estaciones_carga_ev,
  DROP COLUMN IF EXISTS presta_servicio_ve,
  DROP COLUMN IF EXISTS propiedad_horizontal,

  -- Bloque B — actividad y ocupación → sap_presentaciones_actividad
  DROP COLUMN IF EXISTS razon_social,
  DROP COLUMN IF EXISTS cuit,
  DROP COLUMN IF EXISTS nombre_comercial,
  DROP COLUMN IF EXISTS habilitacion_tipo,
  DROP COLUMN IF EXISTS habilitacion_detalle,
  DROP COLUMN IF EXISTS dias_horarios,
  DROP COLUMN IF EXISTS aforo,
  DROP COLUMN IF EXISTS ocupacion_diurna,
  DROP COLUMN IF EXISTS ocupacion_nocturna,
  DROP COLUMN IF EXISTS personas_movilidad_reducida,

  -- Bloque C — G1 → sap_presentaciones_g1
  DROP COLUMN IF EXISTS g1_declarante_persona_id,
  DROP COLUMN IF EXISTS g1_declarante_nombre,
  DROP COLUMN IF EXISTS g1_declarante_dni_cuit,
  DROP COLUMN IF EXISTS g1_caracter,
  DROP COLUMN IF EXISTS g1_capacidad_m2_persona,
  DROP COLUMN IF EXISTS g1_tiene_entrepiso,
  DROP COLUMN IF EXISTS g1_entrepiso_superficie,
  DROP COLUMN IF EXISTS g1_entrepiso_destino,
  DROP COLUMN IF EXISTS g1_subsuelo_destino,
  DROP COLUMN IF EXISTS g1_elementos_mitigacion,
  DROP COLUMN IF EXISTS g1_personal_instruido,
  DROP COLUMN IF EXISTS g1_responsabilidad_evacuacion,

  -- Bloque D — G3 → sap_presentaciones_g3
  DROP COLUMN IF EXISTS g3_riesgos_entorno,
  DROP COLUMN IF EXISTS g3_riesgos_procesos,
  DROP COLUMN IF EXISTS g3_procedimientos_respuesta,
  DROP COLUMN IF EXISTS g3_procedimiento_alarma,

  -- Bloque F — evacuación → sap_presentaciones_evacuacion
  DROP COLUMN IF EXISTS aviso_descripcion,
  DROP COLUMN IF EXISTS aviso_viva_voz,
  DROP COLUMN IF EXISTS evacuacion_procedimiento,
  DROP COLUMN IF EXISTS punto_reunion_descripcion,
  DROP COLUMN IF EXISTS puesta_a_resguardo,
  DROP COLUMN IF EXISTS enclavamientos,
  DROP COLUMN IF EXISTS medidas_supletorias;

-- Verificar columnas restantes en la tabla principal
DO $$
DECLARE
  col_count integer;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'sap_presentaciones';
  RAISE NOTICE 'sap_presentaciones ahora tiene % columnas (esperado ~27)', col_count;
END $$;
