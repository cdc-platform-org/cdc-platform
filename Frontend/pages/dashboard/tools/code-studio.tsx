/**
 * @fileoverview Standalone Code & SQL Simulation Studio page in the user dashboard.
 */

import Head from 'next/head';
import { useRouter } from 'next/router';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import CodeSqlStudio from '../../../src/components/courses/CodeSqlStudio';
import StudioWorkspaceGuard from '../../../src/components/tools/StudioWorkspaceGuard';

export default function CodeSqlStudioToolPage() {
  const router = useRouter();
  const lang = router.locale || 'ka';
  const isKa = lang === 'ka';

  return (
    <ProtectedRoute>
      <Head>
        <title>{isKa ? 'SQL & Frontend კოდის სტუდია | CDC Platform' : 'SQL & Frontend Code Studio | CDC Platform'}</title>
      </Head>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <SiteHeader />
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 space-y-5">
          <div>
            <span className="text-[11px] font-black uppercase tracking-widest text-purple-400">
              CDC INTERACTIVE DEV SANDBOX
            </span>
            <h1 className="text-2xl font-black mt-0.5">
              {isKa ? 'SQL & Frontend კოდის სიმულაციური სტუდია' : 'SQL & Frontend Code Simulation Studio'}
            </h1>
          </div>
          <StudioWorkspaceGuard studio="code" lang={lang}>
            <CodeSqlStudio lang={lang} />
          </StudioWorkspaceGuard>
        </main>
        <SiteFooter />
      </div>
    </ProtectedRoute>
  );
}