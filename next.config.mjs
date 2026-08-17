/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: ['*'],
    },
    serverComponentsExternalPackages: [
      '@prisma/adapter-pg',
      '@prisma/client',
      'pg',
    ],
  },
}

export default nextConfig
