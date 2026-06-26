-- Formas de pago para el modulo Finanzas (presupuestos/cotizaciones y comprobantes).
-- Catalogo hibrido: genericas (consultora_id NULL) + propias por consultora (mismo patron que fin_categorias).

BEGIN;

CREATE TABLE IF NOT EXISTS public.fin_formas_pago (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id uuid REFERENCES public.consultoras(id) ON DELETE CASCADE, -- NULL = generica Sigmetria
  nombre        text NOT NULL,
  orden         int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_formas_pago ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_fin_formas_pago_consultora ON public.fin_formas_pago(consultora_id);

-- RLS (igual que fin_categorias): lectura genericas + miembros; mutacion solo full_access del dueño
CREATE POLICY "fin_formas_pago_select" ON public.fin_formas_pago FOR SELECT
  USING (is_developer() OR consultora_id IS NULL OR public.get_consultora_role(consultora_id) IS NOT NULL);
CREATE POLICY "fin_formas_pago_insert" ON public.fin_formas_pago FOR INSERT
  WITH CHECK (is_developer() OR (consultora_id IS NOT NULL AND public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch')));
CREATE POLICY "fin_formas_pago_update" ON public.fin_formas_pago FOR UPDATE
  USING (is_developer() OR (consultora_id IS NOT NULL AND public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch')))
  WITH CHECK (is_developer() OR (consultora_id IS NOT NULL AND public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch')));
CREATE POLICY "fin_formas_pago_delete" ON public.fin_formas_pago FOR DELETE
  USING (is_developer() OR (consultora_id IS NOT NULL AND public.get_consultora_role(consultora_id) IN ('full_access_main','full_access_branch')));

-- Campo forma de pago en comprobantes (facturacion) y cotizaciones (presupuestos)
ALTER TABLE public.fin_comprobantes ADD COLUMN IF NOT EXISTS forma_pago_id uuid REFERENCES public.fin_formas_pago(id) ON DELETE SET NULL;
ALTER TABLE public.fin_cotizaciones ADD COLUMN IF NOT EXISTS forma_pago_id uuid REFERENCES public.fin_formas_pago(id) ON DELETE SET NULL;

-- Seed genericas (consultora_id NULL)
INSERT INTO public.fin_formas_pago (consultora_id, nombre, orden) VALUES
  (NULL,'Transferencia bancaria',10),
  (NULL,'Efectivo',20),
  (NULL,'Mercado Pago',30),
  (NULL,'Cheque',40),
  (NULL,'Tarjeta de crédito/débito',50),
  (NULL,'Débito automático',60);

COMMIT;
