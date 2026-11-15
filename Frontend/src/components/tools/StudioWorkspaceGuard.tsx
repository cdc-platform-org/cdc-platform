/**
 * @fileoverview URL-level access guard for Design Studio (Ps/Ai) and Code/SQL Studio.
 * Unlocks workspace if the user is ADMIN, has an active 29 GEL/month tool subscription,
 * OR has an active course enrollment within its valid duration window.
 */

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { Lock, Sparkles, BookOpen, Loader2 } from 'lucide-react';
import api from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';

interface StudioWorkspaceGuardProps {
  studio: 'design' | 'code';
  lang?: string;
  children: ReactNode;
}

interface StudioAccessResponse {
  hasDesignStudioAccess: boolean;
  hasCodeStudioAccess: boolean;
}

export default function StudioWorkspaceGuard({
  studio,
  lang = 'ka',
  children,
}: StudioWorkspaceGuardProps) {
  const isKa = lang === 'ka';
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      setAllowed(true);
      setLoading(false);
      return;
    }

    let cancelled = false;
    api
      .get<StudioAccessResponse>('/workspace-access')
      .then((res) => {
        if (cancelled) return;
        const ok =
          studio === 'design'
            ? Boolean(res.data?.hasDesignStudioAccess)
            : Boolean(res.data?.hasCodeStudioAccess);
        setAllowed(ok);
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [studio, user?.role]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center text-slate-400 gap-2 text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
        <span>{isKa ? 'სამუშაო სივრცის წვდომის შემოწმება...' : 'Verifying workspace access...'}</span>
      </div>
    );
  }

  if (!allowed) {
    const studioName =
      studio === 'design'
        ? isKa
          ? 'Ps + Ai დიზაინის სტუდია (2-in-1)'
          : 'Ps + Ai Design Studio (2-in-1)'
        : isKa
          ? 'SQL & Frontend კოდის სტუდია'
          : 'SQL & Frontend Code Studio';

    return (
      <div className="max-w-2xl mx-auto my-12 px-4">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/95 p-8 text-center shadow-2xl space-y-5">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <Lock className="w-7 h-7 text-amber-400" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
              {isKa ? 'შეზღუდული სამუშაო სივრცე' : 'GATED WORKSPACE'}
            </span>
            <h2 className="text-2xl font-black text-white">{studioName}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              {isKa
                ? 'ამ პროფესიონალური სტუდიის გამოსაყენებლად საჭიროა აქტიური ყოველთვიური გამოწერა (29 ₾/თვე) ან შესაბამისი მიმართულების აქტიური კურსი მოქმედების ვადის ფარგლებში.'
                : 'Access to this workspace requires an active monthly subscription (29 GEL/mo) or an active course enrollment within its valid duration window.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/tools"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-5 py-3 text-xs font-black text-white transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              {isKa ? 'გამოწერის გააქტიურება (29 ₾/თვე)' : 'Activate Subscription (29 GEL/mo)'}
            </Link>
            <Link
              href="/courses"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 px-5 py-3 text-xs font-bold text-slate-200 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              {isKa ? 'კურსების ნახვა' : 'Browse Courses'}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}