// Stands in for the Wagtail GraphQL API. Each hostname is a site, and each
// site has a few pages keyed by URL path ('/' is the homepage).
const sites: Record<string, Record<string, { title: string }>> = {
    'beta.example.com': {
        '/': { title: 'Beta homepage' },
        about: { title: 'About' },
    },
};

export function getSiteIdFromHostname(hostname?: string): string | undefined {
    return hostname && sites[hostname] ? hostname : undefined;
}

export function queryPage(siteId: string, urlPath: string) {
    return sites[siteId]?.[urlPath] ?? null;
}
