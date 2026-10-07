/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Shared is published as TypeScript source, so Next must compile it.
  transpilePackages: ['@pitchup/shared'],
}

export default nextConfig
