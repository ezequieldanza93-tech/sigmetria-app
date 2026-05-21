# Mobile Plan — Sigmetría HyS

## Estrategia

App nativa con **React Native + Expo SDK 53** para iOS y Android, compartiendo lógica de negocio en `packages/shared/`. La web (Next.js 15 + Supabase) es la fuente de verdad del backend; la app consume los mismos endpoints y patrones de auth.

## Stack Mobile

| Capa | Tecnología |
|------|-----------|
| Framework | Expo SDK 53 |
| Lenguaje | TypeScript 5 (strict) |
| Routing | expo-router (file-based) |
| Estilos | NativeWind v4 (Tailwind CSS 4) |
| Estado | TanStack Query 5 + Zustand 5 |
| Backend | @supabase/supabase-js 2.45 |
| Icons | lucide-react-native |
| Storage | react-native-mmkv (encrypted) |
| Auth | Supabase Auth + expo-apple-authentication |
| Push | expo-notifications (APNs) |
| Camera | expo-camera |
| Location | expo-location |
| Biometry | expo-local-authentication |
| E2E | Maestro (iOS simulator) |

## Arquitectura de directorio

```
sigmetria-app/
├── apps/
│   ├── ios/               # Expo app iOS
│   └── android/           # Expo app Android (paralelo)
├── packages/
│   └── shared/            # Tipos, hooks, utils, queries compartidos
├── docs/
│   ├── web-screenshots/   # Capturas de cada pantalla web
│   ├── coordination/      # Decisiones cross-platform
│   ├── MOBILE_PLAN.md
│   ├── IOS_SPECIFICS.md
│   ├── STATE_IOS.md
│   ├── QUESTIONS.md
│   ├── TODO_IOS.md
│   ├── PROGRESS_IOS.md
│   ├── AUDIT_SECURITY_IOS.md
│   ├── AUDIT_PERFORMANCE_IOS.md
│   ├── AUDIT_APPSTORE.md
│   └── RELEASE_IOS.md
└── supabase/              # DB schema (compartido)
```

## Screens Inventory (13 route groups + auth)

| # | Screen | Ruta Web | Prioridad | Tipo |
|---|--------|---------|-----------|------|
| 1 | Login | `/login` | 🔴 Crítica | Auth |
| 2 | Onboarding | `/onboarding` | 🔴 Crítica | Auth |
| 3 | Empresas List | `/dashboard/empresas` | 🔴 Crítica | List |
| 4 | Empresa Detail (3 tabs) | `/dashboard/empresas/[id]` | 🔴 Crítica | Detail |
| 5 | Empresa Form | `/dashboard/empresas/nueva`, `/[id]/editar` | 🔴 Crítica | Form |
| 6 | Establecimiento Detail (9 tabs) | `/dashboard/empresas/[id]/establecimientos/[estId]` | 🔴 Crítica | Detail |
| 7 | Personas | `/dashboard/personas` | 🟡 Alta | List |
| 8 | Productos | `/dashboard/productos` | 🟡 Alta | List |
| 9 | Instrumentos | `/dashboard/instrumentos` | 🟡 Alta | List |
| 10 | Organizaciones | `/dashboard/organizaciones` | 🟡 Alta | List |
| 11 | Org. Externas | `/dashboard/organizaciones-externas` | 🟡 Alta | List |
| 12 | Usuarios/Equipo | `/dashboard/usuarios`, `/dashboard/equipo` | 🟡 Alta | List |
| 13 | Analytics | `/dashboard/analytics` | 🟢 Media | Dashboard |
| 14 | Billing | `/dashboard/billing` | 🟢 Media | List/Form |
| 15 | Asistente HyS | `/dashboard/asistencia` | 🟢 Media | Chat |
| 16 | Configuración | `/dashboard/configuracion/catalogacion` | 🟢 Media | Form |
| 17 | Super Admin | `/dashboard/admin` | 🟢 Media | Admin |

## Roles del sistema

```
developer → acceso total
full_access_main  → CRUD completo, manage users
full_access_branch → CRUD completo
colaborador → escritura en asignaciones
full_viewer → solo lectura global
colaborador_viewer → solo lectura limitada
```

## Fases

- **Fase 0** — Discovery: stack, backend, auth, inventario, identidad visual
- **Fase 1** — Bootstrap: Expo project, EAS, app.config, build preview
- **Fase 2** — Auth + Shell: login, registro, navigation, theming
- **Fase 3** — Portado de pantallas por criticidad
- **Fase 4** — Mobile-only features: push, camera, geo, biometría, offline
- **Fase 5** — Auditorías: seguridad, rendimiento, App Store
- **Fase 6** — Publish: .ipa firmado, screenshots, App Store Connect
