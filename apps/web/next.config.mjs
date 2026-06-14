/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  output: 'standalone',
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        '*.arborstudio.pages.dev',
        '*.workers.dev',
        '127.0.0.1:3000',
      ],
    },
  },
  transpilePackages: ['@arborstudio/contracts'],
};

export default config;
