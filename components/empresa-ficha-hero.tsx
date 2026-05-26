'use client'

import { WeatherPanel } from './weather-panel'

interface Props {
  address: string | null
  lat: number | null
  lng: number | null
}

export function EmpresaFichaHero({ address, lat, lng }: Props) {
  const hasCoords = lat != null && lng != null

  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`
    : null

  if (!mapSrc && !address) return null

  return (
    <section className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden mb-6">
      <div
        className={`grid grid-cols-1 ${hasCoords ? 'sm:grid-cols-[1fr_220px]' : ''}`}
        style={{ minHeight: '200px' }}
      >
        {/* Mapa */}
        <div className="relative border-b sm:border-b-0 sm:border-r border-border-subtle min-h-[180px]">
          {mapSrc ? (
            <>
              <iframe
                src={mapSrc}
                width="100%"
                height="100%"
                style={{ border: 0, display: 'block', minHeight: '200px' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Mapa del domicilio legal"
              />
              <a
                href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2 right-2 bg-surface-base/90 backdrop-blur-sm text-xs text-brand-primary font-medium px-2.5 py-1 rounded-lg shadow border border-border-subtle hover:bg-surface-base transition-colors"
              >
                Abrir Maps ↗
              </a>
            </>
          ) : address ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-text-tertiary p-6">
              <p className="text-sm text-center">{address}</p>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-brand-primary hover:underline"
              >
                Ver en Google Maps ↗
              </a>
              <p className="text-xs text-text-tertiary">Agregá latitud y longitud para mostrar el mapa</p>
            </div>
          ) : null}
        </div>

        {/* Clima + hora local */}
        {hasCoords && (
          <WeatherPanel lat={lat!} lng={lng!} />
        )}
      </div>
    </section>
  )
}
