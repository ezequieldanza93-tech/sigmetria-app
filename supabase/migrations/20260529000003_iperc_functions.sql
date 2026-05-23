-- Función para incrementar contador de uso de medidas de control
CREATE OR REPLACE FUNCTION increment_medida_uso(medida_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE medidas_control SET veces_usada = veces_usada + 1, updated_at = now() WHERE id = medida_id;
END;
$$;
