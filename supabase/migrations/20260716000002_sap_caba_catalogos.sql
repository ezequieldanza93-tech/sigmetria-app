-- ============================================================
-- Sistema de Autoprotección (SAP) CABA — Ley 5920 · CATÁLOGOS
-- ============================================================
-- Catálogos globales (sin consultora_id) que alimentan el wizard del Sistema de
-- Autoprotección. Lectura abierta a autenticados, escritura solo developer
-- (mismo patrón que provincias / establecimientos_tipos).
--
-- IMPORTANTE: la LÓGICA de clasificación (umbrales de m²/pisos/subsuelo/litros
-- por uso) vive en el motor TypeScript (lib/sap/clasificacion) — es lógica de
-- negocio compleja con operadores OR/AND, no datos relacionales. Esta tabla
-- `sap_usos` solo provee: catálogo para el dropdown, FK desde la presentación,
-- el grupo mínimo posible (para bloquear selecciones imposibles en UI) y el
-- flag de reválida. El motor referencia cada uso por `codigo`.
--
-- Idempotente.
-- ============================================================

-- ─── 1. Catálogo de USOS / rubros (Anexo I) ─────────────────
CREATE TABLE IF NOT EXISTS public.sap_usos (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo               text NOT NULL UNIQUE,   -- estable, referenciado por el motor TS
  nombre               text NOT NULL,
  incluye              text,                    -- bloque "INCLUYE" del Anexo I
  grupo_min            smallint NOT NULL DEFAULT 1 CHECK (grupo_min IN (1, 2, 3)),
  admite_revalida      text NOT NULL DEFAULT 'si' CHECK (admite_revalida IN ('si', 'no', 'condicional')),
  nota_revalida        text,
  requiere_excepcion_tad boolean NOT NULL DEFAULT false, -- Espacio Cultural Independiente G1 → TAD (Anexo V)
  orden                integer,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ─── 2. Catálogo de SUSTANCIAS PELIGROSAS (Anexo I / III-A) ──
CREATE TABLE IF NOT EXISTS public.sap_sustancias_peligrosas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo     text NOT NULL UNIQUE,
  nombre     text NOT NULL,
  orden      integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. Catálogo de TIPOS DE MEDIO TÉCNICO (Anexo III-A pto 4) ──
CREATE TABLE IF NOT EXISTS public.sap_tipos_medio_tecnico (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo            text NOT NULL UNIQUE,
  nombre            text NOT NULL,
  requiere_funciona boolean NOT NULL DEFAULT true,  -- pide POSEE + FUNCIONA
  requiere_cantidad boolean NOT NULL DEFAULT false, -- pide cantidad (ej. extintores)
  requiere_adjunto  boolean NOT NULL DEFAULT false, -- pide QR/informe (ej. IFCI)
  orden             integer,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. Catálogo de TIPOS DE ROL de emergencia (Anexo III-A pto 9) ──
CREATE TABLE IF NOT EXISTS public.sap_tipos_rol (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  nombre      text NOT NULL,
  descripcion text,
  min_personas smallint NOT NULL DEFAULT 1,
  exclusivo   boolean NOT NULL DEFAULT false, -- no puede ocupar otro rol (Coordinador)
  orden       integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── 5. Catálogo de TIPOS DE DOCUMENTO del SAP ──────────────
CREATE TABLE IF NOT EXISTS public.sap_tipos_documento (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo      text NOT NULL UNIQUE,
  nombre      text NOT NULL,
  descripcion text,
  orden       integer,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── 6. updated_at trigger (solo donde hay updated_at) ──────
DROP TRIGGER IF EXISTS set_updated_at ON public.sap_usos;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sap_usos
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_updated_at();

-- ─── 7. RLS: SELECT abierto a autenticados, escritura developer ──
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'sap_usos','sap_sustancias_peligrosas','sap_tipos_medio_tecnico',
    'sap_tipos_rol','sap_tipos_documento'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s: select" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "%s: select" ON public.%I FOR SELECT TO authenticated USING (true);', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s: write" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "%s: write" ON public.%I FOR ALL TO authenticated USING (public.is_developer()) WITH CHECK (public.is_developer());', t, t);
  END LOOP;
END $$;

-- ============================================================
-- SEED
-- ============================================================

-- ─── Usos (Anexo I) — codigo, nombre, grupo_min, admite_revalida, orden ──
INSERT INTO public.sap_usos (codigo, nombre, grupo_min, admite_revalida, requiere_excepcion_tad, orden) VALUES
  ('ADMINISTRACION_OFICINAS', 'Administración / Oficinas', 1, 'si', false, 10),
  ('ACT_RELIGIOSAS', 'Actividades Religiosas', 1, 'si', false, 20),
  ('ACT_CULTURALES', 'Actividades Culturales (museos, centro cultural)', 1, 'si', false, 30),
  ('ACT_ESPECIALES', 'Actividades Especiales (laboratorios, radioisótopos, residuos radiactivos)', 2, 'si', false, 40),
  ('BANCOS', 'Bancos / Entidades financieras', 1, 'si', false, 50),
  ('BARES_RESTAURANTES', 'Bares – Restaurantes – Cantinas', 1, 'si', false, 60),
  ('CASAS_FIESTAS', 'Casas de Fiestas Privadas', 1, 'si', false, 70),
  ('CASAS_FIESTAS_INFANTILES', 'Casas de Fiestas Privadas Infantiles', 2, 'si', false, 80),
  ('CENTROS_EXPOSICIONES', 'Centros y Salones de Exposiciones', 2, 'si', false, 90),
  ('CIRCO_RODANTE', 'Circo Rodante', 3, 'si', false, 100),
  ('CLUB_DEPORTIVO_AIRE_LIBRE', 'Club Deportivo al Aire Libre', 1, 'si', false, 110),
  ('CLUBES_DEPORTES', 'Clubes y Locales para Práctica de Deportes', 1, 'si', false, 120),
  ('CLUB_SOCIAL_CUBIERTO', 'Club Social, Cultural y Deportivo Cubierto', 1, 'si', false, 130),
  ('COMERCIO', 'Comercio / Locales Comerciales', 1, 'condicional', false, 140),
  ('DEPOSITO', 'Depósito', 2, 'condicional', false, 150),
  ('ESCUELAS', 'Escuelas e Instituciones Educativas', 2, 'no', false, 160),
  ('ESPECTACULOS_CINE_TEATRO', 'Espectáculos: Cine, Teatro, Cine-Teatro', 2, 'no', false, 170),
  ('ESTACION_SERVICIO', 'Estación de Servicio', 2, 'no', false, 180),
  ('ESTADIOS', 'Estadios (Ley 5847/17)', 3, 'no', false, 190),
  ('EVENTOS_NO_MASIVOS', 'Eventos No Masivos (150–999 personas)', 2, 'no', false, 200),
  ('GALERIA_SHOPPING', 'Galería Comercial / Shopping', 2, 'no', false, 210),
  ('GARAGES', 'Garages / Estacionamientos', 1, 'condicional', false, 220),
  ('GERIATRICOS', 'Geriátricos y Asilos', 2, 'no', false, 230),
  ('HOGARES_RESIDENCIAS', 'Hogares, Residencias (hasta 4 personas mayores)', 1, 'no', false, 240),
  ('HOGAR_NINOS', 'Hogar de Niños', 2, 'no', false, 250),
  ('HOTEL', 'Hotel – Alojamiento – Hospedaje', 2, 'si', false, 260),
  ('INDUSTRIA', 'Industria', 2, 'no', false, 270),
  ('JARDIN_INFANTES', 'Jardín de Infantes – Escuela Infantil – Jardín Maternal', 2, 'no', false, 280),
  ('LOCALES_BAILABLES', 'Locales Bailables', 3, 'no', false, 290),
  ('PENITENCIARIA', 'Penitenciaría y Lugares de Detención', 3, 'no', false, 300),
  ('POLIGONOS_TIRO', 'Polígonos de Tiro', 3, 'si', false, 310),
  ('PREDIOS_DEPORTIVOS', 'Predios para Entrenamiento / Prácticas Deportivas / Otros', 1, 'si', false, 320),
  ('RESIDENCIA_ASISTENCIA', 'Residencia para Personas que Requieren Asistencia', 2, 'no', false, 330),
  ('REFUGIOS_NOCTURNOS', 'Refugios Nocturnos', 3, 'no', false, 340),
  ('REPRESENTACIONES_EXTRANJERAS', 'Representaciones Extranjeras (Embajadas/Consulados)', 1, 'si', false, 350),
  ('SALAS_JUEGO', 'Salas de Juego', 1, 'no', false, 360),
  ('SANITARIO', 'Sanitario (Clínicas, Centros Médicos, etc.)', 1, 'no', false, 370),
  ('TALLER_MECANICO', 'Taller Mecánico – Pintura – Service Automotor', 1, 'si', false, 380),
  ('TELEVISION', 'Televisión (estudios, radios)', 1, 'no', false, 390),
  ('TRANSPORTE_PUBLICO', 'Transporte Público (terminales)', 3, 'si', false, 400),
  ('USOS_CULT_MUSICA_VIVO', 'Usos Culturales — Club de Música en Vivo (≤350 localidades)', 2, 'si', false, 410),
  ('USOS_CULT_ESPACIO_INDEP', 'Usos Culturales — Espacio Cultural Independiente (Ley 6063 art. 34)', 1, 'si', true, 420),
  ('USOS_CULT_OTROS', 'Usos Culturales — Otros (sala de teatro independiente, etc.)', 1, 'si', false, 430)
ON CONFLICT (codigo) DO UPDATE SET
  nombre = EXCLUDED.nombre, grupo_min = EXCLUDED.grupo_min,
  admite_revalida = EXCLUDED.admite_revalida,
  requiere_excepcion_tad = EXCLUDED.requiere_excepcion_tad, orden = EXCLUDED.orden;

-- Notas de reválida condicional
UPDATE public.sap_usos SET nota_revalida =
  'No admite reválida si acopia/expende sustancias químicas, biológicas, radiactivas, explosivas, inflamables, tóxicas, corrosivas, oxidantes o baterías de litio-ion.'
  WHERE codigo = 'COMERCIO';
UPDATE public.sap_usos SET nota_revalida =
  'No admite reválida si almacena maquinarias, sustancias peligrosas, inflamables/altamente combustibles, alimentos o medicamentos.'
  WHERE codigo = 'DEPOSITO';
UPDATE public.sap_usos SET nota_revalida =
  'No admite reválida cuando el garage es parte de un edificio.'
  WHERE codigo = 'GARAGES';

-- ─── Sustancias peligrosas ──────────────────────────────────
INSERT INTO public.sap_sustancias_peligrosas (codigo, nombre, orden) VALUES
  ('QUIMICO', 'Químico', 10),
  ('BIOLOGICO', 'Biológico', 20),
  ('RADIOLOGICO', 'Radiactivo / Radiológico', 30),
  ('EXPLOSIVO', 'Explosivo / Pirotecnia (Ley 20.429)', 40),
  ('TOXICO', 'Tóxico', 50),
  ('CORROSIVO', 'Corrosivo', 60),
  ('OXIDANTE', 'Oxidante', 70)
ON CONFLICT (codigo) DO NOTHING;

-- ─── Tipos de medio técnico (Anexo III-A pto 4) ─────────────
INSERT INTO public.sap_tipos_medio_tecnico (codigo, nombre, requiere_funciona, requiere_cantidad, requiere_adjunto, orden) VALUES
  ('DETECCION_ALARMA', 'Sistema de detección y alarma de incendios', true, false, false, 10),
  ('ALARMA_EVACUACION', 'Alarma de evacuación', true, false, false, 20),
  ('EXTINTORES', 'Extintores manuales de incendio', false, true, false, 30),
  ('IFCI', 'Instalación Fija Contra Incendios (red de hidrantes/rociadores)', false, false, true, 40),
  ('ILUMINACION_EMERGENCIA', 'Iluminación de emergencia', true, false, false, 50)
ON CONFLICT (codigo) DO NOTHING;

-- ─── Tipos de rol de emergencia (Anexo III-A pto 9) ─────────
INSERT INTO public.sap_tipos_rol (codigo, nombre, descripcion, min_personas, exclusivo, orden) VALUES
  ('COORDINADOR', 'Coordinador de Autoprotección', 'Mínimo 1 + 1 suplente. No puede ocupar otro rol.', 1, true, 10),
  ('LIDER_EVACUACION', 'Líder de Evacuación', 'Uno por piso/sector con personal. Suplente recomendado.', 1, false, 20),
  ('EPI', 'Equipo de Primera Intervención (EPI)', 'Mínimo 2 personas capacitadas, sin otro rol.', 2, false, 30),
  ('BRIGADA_EMERGENCIAS', 'Brigada de Emergencias / Lucha contra el fuego', 'Según uso/grupo. Mínimo 2 capacitados por bomberos.', 2, false, 40),
  ('COMUNICACIONES', 'Encargado de Comunicaciones y Alarmas', 'Opcional; puede asignarse a otro rol.', 1, false, 50)
ON CONFLICT (codigo) DO NOTHING;

-- ─── Tipos de documento del SAP ─────────────────────────────
INSERT INTO public.sap_tipos_documento (codigo, nombre, descripcion, orden) VALUES
  ('HABILITACION', 'Habilitación (Plancheta / DDJJ / QR)', 'Comprobante de habilitación del establecimiento.', 10),
  ('PLANO_OBRA', 'Plano Conforme a Obra / Instalación contra Incendios', 'Para nuevas habilitaciones (art. 3 bis).', 15),
  ('PLANOS_PLANTA', 'Planos de planta a escala (PDF)', 'Habilitación, arquitectura, sanitarios, eléctricos, incendio.', 20),
  ('QR_IFCI', 'QR de la Instalación Fija Contra Incendios + informe de operatividad', NULL, 30),
  ('PUNTO_REUNION_IMG', 'Imágenes del punto de reunión externo', NULL, 40),
  ('CROQUIS_EVACUACION', 'Croquis/planos de evacuación por planta (A3 color, firmados)', 'Mínimo 2 por planta.', 50),
  ('PLANILLA_CAPACITACION', 'Planilla de capacitación de roles (rubricada/certificada)', NULL, 60),
  ('DOC_CAPACITADOR_BRIGADA', 'Documentación del capacitador de Brigada (DNI, credencial, certificación)', NULL, 65),
  ('SIMULACION_EVACUACION', 'Simulación computacional de evacuación (video + informe)', 'Solo Grupo 3 cuando lo exige uso/grupo (Pathfinder/Exodus/Legionevac).', 70),
  ('SIMULACION_FDS', 'Simulación de dinámica de humo y fuego (FDS) + informe', 'Solo Grupo 3 cuando lo exige uso/grupo.', 80),
  ('INFORME_SIMULACRO', 'Informe de simulacro', NULL, 90),
  ('DDJJ_G1', 'Declaración Jurada Grupo 1 (Anexo II) firmada', NULL, 100),
  ('DDJJ_REVALIDA', 'DDJJ Reválida por Trámite Abreviado (Anexo III-B)', NULL, 110),
  ('NOTA_VIGENCIA_ANUAL', 'Nota de Vigencia Anual (sin modificaciones)', NULL, 120),
  ('OTRO', 'Otro documento', NULL, 900)
ON CONFLICT (codigo) DO NOTHING;

-- ─── Comentarios ────────────────────────────────────────────
COMMENT ON TABLE public.sap_usos IS 'Catálogo de usos/rubros del Anexo I (Ley 5920 CABA). La lógica de umbrales por grupo vive en el motor TS (lib/sap/clasificacion); aquí: dropdown, FK, grupo_min y reválida.';
COMMENT ON COLUMN public.sap_usos.grupo_min IS 'Grupo más bajo posible para este uso (1/2/3). Usos "No contemplado G1" → 2; usos "solo G3" → 3.';
COMMENT ON COLUMN public.sap_usos.admite_revalida IS 'si | no | condicional (ver nota_revalida). "no" = usos del 4º párrafo art. 2 Ley 5920 → siempre SAP nuevo al vencer.';
COMMENT ON TABLE public.sap_sustancias_peligrosas IS 'Catálogo de tipos de sustancia peligrosa (Anexo I/III-A).';
COMMENT ON TABLE public.sap_tipos_medio_tecnico IS 'Catálogo de medios técnicos de protección contra incendio (Anexo III-A pto 4).';
COMMENT ON TABLE public.sap_tipos_rol IS 'Catálogo de roles de emergencia del SAP (Anexo III-A pto 9).';
COMMENT ON TABLE public.sap_tipos_documento IS 'Catálogo de tipos de documento adjuntable en el SAP.';
