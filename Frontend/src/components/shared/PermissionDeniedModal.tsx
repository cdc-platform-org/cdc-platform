import { useRouter } from 'next/router';
import Link from 'next/link';
import { ShieldAlert, Clock, Ban, XCircle, MailQuestion, BadgeCheck } from 'lucide-react';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { resolveLocale } from '../../utils/locale';
import { ApiErrorReason } from '../../utils/apiErrorMessages';
import { useVerificationDrawer } from '../../context/VerificationDrawerContext';

interface PermissionDeniedModalProps {
  reason: ApiErrorReason;
  // What the user was trying to do — the raw backend message is identical
  // across several different requireRole() gates, so the calling component
  // supplies which flow it was, and the copy below tailors itself
  // accordingly (e.g. "posting" needs different guidance than "applying").
  context: 'posting' | 'applying';
  onClose: () => void;
}

const SUPPORT_EMAIL = 'contact@cdc.org.ge';

const EN_STRINGS = {
  titles: {
    PENDING_APPROVAL: 'Your account is still pending approval',
    BANNED: 'This account has been suspended',
    DEACTIVATED: 'This account has been deactivated',
    DAILY_LIMIT: "You've reached your daily posting limit",
    ROLE_RESTRICTED: 'This action is not available for your account',
    VERIFICATION_REQUIRED: 'Verification required',
  },
  bodies: {
    PENDING_APPROVAL: 'An administrator needs to approve your account before you can do this. This is usually quick — check back soon, or reach out if it has been a while.',
    BANNED: 'This account has been suspended and can no longer take this action. Contact support if you believe this is a mistake.',
    DEACTIVATED: 'This account has been deactivated. Contact support if you believe this is a mistake.',
    DAILY_LIMIT: "You've reached your daily posting limit. Try again tomorrow.",
    postingRoleRestricted: 'Posting is open to any approved account. If you\'re seeing this, something is misconfigured on our side — please contact support so we can fix it for you.',
    applyingRoleRestricted: "Applying to jobs is available for Student/Freelancer accounts. If you're a business looking to hire, use \"Post a Vacancy\" instead.",
    VERIFICATION_REQUIRED: 'Publishing a listing (vacancy/gig) requires account verification. The process is simple and keeps the platform secure.',
  },
  contactSupport: 'Contact Support',
  postAJob: 'Post a Vacancy',
  getVerified: 'Get Verified',
  close: 'Close',
};

const dict = {
  ka: {
    titles: {
      PENDING_APPROVAL: 'თქვენი ანგარიში ჯერ არ არის დამტკიცებული',
      BANNED: 'ეს ანგარიში დაბლოკილია',
      DEACTIVATED: 'ეს ანგარიში დეაქტივირებულია',
      DAILY_LIMIT: 'განცხადებების გამოქვეყნების დღიური ლიმიტი ამოწურულია',
      ROLE_RESTRICTED: 'ეს მოქმედება თქვენი ანგარიშისთვის მიუწვდომელია',
      VERIFICATION_REQUIRED: 'ვერიფიკაცია აუცილებელია',
    },
    bodies: {
      PENDING_APPROVAL: 'ამ მოქმედების შესასრულებლად საჭიროა ადმინისტრატორის დამტკიცება. ჩვეულებრივ ეს სწრაფად ხდება — შეამოწმეთ მოგვიანებით, ან დაგვიკავშირდით, თუ დიდი დრო გავიდა.',
      BANNED: 'ეს ანგარიში დაბლოკილია და ვეღარ შეასრულებს ამ მოქმედებას. თუ ეს შეცდომაა, დაგვიკავშირდით მხარდაჭერას.',
      DEACTIVATED: 'ეს ანგარიში დეაქტივირებულია. თუ ეს შეცდომაა, დაგვიკავშირდით მხარდაჭერას.',
      DAILY_LIMIT: 'თქვენ ამოწურეთ განცხადებების გამოქვეყნების დღიური ლიმიტი.',
      postingRoleRestricted: 'გამოქვეყნება ხელმისაწვდომია ნებისმიერი დამტკიცებული ანგარიშისთვის. თუ ამ შეტყობინებას ხედავთ, ესეიგი რაღაც ხარვეზია ჩვენს მხარეს — გთხოვთ დაგვიკავშირდეთ, რომ გამოვასწოროთ.',
      applyingRoleRestricted: 'ვაკანსიაზე განაცხადის გაგზავნა შესაძლებელია სტუდენტის/ფრილანსერის ანგარიშიდან. თუ ბიზნესის სახელით ეძებთ თანამშრომელს, გამოიყენეთ „ვაკანსიის გამოქვეყნება“.',
      VERIFICATION_REQUIRED: 'განცხადების (ვაკანსია/შეკვეთა) გამოსაქვეყნებლად აუცილებელია გაიაროთ ანგარიშის ვერიფიკაცია. პროცესი მარტივია და უზრუნველყოფს პლატფორმის უსაფრთხოებას.',
    },
    contactSupport: 'მხარდაჭერასთან დაკავშირება',
    postAJob: 'ვაკანსიის გამოქვეყნება',
    getVerified: 'ვერიფიკაციის გავლა',
    close: 'დახურვა',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

const REASON_ICON: Record<ApiErrorReason, typeof ShieldAlert> = {
  PENDING_APPROVAL: Clock,
  BANNED: Ban,
  DEACTIVATED: XCircle,
  DAILY_LIMIT: Clock,
  ROLE_RESTRICTED: ShieldAlert,
  VERIFICATION_REQUIRED: BadgeCheck,
};

export default function PermissionDeniedModal({ reason, context, onClose }: PermissionDeniedModalProps) {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const Icon = REASON_ICON[reason];
  const { openVerificationDrawer } = useVerificationDrawer();

  useEscapeToClose(true, onClose);

  const handleGetVerified = () => {
    onClose();
    openVerificationDrawer();
  };

  const body =
    reason === 'ROLE_RESTRICTED'
      ? context === 'posting'
        ? t.bodies.postingRoleRestricted
        : t.bodies.applyingRoleRestricted
      : t.bodies[reason];

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="max-w-sm w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
          <Icon className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-base font-black text-slate-900 dark:text-white mb-2">{t.titles[reason]}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">{body}</p>

        <div className="flex flex-col gap-2">
          {(reason === 'BANNED' || reason === 'DEACTIVATED' || (reason === 'ROLE_RESTRICTED' && context === 'posting')) && (
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm py-3 no-underline"
            >
              <MailQuestion className="w-4 h-4" />
              {t.contactSupport}
            </a>
          )}
          {reason === 'VERIFICATION_REQUIRED' && (
            <button
              type="button"
              onClick={handleGetVerified}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm py-3"
            >
              <BadgeCheck className="w-4 h-4" />
              {t.getVerified}
            </button>
          )}
          {reason === 'ROLE_RESTRICTED' && context === 'applying' && (
            <Link
              href="/vacancies/post"
              className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm py-3 no-underline"
            >
              {t.postAJob}
            </Link>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm py-3"
          >
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
}
