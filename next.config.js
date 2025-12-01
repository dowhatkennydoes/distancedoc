/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['storage.googleapis.com'],
  },
  env: {
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || 'distancedoc',
    GCP_PROJECT_NUMBER: process.env.GCP_PROJECT_NUMBER || '1060519861866',
  },
}

module.exports = nextConfig
