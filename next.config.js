/**** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Ensure Node.js runtime for API routes that need fs
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  webpack: (config) => {
    // Allow importing of pdfjs-dist worker as external URL (we use CDN)
    return config;
  },
};

module.exports = nextConfig;
