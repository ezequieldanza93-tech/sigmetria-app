-- Unificación del eje "Tipo de Riesgo": observaciones_clasificaciones alineadas a los 8 factores IPERC
-- + transversales (Eléctrico, Incendio, Altura). Retira la tabla muerta `aspectos` y la columna aspecto_id.
-- Generado 2026-06-14. NO toca el eje severidad (observaciones_categorias) ni los checklists.
do $$
declare
  loc_id uuid;
begin
  -- 1. renombrar al vocabulario maestro (bare names, igual que iperc factor)
  update observaciones_clasificaciones set nombre = 'Físico'     where nombre = 'Riesgo Físico';
  update observaciones_clasificaciones set nombre = 'Químico'    where nombre = 'Riesgo Químico';
  update observaciones_clasificaciones set nombre = 'Biológico'  where nombre = 'Riesgo Biológico';
  update observaciones_clasificaciones set nombre = 'Ergonómico' where nombre = 'Riesgo Ergonómico';
  update observaciones_clasificaciones set nombre = 'Mecánico'   where nombre = 'Riesgo Mecánico';
  update observaciones_clasificaciones set nombre = 'Locativo'   where nombre = 'Riesgo Locativo';
  update observaciones_clasificaciones set nombre = 'Eléctrico'  where nombre = 'Riesgo Eléctrico';
  update observaciones_clasificaciones set nombre = 'Altura'     where nombre = 'Trabajos en Altura';
  update observaciones_clasificaciones set nombre = 'Incendio'   where nombre = 'Incendio / Emergencia';
  update observaciones_clasificaciones set nombre = 'Ambiental'  where nombre = 'Medio Ambiente';

  -- 2. agregar el factor IPERC faltante
  insert into observaciones_clasificaciones (id, nombre, is_active)
  select gen_random_uuid(), 'Psicosocial', true
  where not exists (select 1 from observaciones_clasificaciones where nombre = 'Psicosocial');

  -- 3. Orden y Limpieza -> Locativo (repuntear observaciones y eliminar)
  select id into loc_id from observaciones_clasificaciones where nombre = 'Locativo';
  update gestiones_observaciones
     set clasificacion_id = loc_id
   where clasificacion_id = (select id from observaciones_clasificaciones where nombre = 'Orden y Limpieza');
  delete from observaciones_clasificaciones where nombre = 'Orden y Limpieza';

  -- 4. soft-retire de lo que NO es tipo de riesgo (eje "Naturaleza del hallazgo" = feature aparte)
  update observaciones_clasificaciones set is_active = false
   where nombre in ('Acto Inseguro', 'Condición Insegura', 'Documentación', 'Uso de EPP');

  -- 5. retirar la tabla muerta `aspectos` y su columna (0 datos, 0 código)
  alter table gestiones_observaciones drop column if exists aspecto_id;
  drop table if exists formularios_secciones_aspectos;
  drop table if exists aspectos;
end $$;
