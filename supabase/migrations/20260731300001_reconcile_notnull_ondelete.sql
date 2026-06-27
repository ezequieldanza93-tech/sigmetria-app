-- Dos correcciones combinadas aplicadas en la misma tanda:

-- (A) RECONCILIACIÓN: contradicción NOT NULL + ON DELETE SET NULL
-- calculo_carga_fuego.gestion_establecimiento_id y capacitacion_sesiones.empresa_id
-- quedaron NOT NULL pero con ON DELETE SET NULL → imposible poner NULL en NOT NULL.
-- Política correcta: CASCADE (relaciones de composición; la purga de papelera lo requiere).

ALTER TABLE public.capacitacion_sesiones DROP CONSTRAINT IF EXISTS capacitacion_sesiones_empresa_id_fkey;
ALTER TABLE public.capacitacion_sesiones ADD  CONSTRAINT capacitacion_sesiones_empresa_id_fkey FOREIGN KEY (empresa_id) REFERENCES public.empresas(id) ON DELETE CASCADE;
ALTER TABLE public.calculo_carga_fuego DROP CONSTRAINT IF EXISTS calculo_carga_fuego_gestion_establecimiento_id_fkey;
ALTER TABLE public.calculo_carga_fuego ADD  CONSTRAINT calculo_carga_fuego_gestion_establecimiento_id_fkey FOREIGN KEY (gestion_establecimiento_id) REFERENCES public.gestiones_establecimientos(id) ON DELETE CASCADE;

-- (B) 3FN-002: COMMENT ON columnas derivadas — documentadas, no convertidas a GENERATED
-- Dependen de tablas externas o fórmulas complejas → no pueden ser GENERATED ALWAYS AS STORED.

COMMENT ON COLUMN public.iperc_matriz_riesgos.valor_calculado IS
  'Calculado por la app como probabilidad.valor × consecuencia.valor, ambos en tablas externas. No puede ser GENERATED. Actualizar cuando cambia probabilidad_id o consecuencia_id.';

COMMENT ON COLUMN public.medicion_ruido_puntos.dosis_pct IS
  'Dosis de ruido en % calculada según Anexo V Decreto 351/79 (suma de fracciones Te/Tp). Calculada por la app con datos de referencia externos. No puede ser GENERATED.';

COMMENT ON COLUMN public.payments.monto_total IS
  'Candidato a GENERATED AS (monto_neto + monto_iva) STORED. Verificar antes del cambio que el webhook de MercadoPago no escriba este campo directamente. Ver 3FN-002.';
