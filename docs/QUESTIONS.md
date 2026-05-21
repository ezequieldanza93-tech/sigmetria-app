# Questions — Sigmetría Mobile

## Pendientes

| # | Pregunta | Best Guess | Resuelto |
|---|---------|-----------|----------|
| 1 | ¿Apple Developer Account Team ID? | No hay info → build manual .ipa + Transporter | ❌ |
| 2 | ¿App Store Connect API Key? | No hay info → submit manual | ❌ |
| 3 | ¿Diseño visual PDF (IdentidadVisual_SigmetriaHyS_v3.pdf)? | No encontrado → inferir de globals.css + tailwind.config.ts | ❌ |
| 4 | ¿Privacy Policy URL? | Generar docs/PRIVACY_POLICY.md | 🔄 |
| 5 | ¿Push notifications endpoint en backend? | Asumir RPC/tabla push_tokens | ❌ |

## Resoluciones

- Bundle ID: `com.sigmetria.app` (confirmado MIGRATION_PLAN.md)
- Display name: "Sigmetría"
- Sign in with Apple: Opcional (solo email/password auth)
- Dark Mode: Sí (web lo soporta)
- Min iOS: 15.1
- Demo accounts: login page lista cuentas demo con pass `Demo1234!`
