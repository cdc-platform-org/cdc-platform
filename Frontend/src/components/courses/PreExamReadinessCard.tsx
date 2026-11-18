/**
 * @fileoverview Official 4-Pillar Pre-Exam Readiness Dossier card.
 * Displays the 4 equal 25% scores (AI Mentor, Attendance, Assignments, Lecturer)
 * and enforces the mandatory >= 90% threshold required to unlock the final exam.
 */

import { ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { ReadinessResponse } from '../../services/readinessPassportService';

interface PreExamReadinessCardProps {
  data: ReadinessResponse;
  lang: string;
}

export default function PreExamReadinessCard({ data, lang }: PreExamReadinessCardProps) {
  const { record, eligibleForExam } = data;
  const isKa = lang === 'ka';

  return (
    <div className="mb-5 rounded-2xl border border-cyan-500/35 bg-slate-900/90 p-5 text-xs space-y-3 shadow-lg">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
            {isKa
              ? 'ოფიციალური წინასაგამოცდო შეფასების დოკუმენტი'
              : 'Official Pre-Exam Readiness Dossier'}
          </p>
          <p className="text-slate-400 mt-0.5">
            {isKa
              ? 'გამოცდაზე დაშვების მინიმალური ზღვარი: 90%'
              : 'Minimum required score to unlock exam: 90%'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-sm font-black ${
              eligibleForExam
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
            }`}
          >
            {isKa ? 'ჯამი:' : 'Total:'} {record.totalScore}%
          </span>
          <Link
            href="/dashboard/passport"
            className="rounded-lg bg-cyan-600/20 border border-cyan-500/40 px-2.5 py-1 font-bold text-cyan-300 hover:bg-cyan-600/30"
          >
            {isKa ? 'ციფრული პასპორტი' : 'Digital Passport'}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
          <p className="text-slate-400">1. AI მენტორი (25%)</p>
          <p className="text-base font-black text-cyan-300 mt-0.5">{record.aiMentorScore}%</p>
        </div>
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
          <p className="text-slate-400">2. დასწრება (25%)</p>
          <p className="text-base font-black text-sky-300 mt-0.5">{record.attendanceScore}%</p>
        </div>
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
          <p className="text-slate-400">3. დავალებები (25%)</p>
          <p className="text-base font-black text-purple-300 mt-0.5">{record.assignmentsScore}%</p>
        </div>
        <div className="rounded-xl bg-slate-950 border border-slate-800 p-3">
          <p className="text-slate-400">4. ლექტორი (25%)</p>
          <p className="text-base font-black text-amber-300 mt-0.5">{record.lecturerScore}%</p>
        </div>
      </div>

      {!eligibleForExam && (
        <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-rose-200 font-semibold">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{isKa
            ? 'ჯამური ქულა 90%-ზე ნაკლებია. გამოცდაზე გასასვლელად თავიდან უნდა გაიაროთ კურსი და სრულყოფილად შეასრულოთ დავალებები.'
            : 'Total score is below 90%. You must retake the course lessons and complete all assignments to unlock the exam.'}</span>
        </div>
      )}
    </div>
  );
}