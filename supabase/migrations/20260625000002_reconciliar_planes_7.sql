-- 20260625000002_reconciliar_planes_7.sql
-- Lanzamiento Sigmetría: reconciliación a los 7 planes nuevos.
-- Precios ARS netos (+IVA 21%). Anual = mensual × 12 × 0.8 (−20%). Viewers ∞ = NULL en TODOS.
-- Gestiones ∞ = NULL salvo trial. Idempotente (rename + alta condicional + UPDATE explícito por slug).
-- Aplicado vía Management API. Depende de 20260625000001 (columnas founder_*).

-- 1. Rename slug: profesional-independiente → profesional-inicial (mismo id → FKs intactas)
UPDATE public.plans SET slug = 'profesional-inicial' WHERE slug = 'profesional-independiente';

-- 2. Alta de los 2 planes nuevos (tipo copiado del hermano; resto se fija en el paso 3). Idempotente.
INSERT INTO public.plans (slug, nombre, tipo)
SELECT 'profesional-avanzado', 'Profesional Avanzado', tipo FROM public.plans WHERE slug = 'profesional-inicial'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.plans (slug, nombre, tipo)
SELECT 'consultora-media', 'Consultora Media', tipo FROM public.plans WHERE slug = 'consultora-chica'
ON CONFLICT (slug) DO NOTHING;

-- 3. Valores definitivos por plan
UPDATE public.plans SET
  nombre='Trial', precio_mensual_neto=NULL, precio_anual_neto=NULL,
  max_empresas=2, max_establecimientos=5, max_gestiones_registros=200, max_horarios_registros=200,
  max_colaboradores=1, max_viewers=NULL, precio_extra_seat_neto=NULL, iva_porcentaje=21,
  is_visible=false, is_active=true, destacado=false, sort_order=0,
  founder_slots_total=0, founder_seed_taken=0, updated_at=now()
WHERE slug='trial';

UPDATE public.plans SET
  nombre='Profesional Inicial', precio_mensual_neto=24000, precio_anual_neto=230400,
  max_empresas=10, max_establecimientos=40, max_gestiones_registros=NULL, max_horarios_registros=NULL,
  max_colaboradores=1, max_viewers=NULL, precio_extra_seat_neto=NULL, iva_porcentaje=21,
  is_visible=true, is_active=true, destacado=false, sort_order=1,
  founder_slots_total=8, founder_seed_taken=3, updated_at=now()
WHERE slug='profesional-inicial';

UPDATE public.plans SET
  nombre='Profesional Avanzado', precio_mensual_neto=33600, precio_anual_neto=322560,
  max_empresas=20, max_establecimientos=80, max_gestiones_registros=NULL, max_horarios_registros=NULL,
  max_colaboradores=1, max_viewers=NULL, precio_extra_seat_neto=NULL, iva_porcentaje=21,
  is_visible=true, is_active=true, destacado=false, sort_order=2,
  founder_slots_total=8, founder_seed_taken=2, updated_at=now()
WHERE slug='profesional-avanzado';

UPDATE public.plans SET
  nombre='Consultora Chica', precio_mensual_neto=115000, precio_anual_neto=1104000,
  max_empresas=30, max_establecimientos=60, max_gestiones_registros=NULL, max_horarios_registros=NULL,
  max_colaboradores=5, max_viewers=NULL, precio_extra_seat_neto=23000, iva_porcentaje=21,
  is_visible=true, is_active=true, destacado=true, sort_order=3,
  founder_slots_total=8, founder_seed_taken=4, updated_at=now()
WHERE slug='consultora-chica';

UPDATE public.plans SET
  nombre='Consultora Media', precio_mensual_neto=228000, precio_anual_neto=2188800,
  max_empresas=60, max_establecimientos=120, max_gestiones_registros=NULL, max_horarios_registros=NULL,
  max_colaboradores=10, max_viewers=NULL, precio_extra_seat_neto=22800, iva_porcentaje=21,
  is_visible=true, is_active=true, destacado=false, sort_order=4,
  founder_slots_total=8, founder_seed_taken=3, updated_at=now()
WHERE slug='consultora-media';

UPDATE public.plans SET
  nombre='Consultora Grande', precio_mensual_neto=430000, precio_anual_neto=4128000,
  max_empresas=120, max_establecimientos=240, max_gestiones_registros=NULL, max_horarios_registros=NULL,
  max_colaboradores=20, max_viewers=NULL, precio_extra_seat_neto=21500, iva_porcentaje=21,
  is_visible=true, is_active=true, destacado=false, sort_order=5,
  founder_slots_total=8, founder_seed_taken=2, updated_at=now()
WHERE slug='consultora-grande';

UPDATE public.plans SET
  nombre='Empresa', precio_mensual_neto=NULL, precio_anual_neto=NULL,
  max_empresas=NULL, max_establecimientos=NULL, max_gestiones_registros=NULL, max_horarios_registros=NULL,
  max_colaboradores=NULL, max_viewers=NULL, precio_extra_seat_neto=NULL, iva_porcentaje=21,
  is_visible=true, is_active=true, destacado=false, sort_order=6,
  founder_slots_total=0, founder_seed_taken=0, updated_at=now()
WHERE slug='empresa';
