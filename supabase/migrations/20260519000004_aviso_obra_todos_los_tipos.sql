-- Q_AVISO_OBRA aplica a todos los tipos de establecimiento, no solo CONSTRUCCION
INSERT INTO public.pregunta_tipos (pregunta_id, tipo_id, orden)
SELECT p.id, t.id, p.orden
FROM public.preguntas_riesgo p
CROSS JOIN public.tipos_establecimiento t
WHERE p.codigo = 'Q_AVISO_OBRA'
  AND t.codigo != 'CONSTRUCCION'  -- ya existe para CONSTRUCCION
ON CONFLICT DO NOTHING;
