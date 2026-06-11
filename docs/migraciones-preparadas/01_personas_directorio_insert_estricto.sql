-- ════════════════════════════════════════════════════════════════════════════
-- PREPARADA — NO APLICAR SIN REVISIÓN (D1/D2 docs/decisiones.md)
--
-- QUÉ CORRIGE
--   Endurece el INSERT de `personas_directorio` (ex `directorio_personas`).
--
-- ESTADO REAL HOY (verificado en el código, NO es "WITH CHECK (true)")
--   La auditoría previa decía que la policy era `WITH CHECK (true)`. ESO YA NO
--   ES ASÍ: la migración 20260516000009_rls_fix_rename_consultor.sql reemplazó
--   esa policy. El estado VIGENTE en producción es:
--
--     CREATE POLICY "personas_directorio: insert" ... WITH CHECK (
--       is_developer()
--       OR EXISTS (SELECT 1 FROM consultoras_members cm
--                  WHERE cm.user_id = auth.uid() AND cm.is_active
--                    AND cm.role IN ('full_access_main','full_access_branch','colaborador'))
--     )
--
--   → Un VIEWER ya NO puede insertar (bien). PERO sigue habiendo un hueco fino:
--     la policy NO valida acceso al ESTABLECIMIENTO concreto. Un `colaborador`
--     de una consultora (rol con acceso GRANULAR vía user_access) puede crear
--     personas en el directorio global de su consultora aunque no tenga ningún
--     establecimiento asignado. Como `personas_directorio` es un directorio a
--     nivel CONSULTORA (no por establecimiento; el vínculo persona↔establecimiento
--     vive en `personas_establecimientos`), el aislamiento ENTRE consultoras se
--     mantiene — el riesgo es solo intra-consultora (un colaborador sin scope
--     puede sembrar filas en el directorio de SU propia consultora).
--
-- QUÉ HACE ESTA MIGRACIÓN
--   Restringe el INSERT del `colaborador` a que tenga AL MENOS un grant activo
--   en `user_access` dentro de su consultora. Los adm(main/branch) y developer
--   siguen pudiendo insertar sin restricción (gestionan todo el directorio).
--
-- RIESGO (POR QUÉ NO SE APLICA AUTOMÁTICAMENTE)
--   ⚠️ PUEDE ROMPER EL ONBOARDING DE COLABORADORES. Si un colaborador todavía
--   no tiene ningún `user_access` activo (recién invitado, o su acceso se asigna
--   DESPUÉS de empezar a cargar datos), este INSERT empezará a fallar y la app
--   mostrará "no tenés permiso para crear personas". Verificar el flujo real de
--   alta de colaboradores ANTES de aplicar.
--
-- CÓMO TESTEAR ANTES DE APLICAR (staging con datos reales o seed)
--   1. Como `full_access_main`: crear persona → debe FUNCIONAR.
--   2. Como `colaborador` CON user_access activo → debe FUNCIONAR.
--   3. Como `colaborador` SIN user_access → debe FALLAR (este es el cambio).
--   4. Como `full_viewer` / `visualizador_comentarista` → debe FALLAR (ya fallaba).
--   5. Como colaborador de OTRA consultora → debe FALLAR (aislamiento).
--   Recién si (1)(2) pasan y el onboarding no se rompe, aplicar a prod.
--
-- ROLLBACK
--   DROP POLICY IF EXISTS "personas_directorio: insert" ON public.personas_directorio;
--   -- y recrear la policy previa (la de 20260516000009, role-gated sin user_access).
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS "personas_directorio: insert" ON public.personas_directorio;

CREATE POLICY "personas_directorio: insert" ON public.personas_directorio
  FOR INSERT TO authenticated
  WITH CHECK (
    is_developer()
    -- Admins de consultora: gestionan todo el directorio de su consultora.
    OR EXISTS (
      SELECT 1 FROM public.consultoras_members cm
      WHERE cm.user_id   = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role IN ('full_access_main', 'full_access_branch')
    )
    -- Colaborador: solo si tiene AL MENOS un acceso granular activo en su consultora.
    -- (Esto evita que un colaborador sin scope siembre el directorio.)
    OR EXISTS (
      SELECT 1
      FROM public.consultoras_members cm
      JOIN public.user_access ua
        ON ua.user_id = cm.user_id
       AND ua.consultora_id = cm.consultora_id
      WHERE cm.user_id   = (SELECT auth.uid())
        AND cm.is_active = true
        AND cm.role      = 'colaborador'
        AND ua.is_active = true
    )
  );

COMMIT;
