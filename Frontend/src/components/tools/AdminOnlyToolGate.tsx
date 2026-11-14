/**
 * Hides a tool page from non-admins when an admin set the tool to
 * "Admin only" in the Tool Catalog CMS (pages/admin/tools.tsx). The admin
 * team sees the page normally. The backend refuses non-admin writes too
 * (Backend middleware/toolVisibility.ts), so this is the friendly message,
 * not the security boundary. Render inside ProtectedRoute.
 */
import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Lock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getSiteContent } from '../../services/siteContentService';
import { ToolCatalogContent } from '../../types/siteContent';
import { findToolEntry } from '../../utils/toolCatalog';

export default function AdminOnlyToolGate({ slug, children }: { slug: string; children: ReactNode }) {
  const { user } = useAuth();
  const { locale } = useRouter();
  const isAdmin = !!user?.adminRole;
  // null = still checking. Admins skip the lookup entirely.
  const [adminOnly, setAdminOnly] = useState<boolean | null>(isAdmin ? false : null);

  useEffect(() => {
    if (isAdmin) return setAdminOnly(false);
    let cancelled = false;
    getSiteContent<ToolCatalogContent>('tool-catalog')
      .then((row) => !cancelled && setAdminOnly(findToolEntry(row?.content?.tools, slug)?.status === 'ADMIN_ONLY'))
      // Fail open: the API still enforces the rule if the CMS read fails.
      .catch(() => !cancelled && setAdminOnly(false));
    return () => {
      cancelled = true;
    };
  }, [isAdmin, slug]);

  if (adminOnly === null) {
    return <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-400">Loading…</div>;
  }
  if (!adminOnly) return <>{children}</>;

  const ka = (locale ?? 'ka') === 'ka';
  return (
    <div className="min-h-[50vh] flex items-center justify-center px-4">
      <div className="max-w-md text-center rounded-2xl border border-gray-200 bg-white p-8">
        <Lock className="w-8 h-8 mx-auto text-gray-400 mb-3" />
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          {ka ? 'ეს ხელსაწყო ამჟამად მიუწვდომელია' : 'This tool is currently unavailable'}
        </h1>
        <p className="text-sm text-gray-500 mb-5">
          {ka ? 'იხილეთ სხვა AI ხელსაწყოები ჩვენს კატალოგში.' : 'Browse our other AI tools in the catalog.'}
        </p>
        <Link href="/tools" className="inline-block text-sm font-medium text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700">
          {ka ? 'AI ხელსაწყოები' : 'AI tools'}
        </Link>
      </div>
    </div>
  );
}
