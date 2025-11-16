/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // ← enables static export
  distDir: 'out',   // default is 'out'
  typescript: {
    ignoreBuildErrors: false,
  },
  transpilePackages: ["undici"],
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push("undici");
    }
    return config;
  },
};

export default nextConfig;
