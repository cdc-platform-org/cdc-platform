/**
 * "Why verify your account?" — one list of real, code-backed benefits,
 * shown everywhere verification is offered (VerificationDrawer,
 * SoftVerificationNudge, PermissionDeniedModal) so the pitch never drifts
 * between screens. The same points are in the Terms (src/data/legal/terms.ts,
 * section 5/6), so keep both in sync.
 *
 * Each point maps to a real rule in the backend:
 *  - 20% vs 25% commission: platformFeeScheduleService / productSaleService
 *  - payouts need verification: routes/wallet.ts
 *  - posting gigs/vacancies needs verification: utils/freelancerVerification.ts
 *  - one ID number = one account: individual verification upload
 */
import { BadgeCheck, Percent, Wallet, Megaphone, ShieldCheck } from 'lucide-react';

const POINTS = {
  ka: {
    title: 'რატომ ღირს ვერიფიკაცია?',
    items: [
      { icon: Percent, text: 'ნაკლები საკომისიო: 20% ნაცვლად 25%-ისა (ციფრულ მაღაზიაში გაყიდვებზე და ფრილანს გარიგებებზე).' },
      { icon: Wallet, text: 'გამომუშავებული თანხის გატანა საბანკო ანგარიშზე (ვერიფიკაციის გარეშე გატანა შეუძლებელია).' },
      { icon: Megaphone, text: 'შეკვეთების და ვაკანსიების გამოქვეყნება, პროდუქტის გაყიდვაში განთავსება, ფორუმზე ულიმიტო პოსტები.' },
      { icon: BadgeCheck, text: '„ვერიფიცირებული“ ნიშანი პროფილსა და წინადადებებზე: კლიენტები და მყიდველები მეტად გენდობიან.' },
      { icon: ShieldCheck, text: 'მეტი უსაფრთხოება ყველასთვის: ერთი პირადი ნომერი = ერთი ანგარიში, ნაკლები ყალბი პროფილი და თაღლითობა.' },
    ],
    privacy: 'დოკუმენტი ინახება დახურულ საცავში და მას მხოლოდ ადმინისტრატორი ხედავს შემოწმებისთვის.',
  },
  en: {
    title: 'Why verify your account?',
    items: [
      { icon: Percent, text: 'Lower fees: 20% commission instead of 25% (Digital Store sales and freelance deals).' },
      { icon: Wallet, text: 'Withdraw your earnings to your bank account (payouts are not possible without verification).' },
      { icon: Megaphone, text: 'Post gigs and vacancies, sell products in the store, and post on the forum without limits.' },
      { icon: BadgeCheck, text: 'A "Verified" badge on your profile and proposals, so clients and buyers trust you more.' },
      { icon: ShieldCheck, text: 'A safer platform for everyone: one ID number = one account, fewer fake profiles and less fraud.' },
    ],
    privacy: 'Your document is kept in private storage and is only seen by an administrator for the check.',
  },
};

interface Props {
  lang: string;
  /** compact: first three points only, no privacy line (for small modals). */
  compact?: boolean;
  className?: string;
}

export default function VerificationBenefits({ lang, compact, className = '' }: Props) {
  const t = lang === 'ka' ? POINTS.ka : POINTS.en;
  const items = compact ? t.items.slice(0, 3) : t.items;
  return (
    <div className={`rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50/70 dark:bg-emerald-500/10 px-4 py-3 ${className}`}>
      <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 mb-2">{t.title}</p>
      <ul className="space-y-1.5">
        {items.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-2 text-[11px] leading-snug text-emerald-900/90 dark:text-emerald-100/85">
            <Icon className="w-3.5 h-3.5 shrink-0 mt-px text-emerald-600 dark:text-emerald-400" aria-hidden />
            <span>{text}</span>
          </li>
        ))}
      </ul>
      {!compact && <p className="mt-2 text-[10px] text-emerald-800/70 dark:text-emerald-200/60">{t.privacy}</p>}
    </div>
  );
}
