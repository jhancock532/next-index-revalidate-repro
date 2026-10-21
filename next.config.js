// Trimmed copy of the affected app's next.config.js. Only the settings that
// touch routing and ISR caching are kept.

// USE_CACHE_HANDLER=false runs Next's built-in cache, which shows the bug isn't
// caused by the custom handler.
const useCustomCacheHandler = process.env.USE_CACHE_HANDLER !== 'false';

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,

    cacheHandler:
        useCustomCacheHandler && ['production', 'test'].includes(process.env.NODE_ENV)
            ? require.resolve('./cache-handler.ts')
            : undefined,

    // Same as the affected app: no in-memory page cache, so every pod reads
    // the HTML from the shared cache handler (Redis).
    cacheMaxMemorySize: 0,

    generateBuildId: async () => 'static-build-id',

    // Multisite routing: put the request hostname at the front of the path so
    // pages/[hostname]/... knows which site to load.
    // e.g. beta.example.com/about -> /beta.example.com/about
    async rewrites() {
        return {
            afterFiles: [
                {
                    source: '/:path(.*)',
                    has: [
                        {
                            type: 'header',
                            key: 'x-forwarded-host',
                            value: '(?<host>.*)',
                        },
                    ],
                    destination: '/:host/:path',
                },
            ],
        };
    },
};

module.exports = nextConfig;
