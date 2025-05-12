/** 
 * @type {import('next').NextConfig}
 * 
 * NOTE: This file must remain in the root directory for Next.js to work properly.
 * It references configuration files that have been moved to the frontend/config directory.
 */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  // Reference the frontend config files in their new location
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': 'frontend',
      '@components': 'frontend/components',
      '@styles': 'frontend/styles',
      '@utils': 'frontend/utils',
      '@hooks': 'frontend/hooks',
      '@config': 'frontend/config',
    };
    return config;
  },
  
  // Setup paths for tailwind and postcss configs
  tailwindConfigPath: './frontend/config/tailwind.config.ts',
  postcssConfigPath: './frontend/config/postcss.config.mjs',
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/scheduler.html',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
