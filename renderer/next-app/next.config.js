/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: '../../dist/renderer',
  assetPrefix: process.env.NODE_ENV === 'production' ? './' : undefined,
  images: {
    unoptimized: true,
  },
};

module.exports = nextConfig;
