# TODO — Sigmetria Mobile Android

## Phase 0 — Discovery ✅
- [x] Clone repo, create `mobile/android` branch
- [x] Inventory complete: stack, routes, DB schema, auth
- [x] Supabase project identified (lslzhgmoaxgkcjeweqaz)
- [x] Write MOBILE_PLAN.md with full architecture
- [x] Write STATE.md, QUESTIONS.md, TODO.md

## Phase 1 — Bootstrap 🔄
- [ ] Create Expo project in apps/mobile/
- [ ] Configure app.config.ts (bundle ID, icons, splash, Android permissions)
- [ ] Install all dependencies (supabase-js, tanstack-query, zustand, nativewind, mmkv, sentry)
- [ ] Configure NativeWind v4
- [ ] Configure EAS (development, preview, production profiles)
- [ ] Configure expo-router (file-based routing)
- [ ] Configure TypeScript strict
- [ ] First eas build --platform android --profile preview green

## Phase 2 — Auth + Shell
- [ ] Login screen (email + password, parity with web)
- [ ] Session management (token persistence with MMKV)
- [ ] Navigation shell (bottom tabs + stack)
- [ ] Theming (light/dark from design tokens)
- [ ] Logout flow

## Phase 3 — Screens (P0)
- [ ] Empresas list + detail
- [ ] Establecimiento detail (with tabs)
- [ ] Personas list + CRUD
- [ ] Productos list + CRUD
- [ ] Organizaciones Externas list + CRUD
- [ ] Instrumentos list + CRUD
- [ ] Usuarios/Equipo list + access assignment
- [ ] Analytics dashboard
- [ ] Billing/subscription
- [ ] Admin panel (super admin)
- [ ] Asistente HyS (AI chat)

## Phase 4 — Mobile-only Features
- [ ] Push notifications (FCM via expo-notifications)
- [ ] Camera (evidence photos for inspections)
- [ ] Geolocation (field records, auto-fill address)
- [ ] Biometric auth (fingerprint/face)
- [ ] Offline queue with MMKV sync

## Phase 5 — Audits
- [ ] Security audit (npm audit, secrets, permissions, HTTPS)
- [ ] Performance audit (bundle size, cold start, FPS, memory)

## Phase 6 — Publish
- [ ] Google Play screenshots (phone + tablet sizes)
- [ ] Feature graphic (1024x500)
- [ ] Store listing (short + long description in ES)
- [ ] Privacy policy draft (docs/PRIVACY_POLICY.md)
- [ ] eas build --platform android --profile production → .aab
- [ ] RELEASE_ANDROID.md with manual submit steps
