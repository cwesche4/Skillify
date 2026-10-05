import { getServerActionAllowedOrigins } from './lib/config/serverActionOrigins.mjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: getServerActionAllowedOrigins(),
    },
    serverComponentsExternalPackages: [
      '@prisma/adapter-pg',
      '@prisma/client',
      'pg',
    ],
  },
}

export default nextConfig
