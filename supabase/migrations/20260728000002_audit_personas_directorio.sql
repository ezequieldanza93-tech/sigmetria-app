-- Cadena de custodia (SRT 48/2025) para personas_directorio: la tabla tiene datos
-- personales / de legajo pero NO estaba auditada — la migración 20260702000001
-- listó 'directorio_personas' (nombre inexistente) en vez de 'personas_directorio'
-- y la salteó. Acá: (1) se extiende fn_resolve_consultora_id para resolver el
-- tenant por created_in_consultora_id, y (2) se engancha el audit trigger.
--
-- fn_resolve_consultora_id se reescribe COMPLETA preservando las 9 ramas vigentes
-- (consultora/empresa/establecimiento/gestiones/incidentes/denuncias/reportes/
-- observaciones) + la rama nueva. Tomada de pg_get_functiondef en vivo.

CREATE OR REPLACE FUNCTION public.fn_resolve_consultora_id(p_row jsonb)
RETURNS uuid
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cid uuid;
  v_eid uuid;
  v_est uuid;
BEGIN
  IF p_row ? 'consultora_id' AND p_row->>'consultora_id' IS NOT NULL THEN
    RETURN (p_row->>'consultora_id')::uuid;
  END IF;

  IF p_row ? 'empresa_id' AND p_row->>'empresa_id' IS NOT NULL THEN
    v_eid := (p_row->>'empresa_id')::uuid;
    SELECT consultora_id INTO v_cid FROM public.empresas WHERE id = v_eid;
    RETURN v_cid;
  END IF;

  IF p_row ? 'establecimiento_id' AND p_row->>'establecimiento_id' IS NOT NULL THEN
    v_est := (p_row->>'establecimiento_id')::uuid;
    SELECT e.consultora_id INTO v_cid
    FROM public.establecimientos est
    JOIN public.empresas e ON e.id = est.empresa_id
    WHERE est.id = v_est;
    RETURN v_cid;
  END IF;

  IF p_row ? 'gestion_establecimiento_id' AND p_row->>'gestion_establecimiento_id' IS NOT NULL THEN
    SELECT e.consultora_id INTO v_cid
    FROM public.gestiones_establecimientos ge
    JOIN public.establecimientos est ON est.id = ge.establecimiento_id
    JOIN public.empresas e ON e.id = est.empresa_id
    WHERE ge.id = (p_row->>'gestion_establecimiento_id')::uuid;
    RETURN v_cid;
  END IF;

  IF p_row ? 'registro_gestion_id' AND p_row->>'registro_gestion_id' IS NOT NULL THEN
    SELECT e.consultora_id INTO v_cid
    FROM public.gestiones_registros gr
    JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
    JOIN public.establecimientos est ON est.id = ge.establecimiento_id
    JOIN public.empresas e ON e.id = est.empresa_id
    WHERE gr.id = (p_row->>'registro_gestion_id')::uuid;
    RETURN v_cid;
  END IF;

  IF p_row ? 'incidente_id' AND p_row->>'incidente_id' IS NOT NULL THEN
    SELECT consultora_id INTO v_cid
    FROM public.incidentes
    WHERE id = (p_row->>'incidente_id')::uuid;
    RETURN v_cid;
  END IF;

  IF p_row ? 'denuncia_id' AND p_row->>'denuncia_id' IS NOT NULL THEN
    SELECT consultora_id INTO v_cid
    FROM public.denuncias
    WHERE id = (p_row->>'denuncia_id')::uuid;
    RETURN v_cid;
  END IF;

  IF p_row ? 'reporte_id' AND p_row->>'reporte_id' IS NOT NULL THEN
    SELECT consultora_id INTO v_cid
    FROM public.reportes_fotograficos
    WHERE id = (p_row->>'reporte_id')::uuid;
    RETURN v_cid;
  END IF;

  IF p_row ? 'observacion_id' AND p_row->>'observacion_id' IS NOT NULL THEN
    SELECT e.consultora_id INTO v_cid
    FROM public.gestiones_observaciones go
    JOIN public.gestiones_registros gr ON gr.id = go.registro_gestion_id
    JOIN public.gestiones_establecimientos ge ON ge.id = gr.gestion_establecimiento_id
    JOIN public.establecimientos est ON est.id = ge.establecimiento_id
    JOIN public.empresas e ON e.id = est.empresa_id
    WHERE go.id = (p_row->>'observacion_id')::uuid;
    RETURN v_cid;
  END IF;

  -- NUEVA: personas_directorio (PII/legajo) → tenant por la consultora dueña.
  IF p_row ? 'created_in_consultora_id' AND p_row->>'created_in_consultora_id' IS NOT NULL THEN
    RETURN (p_row->>'created_in_consultora_id')::uuid;
  END IF;

  RETURN NULL;
END;
$$;

-- Enganchar la cadena de custodia a personas_directorio.
DROP TRIGGER IF EXISTS audit_personas_directorio ON public.personas_directorio;
CREATE TRIGGER audit_personas_directorio
  AFTER INSERT OR UPDATE OR DELETE ON public.personas_directorio
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_trigger();
