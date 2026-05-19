-- Q_AVISO_OBRA no es una pregunta configurable por el usuario.
-- Para establecimientos tipo CONSTRUCCION aplica siempre por normativa.
-- La quitamos de pregunta_tipos en todos los tipos.
DELETE FROM public.pregunta_tipos
WHERE pregunta_id = (SELECT id FROM public.preguntas_riesgo WHERE codigo = 'Q_AVISO_OBRA');

-- La marcamos inactiva para que no aparezca en ningún listado futuro.
UPDATE public.preguntas_riesgo SET is_active = false WHERE codigo = 'Q_AVISO_OBRA';
