import type { GetStaticPaths, GetStaticProps } from 'next';
import { getSiteIdFromHostname, queryPage } from '../../cms';

type PageProps = {
    title: string;
    hostname: string;
    urlPath: string;
    renderedAt: string;
};

const Page = ({ title, hostname, urlPath, renderedAt }: PageProps) => (
    <main>
        <h1>{title}</h1>
        <p>
            Site: {hostname}, path: {urlPath}
        </p>
        <p id="rendered-at">Rendered at {renderedAt}</p>
    </main>
);

type Params = {
    hostname?: string;
    slug?: string[];
};

// Same structure as the affected app's getStaticProps.
export const getStaticProps: GetStaticProps<PageProps, Params> = async ({ params }) => {
    let urlPath = '/';
    if (Array.isArray(params?.slug)) {
        urlPath = params.slug.join('/');
    }

    console.log(`getStaticProps hostname=${params?.hostname} urlPath=${urlPath}`);

    const siteId = getSiteIdFromHostname(params?.hostname);
    if (!siteId) {
        return { notFound: true };
    }

    const page = queryPage(siteId, urlPath);

    // No `revalidate` here, matching the affected app. Next treats this as
    // `revalidate: false`.
    if (page === null) {
        return { notFound: true };
    }

    const nextISRRevalidateSeconds = Number(process.env.NEXT_ISR_REVALIDATE_SECONDS) || false;

    return {
        props: {
            title: page.title,
            hostname: siteId,
            urlPath,
            renderedAt: new Date().toISOString(),
        },
        revalidate: nextISRRevalidateSeconds,
    };
};

export const getStaticPaths: GetStaticPaths = async () => ({
    paths: [],
    fallback: 'blocking',
});

export default Page;
