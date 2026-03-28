import { pickPostgresUrl } from './scripts/prisma-resolve-env.mjs'

const _pg = pickPostgresUrl()
if (_pg && !process.env.DATABASE_URL?.trim()) {
  process.env.DATABASE_URL = _pg
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['ical.js'],
  serverExternalPackages: ['pg', 'better-sqlite3'],
  outputFileTracingIncludes: {
    '/*': ['./generated/prisma/**/*'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
