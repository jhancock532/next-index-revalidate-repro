# Next.js `/index` revalidate collision repro

A request for `<page>/index` that returns `notFound` overwrites the `revalidate` value of `<page>` in the Next.js server process. In a multisite Pages Router app, a request to `https://<site>/index` stops that site's homepage from ever going stale. It is served as `HIT` with `Cache-Control: s-maxage=31536000` until the cache handler evicts the entry.

Tested as affected: Next.js 16.3.1 and 16.3.4. The `toRoute()` lookups are still there in 16.3.7 and are gone in 16.3.8. Tested as fixed: 16.3.8 and 16.4.2. The fix is [vercel/next.js#99482](https://github.com/vercel/next.js/pull/99482) ("Scope response cache keys to their source route"), released alongside advisories [GHSA-mcj8-r9mp-w47p](https://github.com/vercel/next.js/security/advisories/GHSA-mcj8-r9mp-w47p) and [GHSA-4jqv-mc3x-m676](https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676).

## How it happens (16.3.1)

1. `IncrementalCache` keeps each route's cache control (`revalidate`, `expire`) in an in-memory `SharedCacheControls` map, separate from the cached HTML.
2. The map key comes from `toRoute()`, which strips a trailing `/index`. The cache keys `/beta.example.com/index` and `/beta.example.com` both map to `/beta.example.com`.
3. `GET /index` with `x-forwarded-host: beta.example.com` is rewritten to `/beta.example.com/index`, which matches `pages/[hostname]/[...slug].tsx` with `slug = ['index']`. No CMS page exists there, so `getStaticProps` returns `{ notFound: true }` without `revalidate`. Next reads that as `revalidate: false` and `IncrementalCache.set` writes it to the homepage's key.
4. From then on `calculateRevalidate()` returns `false` for the homepage, so it is never stale, `getStaticProps` never runs again, and `pages-handler` turns `revalidate: false` into `s-maxage=31536000`.

The relevant code is in `node_modules/next/dist/server/lib/incremental-cache/index.js` (`calculateRevalidate`, `get`, `set`), `lib/to-route.js` and `route-modules/pages/pages-handler.js`.

## What matches the affected app

- Next.js 16.3.1 (the version in the app's lockfile), React 19.2.3, Pages Router, webpack build.
- The same `afterFiles` rewrite that puts `x-forwarded-host` at the front of the path.
- `pages/[hostname]/index.tsx` re-exporting `pages/[hostname]/[...slug].tsx`, with `getStaticPaths` returning `fallback: 'blocking'`.
- `getStaticProps` returns `revalidate: NEXT_ISR_REVALIDATE_SECONDS` (20) for found pages and a bare `{ notFound: true }` otherwise.
- An ISR `404.tsx` with `revalidate`.
- `cacheMaxMemorySize: 0` and the `@fortedigital/nextjs-cache-handler` 3.2.0 handler, with Redis when `REDIS_URL` is set and the LRU handler otherwise.

`src/cms.ts` stands in for Wagtail. It has one site, `beta.example.com`, with a homepage and `/about`.

## Running it

Node 22 is required.

```sh
npm install
npm run build
npm start            # port 3000
npm run repro        # in a second terminal, takes about a minute
```

With Redis, matching production:

```sh
docker compose up -d
REDIS_URL=redis://localhost:6379 REDIS_PASSWORD=example npm run build
REDIS_URL=redis://localhost:6379 REDIS_PASSWORD=example npm start
npm run repro
```

To rule out the custom cache handler, build and start with `USE_CACHE_HANDLER=false`.

To try another Next.js version, run `npm install next@16.3.8`, then rebuild.

## Results

Output on 16.3.1:

```
3. Request /index. There's no CMS page at that path, so getStaticProps returns { notFound: true }
  GET /index   -> 404  x-nextjs-cache=STALE  cache-control: s-maxage=31536000

4. Request the homepage again. Expect s-maxage=20
  GET /        -> 200  x-nextjs-cache=HIT    cache-control: s-maxage=31536000

5. Wait 22s. The homepage should go STALE, like /about
  GET /        -> 200  x-nextjs-cache=HIT    cache-control: s-maxage=31536000
  GET /about   -> 200  x-nextjs-cache=STALE  cache-control: s-maxage=20, stale-while-revalidate=31535980
```

| Setup | Homepage after `/index` |
| --- | --- |
| 16.3.1, LRU handler | stuck, `s-maxage=31536000` |
| 16.3.1, Redis handler | stuck, `s-maxage=31536000` |
| 16.3.1, built-in cache (`USE_CACHE_HANDLER=false`) | stuck, `s-maxage=31536000` |
| 16.3.4 | stuck, `s-maxage=31536000` |
| 16.3.8 | revalidates normally |
| 16.4.2 | revalidates normally |
| 16.3.1, `notFound` returned with `revalidate` | revalidates normally |

With the Forte Digital handler the stuck state ends when the homepage entry reaches `REDIS_EXPIRY_SECONDS` after its last render. The next request is then a `MISS`, the page renders again, and the map goes back to 20 seconds. Every response served before that carries `s-maxage=31536000`, which a CDN or proxy in front of the app will hold for a year.

## Workaround without upgrading

Return `revalidate` with `notFound` in `getStaticProps`:

```ts
if (page === null) {
    return { notFound: true, revalidate: Number(process.env.NEXT_ISR_REVALIDATE_SECONDS) || false };
}
```

The collision still happens, but it writes 20 seconds instead of `false`, so the homepage keeps revalidating. Unknown paths also stop returning a 404 with `s-maxage=31536000`.
