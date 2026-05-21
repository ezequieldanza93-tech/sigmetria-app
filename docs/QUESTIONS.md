# Questions — Sigmetría Mobile iOS

## Pendientes de responder por el equipo

| # | Pregunta | Best Guess | Resuelto |
|---|---------|-----------|----------|
| 1 | ¿Hay Apple Developer account con Team ID para EAS Submit? | No hay info → .ipa en dist/ + manual submit via Transporter | ❌ |
| 2 | ¿Hay App Store Connect API Key (Issuer ID, Key ID, .p8)? | No hay info → build manual | ❌ |
| 3 | ¿Hay diseño/identidad visual PDF (IdentidadVisual_SigmetriaHyS_v3.pdf)? | No encontrado en repo → inferir de globals.css | ❌ |
| 4 | ¿Qué plan de EAS Build (free vs production)? | Asumir EAS Build free (2 builds/día) | ✅ |
| 5 | ¿iPad soporte requerido? | Asumir solo iPhone, declarar en app.config | ✅ |
| 6 | ¿Offline-first requerido? | Sí, MMKV encrypted queue | ✅ |
| 7 | ¿Push notifications endpoint en backend? | Asumir tabla `push_tokens` y RPC | ❌ |
| 8 | ¿Privacy Policy URL? | Generar en docs/PRIVACY_POLICY.md | 🔄 |
| 9 | ¿Support URL? | Usar web de Sigmetría | ✅ |

## Resoluciones

- **Bundle ID**: `com.sigmetria.app` (confirmado en MIGRATION_PLAN.md)
- **Display name**: "Sigmetría" (vs "Sigmetría HyS")
- **Sign in with Apple**: NO obligatorio (solo email/password auth), implementar igual por buena práctica
- **Dark Mode**: La web lo soporta → app también
- **Minimum OS**: iOS 15.1
