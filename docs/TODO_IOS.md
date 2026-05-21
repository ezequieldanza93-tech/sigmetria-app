# TODO iOS — Sigmetría Mobile

## Fase 0 — Discovery ✅
- [x] Analizar stack web (Next.js 15, Supabase, TanStack Query, Tailwind)
- [x] Identificar backend (Supabase URL: lslzhgmoaxgkcjeweqaz.supabase.co)
- [x] Mapear auth flow (Supabase SSR, email+password)
- [x] Inventario de pantallas (13 route groups + auth)
- [x] Identidad visual de globals.css + tailwind.config.ts
- [x] Determinar roles/permisos (6 roles)
- [x] Generar docs (MOBILE_PLAN.md, IOS_SPECIFICS.md, QUESTIONS.md)
- [ ] Recorrer web con Playwright para capturar screenshots

## Fase 1 — Bootstrap 🔄
- [ ] Crear Expo app con TypeScript strict
- [ ] Configurar app.config.ts (bundle ID, icons, splash, permissions)
- [ ] Configurar NativeWind v4
- [ ] Configurar EAS (development, preview, production profiles)
- [ ] Configurar expo-router file-based routing
- [ ] Primer build preview en simulador iOS
- [ ] Configurar TanStack Query + Zustand
- [ ] Configurar MMKV encrypted storage
- [ ] Configurar Sentry / error tracking

## Fase 2 — Auth + Shell
- [ ] Login screen (email + password)
- [ ] Sign in with Apple
- [ ] Sesión persistence con MMKV + SecureStore
- [ ] Dashboard shell con tab navigator
- [ ] Theming (light/dark) desde CSS variables web
- [ ] SafeArea y Dynamic Type

## Fase 3 — Screens (por criticidad)
- [ ] Empresas List (card layout)
- [ ] Empresa Detail (3 tabs)
- [ ] Empresa Form (create + edit)
- [ ] Establecimiento Detail (9 tabs)
- [ ] Personas
- [ ] Productos
- [ ] Instrumentos
- [ ] Organizaciones
- [ ] Organizaciones Externas
- [ ] Usuarios / Equipo
- [ ] Analytics
- [ ] Billing
- [ ] Asistente HyS
- [ ] Configuración
- [ ] Super Admin

## Fase 4 — Mobile-only
- [ ] Push notifications (APNs via expo-notifications)
- [ ] Camera (evidence photos)
- [ ] Geolocation (check-in, establecimiento location)
- [ ] Face ID / Touch ID
- [ ] Offline queue with MMKV

## Fase 5 — Auditorías
- [ ] Auditoría de seguridad
- [ ] Auditoría de rendimiento
- [ ] Auditoría App Store (pre-submit)

## Fase 6 — Publish
- [ ] App Store screenshots
- [ ] Icon 1024×1024 sin alpha
- [ ] Privacy Manifest (PrivacyInfo.xcprivacy)
- [ ] Privacy Policy URL
- [ ] eas build production → .ipa
- [ ] eas submit → TestFlight (o manual)
