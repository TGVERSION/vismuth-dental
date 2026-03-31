import type { NextConfig } from 'next';

const API_MAIN_URL = process.env.API_MAIN_URL || 'http://localhost:8000';
const API_ML_URL = process.env.API_ML_URL || 'http://localhost:8001';

if (process.env.NODE_ENV !== 'production') {
  console.log('API_MAIN_URL:', API_MAIN_URL);
  console.log('API_ML_URL:', API_ML_URL);
}

const nextConfig: NextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/main/:path*',
        destination: `${API_MAIN_URL}/:path*`,
      },
      {
        source: '/api/ml/:path*',
        destination: `${API_ML_URL}/:path*`,
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET,POST,PUT,DELETE,OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type,Authorization',
          },
        ],
      },
    ];
  },
  compress: true,
  reactStrictMode: process.env.NODE_ENV !== 'production',
};

export default nextConfig;
