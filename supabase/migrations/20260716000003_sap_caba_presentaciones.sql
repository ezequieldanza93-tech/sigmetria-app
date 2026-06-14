-- ============================================================
-- Sistema de Autoprotección (SAP) CABA — Ley 5920 · TRANSACCIONAL
-- ============================================================
-- Una `sap_presentaciones` por trámite de SAP de un establecimiento. Guarda:
--  - inputs de clasificación (Anexo I) → 3FN, una columna por atributo;
--  - el grupo calculado por el motor + el motivo (trazabilidad legal);
--  - campos 1:1 de la DDJJ Grupo 1 (Anexo II) y del SAP Grupo 2/3 (Anexo III-A);
--  - ciclo de vida (estado, fechas de vigencia, expediente/disposición).
-- Lo repetible (sustancias, actividades por planta, riesgos, medios técnicos,
-- roles, simulacros) va a tablas hijas (3FN, sin campos multivaluados).
--
-- RLS por establecimiento (has_establecimiento_read/write_access). Hijas heredan
-- acceso vía EXISTS sobre el padre. Soft-delete con deleted_at (papelera).
--
-- Idempotente.
-- ============================================================

-- ─── 1. Presentación (cabecera 1:1) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.sap_presentaciones (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establecimiento_id  uuid NOT NULL REFERENCES public.establecimientos(id) ON DELETE CASCADE,
  empresa_id          uuid REFERENCES public.empresas(id) ON DELETE CASCADE,       -- denormalizado (índices/RLS baratos)
  consultora_id       uuid REFERENCES public.consultoras(id) ON DELETE CASCADE,    -- denormalizado (storage path / archivos)

  -- Estado del trámite (ciclo de vida)
  estado              text NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador','en_progreso','completo','presentado','observado',
                      'aprobado','vigencia_anual','revalida','vencido','no_aplica')),
  via_tramite         text CHECK (via_tramite IN ('ddjj_grupo1','sap_completo','excepcion_cultural')),
  paso_actual         smallint NOT NULL DEFAULT 1,   -- para retomar el wizard

  -- ── Clasificación (Anexo I) — inputs ──
  uso_id                  uuid REFERENCES public.sap_usos(id),
  superficie_cubierta_m2  numeric(12,2),
  superficie_aire_libre_m2 numeric(12,2),
  pisos_elevados          smallint,
  tiene_subsuelo          boolean,
  cantidad_subsuelos      smallint,
  actividad_en_subsuelo   boolean,
  tiene_inflamables       boolean,
  litros_inflamables      numeric(12,2),
  tiene_baterias_litio    boolean,
  kg_baterias_litio       numeric(12,2),
  estaciones_carga_ev     boolean,
  presta_servicio_ve      boolean,               -- vehículos eléctricos (taller)
  propiedad_horizontal    boolean,
  aforo                   integer,
  -- Clasificación — resultado (computado por el motor)
  grupo_calculado     smallint CHECK (grupo_calculado IN (1,2,3)),
  admite_revalida     boolean,
  clasificacion_motivo text,                     -- regla literal que determinó el grupo (trazabilidad)

  -- ── DDJJ Grupo 1 (Anexo II) — 1:1, solo si grupo 1 ──
  g1_declarante_nombre   text,
  g1_declarante_dni_cuit text,
  g1_caracter            text CHECK (g1_caracter IN ('titular','representante_legal','explotador')),
  g1_capacidad_m2_persona numeric(10,2),
  g1_tiene_entrepiso     boolean,
  g1_entrepiso_superficie numeric(12,2),
  g1_entrepiso_destino   text,
  g1_subsuelo_destino    text,
  g1_elementos_mitigacion text,
  g1_personal_instruido  boolean,                -- declaración jurada
  g1_responsabilidad_evacuacion boolean,         -- declaración jurada

  -- ── SAP Grupo 2/3 (Anexo III-A pto 2) — datos del establecimiento ──
  razon_social           text,
  cuit                   text,
  nombre_comercial       text,
  habilitacion_tipo      text CHECK (habilitacion_tipo IN
                          ('plancheta','ddjj','qr','en_tramite','exenta','nueva')),
  habilitacion_detalle   text,                   -- nro expediente / nota / acto
  dias_horarios          text,
  ocupacion_diurna       integer,
  ocupacion_nocturna     integer,
  personas_movilidad_reducida integer,
  telefono_emergencia    text,
  qr_ifci                text,
  -- Profesional interviniente (firma el SAP G2/G3)
  profesional_nombre     text,
  profesional_titulo     text,
  profesional_matricula  text,
  profesional_email      text,
  profesional_telefono   text,

  -- ── Aviso / Evacuación (Anexo III-A pto 6,7) ──
  aviso_descripcion      text,
  aviso_viva_voz         boolean,
  evacuacion_procedimiento text,
  punto_reunion_descripcion text,
  puesta_a_resguardo     text,
  enclavamientos         text,
  medidas_supletorias    text,

  -- ── Requisitos adicionales Grupo 3 (Anexo III-A pto 12) ──
  g3_riesgos_entorno     text,
  g3_riesgos_procesos    text,
  g3_procedimientos_respuesta text,
  g3_procedimiento_alarma text,

  -- ── Declaraciones de responsabilidad (Anexo III-A pto 16) ──
  decl_viabilidad        boolean,
  decl_comunicar_cambios boolean,

  -- ── Ciclo de vida / expediente ──
  fecha_presentacion     date,
  fecha_aprobacion       date,
  fecha_vencimiento      date,                   -- aprobación + 2 años
  expediente_nro         text,
  disposicion_nro        text,
  observaciones_autoridad text,

  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sap_presentaciones_estab
  ON public.sap_presentaciones (establecimiento_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sap_presentaciones_estado
  ON public.sap_presentaciones (estado) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_sap_presentaciones_venc
  ON public.sap_presentaciones (fecha_vencimiento) WHERE deleted_at IS NULL;

-- ─── 2. Sustancias peligrosas declaradas (N:M) ──────────────
CREATE TABLE IF NOT EXISTS public.sap_presentaciones_sustancias (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id uuid NOT NULL REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,
  sustancia_id    uuid NOT NULL REFERENCES public.sap_sustancias_peligrosas(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (presentacion_id, sustancia_id)
);
CREATE INDEX IF NOT EXISTS idx_sap_sustancias_pres ON public.sap_presentaciones_sustancias (presentacion_id);

-- ─── 3. Actividades por planta (Anexo III-A pto 2.m) ────────
CREATE TABLE IF NOT EXISTS public.sap_actividades_planta (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id uuid NOT NULL REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,
  planta          text NOT NULL,
  actividad       text,
  superficie_m2   numeric(12,2),
  orden           integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sap_actividades_pres ON public.sap_actividades_planta (presentacion_id);

-- ─── 4. Riesgos (Anexo III-A pto 3) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.sap_riesgos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id uuid NOT NULL REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,
  peligro         text NOT NULL,
  probabilidad    text CHECK (probabilidad IN ('baja','media','alta')),
  severidad       text CHECK (severidad IN ('leve','moderada','grave')),
  propagacion     text,
  orden           integer,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sap_riesgos_pres ON public.sap_riesgos (presentacion_id);

-- ─── 5. Medios técnicos (Anexo III-A pto 4) ─────────────────
CREATE TABLE IF NOT EXISTS public.sap_medios_tecnicos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id uuid NOT NULL REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,
  tipo_id         uuid NOT NULL REFERENCES public.sap_tipos_medio_tecnico(id),
  posee           boolean NOT NULL DEFAULT false,
  funciona        boolean,
  cantidad        integer,
  observaciones   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (presentacion_id, tipo_id)
);
CREATE INDEX IF NOT EXISTS idx_sap_medios_pres ON public.sap_medios_tecnicos (presentacion_id);

-- ─── 6. Roles de emergencia asignados (Anexo III-A pto 9) ───
CREATE TABLE IF NOT EXISTS public.sap_roles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id uuid NOT NULL REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,
  rol_id          uuid NOT NULL REFERENCES public.sap_tipos_rol(id),
  persona_nombre  text NOT NULL,
  persona_dni     text,
  es_suplente     boolean NOT NULL DEFAULT false,
  piso_sector     text,
  capacitado      boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sap_roles_pres ON public.sap_roles (presentacion_id);

-- ─── 7. Simulacros (Anexo III-A pto 13) ─────────────────────
CREATE TABLE IF NOT EXISTS public.sap_simulacros (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  presentacion_id uuid NOT NULL REFERENCES public.sap_presentaciones(id) ON DELETE CASCADE,
  orden           smallint NOT NULL,             -- 1°,2°,3°,4°
  fecha           date,
  hora            time,
  realizado       boolean NOT NULL DEFAULT false,
  tiempo_evacuacion_min numeric(6,2),
  personas_evacuadas integer,
  tipo            text CHECK (tipo IN ('total','parcial','puesta_a_resguardo')),
  observaciones   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sap_simulacros_pres ON public.sap_simulacros (presentacion_id);

-- ─── 8. updated_at trigger (solo cabecera) ──────────────────
DROP TRIGGER IF EXISTS set_updated_at ON public.sap_presentaciones;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sap_presentaciones
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ─── 9. RLS ─────────────────────────────────────────────────
-- Cabecera: acceso por establecimiento. Soft-delete oculto salvo developer.
ALTER TABLE public.sap_presentaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sap_presentaciones: select" ON public.sap_presentaciones;
CREATE POLICY "sap_presentaciones: select" ON public.sap_presentaciones FOR SELECT
  USING ((deleted_at IS NULL OR public.is_developer())
         AND public.has_establecimiento_read_access(establecimiento_id));

DROP POLICY IF EXISTS "sap_presentaciones: insert" ON public.sap_presentaciones;
CREATE POLICY "sap_presentaciones: insert" ON public.sap_presentaciones FOR INSERT
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

DROP POLICY IF EXISTS "sap_presentaciones: update" ON public.sap_presentaciones;
CREATE POLICY "sap_presentaciones: update" ON public.sap_presentaciones FOR UPDATE
  USING (public.has_establecimiento_write_access(establecimiento_id))
  WITH CHECK (public.has_establecimiento_write_access(establecimiento_id));

-- DELETE físico solo developer (el borrado normal es soft vía deleted_at).
DROP POLICY IF EXISTS "sap_presentaciones: delete" ON public.sap_presentaciones;
CREATE POLICY "sap_presentaciones: delete" ON public.sap_presentaciones FOR DELETE
  USING (public.is_developer());

-- Hijas: heredan acceso vía EXISTS sobre la presentación padre (4 policies c/u).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sap_presentaciones_sustancias','sap_actividades_planta','sap_riesgos',
    'sap_medios_tecnicos','sap_roles','sap_simulacros'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s: select" ON public.%I;', t, t);
    EXECUTE format($f$CREATE POLICY "%s: select" ON public.%I FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.sap_presentaciones p
              WHERE p.id = %I.presentacion_id
                AND (p.deleted_at IS NULL OR public.is_developer())
                AND public.has_establecimiento_read_access(p.establecimiento_id)));$f$, t, t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s: insert" ON public.%I;', t, t);
    EXECUTE format($f$CREATE POLICY "%s: insert" ON public.%I FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.sap_presentaciones p
              WHERE p.id = %I.presentacion_id
                AND public.has_establecimiento_write_access(p.establecimiento_id)));$f$, t, t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s: update" ON public.%I;', t, t);
    EXECUTE format($f$CREATE POLICY "%s: update" ON public.%I FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.sap_presentaciones p
              WHERE p.id = %I.presentacion_id
                AND public.has_establecimiento_write_access(p.establecimiento_id)));$f$, t, t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s: delete" ON public.%I;', t, t);
    EXECUTE format($f$CREATE POLICY "%s: delete" ON public.%I FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.sap_presentaciones p
              WHERE p.id = %I.presentacion_id
                AND public.has_establecimiento_write_access(p.establecimiento_id)));$f$, t, t, t);
  END LOOP;
END $$;

-- ─── 10. Comentarios ────────────────────────────────────────
COMMENT ON TABLE public.sap_presentaciones IS 'Trámite de Sistema de Autoprotección (Ley 5920 CABA) por establecimiento. Inputs de clasificación + DDJJ G1 / SAP G2-G3 + ciclo de vida.';
COMMENT ON COLUMN public.sap_presentaciones.grupo_calculado IS 'Grupo (1/2/3) computado por el motor de clasificación a partir de los inputs del Anexo I.';
COMMENT ON COLUMN public.sap_presentaciones.clasificacion_motivo IS 'Texto de la regla del Anexo I que determinó el grupo (trazabilidad legal).';
COMMENT ON COLUMN public.sap_presentaciones.deleted_at IS 'Soft-delete (papelera). NULL = vigente. Borrado físico solo developer.';
