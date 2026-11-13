/**
 * "My gigs" tab of /dashboard: gigs assigned to the user as a freelancer,
 * with chat link and — on a freelancer's first order — a "request mentor
 * help" button.
 */
import Link from 'next/link';
import { CheckCircle2, LifeBuoy } from 'lucide-react';
import { AssignedGig } from '../../../types/community';
import { DashboardStrings } from './dashboardDict';
import { CARD_CLASS, GIG_STATUS_BADGE, formatGel } from './dashboardShared';

interface GigsTabProps {
  t: DashboardStrings;
  gigs: AssignedGig[];
  requestingMentorFor: string | null;
  onRequestMentorHelp: (gigId: string) => void;
}

export default function GigsTab({ t, gigs, requestingMentorFor, onRequestMentorHelp }: GigsTabProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-extrabold tracking-wide mb-2">{t.gigsTitle}</h2>
      {gigs.length === 0 ? (
        <div className={`${CARD_CLASS} p-10 text-center`}>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.noGigs}</p>
          <Link
            href="/gigs"
            className="inline-block text-xs font-bold text-white bg-slate-900 dark:bg-cyan-600 px-4 py-2.5 rounded-xl no-underline"
          >
            {t.browseGigs}
          </Link>
        </div>
      ) : (
        gigs.map((gig) => (
          <div
            key={gig.id}
            className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-3"
          >
            <div className="flex justify-between items-start gap-3">
              <div>
                <h3 className="font-bold text-base text-slate-900 dark:text-white tracking-wide">{gig.title}</h3>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-medium mt-1">
                  {t.budget}: {formatGel(gig.budgetAmount)}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${GIG_STATUS_BADGE[gig.status]}`}>
                  {gig.status}
                </span>
                {gig.isFirstOrder && (
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded border bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30">
                    {t.firstOrderBadge}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <Link
                href={`/messages/${gig.postedById}`}
                className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {t.chat}
              </Link>
              {gig.isFirstOrder &&
                (gig.mentorHelpRequestedAt ? (
                  <span className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t.mentorRequested}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRequestMentorHelp(gig.id)}
                    disabled={requestingMentorFor === gig.id}
                    className="flex items-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white transition disabled:opacity-60"
                  >
                    <LifeBuoy className="w-3.5 h-3.5" />
                    {t.mentorHelp}
                  </button>
                ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
