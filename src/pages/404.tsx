import type { GetStaticProps } from 'next';

const Page404 = () => (
    <main>
        <h1>Page not found</h1>
    </main>
);

// Like the affected app, the 404 page itself is ISR with a revalidate value.
export const getStaticProps: GetStaticProps = async () => ({
    props: {},
    revalidate: Number(process.env.NEXT_ISR_REVALIDATE_SECONDS) || false,
});

export default Page404;
