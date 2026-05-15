import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  transpilePackages: ['react-leaflet', '@react-leaflet/core'],
}

export default nextConfig
