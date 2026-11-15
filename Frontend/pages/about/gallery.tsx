import type { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import AboutHubPage from '../../src/components/about/AboutHubPage';

export default function AboutPage() { return <AboutHubPage section="gallery" />; }
export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['home'])) },
});
