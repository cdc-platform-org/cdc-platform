import { useState, FormEvent } from 'react';
import { X, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { joinCyberSentinelWaitlist, PreferredOs } from '../../services/cyberSentinelService';
import { SupportedLocale } from '../../utils/locale';

const dictBase = {
  ka: {
    title: 'ადრეული წვდომა — Cyber Sentinel AI',
    subtitle: 'შემოგვიერთდით ლისტში და პირველებმა მიიღეთ 10-დღიანი უფასო ულიმიტო წვდომა გაშვებისთანავე.',
    name: 'სახელი',
    namePlaceholder: 'თქვენი სახელი',
    email: 'ელ. ფოსტა',
    emailPlaceholder: 'name@company.com',
    os: 'რომელ ოპერაციულ სისტემას იყენებთ?',
    submit: 'დარეგისტრირება',
    submitting: 'იგზავნება…',
    close: 'დახურვა',
    error: 'დარეგისტრირება ვერ მოხერხდა. სცადეთ ხელახლა.',
    successTitle: 'თქვენ ლისტში ხართ! 🎉',
    successBody: 'გაცნობებთ, როგორც კი Cyber Sentinel AI გაეშვება — 10-დღიანი უფასო წვდომით.',
    done: 'დახურვა',
  },
  en: {
    title: 'Get Early Access — Cyber Sentinel AI',
    subtitle: "Join the waitlist and be first to get 10 days of free, unlimited access at launch.",
    name: 'Name',
    namePlaceholder: 'Your name',
    email: 'Email',
    emailPlaceholder: 'name@company.com',
    os: 'Which operating system do you use?',
    submit: 'Join Waitlist',
    submitting: 'Submitting…',
    close: 'Close',
    error: 'Could not join the waitlist. Please try again.',
    successTitle: "You're on the list! 🎉",
    successBody: "We'll email you the moment Cyber Sentinel AI launches — with your 10-day free trial.",
    done: 'Close',
  },
};

// English fallback for locales without a translation yet.
const dict: Record<SupportedLocale, typeof dictBase.en> = {
  ...dictBase,
  de: dictBase.en,
  es: dictBase.en,
  fr: dictBase.en,
  uk: dictBase.en,
};

const OS_OPTIONS: { value: PreferredOs; label: string }[] = [
  { value: 'WINDOWS', label: 'Windows' },
  { value: 'MAC', label: 'macOS' },
  { value: 'LINUX', label: 'Linux' },
];

export default function CyberSentinelWaitlistModal({ lang, onClose }: { lang: SupportedLocale; onClose: () => void }) {
  const t = dict[lang];
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [os, setOs] = useState<PreferredOs>('WINDOWS');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await joinCyberSentinelWaitlist({ name: name.trim(), email: email.trim(), os });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.error);
    } finally {
      setSubmitting(false);
    }
  };

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

        {success ? (
          <div className="text-center py-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-cyan-600 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-base font-black tracking-wide mb-2">{t.successTitle}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.successBody}</p>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
            >
              {t.done}
            </button>
          </div>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center mb-4">
              <ShieldAlert className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-base font-black tracking-wide mb-1.5">{t.title}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.subtitle}</p>

            {error && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-600 dark:text-red-300">{error}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t.name}</label>
                <input
                  required
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t.email}</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t.emailPlaceholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">{t.os}</label>
                <div className="grid grid-cols-3 gap-2">
                  {OS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setOs(opt.value)}
                      className={`text-xs font-bold px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                        os === opt.value
                          ? 'bg-cyan-600 text-white border-cyan-600'
                          : 'bg-transparent text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !name.trim() || !email.trim()}
                className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-60 mt-2"
              >
                {submitting ? t.submitting : t.submit}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
