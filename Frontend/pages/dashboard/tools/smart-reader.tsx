import { GetStaticProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { useRouter } from 'next/router';
import { BookOpen } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import DigitalToolAccessGate from '../../../src/components/tools/DigitalToolAccessGate';
import ToolShell, { ToolPageHeader } from '../../../src/components/tools/ToolShell';
import { SmartReader } from '../../../src/components/tools/SmartReader';
export default function SmartReaderPage() {
  const { locale } = useRouter();
  return <ProtectedRoute><DigitalToolAccessGate toolKey="smart-reader"><ToolShell><ToolPageHeader icon={BookOpen} accent="cyan" title={locale === 'ka' ? 'AI ჭკვიანი წამკითხველი' : 'AI Smart Reader'} /><SmartReader /></ToolShell></DigitalToolAccessGate></ProtectedRoute>;
}
export const getStaticProps: GetStaticProps = async ({ locale }) => ({ props: { ...(await serverSideTranslations(locale || 'ka', ['common'])) } });
