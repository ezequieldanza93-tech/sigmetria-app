-- =============================================================
-- Normalización sap_presentaciones: 82 cols → tablas satélite
-- =============================================================
-- Crea 5 tablas satélite (1:1), migra los datos de la fila existente,
-- crea la vista sap_presentaciones_full para compatibilidad hacia atrás,
-- y documenta las columnas snapshot del profesional actuante (Bloque E).
-- Los DROP COLUMN van en la migración siguiente (20260731400002).
-- =============================================================

-- ─────────────────────────────────────────────────────────────
-- Bloque A: Datos del local e infraestructura (14 cols)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.sap_presentaciones_local (
  presentacion_id uuid PRIMARY KEY
    REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,

  uso_id                   uuid REFERENCES public.sap_usos(id),
  superficie_cubierta_m2   numeric,
  superficie_aire_libre_m2 numeric,
  pisos_elevados           smallint,
  tiene_subsuelo           boolean,
  cantidad_subsuelos       smallint,
  actividad_en_subsuelo    boolean,
  tiene_inflamables        boolean,
  litros_inflamables       numeric,
  tiene_baterias_litio     boolean,
  kg_baterias_litio        numeric,
  estaciones_carga_ev      boolean,
  presta_servicio_ve       boolean,
  propiedad_horizontal     boolean
);

INSERT INTO public.sap_presentaciones_local (
  presentacion_id,
  uso_id, superficie_cubierta_m2, superficie_aire_libre_m2,
  pisos_elevados, tiene_subsuelo, cantidad_subsuelos, actividad_en_subsuelo,
  tiene_inflamables, litros_inflamables, tiene_baterias_litio, kg_baterias_litio,
  estaciones_carga_ev, presta_servicio_ve, propiedad_horizontal
)
SELECT
  id,
  uso_id, superficie_cubierta_m2, superficie_aire_libre_m2,
  pisos_elevados, tiene_subsuelo, cantidad_subsuelos, actividad_en_subsuelo,
  tiene_inflamables, litros_inflamables, tiene_baterias_litio, kg_baterias_litio,
  estaciones_carga_ev, presta_servicio_ve, propiedad_horizontal
FROM public.sap_presentaciones;

-- ─────────────────────────────────────────────────────────────
-- Bloque B: Actividad y ocupación (10 cols)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.sap_presentaciones_actividad (
  presentacion_id uuid PRIMARY KEY
    REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,

  razon_social                text,
  cuit                        text,
  nombre_comercial            text,
  habilitacion_tipo           text,
  habilitacion_detalle        text,
  dias_horarios               text,
  aforo                       integer,
  ocupacion_diurna            integer,
  ocupacion_nocturna          integer,
  personas_movilidad_reducida integer
);

INSERT INTO public.sap_presentaciones_actividad (
  presentacion_id,
  razon_social, cuit, nombre_comercial,
  habilitacion_tipo, habilitacion_detalle, dias_horarios,
  aforo, ocupacion_diurna, ocupacion_nocturna, personas_movilidad_reducida
)
SELECT
  id,
  razon_social, cuit, nombre_comercial,
  habilitacion_tipo, habilitacion_detalle, dias_horarios,
  aforo, ocupacion_diurna, ocupacion_nocturna, personas_movilidad_reducida
FROM public.sap_presentaciones;

-- ─────────────────────────────────────────────────────────────
-- Bloque C: Sección G1 — solo establecimientos Grupo 1 (12 cols)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.sap_presentaciones_g1 (
  presentacion_id uuid PRIMARY KEY
    REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,

  g1_declarante_persona_id    uuid REFERENCES public.personas_directorio(id),
  g1_declarante_nombre        text,
  g1_declarante_dni_cuit      text,
  g1_caracter                 text,
  g1_capacidad_m2_persona     numeric,
  g1_tiene_entrepiso          boolean,
  g1_entrepiso_superficie     numeric,
  g1_entrepiso_destino        text,
  g1_subsuelo_destino         text,
  g1_elementos_mitigacion     text,
  g1_personal_instruido       boolean,
  g1_responsabilidad_evacuacion boolean
);

INSERT INTO public.sap_presentaciones_g1 (
  presentacion_id,
  g1_declarante_persona_id, g1_declarante_nombre, g1_declarante_dni_cuit,
  g1_caracter, g1_capacidad_m2_persona,
  g1_tiene_entrepiso, g1_entrepiso_superficie, g1_entrepiso_destino,
  g1_subsuelo_destino, g1_elementos_mitigacion,
  g1_personal_instruido, g1_responsabilidad_evacuacion
)
SELECT
  id,
  g1_declarante_persona_id, g1_declarante_nombre, g1_declarante_dni_cuit,
  g1_caracter, g1_capacidad_m2_persona,
  g1_tiene_entrepiso, g1_entrepiso_superficie, g1_entrepiso_destino,
  g1_subsuelo_destino, g1_elementos_mitigacion,
  g1_personal_instruido, g1_responsabilidad_evacuacion
FROM public.sap_presentaciones
WHERE grupo_calculado = 1
   OR (g1_declarante_nombre IS NOT NULL OR g1_caracter IS NOT NULL);

-- ─────────────────────────────────────────────────────────────
-- Bloque D: Sección G3 — solo establecimientos Grupo 3 (4 cols)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.sap_presentaciones_g3 (
  presentacion_id uuid PRIMARY KEY
    REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,

  g3_riesgos_entorno          text,
  g3_riesgos_procesos         text,
  g3_procedimientos_respuesta text,
  g3_procedimiento_alarma     text
);

INSERT INTO public.sap_presentaciones_g3 (
  presentacion_id,
  g3_riesgos_entorno, g3_riesgos_procesos,
  g3_procedimientos_respuesta, g3_procedimiento_alarma
)
SELECT
  id,
  g3_riesgos_entorno, g3_riesgos_procesos,
  g3_procedimientos_respuesta, g3_procedimiento_alarma
FROM public.sap_presentaciones
WHERE grupo_calculado = 3
   OR (g3_riesgos_entorno IS NOT NULL OR g3_riesgos_procesos IS NOT NULL);

-- ─────────────────────────────────────────────────────────────
-- Bloque F: Plan de evacuación (7 cols)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE public.sap_presentaciones_evacuacion (
  presentacion_id uuid PRIMARY KEY
    REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,

  aviso_descripcion           text,
  aviso_viva_voz              boolean,
  evacuacion_procedimiento    text,
  punto_reunion_descripcion   text,
  puesta_a_resguardo          text,
  enclavamientos              text,
  medidas_supletorias         text
);

INSERT INTO public.sap_presentaciones_evacuacion (
  presentacion_id,
  aviso_descripcion, aviso_viva_voz,
  evacuacion_procedimiento, punto_reunion_descripcion,
  puesta_a_resguardo, enclavamientos, medidas_supletorias
)
SELECT
  id,
  aviso_descripcion, aviso_viva_voz,
  evacuacion_procedimiento, punto_reunion_descripcion,
  puesta_a_resguardo, enclavamientos, medidas_supletorias
FROM public.sap_presentaciones;

-- ─────────────────────────────────────────────────────────────
-- Bloque E: Profesional actuante — snapshot histórico intencional
-- Las 5 cols se MANTIENEN en la tabla principal (no se mueven a satélite).
-- Son snapshot del profesional al momento del trámite: si el profesional
-- actualiza sus datos en personas_directorio, el trámite original debe
-- reflejar los datos que tenía en ese instante.
-- ─────────────────────────────────────────────────────────────
COMMENT ON COLUMN public.sap_presentaciones.profesional_nombre IS
  'Snapshot histórico: nombre del profesional al momento del trámite. No sincronizar con personas_directorio. Ver también profesional_persona_id.';
COMMENT ON COLUMN public.sap_presentaciones.profesional_titulo IS
  'Snapshot histórico: título habilitante del profesional al momento del trámite.';
COMMENT ON COLUMN public.sap_presentaciones.profesional_matricula IS
  'Snapshot histórico: matrícula profesional al momento del trámite.';
COMMENT ON COLUMN public.sap_presentaciones.profesional_email IS
  'Snapshot histórico: email de contacto del profesional al momento del trámite.';
COMMENT ON COLUMN public.sap_presentaciones.profesional_telefono IS
  'Snapshot histórico: teléfono del profesional al momento del trámite.';

-- ─────────────────────────────────────────────────────────────
-- Vista de compatibilidad hacia atrás: sap_presentaciones_full
-- Une la tabla principal con los 5 satélites.
-- Usar esta vista para todos los SELECTs que antes hacían SELECT * FROM sap_presentaciones.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.sap_presentaciones_full AS
SELECT
  -- CORE (tabla principal: Bloque CORE + G + H + profesional snapshot)
  p.id,
  p.establecimiento_id,
  p.empresa_id,
  p.consultora_id,
  p.estado,
  p.via_tramite,
  p.paso_actual,
  p.grupo_calculado,
  p.admite_revalida,
  p.clasificacion_motivo,
  p.fecha_presentacion,
  p.fecha_aprobacion,
  p.fecha_vencimiento,
  p.expediente_nro,
  p.disposicion_nro,
  p.observaciones_autoridad,
  -- Bloque G — declaraciones y contacto
  p.decl_viabilidad,
  p.decl_comunicar_cambios,
  p.telefono_emergencia,
  p.qr_ifci,
  p.requisitos_tecnicos,
  -- Bloque H — condiciones especiales (flags de alta consulta)
  p.procesos_soldadura,
  p.tiene_internacion,
  p.gases_medicinales,
  p.tiene_deposito_telones_utileria,
  -- Bloque E — profesional actuante (snapshot histórico)
  p.profesional_persona_id,
  p.profesional_nombre,
  p.profesional_titulo,
  p.profesional_matricula,
  p.profesional_email,
  p.profesional_telefono,
  -- auditoría
  p.created_by,
  p.created_at,
  p.updated_at,
  p.deleted_at,

  -- Bloque A — local e infraestructura (satélite)
  l.uso_id,
  l.superficie_cubierta_m2,
  l.superficie_aire_libre_m2,
  l.pisos_elevados,
  l.tiene_subsuelo,
  l.cantidad_subsuelos,
  l.actividad_en_subsuelo,
  l.tiene_inflamables,
  l.litros_inflamables,
  l.tiene_baterias_litio,
  l.kg_baterias_litio,
  l.estaciones_carga_ev,
  l.presta_servicio_ve,
  l.propiedad_horizontal,

  -- Bloque B — actividad y ocupación (satélite)
  a.razon_social,
  a.cuit,
  a.nombre_comercial,
  a.habilitacion_tipo,
  a.habilitacion_detalle,
  a.dias_horarios,
  a.aforo,
  a.ocupacion_diurna,
  a.ocupacion_nocturna,
  a.personas_movilidad_reducida,

  -- Bloque C — G1 (satélite, solo Grupo 1)
  g1.g1_declarante_persona_id,
  g1.g1_declarante_nombre,
  g1.g1_declarante_dni_cuit,
  g1.g1_caracter,
  g1.g1_capacidad_m2_persona,
  g1.g1_tiene_entrepiso,
  g1.g1_entrepiso_superficie,
  g1.g1_entrepiso_destino,
  g1.g1_subsuelo_destino,
  g1.g1_elementos_mitigacion,
  g1.g1_personal_instruido,
  g1.g1_responsabilidad_evacuacion,

  -- Bloque D — G3 (satélite, solo Grupo 3)
  g3.g3_riesgos_entorno,
  g3.g3_riesgos_procesos,
  g3.g3_procedimientos_respuesta,
  g3.g3_procedimiento_alarma,

  -- Bloque F — evacuación (satélite)
  ev.aviso_descripcion,
  ev.aviso_viva_voz,
  ev.evacuacion_procedimiento,
  ev.punto_reunion_descripcion,
  ev.puesta_a_resguardo,
  ev.enclavamientos,
  ev.medidas_supletorias

FROM public.sap_presentaciones p
LEFT JOIN public.sap_presentaciones_local     l  ON l.presentacion_id  = p.id
LEFT JOIN public.sap_presentaciones_actividad a  ON a.presentacion_id  = p.id
LEFT JOIN public.sap_presentaciones_g1        g1 ON g1.presentacion_id = p.id
LEFT JOIN public.sap_presentaciones_g3        g3 ON g3.presentacion_id = p.id
LEFT JOIN public.sap_presentaciones_evacuacion ev ON ev.presentacion_id = p.id;

-- ─────────────────────────────────────────────────────────────
-- Verificación rápida: las 5 tablas satélite deben tener ≤ 1 fila
-- (igual que la tabla principal en pre-lanzamiento)
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  cnt_local     bigint;
  cnt_actividad bigint;
  cnt_g1        bigint;
  cnt_g3        bigint;
  cnt_ev        bigint;
  cnt_main      bigint;
BEGIN
  SELECT COUNT(*) INTO cnt_main     FROM public.sap_presentaciones;
  SELECT COUNT(*) INTO cnt_local    FROM public.sap_presentaciones_local;
  SELECT COUNT(*) INTO cnt_actividad FROM public.sap_presentaciones_actividad;
  SELECT COUNT(*) INTO cnt_ev       FROM public.sap_presentaciones_evacuacion;

  RAISE NOTICE 'sap_presentaciones: % filas', cnt_main;
  RAISE NOTICE 'sap_presentaciones_local: % filas', cnt_local;
  RAISE NOTICE 'sap_presentaciones_actividad: % filas', cnt_actividad;
  RAISE NOTICE 'sap_presentaciones_evacuacion: % filas', cnt_ev;
END $$;
