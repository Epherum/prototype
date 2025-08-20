/** @type {import('next').NextConfig} */
const nextConfig = {
  //remove strict mode
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: 'standalone',
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client']
  },
  images: {
    remotePatterns: [
      // Keep Unsplash if you might use it elsewhere, or remove
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        port: "",
        pathname: "**",
      },
      // Add placeholder.com
      {
        protocol: "https",
        hostname: "via.placeholder.com", // Add this hostname
        port: "",
        pathname: "**", // Allow any path
      },
    ],
  },
};
export default nextConfig;
