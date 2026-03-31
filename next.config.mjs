import { pickPostgresUrl } from './scripts/resolve-database-env.mjs'

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
    '/*': ['./drizzle/**/*', './styles/theme-presets/**/*'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
    qualities: [25, 50, 75, 92, 100],
  },
}

export default nextConfig
