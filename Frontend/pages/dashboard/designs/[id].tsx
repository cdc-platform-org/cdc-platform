// /dashboard/designs/[id] — the design editor for one of the buyer's designs.
// The editor itself (src/components/designEditor/DesignEditor.tsx) is
// client-only: Fabric.js needs a real <canvas>.
import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import { designEditorDict } from '../../../src/components/designEditor/i18n';
import { getDesign, type DesignRecord } from '../../../src/services/designService';

const DesignEditor = dynamic(() => import('../../../src/components/designEditor/DesignEditor'), { ssr: false });

function EditorPage() {
  const router = useRouter();
  const t = designEditorDict(router.locale);
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  const [record, setRecord] = useState<DesignRecord | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getDesign(id).then((design) => { if (!cancelled) setRecord(design); }).catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <>
      <Head>
        <title>{record ? `${record.title} | CDC` : t.loading}</title>
        <meta name="robots" content="noindex" />
      </Head>
      {failed ? (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p>{t.notFound}</p>
          <Link href="/dashboard/designs" className="underline">{t.myDesigns}</Link>
        </div>
      ) : record ? (
        <DesignEditor key={record.id} record={record} t={t} />
      ) : (
        <div className="min-h-screen flex items-center justify-center text-sm">{t.loading}</div>
      )}
    </>
  );
}

export default function DesignEditorPage() {
  return <ProtectedRoute><EditorPage /></ProtectedRoute>;
}
