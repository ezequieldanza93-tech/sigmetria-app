# Questions & Assumptions — Sigmetria Mobile Android

## Unresolved Questions

| # | Question | Best Guess | Status |
|---|----------|------------|--------|
| 1 | Google Play Service Account JSON for EAS Submit? | No service account found → manual `.aab` delivery via `RELEASE_ANDROID.md` | 🔴 Assumed no |
| 2 | Vercel env vars for production Supabase keys? | Using Supabase project `lslzhgmoaxgkcjeweqaz` — anon key from publishable keys API | 🟢 Resolved |
| 3 | Font licenses for Montserrat/Poppins in APK bundle? | Both are OFL-licensed, safe to bundle | 🟢 Safe |
| 4 | Does the web use Google Fonts or self-hosted? | Next.js `next/font/google` — fetches from Google at build time | 🟢 Self-hosted at build |
| 5 | Privacy Policy URL for Google Play? | No existing policy → create `docs/PRIVACY_POLICY.md` draft | 🔴 Needs draft |
| 6 | Demo mode accounts exist in the real backend? | Login page lists demo accounts; need to verify they work with Supabase anon key | 🟡 Assumed yes |
| 7 | What is the app's color scheme beyond CSS vars? | Extracted from globals.css: green brand (#4CAF50), dark/light themes | 🟢 Resolved |
| 8 | Does the web have password recovery / registration? | Login page only shows email+password, no recovery or sign-up links | 🟢 Only login exists |
| 9 | What's the Zapier integration URL / webhook? | Not in codebase → not needed for mobile MVP | 🔴 Out of scope |
| 10 | Is there a staging/development Supabase instance? | Two projects found: `sigmetria-project` (CRM/leads) and `Sigmetria-app` (main app) | 🟢 Resolved |

## Decisions Made

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Expo SDK (not bare React Native) | Faster development, EAS Build, OTA updates |
| 2 | expo-router (file-based routing) | Standard for Expo projects, matches Next.js mental model |
| 3 | Supabase JS SDK same version as web (v2.45.4) | Reuse query patterns, types, and auth logic |
| 4 | NativeWind (Tailwind for RN) | Web uses Tailwind, NW provides class-based styling parity |
| 5 | MMKV for offline storage | Fastest KV store for RN, encrypted option available |
| 6 | Bundle ID: `com.sigmetria.app` | Consistent with MIGRATION_PLAN.md |
| 7 | Min SDK 24, Target SDK 34 | Google Play requirement 2025+ |
| 8 | All mobile features enabled (push, camera, geo, bio, offline) | Will implement in Phase 4 based on priority |
