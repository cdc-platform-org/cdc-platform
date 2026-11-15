/**
 * @fileoverview Full-screen Live Interactive Classroom page combining
 * multi-student screen sharing, session recording, and in-session Design Studio.
 */

import { useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import ProtectedRoute from '../../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../../src/components/layout/SiteHeader';
import SiteFooter from '../../../src/components/layout/SiteFooter';
import LiveClassroomGrid from '../../../src/components/live/LiveClassroomGrid';
import { useAuth } from '../../../src/context/AuthContext';

const DesignStudio2in1 = dynamic(() => import('../../../src/components/courses/DesignStudio2in1'), { ssr: false });

export default function LiveClassroomRoomPage() {
  const router = useRouter();
  const trainingId = typeof router.query.id === 'string' ? router.query.id : '';
  const lang = router.locale || 'ka';
  const isKa = lang === 'ka';
  const { user } = useAuth();
  const [showStudio, setShowStudio] = useState(false);

  const isTrainerView = user?.role === 'Mentor' || user?.role === 'SuperAdmin';

  return (
    <ProtectedRoute>
      <Head>
        <title>{isKa ? 'Live საკლასო ოთახი | CDC Platform' : 'Live Classroom | CDC Platform'}</title>
      </Head>
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
        <SiteHeader />
        <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 flex-1 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-widest text-cyan-400">
                CDC LIVE INTERACTIVE CLASSROOM
              </span>
              <h1 className="text-2xl font-black mt-0.5">
                {isKa ? 'ცოცხალი სასწავლო ოთახი და პრაქტიკული სივრცე' : 'Live Training Room & Practice Workspace'}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => setShowStudio((v) => !v)}
              className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 hover:bg-cyan-500/20 px-4 py-2 text-xs font-bold text-cyan-300 cursor-pointer"
            >
              {showStudio
                ? isKa
                  ? 'სტუდიის დამალვა'
                  : 'Hide Practice Studio'
                : isKa
                  ? '🎨 პრაქტიკული სტუდიის გახსნა (Ps/Ai)'
                  : '🎨 Open Practice Studio (Ps/Ai)'}
            </button>
          </div>

          {trainingId && (
            <LiveClassroomGrid
              trainingId={trainingId}
              studentName={user?.name}
              isTrainerView={isTrainerView}
              lang={lang}
            />
          )}

          {showStudio && (
            <div className="pt-2">
              <DesignStudio2in1 lang={lang} />
            </div>
          )}
        </main>
        <SiteFooter />
      </div>
    </ProtectedRoute>
  );
}