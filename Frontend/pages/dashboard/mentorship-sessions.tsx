import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { CalendarClock, Video, Users } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { getMyMentorshipBookings, MyMentorshipBooking } from '../../src/services/mentorshipService';

const dict = {
  ka: {
    title: 'ჩემი მენტორის სესიები',
    subtitle: 'ყველა დაჯავშნილი და გამართული სესია.',
    loading: 'იტვირთება…',
    empty: 'თქვენ ჯერ არცერთი სესია არ დაგიჯავშნიათ.',
    withMentor: 'მენტორი',
    withStudent: 'სტუდენტი',
    joinMeet: 'Google Meet-ზე გადასვლა',
    addToCalendar: 'Google კალენდარში დამატება',
    calendarPending: 'კალენდარში დამატება მიმდინარეობს.',
    upcoming: 'მომავალი სესიები',
    past: 'გასული სესიები',
    topic: 'თემა',
  },
  en: {
    title: 'My Mentorship Sessions',
    subtitle: 'Every session you have booked or been booked for.',
    loading: 'Loading…',
    empty: "You haven't booked any sessions yet.",
    withMentor: 'Mentor',
    withStudent: 'Student',
    joinMeet: 'Join Google Meet',
    addToCalendar: 'Add to Google Calendar',
    calendarPending: 'Calendar invite is still being generated.',
    upcoming: 'Upcoming Sessions',
    past: 'Past Sessions',
    topic: 'Topic',
  },
};

// Builds a Google Calendar "quick add" URL — works without any OAuth/API
// call, just a pre-filled event the user reviews and saves themselves.
function googleCalendarAddUrl(booking: MyMentorshipBooking, otherPartyName: string): string {
  const start = new Date(booking.scheduledAt);
  const end = new Date(start.getTime() + 60 * 60_000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `CDC Mentorship: ${otherPartyName}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: [booking.consultationDescription, booking.googleMeetLink].filter(Boolean).join('\n\n'),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function SessionCard({ booking, lang }: { booking: MyMentorshipBooking; lang: 'ka' | 'en' }) {
  const t = dict[lang];
  const otherParty = booking.role === 'student' ? booking.mentor : booking.student;
  const otherPartyLabel = booking.role === 'student' ? t.withMentor : t.withStudent;

  return (
    <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400">{otherPartyLabel}</p>
          <p className="text-sm font-black text-slate-900 dark:text-white">{otherParty.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
            <CalendarClock className="w-3.5 h-3.5" />
            {new Date(booking.scheduledAt).toLocaleString(lang === 'en' ? 'en-GB' : 'ka-GE', { timeZone: 'Asia/Tbilisi' })}
          </p>
          {booking.consultationDescription && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {t.topic}: {booking.consultationDescription}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {booking.googleMeetLink ? (
            <a
              href={booking.googleMeetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl bg-indigo-600 text-white no-underline hover:bg-indigo-700"
            >
              <Video className="w-3.5 h-3.5" />
              {t.joinMeet}
            </a>
          ) : (
            <p className="text-[11px] text-slate-400 max-w-[160px] text-right">{t.calendarPending}</p>
          )}
          <a
            href={googleCalendarAddUrl(booking, otherParty.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 no-underline hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            {t.addToCalendar}
          </a>
        </div>
      </div>
    </div>
  );
}

function MentorshipSessionsContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];

  const [bookings, setBookings] = useState<MyMentorshipBooking[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBookings(await getMyMentorshipBookings());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();
  const upcoming = bookings.filter((b) => new Date(b.scheduledAt).getTime() >= now);
  const past = bookings.filter((b) => new Date(b.scheduledAt).getTime() < now);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 w-full">
        <BackButton fallbackHref="/dashboard" className="dark:text-slate-400 dark:hover:text-slate-100" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-black tracking-wide flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-500" />
            {t.title}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-10 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.empty}</p>
          </div>
        ) : (
          <div className="space-y-10">
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{t.upcoming}</h2>
                <div className="space-y-3">
                  {upcoming.map((b) => (
                    <SessionCard key={b.id} booking={b} lang={lang} />
                  ))}
                </div>
              </div>
            )}
            {past.length > 0 && (
              <div>
                <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">{t.past}</h2>
                <div className="space-y-3 opacity-70">
                  {past.map((b) => (
                    <SessionCard key={b.id} booking={b} lang={lang} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <SiteFooter lang={lang === 'ka' ? 'GEO' : 'ENG'} />
    </div>
  );
}

export default function MentorshipSessionsPage() {
  return (
    <ProtectedRoute>
      <MentorshipSessionsContent />
    </ProtectedRoute>
  );
}
