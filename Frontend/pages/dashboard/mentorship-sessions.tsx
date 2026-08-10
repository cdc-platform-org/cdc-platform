import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { CalendarClock, Video, Users, UserPlus, List, CalendarDays, ChevronLeft, ChevronRight, X, PlayCircle, Link2 } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { getMyMentorshipBookings, attachMyBookingRecording, MyMentorshipBooking } from '../../src/services/mentorshipService';

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
    bookMentor: 'მენტორის დაჯავშნა',
    chooseMentor: 'მენტორის არჩევა და დაჯავშნა →',
    listView: 'სია',
    calendarView: 'კალენდარი',
    scheduled: 'დაგეგმილი',
    completed: 'დასრულებული',
    close: 'დახურვა',
    noSessionsOnDay: 'ამ დღეს სესიები არ არის.',
    watchRecording: 'ვიდეო ჩანაწერის ყურება',
    attachRecording: 'ჩანაწერის ბმულის დამატება',
    recordingPlaceholder: 'ჩასვით ბმული (Google Drive, Bunny CDN, MP4...)',
    save: 'შენახვა',
    cancel: 'გაუქმება',
    recordingSaveFailed: 'ჩანაწერის შენახვა ვერ მოხერხდა.',
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
    bookMentor: 'Book a Mentor',
    chooseMentor: 'Choose a mentor & book →',
    listView: 'List',
    calendarView: 'Calendar',
    scheduled: 'Scheduled',
    completed: 'Completed',
    close: 'Close',
    noSessionsOnDay: 'No sessions on this day.',
    watchRecording: 'Watch Recording',
    attachRecording: 'Attach recording link',
    recordingPlaceholder: 'Paste a link (Google Drive, Bunny CDN, MP4...)',
    save: 'Save',
    cancel: 'Cancel',
    recordingSaveFailed: 'Could not save the recording link.',
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
  const isPast = new Date(booking.scheduledAt).getTime() < Date.now();

  const [recordingUrl, setRecordingUrl] = useState(booking.recordingUrl);
  const [attaching, setAttaching] = useState(false);
  const [recordingInput, setRecordingInput] = useState('');
  const [savingRecording, setSavingRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);

  const handleSaveRecording = async () => {
    if (!recordingInput.trim()) return;
    setSavingRecording(true);
    setRecordingError(null);
    try {
      await attachMyBookingRecording(booking.id, recordingInput.trim());
      setRecordingUrl(recordingInput.trim());
      setAttaching(false);
    } catch {
      setRecordingError(t.recordingSaveFailed);
    } finally {
      setSavingRecording(false);
    }
  };

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
          {recordingUrl && (
            <a
              href={recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl bg-emerald-600 text-white no-underline hover:bg-emerald-700"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              {t.watchRecording}
            </a>
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
          {booking.role === 'mentor' && isPast && !recordingUrl && !attaching && (
            <button
              type="button"
              onClick={() => setAttaching(true)}
              className="flex items-center justify-center gap-1.5 text-xs font-bold px-3.5 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 bg-transparent cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <Link2 className="w-3.5 h-3.5" />
              {t.attachRecording}
            </button>
          )}
        </div>
      </div>

      {attaching && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              value={recordingInput}
              onChange={(e) => setRecordingInput(e.target.value)}
              placeholder={t.recordingPlaceholder}
              className="flex-1 min-w-[220px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950/60 px-3 py-2 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-500/60"
              autoFocus
            />
            <button
              type="button"
              disabled={savingRecording || !recordingInput.trim()}
              onClick={handleSaveRecording}
              className="text-xs font-bold text-white bg-indigo-600 px-3.5 py-2 rounded-lg border-none cursor-pointer hover:bg-indigo-700 disabled:opacity-60"
            >
              {savingRecording ? '…' : t.save}
            </button>
            <button
              type="button"
              onClick={() => setAttaching(false)}
              className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-transparent border-none cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
            >
              {t.cancel}
            </button>
          </div>
          {recordingError && <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1.5">{recordingError}</p>}
        </div>
      )}
    </div>
  );
}

function SessionDetailsModal({
  booking,
  lang,
  onClose,
}: {
  booking: MyMentorshipBooking;
  lang: 'ka' | 'en';
  onClose: () => void;
}) {
  const t = dict[lang];
  const otherParty = booking.role === 'student' ? booking.mentor : booking.student;
  const otherPartyLabel = booking.role === 'student' ? t.withMentor : t.withStudent;
  const isPast = new Date(booking.scheduledAt).getTime() < Date.now();

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-4 right-4 p-2 cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <span
          className={`inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border mb-3 ${
            isPast
              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          }`}
        >
          {isPast ? t.completed : t.scheduled}
        </span>

        <p className="text-[11px] uppercase tracking-widest font-bold text-slate-400">{otherPartyLabel}</p>
        <p className="text-base font-black text-slate-900 dark:text-white mb-3">{otherParty.name}</p>

        <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 mb-2">
          <CalendarClock className="w-4 h-4 shrink-0" />
          {new Date(booking.scheduledAt).toLocaleString(lang === 'en' ? 'en-GB' : 'ka-GE', { timeZone: 'Asia/Tbilisi' })}
        </p>
        {booking.consultationDescription && (
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {t.topic}: {booking.consultationDescription}
          </p>
        )}

        <div className="space-y-2">
          {booking.googleMeetLink ? (
            <a
              href={booking.googleMeetLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl bg-indigo-600 text-white no-underline hover:bg-indigo-700"
            >
              <Video className="w-4 h-4" />
              {t.joinMeet}
            </a>
          ) : (
            <p className="text-xs text-slate-400 text-center">{t.calendarPending}</p>
          )}
          {booking.recordingUrl && (
            <a
              href={booking.recordingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 text-sm font-bold px-4 py-2.5 rounded-xl bg-emerald-600 text-white no-underline hover:bg-emerald-700"
            >
              <PlayCircle className="w-4 h-4" />
              {t.watchRecording}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// Hand-rolled month grid — no calendar library in this project (matches its
// general pattern of small hand-built components over new dependencies for
// something this size). Monday-first week, matching /admin/mentorship's
// existing DAY_DISPLAY_ORDER convention.
const CALENDAR_WEEKDAY_LABELS: Record<'ka' | 'en', string[]> = {
  ka: ['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვი'],
  en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function SessionsCalendarView({
  bookings,
  lang,
  onSelectBooking,
}: {
  bookings: MyMentorshipBooking[];
  lang: 'ka' | 'en';
  onSelectBooking: (booking: MyMentorshipBooking) => void;
}) {
  const t = dict[lang];
  const [cursor, setCursor] = useState(() => new Date());

  const weeks = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const firstOfMonth = new Date(year, month, 1);
    // getDay(): 0=Sunday..6=Saturday — shift so Monday=0..Sunday=6.
    const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1))];
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const monthLabel = cursor.toLocaleDateString(lang === 'en' ? 'en-GB' : 'ka-GE', { month: 'long', year: 'numeric' });
  const today = new Date();

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-black capitalize">{monthLabel}</p>
        <button
          type="button"
          onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
          aria-label="Next month"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {CALENDAR_WEEKDAY_LABELS[lang].map((label) => (
          <div key={label} className="text-center text-[10px] font-black uppercase tracking-wide text-slate-400 py-1">
            {label}
          </div>
        ))}
      </div>

      <div className="space-y-1">
        {weeks.map((week, i) => (
          <div key={i} className="grid grid-cols-7 gap-1">
            {week.map((day, j) => {
              if (!day) return <div key={j} className="min-h-[4.5rem] rounded-lg" />;
              const dayBookings = bookings.filter((b) => isSameDay(new Date(b.scheduledAt), day));
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={j}
                  className={`min-h-[4.5rem] rounded-lg border p-1.5 ${
                    isToday
                      ? 'border-indigo-400 bg-indigo-50/60 dark:bg-indigo-500/10'
                      : 'border-slate-100 dark:border-slate-800'
                  }`}
                >
                  <p className={`text-[11px] font-bold mb-1 ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}>
                    {day.getDate()}
                  </p>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 3).map((b) => {
                      const isPast = new Date(b.scheduledAt).getTime() < Date.now();
                      const otherParty = b.role === 'student' ? b.mentor : b.student;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => onSelectBooking(b)}
                          className={`w-full text-left text-[10px] font-bold px-1.5 py-0.5 rounded truncate border-none cursor-pointer ${
                            isPast
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                              : 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300'
                          }`}
                          title={otherParty.name}
                        >
                          {otherParty.name}
                        </button>
                      );
                    })}
                    {dayBookings.length > 3 && (
                      <p className="text-[9px] text-slate-400 px-1.5">+{dayBookings.length - 3}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
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
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedBooking, setSelectedBooking] = useState<MyMentorshipBooking | null>(null);

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
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 w-full">
        <BackButton fallbackHref="/dashboard" className="dark:text-slate-400 dark:hover:text-slate-100" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-wide flex items-center gap-2">
              <Users className="w-6 h-6 text-indigo-500" />
              {t.title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {bookings.length > 0 && (
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 p-1 bg-white dark:bg-slate-900/60">
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors ${
                    viewMode === 'list' ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  {t.listView}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('calendar')}
                  className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border-none cursor-pointer transition-colors ${
                    viewMode === 'calendar' ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  {t.calendarView}
                </button>
              </div>
            )}
            <Link
              href="/mentors"
              className="inline-flex items-center gap-2 bg-indigo-600 text-white font-bold text-sm px-4 py-2.5 rounded-xl no-underline hover:bg-indigo-700 transition-colors shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              {t.bookMentor}
            </Link>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
        ) : bookings.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-10 text-center">
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">{t.empty}</p>
            <Link
              href="/mentors"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-indigo-600 dark:text-indigo-400 no-underline hover:underline"
            >
              {t.chooseMentor}
            </Link>
          </div>
        ) : viewMode === 'calendar' ? (
          <SessionsCalendarView bookings={bookings} lang={lang} onSelectBooking={setSelectedBooking} />
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

      {selectedBooking && <SessionDetailsModal booking={selectedBooking} lang={lang} onClose={() => setSelectedBooking(null)} />}
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
