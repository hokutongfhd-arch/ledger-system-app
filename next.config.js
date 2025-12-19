/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    images: {
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
        root: '.',
    },
};

export default nextConfig;
