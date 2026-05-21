# Platform Decisions — Sigmetría Mobile

## Divergencia con el plan original (MIGRATION_PLAN.md)

El plan original recomienda **Capacitor (Ionic)** para mobile. Decisión del equipo: **React Native + Expo SDK 53** en su lugar. Razones:
- Mejor rendimiento nativo vs WebView
- Acceso completo a APIs nativas (cámara, geo, biometría, push)
- Mejor UX iOS (HIG compliance, gestos nativos)
- Recurso compartido: solo lógica de negocio en packages/shared/

## Bundle ID
- iOS: `com.sigmetria.app`
- Android: `com.sigmetria.app` (mismo)

## Estructura de directorios
```
apps/ios/    ← esta branch
apps/android/ ← branch paralela
packages/shared/ ← código compartido
```

## Shared package candidates
- `lib/types.ts` — Domain types (empresa, establecimiento, etc.)
- `lib/constants.ts` — Labels, options, enum labels
- `lib/utils.ts` — formatDate, formatCUIT, getInitials, cn()
- `lib/schemas/` — Zod schemas (ya existen)
- React Query hooks en `lib/queries/`

## Backend
- Usar `@supabase/supabase-js` 2.45 (misma versión que web)
- NO REST API — usar Supabase JS client directo
- Las mutations vía server actions en web → en mobile vía Supabase JS directo

## Auth
- Supabase Auth con email+password (como web)
- Sign in with Apple opcional (recomendado)
- Sesión persistida con SecureStore
