import Image from 'next/image'
import { WeatherPanel } from './weather-panel'

interface Props {
  lat: number
  lng: number
  nombre: string
  fotoUrl?: string | null
}

export function EstablecimientoLocation({ lat, lng, nombre, fotoUrl }: Props) {
  const mapsEmbedUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`
  const mapsOpenUrl = `https://www.google.com/maps/@${lat},${lng},15z`

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
      <div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[1fr_1fr_280px]"
        style={{ minHeight: '230px' }}
      >
        <div className="relative border-r border-gray-100 bg-gray-50 min-h-[180px]">
          {fotoUrl ? (
            <Image
              src={fotoUrl}
              alt={`Foto de ${nombre}`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
              <span className="text-3xl mb-1">🏭</span>
              <p className="text-xs">Sin foto</p>
            </div>
          )}
        </div>

        <div className="relative border-r border-gray-100 min-h-[180px]">
          <iframe
            src={mapsEmbedUrl}
            width="100%"
            height="100%"
            style={{ border: 0, display: 'block', minHeight: '224px' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Mapa de ${nombre}`}
          />
          <a
            href={mapsOpenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-3 bg-white text-xs text-sig-500 font-medium px-3 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
          >
            Abrir en Google Maps ↗
          </a>
        </div>

        <WeatherPanel lat={lat} lng={lng} />
      </div>
    </div>
  )
}
