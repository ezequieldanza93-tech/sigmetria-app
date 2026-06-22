-- RPC: capacitaciones del TRABAJADOR logueado (identidad verificada por user_id).
-- Espejo de mis_entregas_epp(): SECURITY DEFINER, scopeado a la persona del
-- directorio linkeada a la cuenta (personas_directorio.user_id = auth.uid()).
--
-- Nota: el hook cliente useMisAsignaciones (lib/queries/curso.ts) consulta una
-- tabla inexistente ('directorio_personas.usuario_id'); por eso el trabajador
-- usa este RPC, que resuelve la identidad por la columna correcta.

CREATE OR REPLACE FUNCTION public.mis_capacitaciones()
RETURNS jsonb
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(c ORDER BY c.fecha_asignacion DESC), '[]'::jsonb)
  FROM (
    SELECT
      ca.id                        AS asignacion_id,
      ca.curso_id,
      ca.estado,
      ca.fecha_limite,
      ca.fecha_aprobacion,
      ca.fecha_asignacion,
      ca.progreso_porcentaje,
      cu.titulo                    AS curso_titulo,
      cu.descripcion_corta,
      cu.duracion_estimada_minutos,
      cert.codigo_validacion       AS certificado_codigo
    FROM public.curso_asignaciones ca
    JOIN public.personas_directorio pd
      ON pd.id = ca.persona_id AND pd.user_id = (SELECT auth.uid())
    JOIN public.cursos cu ON cu.id = ca.curso_id
    LEFT JOIN public.cursos_certificados cert
      ON cert.asignacion_id = ca.id AND cert.invalidado = false
  ) c;
$$;

GRANT EXECUTE ON FUNCTION public.mis_capacitaciones() TO authenticated;
