/**
 * "Ask a CDC mentor" dialog on /dashboard: a short free-text request,
 * then a "sent" confirmation. State comes from useMentorshipRequest.
 */
import { Wifi } from 'lucide-react';
import { DashboardStrings } from './dashboardDict';
import { MentorshipRequest } from './useMentorshipRequest';

export default function MentorshipRequestModal({ t, mentorship: m }: { t: DashboardStrings; mentorship: MentorshipRequest }) {
  if (!m.showMentorshipModal) return null;
  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={m.closeMentorshipModal}
    >
      <div
        className="max-w-md w-full bg-white dark:bg-slate-900 border border-cyan-400/40 rounded-2xl p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {m.mentorshipSent ? (
          <>
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white mb-2">{t.mentorshipSentTitle}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">{t.mentorshipSentBody}</p>
            <button
              type="button"
              onClick={m.closeMentorshipModal}
              className="w-full text-sm font-bold px-4 py-3 rounded-xl bg-slate-950 dark:bg-cyan-600 text-white hover:bg-slate-800 dark:hover:bg-cyan-500 transition"
            >
              {t.mentorshipClose}
            </button>
          </>
        ) : (
          <form onSubmit={m.handleMentorshipSubmit}>
            <h3 className="flex items-center gap-2 text-base font-extrabold text-slate-900 dark:text-white mb-2">
              <Wifi className="w-4 h-4 text-cyan-500" />
              {t.mentorshipModalTitle}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.mentorshipModalHint}</p>
            {m.mentorshipError && (
              <div className="mb-3 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">
                {m.mentorshipError}
              </div>
            )}
            <textarea
              rows={4}
              value={m.mentorshipMessage}
              onChange={(e) => m.setMentorshipMessage(e.target.value)}
              placeholder={t.mentorshipPlaceholder}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <div className="flex flex-col gap-2 mt-4">
              <button
                type="submit"
                disabled={m.mentorshipSubmitting}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl bg-slate-950 dark:bg-cyan-600 text-white hover:bg-slate-800 dark:hover:bg-cyan-500 transition disabled:opacity-60"
              >
                {m.mentorshipSubmitting ? t.mentorshipSubmitting : t.mentorshipSubmit}
              </button>
              <button
                type="button"
                onClick={m.closeMentorshipModal}
                className="w-full text-sm font-bold px-4 py-3 rounded-xl text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 bg-transparent"
              >
                {t.confirmCancel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
