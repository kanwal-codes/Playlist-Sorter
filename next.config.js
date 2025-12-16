/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Only expose public environment variables to the client
  // Server-side env vars are automatically available in API routes
  env: {
    // Public variables (accessible in browser)
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
}

module.exports = nextConfig






