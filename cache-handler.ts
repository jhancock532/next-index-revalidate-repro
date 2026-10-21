// Trimmed copy of the affected app's cache-handler.ts. It uses Redis when
// REDIS_URL is set and falls back to the in-memory LRU handler otherwise.
import { CacheHandler } from '@fortedigital/nextjs-cache-handler';
import createLruHandler from '@fortedigital/nextjs-cache-handler/local-lru';
import createRedisHandler from '@fortedigital/nextjs-cache-handler/redis-strings';
import { createClient, type RedisClientType } from 'redis';

const revalidateSeconds = Number(process.env.NEXT_ISR_REVALIDATE_SECONDS);
const expirySeconds = Number(process.env.REDIS_EXPIRY_SECONDS);

CacheHandler.onCreation(async () => {
    let handler: ReturnType<typeof createLruHandler>;

    if (process.env.REDIS_URL) {
        const client: RedisClientType = createClient({
            url: process.env.REDIS_URL,
            password: process.env.REDIS_PASSWORD,
        });
        client.on('error', () => {});
        await client.connect();
        console.log(' - cache handler: Redis');

        handler = createRedisHandler({
            client,
            keyPrefix: 'repro',
            timeoutMs: 1000,
            keyExpirationStrategy: 'EXAT',
        });
    } else {
        console.log(' - cache handler: in-memory LRU');
        handler = createLruHandler();
    }

    return {
        handlers: [handler],
        ttl: {
            defaultStaleAge: revalidateSeconds,
            estimateExpireAge: () => expirySeconds,
        },
    };
});

export default CacheHandler;
