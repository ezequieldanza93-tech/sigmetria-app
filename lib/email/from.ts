// Remitente único de todos los emails salientes (Resend).
//
// En desarrollo / sin dominio propio verificado usamos el dominio de PRUEBA de
// Resend (`onboarding@resend.dev`), que NO requiere verificar ningún dominio.
// Limitación de ese modo: Resend solo entrega a la casilla DUEÑA de la cuenta
// Resend (hoy: ezequieldanza93@gmail.com). Suficiente para probar el flujo en dev.
//
// Cuando haya un dominio propio verificado en Resend (al lanzar / registrar como
// Prestador 4.0), basta con setear la env var EMAIL_FROM en Vercel, por ejemplo:
//   EMAIL_FROM="Sigmetría <no-reply@sigmetria.com.ar>"
// y todos los emails pasan a salir desde ahí — sin tocar una línea de código.
export const EMAIL_FROM = process.env.EMAIL_FROM ?? 'Sigmetría <onboarding@resend.dev>'
