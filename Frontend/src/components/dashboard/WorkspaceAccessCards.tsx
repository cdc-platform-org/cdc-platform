/**
 * @fileoverview Conditional Student Workspace & Digital Passport Cards.
 * - Always displays the Student Digital Passport (QR).
 * - Conditionally unlocks Design Studio (Ps/Ai) and Code/SQL Studio ONLY when the student
 *   has an active monthly subscription OR an active course enrollment within its duration window.
 * - Displays Live Classroom entry when enrolled in an active live cohort.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '../../services/apiClient';

interface StudioAccessStatus {
  hasDesignStudioAccess: boolean;
  designAccessSource: 'SUBSCRIPTION' | 'ACTIVE_COURSE' | 'ADMIN' | 'NONE';
  designAccessExpiresAt: string | null;
  hasCodeStudioAccess: boolean;
  codeAccessSource: 'SUBSCRIPTION' | 'ACTIVE_COURSE' | 'ADMIN' | 'NONE';
  codeAccessExpiresAt: string | null;
  hasActiveLiveTraining: boolean;
  activeLiveTrainingId: string | null;
}

export default function WorkspaceAccessCards({ lang = 'ka' }: { lang?: string }) {
  const isKa = lang === 'ka';
  const [access, setAccess] = useState<StudioAccessStatus | null>(null);

  useEffect(() => {
    api
      .get('/workspace-access')
      .then((res) => setAccess(res.data))
      .catch(() => {});
  }, []);

  return (
    <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* Always visible: Student Digital Skill Passport */}
      <Link
        href="/dashboard/passport"
        className="rounded-2xl border border-cyan-500/35 bg-slate-900/90 hover:border-cyan-400 p-4 text-xs transition-all block"
      >
        <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
          {isKa ? 'ვერიფიცირებული დოკუმენტი' : 'VERIFIED CREDENTIAL'}
        </span>
        <p className="text-sm font-black text-white mt-1">
          {isKa ? 'ციფრული პასპორტი & QR' : 'Digital Passport & QR'}
        </p>
        <p className="text-slate-400 mt-1">
          {isKa ? 'სრული აკადემიური ქრონოლოგია და QR კოდი' : 'Academic timeline & scannable QR'}
        </p>
      </Link>

      {/* Conditional: 2-in-1 Design Studio (Ps/Ai) */}
      {access?.hasDesignStudioAccess ? (
        <Link
          href="/dashboard/tools/design-studio"
          className="rounded-2xl border border-emerald-500/35 bg-slate-900/90 hover:border-emerald-400 p-4 text-xs transition-all block"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
            {access.designAccessSource === 'SUBSCRIPTION'
              ? isKa ? 'აქტიური გამოწერა' : 'ACTIVE SUBSCRIPTION'
              : isKa ? 'აქტიური კურსის სივრცე' : 'ACTIVE COURSE WORKSPACE'}
          </span>
          <p className="text-sm font-black text-white mt-1">
            {isKa ? 'დიზაინის სტუდია (Ps/Ai)' : 'Design Studio (Ps/Ai)'}
          </p>
          <p className="text-slate-400 mt-1">
            {access.designAccessExpiresAt
              ? `${isKa ? 'ვადა:' : 'Valid until:'} ${new Date(access.designAccessExpiresAt).toLocaleDateString()}`
              : isKa ? 'სამუშაო სტუდია აქტიურია' : 'Workspace active'}
          </p>
        </Link>
      ) : (
        <Link
          href="/tools"
          className="rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 p-4 text-xs transition-all block"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {isKa ? 'გამოწერით (29 ₾/თვე) ან კურსით' : 'SUBSCRIPTION OR COURSE'}
          </span>
          <p className="text-sm font-bold text-slate-300 mt-1">
            {isKa ? 'დიზაინის სტუდია (Ps/Ai)' : 'Design Studio (Ps/Ai)'}
          </p>
          <p className="text-slate-500 mt-1">
            {isKa ? 'გაიაქტიურეთ გამოწერა ან ჩაეწერეთ კურსზე' : 'Subscribe or enroll in a design course'}
          </p>
        </Link>
      )}

      {/* Conditional: SQL & Frontend Code Studio */}
      {access?.hasCodeStudioAccess ? (
        <Link
          href="/dashboard/tools/code-studio"
          className="rounded-2xl border border-purple-500/35 bg-slate-900/90 hover:border-purple-400 p-4 text-xs transition-all block"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-purple-400">
            {access.codeAccessSource === 'SUBSCRIPTION'
              ? isKa ? 'აქტიური გამოწერა' : 'ACTIVE SUBSCRIPTION'
              : isKa ? 'აქტიური კურსის სივრცე' : 'ACTIVE COURSE WORKSPACE'}
          </span>
          <p className="text-sm font-black text-white mt-1">
            {isKa ? 'კოდის / SQL სტუდია' : 'Code / SQL Studio'}
          </p>
          <p className="text-slate-400 mt-1">
            {access.codeAccessExpiresAt
              ? `${isKa ? 'ვადა:' : 'Valid until:'} ${new Date(access.codeAccessExpiresAt).toLocaleDateString()}`
              : isKa ? 'სამუშაო სტუდია აქტიურია' : 'Workspace active'}
          </p>
        </Link>
      ) : (
        <Link
          href="/tools"
          className="rounded-2xl border border-slate-800 bg-slate-900/50 hover:border-slate-700 p-4 text-xs transition-all block"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
            {isKa ? 'გამოწერით (29 ₾/თვე) ან კურსით' : 'SUBSCRIPTION OR COURSE'}
          </span>
          <p className="text-sm font-bold text-slate-300 mt-1">
            {isKa ? 'კოდის / SQL სტუდია' : 'Code / SQL Studio'}
          </p>
          <p className="text-slate-500 mt-1">
            {isKa ? 'გაიაქტიურეთ გამოწერა ან ჩაეწერეთ კურსზე' : 'Subscribe or enroll in a dev course'}
          </p>
        </Link>
      )}

      {/* Conditional: Live Classroom if enrolled in active live training */}
      {access?.hasActiveLiveTraining && access.activeLiveTrainingId && (
        <Link
          href={`/dashboard/live-classroom/${access.activeLiveTrainingId}`}
          className="rounded-2xl border border-amber-500/40 bg-slate-900/90 hover:border-amber-400 p-4 text-xs transition-all block"
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
            LIVE COHORT
          </span>
          <p className="text-sm font-black text-white mt-1">
            {isKa ? 'Live საკლასო ოთახი' : 'Live Classroom'}
          </p>
          <p className="text-slate-400 mt-1">
            {isKa ? 'შესვლა ცოცხალ პრაქტიკულ სესიაზე' : 'Join live interactive workspace'}
          </p>
        </Link>
      )}
    </div>
  );
}
