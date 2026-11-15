import dynamic from 'next/dynamic';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Palette } from 'lucide-react';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import ToolErrorBoundary from '../../../src/components/common/ToolErrorBoundary';
import StudioWorkspaceGuard from '../../../src/components/tools/StudioWorkspaceGuard';
import ToolShell, { ToolPageHeader } from '../../../src/components/tools/ToolShell';

const DesignStudio2in1 = dynamic(() => import('../../../src/components/courses/DesignStudio2in1'), { ssr: false });

export default function DesignStudioToolPage() {
  const router = useRouter();
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const isKa = lang === 'ka';

  const title = isKa ? 'Ps + Ai დიზაინის სტუდია (2-in-1)' : 'Ps + Ai Design Studio (2-in-1)';
  const subtitle = isKa
    ? 'პროფესიონალური რასტრული და ვექტორული გრაფიკული რედაქტორი ბრაუზერში — ფენები, ფილტრები, ტიპოგრაფია და PNG/SVG ექსპორტი.'
    : 'Professional Raster & Vector graphic design workspace in your browser — layers, filters, typography, and PNG/SVG export.';

  return (
    <ProtectedRoute>
      <Head>
        <title>{`${title} | CDC Platform`}</title>
      </Head>
      <ToolErrorBoundary>
        <StudioWorkspaceGuard studio="design" lang={lang}><!--
          toolKey="design-studio"
          toolTitle={title}
          toolSubtitle={subtitle}
          toolIcon={Palette}
          accent="cyan" -->
          <ToolShell>
            <ToolPageHeader
              icon={Palette}
              accent="cyan"
              title={title}
              subtitle={subtitle}
            />
            <DesignStudio2in1 lang={lang} />
          </ToolShell>
        </StudioWorkspaceGuard>
      </ToolErrorBoundary>
    </ProtectedRoute>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});