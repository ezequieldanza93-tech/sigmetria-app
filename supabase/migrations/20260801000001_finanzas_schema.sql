-- Modulo Finanzas (BP1 - El Consultor). Diseñado escalable / multi-pais:
-- multi-moneda (ISO 4217 por registro + default por consultora), locale, IVA configurable.
-- Tablas fin_*: categorias (catalogo hibrido), config, gastos, inversiones,
-- comprobantes (registro de cobros), cotizaciones (embudo comercial).
-- RLS: la plata es sensible -> solo full_access_main / full_access_branch (o developer).
-- Categorias genericas (consultora_id NULL) legibles por cualquier miembro.

BEGIN;

-- ============================================================ fin_categorias
CREATE TABLE IF NOT EXISTS public.fin_categorias (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id uuid REFERENCES public.consultoras(id) ON DELETE CASCADE, -- NULL = generica Sigmetria
  tipo          text NOT NULL CHECK (tipo IN ('ingreso','gasto','inversion')),
  nombre        text NOT NULL,
  es_deducible  boolean NOT NULL DEFAULT true,
  color         text,
  orden         int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_categorias ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fin_categorias_consultora ON public.fin_categorias(consultora_id);

-- ============================================================ fin_config (params por consultora)
CREATE TABLE IF NOT EXISTS public.fin_config (
  consultora_id        uuid PRIMARY KEY REFERENCES public.consultoras(id) ON DELETE CASCADE,
  pais                 text NOT NULL DEFAULT 'AR',
  locale               text NOT NULL DEFAULT 'es-AR',
  moneda               text NOT NULL DEFAULT 'ARS',  -- ISO 4217
  iva_tasa             numeric(5,2) NOT NULL DEFAULT 21.00,
  costo_km             numeric(14,2) NOT NULL DEFAULT 0,
  costo_hora           numeric(14,2) NOT NULL DEFAULT 0,
  vida_util_meses_def  int NOT NULL DEFAULT 36,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_config ENABLE ROW LEVEL SECURITY;

-- ============================================================ fin_gastos
CREATE TABLE IF NOT EXISTS public.fin_gastos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id       uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  empresa_id          uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  establecimiento_id  uuid REFERENCES public.establecimientos(id) ON DELETE SET NULL,
  categoria_id        uuid REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  concepto            text NOT NULL,
  fecha               date NOT NULL DEFAULT current_date,
  monto               numeric(14,2) NOT NULL,
  moneda              text NOT NULL DEFAULT 'ARS',
  es_recurrente       boolean NOT NULL DEFAULT false,
  periodicidad        text CHECK (periodicidad IN ('mensual','bimestral','trimestral','semestral','anual')),
  km_recorridos       numeric(10,1),
  comprobante_url     text,
  gestion_registro_id uuid,
  estado              text NOT NULL DEFAULT 'pagado' CHECK (estado IN ('pagado','pendiente')),
  fecha_pago          date,
  notas               text,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_gastos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fin_gastos_consultora ON public.fin_gastos(consultora_id);
CREATE INDEX IF NOT EXISTS idx_fin_gastos_empresa ON public.fin_gastos(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fin_gastos_fecha ON public.fin_gastos(consultora_id, fecha);

-- ============================================================ fin_inversiones
CREATE TABLE IF NOT EXISTS public.fin_inversiones (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id     uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  categoria_id      uuid REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  instrumento_id    uuid REFERENCES public.mediciones_instrumentos(id) ON DELETE SET NULL, -- vinculo opcional al activo real
  descripcion       text NOT NULL,
  fecha_adquisicion date NOT NULL DEFAULT current_date,
  monto             numeric(14,2) NOT NULL,
  moneda            text NOT NULL DEFAULT 'ARS',
  vida_util_meses   int NOT NULL DEFAULT 36,
  valor_residual    numeric(14,2) NOT NULL DEFAULT 0,
  comprobante_url   text,
  notas             text,
  created_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_inversiones ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fin_inversiones_consultora ON public.fin_inversiones(consultora_id);
CREATE INDEX IF NOT EXISTS idx_fin_inversiones_instrumento ON public.fin_inversiones(instrumento_id);

-- ============================================================ fin_comprobantes (facturacion / registro de cobros)
CREATE TABLE IF NOT EXISTS public.fin_comprobantes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id       uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  empresa_id          uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  establecimiento_id  uuid REFERENCES public.establecimientos(id) ON DELETE SET NULL,
  categoria_id        uuid REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  numero              text,
  concepto            text NOT NULL,
  tipo                text NOT NULL DEFAULT 'puntual' CHECK (tipo IN ('abono','puntual')),
  fecha_emision       date NOT NULL DEFAULT current_date,
  fecha_vencimiento   date,
  fecha_cobro         date,
  monto_neto          numeric(14,2) NOT NULL,
  monto_iva           numeric(14,2) NOT NULL DEFAULT 0,
  monto_total         numeric(14,2) NOT NULL,
  moneda              text NOT NULL DEFAULT 'ARS',
  estado              text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('borrador','emitida','pendiente','cobrada','vencida','anulada')),
  es_recurrente       boolean NOT NULL DEFAULT false,
  recurrencia_dia     int CHECK (recurrencia_dia BETWEEN 1 AND 28),
  gestion_registro_id uuid,
  notas               text,
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_comprobantes ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fin_comprobantes_consultora ON public.fin_comprobantes(consultora_id);
CREATE INDEX IF NOT EXISTS idx_fin_comprobantes_empresa ON public.fin_comprobantes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_fin_comprobantes_estado ON public.fin_comprobantes(consultora_id, estado);

-- ============================================================ fin_cotizaciones (embudo comercial)
CREATE TABLE IF NOT EXISTS public.fin_cotizaciones (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id         uuid NOT NULL REFERENCES public.consultoras(id) ON DELETE CASCADE,
  empresa_id            uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  lead_id               uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  prospecto_nombre      text,
  prospecto_email       text,
  prospecto_telefono    text,
  tipo                  text NOT NULL DEFAULT 'completo' CHECK (tipo IN ('completo','especifico')),
  concepto              text NOT NULL,
  items                 jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{descripcion, monto}] para 'especifico'
  monto_total           numeric(14,2) NOT NULL DEFAULT 0,
  moneda                text NOT NULL DEFAULT 'ARS',
  estado                text NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador','enviada','aceptada','rechazada','vencida')),
  fecha_emision         date NOT NULL DEFAULT current_date,
  validez_dias          int DEFAULT 30,
  fecha_decision        date,
  convertida_empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  notas                 text,
  created_by            uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_cotizaciones ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fin_cotizaciones_consultora ON public.fin_cotizaciones(consultora_id);

-- ============================================================ RLS POLICIES
-- fin_categorias: lectura amplia (genericas + miembros), mutacion solo full_access del dueño
CREATE POLICY "fin_categorias_select" ON public.fin_categorias FOR SELECT
  USING (is_developer() OR consultora_id IS NULL OR public.get_consultora_role(consultora_id) IS NOT NULL);
CREATE POLICY "fin_categorias_insert" ON public.fin_categorias FOR INSERT
  WITH CHECK (is_developer() OR (consultora_id IS NOT NULL AND public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch')));
CREATE POLICY "fin_categorias_update" ON public.fin_categorias FOR UPDATE
  USING (is_developer() OR (consultora_id IS NOT NULL AND public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch')))
  WITH CHECK (is_developer() OR (consultora_id IS NOT NULL AND public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch')));
CREATE POLICY "fin_categorias_delete" ON public.fin_categorias FOR DELETE
  USING (is_developer() OR (consultora_id IS NOT NULL AND public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch')));

-- Tablas de plata: una sola policy FOR ALL (solo full_access del dueño o developer)
CREATE POLICY "fin_config_all" ON public.fin_config FOR ALL
  USING (is_developer() OR public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch'))
  WITH CHECK (is_developer() OR public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch'));

CREATE POLICY "fin_gastos_all" ON public.fin_gastos FOR ALL
  USING (is_developer() OR public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch'))
  WITH CHECK (is_developer() OR public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch'));

CREATE POLICY "fin_inversiones_all" ON public.fin_inversiones FOR ALL
  USING (is_developer() OR public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch'))
  WITH CHECK (is_developer() OR public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch'));

CREATE POLICY "fin_comprobantes_all" ON public.fin_comprobantes FOR ALL
  USING (is_developer() OR public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch'))
  WITH CHECK (is_developer() OR public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch'));

CREATE POLICY "fin_cotizaciones_all" ON public.fin_cotizaciones FOR ALL
  USING (is_developer() OR public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch'))
  WITH CHECK (is_developer() OR public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch'));

-- ============================================================ SEED categorias genericas (consultora_id NULL)
INSERT INTO public.fin_categorias (consultora_id, tipo, nombre, orden) VALUES
  (NULL,'gasto','Movilidad / Combustible',10),
  (NULL,'gasto','Matrícula profesional',20),
  (NULL,'gasto','ART propia',30),
  (NULL,'gasto','Software y herramientas',40),
  (NULL,'gasto','Telefonía / Internet',50),
  (NULL,'gasto','Marketing / Publicidad',60),
  (NULL,'gasto','EPP de demostración',70),
  (NULL,'gasto','Cursos / Formación',80),
  (NULL,'gasto','Honorarios a terceros',90),
  (NULL,'gasto','Impuestos y tasas',100),
  (NULL,'gasto','Seguros',110),
  (NULL,'gasto','Oficina / Alquiler',120),
  (NULL,'gasto','Otros gastos',900),
  (NULL,'inversion','Instrumentos de medición',10),
  (NULL,'inversion','Equipamiento',20),
  (NULL,'inversion','Equipo informático',30),
  (NULL,'inversion','Vehículo',40),
  (NULL,'inversion','Otras inversiones',900),
  (NULL,'ingreso','Abono mensual',10),
  (NULL,'ingreso','Trabajo puntual',20),
  (NULL,'ingreso','Medición facturada',30),
  (NULL,'ingreso','Capacitación dictada',40),
  (NULL,'ingreso','Otros ingresos',900);

-- ============================================================ plan_features: habilitar 'finanzas'
-- Profesional Inicial -> Consultora Grande + Empresa (NO trial). Idempotente sin depender de UNIQUE.
INSERT INTO public.plan_features (plan_id, feature_key, habilitado)
SELECT p.id, 'finanzas', true
FROM public.plans p
WHERE p.slug IN ('profesional-inicial','profesional-avanzado','consultora-chica','consultora-media','consultora-grande','empresa')
  AND NOT EXISTS (
    SELECT 1 FROM public.plan_features pf WHERE pf.plan_id = p.id AND pf.feature_key = 'finanzas'
  );

COMMIT;
