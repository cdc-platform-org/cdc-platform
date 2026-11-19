// /employer-verification — what employer verification is, what it unlocks,
// and a button that opens the verification drawer. Linked from the
// Employment (დასაქმება) menu and from the API's 403 body
// (Backend/src/utils/freelancerVerification.ts → verifyUrl).
import { BadgeCheck, Briefcase, FileText, ShieldCheck } from 'lucide-react';
import SimpleSiteLayout from '@/src/components/layout/SimpleSiteLayout';
import { useAuth } from '@/src/context/AuthContext';
import { useAuthModal } from '@/src/context/AuthModalContext';
import { useVerificationDrawer } from '@/src/context/VerificationDrawerContext';

const copy = {
  ka: {
    title: 'დამსაქმებლის ვერიფიკაცია',
    intro: 'ვაკანსიის ან შეკვეთის გამოსაქვეყნებლად და ფრილანსერისთვის ფასიანი შეთავაზების გასაგზავნად საჭიროა დამსაქმებლის ვერიფიკაცია. ასე ვიცავთ კანდიდატებს და ფრილანსერებს თაღლითობისგან.',
    unlocksTitle: 'რას გაძლევს',
    unlocks: ['ვაკანსიების და შეკვეთების გამოქვეყნება', 'ფასიანი შეთავაზებების გაგზავნა ფრილანსერებისთვის', 'დადასტურებული დამსაქმებლის ნიშანი შენს განცხადებებზე', 'შემცირებული საკომისიო'],
    howTitle: 'როგორ გავიაროთ',
    how: ['კომპანია: ატვირთე საჯარო რეესტრის ამონაწერი და მიუთითე საიდენტიფიკაციო კოდი.', 'ფიზიკური პირი: ატვირთე პირადობის დოკუმენტი.', 'გუნდი ამოწმებს და გიგზავნის შეტყობინებას. ზოგჯერ დადასტურება მყისიერია.'],
    note: 'უკვე გამოქვეყნებული განცხადებები აქტიური რჩება — ვერიფიკაცია საჭიროა მხოლოდ ახალისთვის.',
    start: 'ვერიფიკაციის დაწყება',
    login: 'შესვლა ვერიფიკაციისთვის',
    done: 'შენი ანგარიში უკვე დადასტურებულია — შეგიძლია ვაკანსიის გამოქვეყნება.',
  },
  en: {
    title: 'Employer Verification',
    intro: 'Employer verification is required to publish a job post or order and to send paid offers to freelancers. It protects candidates and freelancers from fraud.',
    unlocksTitle: 'What it unlocks',
    unlocks: ['Publishing vacancies and orders', 'Sending paid offers to freelancers', 'A verified-employer badge on your posts', 'A lower commission'],
    howTitle: 'How it works',
    how: ['Company: upload a public registry extract and enter your identification code.', 'Individual: upload an identity document.', 'Our team reviews it and notifies you. Sometimes approval is instant.'],
    note: 'Posts you already published stay live — verification is only needed for new ones.',
    start: 'Start verification',
    login: 'Log in to verify',
    done: 'Your account is already verified — you can publish a vacancy.',
  },
};

export default function EmployerVerificationPage() {
  const { user } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { openVerificationDrawer } = useVerificationDrawer();
  const verified =
    !!user &&
    (!!user.isVerified || (user.verificationLevel === 'INDIVIDUAL' && user.verificationStatus === 'APPROVED') || !!user.isVerifiedGraduate);

  return (
    <SimpleSiteLayout titleKa={copy.ka.title} titleEn={copy.en.title} descriptionKa={copy.ka.intro} descriptionEn={copy.en.intro}>
      {(lang) => {
        const t = lang === 'GEO' ? copy.ka : copy.en;
        return (
          <>
            <h1 className="text-3xl font-black mb-2 flex items-center gap-2">
              <ShieldCheck className="w-7 h-7 text-cyan-400" /> {t.title}
            </h1>
            <p className="text-sm text-slate-400 mb-8 leading-relaxed">{t.intro}</p>

            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">{t.unlocksTitle}</h2>
            <ul className="space-y-2 mb-8">
              {t.unlocks.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-200">
                  <Briefcase className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" /> {item}
                </li>
              ))}
            </ul>

            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">{t.howTitle}</h2>
            <ol className="space-y-2 mb-6">
              {t.how.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-slate-200">
                  <FileText className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" /> {item}
                </li>
              ))}
            </ol>
            <p className="text-xs text-slate-500 mb-8">{t.note}</p>

            {verified ? (
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <BadgeCheck className="w-5 h-5" /> {t.done}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => (user ? openVerificationDrawer({ initialTab: 'business' }) : openAuthModal({ mode: 'login' }))}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 px-5 py-3 text-sm font-bold text-white"
              >
                <BadgeCheck className="w-4 h-4" /> {user ? t.start : t.login}
              </button>
            )}
          </>
        );
      }}
    </SimpleSiteLayout>
  );
}
