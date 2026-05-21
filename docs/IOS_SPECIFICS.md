# iOS Specifics — Sigmetría HyS Mobile

## App Store Requirements

### Sign in with Apple
NO obligatorio (solo email/password auth). Implementar igual como opción para mejor UX iOS.

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

### Privacy Manifest (PrivacyInfo.xcprivacy)
Required Reason APIs: UserDefaults, file timestamps, system boot time, disk space.

### App Transport Security
HTTPS estricto, sin excepciones.

### Deployment Target
iOS 15.1 mínimo (Expo SDK 53). iPhone only (iPad opcional).

### App Store Connect Metadata
- Bundle ID: `com.sigmetria.app`
- Display Name: "Sigmetría"
- Primary Language: Spanish (Spain)
- Category: Business / Productivity

### Export Compliance (ITSAppUsesNonExemptEncryption)
NO — solo HTTPS estándar.
