import type { LucideIcon } from 'lucide-react'

/**
 * Ícono CANÓNICO de "establecimiento": una fábrica con chimenea y humo.
 *
 * Estilo lucide (viewBox 24x24, stroke = currentColor, caps/joins redondeados,
 * strokeWidth por defecto 2 pero sobreescribible) para que combine con el resto
 * de los íconos de la app y sea un drop-in donde se espera un `LucideIcon`.
 *
 * REGLA: usar SIEMPRE este componente para representar un establecimiento.
 * Misma identidad → mismo ícono en toda la aplicación.
 */
export const EstablecimientoIcon: LucideIcon = ({ size = 24, absoluteStrokeWidth, ...props }) => {
  void absoluteStrokeWidth
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* humo saliendo de la chimenea */}
      <path d="M6 2.5c0-1 1.2-1 1.2-2" />
      {/* chimenea */}
      <path d="M5 10V3.5h2.5V10" />
      {/* cuerpo de la fábrica */}
      <path d="M3 21V10h18v11" />
      {/* piso */}
      <path d="M2 21h20" />
      {/* portón */}
      <path d="M9.5 21v-5h4v5" />
      {/* ventanas */}
      <path d="M5.5 14h3" />
      <path d="M15.5 14h3" />
    </svg>
  )
}
