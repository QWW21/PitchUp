/* global process */
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Shared is published as TypeScript source, so Next must compile it.
  transpilePackages: ['@pitchup/shared'],
  // Where builds go. The E2E run builds into its own folder (NEXT_DIST_DIR is
  // set in playwright.config.ts), so it can never overwrite the files a
  // running `next dev` is serving from `.next`.
  distDir: process.env.NEXT_DIST_DIR || '.next',
}

export default nextConfig
