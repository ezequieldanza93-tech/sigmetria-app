-- Políticas de ON DELETE explícitas (hallazgo INTEG-001)
-- Solo se tocan FKs donde la política CAMBIA el comportamiento (no churn cosmético):
--   · Autoría → profiles/users: SET NULL (poder borrar el usuario sin perder el registro ni bloquear).
--   · Composición hijo→cabecera: CASCADE (la purga física de papelera a 90 días necesita la cascada).
--   · Árbol/categoría del scraper: SET NULL.
-- Las ~46 FK a catálogos en NO ACTION se DEJAN: NO ACTION ya bloquea el borrado en uso (== RESTRICT).
-- Recreación DROP+ADD conservando el nombre del constraint.

ALTER TABLE public.blog_comments DROP CONSTRAINT IF EXISTS blog_comments_auth_user_id_fkey;
ALTER TABLE public.blog_comments ADD  CONSTRAINT blog_comments_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.consultoras_members DROP CONSTRAINT IF EXISTS consultora_members_invited_by_fkey;
ALTER TABLE public.consultoras_members ADD  CONSTRAINT consultora_members_invited_by_fkey FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.empresas_documentos DROP CONSTRAINT IF EXISTS empresa_documentos_subido_por_fkey;
ALTER TABLE public.empresas_documentos ADD  CONSTRAINT empresa_documentos_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.establecimientos_documentos DROP CONSTRAINT IF EXISTS establecimiento_documentos_subido_por_fkey;
ALTER TABLE public.establecimientos_documentos ADD  CONSTRAINT establecimiento_documentos_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.firmas DROP CONSTRAINT IF EXISTS firmas_asistente_id_fkey;
ALTER TABLE public.firmas ADD  CONSTRAINT firmas_asistente_id_fkey FOREIGN KEY (asistente_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.firmas DROP CONSTRAINT IF EXISTS firmas_firmante_usuario_id_fkey;
ALTER TABLE public.firmas ADD  CONSTRAINT firmas_firmante_usuario_id_fkey FOREIGN KEY (firmante_usuario_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.founder_review_bonuses DROP CONSTRAINT IF EXISTS founder_review_bonuses_verificado_por_fkey;
ALTER TABLE public.founder_review_bonuses ADD  CONSTRAINT founder_review_bonuses_verificado_por_fkey FOREIGN KEY (verificado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.gifted_plans DROP CONSTRAINT IF EXISTS gifted_plans_otorgado_por_fkey;
ALTER TABLE public.gifted_plans ADD  CONSTRAINT gifted_plans_otorgado_por_fkey FOREIGN KEY (otorgado_por) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.incidentes DROP CONSTRAINT IF EXISTS incidentes_reportado_por_fkey;
ALTER TABLE public.incidentes ADD  CONSTRAINT incidentes_reportado_por_fkey FOREIGN KEY (reportado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.inspecciones DROP CONSTRAINT IF EXISTS inspecciones_inspector_id_fkey;
ALTER TABLE public.inspecciones ADD  CONSTRAINT inspecciones_inspector_id_fkey FOREIGN KEY (inspector_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.iperc_historial_estados DROP CONSTRAINT IF EXISTS iperc_historial_estados_usuario_id_fkey;
ALTER TABLE public.iperc_historial_estados ADD  CONSTRAINT iperc_historial_estados_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.lead_magnet_descargas DROP CONSTRAINT IF EXISTS lead_magnet_descargas_auth_user_id_fkey;
ALTER TABLE public.lead_magnet_descargas ADD  CONSTRAINT lead_magnet_descargas_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_auth_user_id_fkey;
ALTER TABLE public.leads ADD  CONSTRAINT leads_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.mediciones DROP CONSTRAINT IF EXISTS mediciones_realizado_por_fkey;
ALTER TABLE public.mediciones ADD  CONSTRAINT mediciones_realizado_por_fkey FOREIGN KEY (realizado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.personas_documentos DROP CONSTRAINT IF EXISTS empleado_documentos_subido_por_fkey;
ALTER TABLE public.personas_documentos ADD  CONSTRAINT empleado_documentos_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.subcontratistas_documentos DROP CONSTRAINT IF EXISTS subcontratistas_documentos_subido_por_fkey;
ALTER TABLE public.subcontratistas_documentos ADD  CONSTRAINT subcontratistas_documentos_subido_por_fkey FOREIGN KEY (subido_por) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.user_access DROP CONSTRAINT IF EXISTS user_access_granted_by_fkey;
ALTER TABLE public.user_access ADD  CONSTRAINT user_access_granted_by_fkey FOREIGN KEY (granted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.scraper_categorias DROP CONSTRAINT IF EXISTS scraper_categorias_parent_id_fkey;
ALTER TABLE public.scraper_categorias ADD  CONSTRAINT scraper_categorias_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.scraper_categorias(id) ON DELETE SET NULL;
ALTER TABLE public.scraper_productos DROP CONSTRAINT IF EXISTS scraper_productos_categoria_id_fkey;
ALTER TABLE public.scraper_productos ADD  CONSTRAINT scraper_productos_categoria_id_fkey FOREIGN KEY (categoria_id) REFERENCES public.scraper_categorias(id) ON DELETE SET NULL;
ALTER TABLE public.formularios_items_respuestas DROP CONSTRAINT IF EXISTS formulario_item_respuestas_item_id_fkey;
ALTER TABLE public.formularios_items_respuestas ADD  CONSTRAINT formulario_item_respuestas_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.formularios_items(id) ON DELETE CASCADE;
ALTER TABLE public.formularios_respuestas DROP CONSTRAINT IF EXISTS formulario_respuestas_gestion_id_fkey;
ALTER TABLE public.formularios_respuestas ADD  CONSTRAINT formulario_respuestas_gestion_id_fkey FOREIGN KEY (gestion_id) REFERENCES public.gestiones(id) ON DELETE CASCADE;
