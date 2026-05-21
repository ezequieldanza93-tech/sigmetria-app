# Platform Decisions — Sigmetría Mobile

## Divergencia con MIGRATION_PLAN.md
Plan original recomienda Capacitor. Decisión: **React Native + Expo SDK 53**.
Razones: rendimiento nativo, APIs nativas, HIG compliance.

## Bundle ID
- iOS: `com.sigmetria.app`
- Android: `com.sigmetria.app`

## Estructura
```
apps/ios/      ← this branch (mobile/ios)
apps/android/  ← branch paralela (mobile/android)
packages/shared/ ← código compartido
```

## Shared package candidates
- `lib/types.ts` — Domain types
- `lib/constants.ts` — Labels, enum labels
- `lib/utils.ts` — Format helpers
- `lib/schemas/` — Zod schemas
- React Query hooks en `lib/queries/`

## Backend
- @supabase/supabase-js 2.45 (misma versión web)
- Sin REST API — Supabase JS client directo
- Mutations via Supabase JS (no server actions en mobile)

## Auth
- Supabase Auth email+password
- Sign in with Apple opcional
- Sesión en SecureStore
