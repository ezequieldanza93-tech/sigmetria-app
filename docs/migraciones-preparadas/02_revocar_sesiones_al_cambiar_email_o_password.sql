-- ════════════════════════════════════════════════════════════════════════════
-- PREPARADA — NO APLICAR SIN REVISIÓN (D1/D2 docs/decisiones.md)
--
-- QUÉ CORRIGE (HUECO b — Art. 4.5 protección de datos / control de acceso)
--   Hoy, al cambiar el email de un usuario (lib/actions/email-change.ts →
--   admin.auth.admin.updateUserById) NO se revocan las sesiones activas. Si una
--   sesión fue comprometida, cambiar email/contraseña NO la corta: el atacante
--   sigue logueado en su dispositivo con el refresh token viejo.
--
-- DOS CAMINOS (elegir uno; recomendado el app-side):
--
--   ── OPCIÓN A (RECOMENDADA, app-side, NO requiere esta migración) ───────────
--   En lib/actions/email-change.ts, tras updateUserById(...), agregar:
--
--       // Revoca TODAS las sesiones del usuario destino (lo desloguea de todos
--       // los dispositivos). Requiere service role / admin client.
--       await admin.auth.admin.signOut(targetUserId, 'global')
--
--   Y, idealmente, hacer lo mismo en el flujo de cambio de CONTRASEÑA cuando lo
--   dispara un admin. Esto NO necesita SQL. Es la forma soportada por GoTrue.
--   `scope: 'global'` mata todas; `'others'` deja viva la sesión actual del que
--   ejecuta (no aplica acá: el que ejecuta es el ADMIN, no el target).
--
--   ── OPCIÓN B (SQL directo sobre auth.sessions, esta migración) ─────────────
--   Si por alguna razón no se quiere tocar la app, este RPC SECURITY DEFINER
--   borra las sesiones del usuario a nivel base. GoTrue invalida el refresh token
--   en el próximo refresh. Llamar desde el server action con el service client:
--       await service.rpc('revocar_sesiones_usuario', { p_user_id: targetUserId })
--
-- RIESGO (POR QUÉ NO SE APLICA AUTOMÁTICAMENTE)
--   ⚠️ DESLOGUEA AL USUARIO DE TODOS SUS DISPOSITIVOS. Es el comportamiento
--   deseado tras un cambio de email/credencial, pero hay que confirmar que el
--   flujo de UX lo comunica (el usuario tendrá que volver a loguearse con el
--   email nuevo). Tocar auth.* directamente es sensible: probar en staging.
--
-- CÓMO TESTEAR ANTES DE APLICAR
--   1. Loguear al usuario target en 2 navegadores (2 sesiones activas).
--   2. Cambiar su email desde el panel de admin.
--   3. Verificar que AMBAS sesiones quedan inválidas (al refrescar, redirige a
--      /login). Con Opción A: signOut('global'). Con Opción B: este RPC.
--   4. Confirmar que el login con el email NUEVO funciona.
--
-- ROLLBACK (Opción B)
--   DROP FUNCTION IF EXISTS public.revocar_sesiones_usuario(uuid);
-- ════════════════════════════════════════════════════════════════════════════

-- ── OPCIÓN B — RPC de revocación a nivel auth.sessions ──────────────────────
CREATE OR REPLACE FUNCTION public.revocar_sesiones_usuario(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Borra todas las sesiones del usuario. El borrado cascada limpia
  -- refresh_tokens asociados (FK en el esquema auth de Supabase).
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Solo el service_role (server actions con admin client) puede invocarlo.
-- NO se otorga a authenticated ni anon: un usuario no debe poder desloguear a otro.
REVOKE ALL ON FUNCTION public.revocar_sesiones_usuario(uuid) FROM public;
REVOKE ALL ON FUNCTION public.revocar_sesiones_usuario(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.revocar_sesiones_usuario(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.revocar_sesiones_usuario(uuid) TO service_role;
