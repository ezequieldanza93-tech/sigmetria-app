-- Restringir columnas de estado/tipo de conjunto CERRADO (hallazgo CAT-001)
-- CHECKs validados contra los valores REALES presentes en la base, no a ciegas.
-- Solo se incluyen columnas con dominio cerrado y estable. Las de texto libre/extensible
-- (ct_var_ropa.tipo_ropa, cursos.categoria, leads.tipo_contacto, *_log vacías de dominio
-- desconocido, web_profiles.* del repo web) se OMITEN a propósito.
-- DROP IF EXISTS + ADD para que la migración sea idempotente.

-- ── Normalización previa ───────────────────────────────────────────────────
-- ergonomia_seguimiento.nivel_riesgo tenía 'Requiere Evaluación' y 'Requiere evaluación'
-- (mismo valor, distinto case) — exactamente la inconsistencia que un CHECK previene.
-- Unifico el dato. (No le pongo CHECK aún: el dominio completo de niveles no está cerrado.)
UPDATE public.ergonomia_seguimiento
   SET nivel_riesgo = 'Requiere evaluación'
 WHERE nivel_riesgo = 'Requiere Evaluación';

-- ── Escalas IPERC (genéricas, conjunto fijo) ────────────────────────────────
ALTER TABLE public.iperc_consecuencias  DROP CONSTRAINT IF EXISTS chk_iperc_consecuencias_nivel;
ALTER TABLE public.iperc_consecuencias  ADD  CONSTRAINT chk_iperc_consecuencias_nivel
  CHECK (nivel IN ('Daño Leve','Daño Moderado','Daño Grave','Daño Muy Grave','Daño Fatal'));

ALTER TABLE public.iperc_probabilidades DROP CONSTRAINT IF EXISTS chk_iperc_probabilidades_nivel;
ALTER TABLE public.iperc_probabilidades ADD  CONSTRAINT chk_iperc_probabilidades_nivel
  CHECK (nivel IN ('Muy Improbable','Improbable','Moderada','Probable','Muy Probable'));

-- ── Tipos de plan (billing) y de protocolo/medición ─────────────────────────
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS chk_plans_tipo;
ALTER TABLE public.plans ADD  CONSTRAINT chk_plans_tipo
  CHECK (tipo IN ('trial','profesional_independiente','consultora_chica','consultora_grande','empresa'));

ALTER TABLE public.protocolo_verificaciones DROP CONSTRAINT IF EXISTS chk_protocolo_verificaciones_tipo;
ALTER TABLE public.protocolo_verificaciones ADD  CONSTRAINT chk_protocolo_verificaciones_tipo
  CHECK (tipo IN ('medicion_iluminacion','medicion_pat','medicion_ruido','medicion_carga_termica','protocolo_ergonomia','calculo_carga_fuego'));

-- ── Categorías de catálogo ──────────────────────────────────────────────────
ALTER TABLE public.unidades DROP CONSTRAINT IF EXISTS chk_unidades_categoria;
ALTER TABLE public.unidades ADD  CONSTRAINT chk_unidades_categoria
  CHECK (categoria IN ('medicion','cantidad','masa','volumen','longitud'));

ALTER TABLE public.dec351_materiales_pci DROP CONSTRAINT IF EXISTS chk_dec351_materiales_pci_categoria;
ALTER TABLE public.dec351_materiales_pci ADD  CONSTRAINT chk_dec351_materiales_pci_categoria
  CHECK (categoria IN ('Celulósicos','Líq. inflam.','Plásticos','Gases','Cauchos','Carbones'));

-- ── Tipo de identidad impositiva (Argentina: CUIT/CUIL/CDI) ──────────────────
ALTER TABLE public.empresas DROP CONSTRAINT IF EXISTS chk_empresas_tipo_identidad_impositiva;
ALTER TABLE public.empresas ADD  CONSTRAINT chk_empresas_tipo_identidad_impositiva
  CHECK (tipo_identidad_impositiva IN ('CUIT','CUIL','CDI'));

ALTER TABLE public.perfiles_profesionales DROP CONSTRAINT IF EXISTS chk_perfiles_profesionales_tipo_identidad_impositiva;
ALTER TABLE public.perfiles_profesionales ADD  CONSTRAINT chk_perfiles_profesionales_tipo_identidad_impositiva
  CHECK (tipo_identidad_impositiva IN ('CUIT','CUIL','CDI'));

-- ── Estado de Mercado Pago (dominio fijo del proveedor) ─────────────────────
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS chk_payments_mp_status;
ALTER TABLE public.payments ADD  CONSTRAINT chk_payments_mp_status
  CHECK (mp_status IN ('pending','approved','authorized','in_process','in_mediation','rejected','cancelled','refunded','charged_back'));

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS chk_subscriptions_mp_status;
ALTER TABLE public.subscriptions ADD  CONSTRAINT chk_subscriptions_mp_status
  CHECK (mp_status IN ('pending','approved','authorized','in_process','in_mediation','rejected','cancelled','refunded','charged_back'));
