-- ============================================================
-- Actividades economicas: CIIU Rev3 a nivel DIVISION (2 digitos)
-- ============================================================
-- Reemplaza las 21 secciones provisionales (A-U) por las 60 divisiones
-- del CIIU Rev3 presentes en el nomenclador (listado_CIIU.pdf). Nivel "general":
-- mas granular que la seccion, sin el detalle de las clases de 5 digitos.
-- 0 establecimientos usaban actividad_id al momento de migrar (FK on-delete SET NULL).
-- Idempotente: borra filas codigo<=2 chars y re-inserta.
-- ============================================================

BEGIN;

DELETE FROM public.actividades_economicas WHERE char_length(codigo) <= 2;

INSERT INTO public.actividades_economicas (codigo, nombre, seccion, is_active) VALUES
  ('01', 'Agricultura, ganadería, caza y servicios conexos', 'A', true),
  ('02', 'Silvicultura, extracción de madera y servicios conexos', 'A', true),
  ('05', 'Pesca, explotación de criaderos y servicios conexos', 'B', true),
  ('10', 'Extracción de carbón y lignito; extracción de turba', 'C', true),
  ('11', 'Extracción de petróleo crudo y gas natural; servicios conexos', 'C', true),
  ('12', 'Extracción de minerales de uranio y torio', 'C', true),
  ('13', 'Extracción de minerales metalíferos', 'C', true),
  ('14', 'Explotación de otras minas y canteras', 'C', true),
  ('15', 'Elaboración de productos alimenticios y bebidas', 'D', true),
  ('16', 'Elaboración de productos de tabaco', 'D', true),
  ('17', 'Fabricación de productos textiles', 'D', true),
  ('18', 'Confección de prendas de vestir; terminación y teñido de pieles', 'D', true),
  ('19', 'Curtido de cueros; fabricación de calzado y artículos de marroquinería', 'D', true),
  ('20', 'Producción de madera y fabricación de productos de madera y corcho, excepto muebles', 'D', true),
  ('21', 'Fabricación de papel y de productos de papel', 'D', true),
  ('22', 'Edición e impresión; reproducción de grabaciones', 'D', true),
  ('23', 'Fabricación de coque, productos de la refinación del petróleo y combustible nuclear', 'D', true),
  ('24', 'Fabricación de sustancias y productos químicos', 'D', true),
  ('25', 'Fabricación de productos de caucho y plástico', 'D', true),
  ('26', 'Fabricación de productos minerales no metálicos', 'D', true),
  ('27', 'Fabricación de metales comunes', 'D', true),
  ('28', 'Fabricación de productos elaborados de metal, excepto maquinaria y equipo', 'D', true),
  ('29', 'Fabricación de maquinaria y equipo n.c.p.', 'D', true),
  ('30', 'Fabricación de maquinaria de oficina, contabilidad e informática', 'D', true),
  ('31', 'Fabricación de maquinaria y aparatos eléctricos n.c.p.', 'D', true),
  ('32', 'Fabricación de equipos y aparatos de radio, televisión y comunicaciones', 'D', true),
  ('33', 'Fabricación de instrumentos médicos, ópticos y de precisión; fabricación de relojes', 'D', true),
  ('34', 'Fabricación de vehículos automotores, remolques y semirremolques', 'D', true),
  ('35', 'Fabricación de equipo de transporte n.c.p.', 'D', true),
  ('36', 'Fabricación de muebles y colchones; industrias manufactureras n.c.p.', 'D', true),
  ('37', 'Reciclamiento', 'D', true),
  ('40', 'Electricidad, gas, vapor y agua caliente', 'E', true),
  ('41', 'Captación, depuración y distribución de agua', 'E', true),
  ('45', 'Construcción', 'F', true),
  ('50', 'Venta, mantenimiento y reparación de vehículos automotores y motocicletas', 'G', true),
  ('51', 'Comercio al por mayor y en comisión, excepto vehículos automotores', 'G', true),
  ('52', 'Comercio al por menor, excepto vehículos automotores; reparación de efectos personales', 'G', true),
  ('55', 'Servicios de hotelería y restaurantes', 'H', true),
  ('60', 'Servicio de transporte terrestre', 'I', true),
  ('61', 'Servicio de transporte por vía acuática', 'I', true),
  ('62', 'Servicio de transporte aéreo', 'I', true),
  ('63', 'Servicios anexos al transporte; servicios de agencias de viaje', 'I', true),
  ('64', 'Servicios de correos y telecomunicaciones', 'I', true),
  ('65', 'Intermediación financiera, excepto seguros y planes de pensiones', 'J', true),
  ('66', 'Servicios de seguros y de administración de fondos de jubilaciones y pensiones', 'J', true),
  ('67', 'Servicios auxiliares a la actividad financiera', 'J', true),
  ('70', 'Servicios inmobiliarios', 'K', true),
  ('71', 'Alquiler de maquinaria y equipo sin operarios; alquiler de efectos personales', 'K', true),
  ('72', 'Servicios informáticos y actividades conexas', 'K', true),
  ('73', 'Investigación y desarrollo', 'K', true),
  ('74', 'Servicios empresariales n.c.p.', 'K', true),
  ('75', 'Administración pública, defensa y seguridad social obligatoria', 'L', true),
  ('80', 'Enseñanza', 'M', true),
  ('85', 'Servicios sociales y de salud', 'N', true),
  ('90', 'Eliminación de desperdicios y aguas residuales, saneamiento y servicios similares', 'O', true),
  ('91', 'Servicios de asociaciones n.c.p.', 'O', true),
  ('92', 'Servicios de esparcimiento y servicios culturales y deportivos', 'O', true),
  ('93', 'Servicios personales n.c.p.', 'O', true),
  ('95', 'Servicios de hogares privados que contratan servicio doméstico', 'P', true),
  ('99', 'Servicios de organizaciones y órganos extraterritoriales', 'Q', true);

COMMIT;