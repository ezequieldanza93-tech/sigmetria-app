# iOS Specifics — Sigmetría HyS Mobile

## App Store Requirements

### Sign in with Apple
**Obligatorio** si la app ofrece login con Google/Facebook/otros OAuth providers. La web solo usa Supabase Auth con email+password. Como NO hay otros providers OAuth actualmente, Sign in with Apple es opcional pero RECOMENDADO para mejor UX iOS y preparación futura.

**Decisión**: Implementar Sign in with Apple como opción adicional de login.

### Human Interface Guidelines (HIG)

| Principio | Implementación |
|-----------|---------------|
| Safe Area | `expo-router` + `<SafeAreaView>` en layouts |
| Dynamic Type | `react-native` `fontScale` respetado globalmente |
| Tap targets | Mínimo 44×44 pt en todos los interactive elements |
| Navigation | Tab bar + stack navigation con `expo-router` |
| Dark Mode | `useColorScheme()` + NativeWind dark mode |
| Gestures | Swipe back nativo, pull-to-refresh en listas |

### Required Info.plist Entries (NSUsageDescription)

| Key | Copy (ES) | API |
|-----|----------|-----|
| NSCameraUsageDescription | "Sigmetría necesita acceso a la cámara para tomar fotos como evidencia de inspecciones y gestiones." | expo-camera |
| NSPhotoLibraryUsageDescription | "Sigmetría necesita acceso a tu galería para adjuntar imágenes a los reportes." | expo-image-picker |
| NSLocationWhenInUseUsageDescription | "Sigmetría usa tu ubicación para registrar la posición de establecimientos y facilitar la navegación." | expo-location |
| NSLocationAlwaysAndWhenInUseUsageDescription | "Sigmetría usa tu ubicación en segundo plano para registrar asistencias." | expo-location (background) |
| NSFaceIDUsageDescription | "Sigmetría usa Face ID para autenticarte rápidamente sin contraseña." | expo-local-authentication |
| NSUserTrackingUsageDescription | "Sigmetría no trackea usuarios entre apps. Este permiso no se solicita." | App Tracking Transparency |

### Privacy Manifest (PrivacyInfo.xcprivacy)

Required Reason APIs usadas:
- `UserDefaults` (MMKV fallback, expo-secure-store)
- `File timestamps` (expo-file-system)
- `System boot time` (expo-location)
- `Disk space` (expo-file-system)

### App Transport Security
- HTTPS estricto, sin excepciones
- Pinning: no implementado en web, no necesario en mobile

### Universal Links / Associated Domains
- Dominio: `sigmetria.app` (asumido)
- Configurar en `app.config.ts` y `.env`

### Deployment Target
- iOS 15.1 mínimo (requisito Expo SDK 53)
- iPhone (iPad opcional, declarado en app.config.ts)

### App Store Connect Metadata
- Bundle ID: `com.sigmetria.app`
- Display Name: "Sigmetría"
- Primary Language: Spanish (Spain)
- Category: Business / Productivity

### Export Compliance (ITSAppUsesNonExemptEncryption)
- La app usa HTTPS estándar (no encryption APIs propias)
- Declarar NO en App Store Connect
- Documentar en RELEASE_IOS.md

## Push Notifications (APNs)
- Provider: expo-notifications con Expo Push Token
- Manejo foreground/background via expo-notifications handlers
- Badges, categorías de notificación
- Deep link al tap en notificación
