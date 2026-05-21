/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["192.168.0.102", "192.168.0.182", "172.26.0.1", "localhost"],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://backend:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
