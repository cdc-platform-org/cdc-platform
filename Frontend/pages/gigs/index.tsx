import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import JobsDashboard from '../../src/components/community/JobsDashboard';

export default function GigsPage() {
  return <JobsDashboard defaultTab="gigs" />;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common', 'proposals'])) },
});
