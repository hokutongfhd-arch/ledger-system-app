/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    // output: 'export', // Server Actions are not supported with static export
    images: {
        unoptimized: true,
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'imogixajsqkatoixkwlc.supabase.co',
                port: '',
                pathname: '/storage/v1/object/public/**',
            },
            {
                protocol: 'http',
                hostname: 'localhost',
                port: '3000',
                pathname: '/**',
            }
        ],
    },
    // Fix Turbopack root detection issue
    turbopack: {
        root: process.cwd(),
    },
    distDir: 'dist',
};

export default nextConfig;
