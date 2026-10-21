// The affected app adds this route for the homepage as a workaround for
// https://github.com/vercel/next.js/issues/39507 and reuses the catch-all page.
export { default, getStaticProps, getStaticPaths } from './[...slug]';
