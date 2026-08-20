import { useState, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/router';
import { X, ShieldCheck, ShieldAlert, Clock, UserCheck, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useVerificationDrawer } from '../../context/VerificationDrawerContext';
import { uploadVerificationDoc, uploadIndividualVerificationDoc, updateProfile } from '../../services/authService';
import { resolveLocale } from '@/src/utils/locale';

const EN_STRINGS = {
  title: 'Verify Your Account',
  individualTab: 'Individual',
  businessTab: 'Business',
  individualBlurb: 'Verify your identity with an ID card or passport to unlock freelancer rights — submitting proposals, applying to vacancies, and unlimited forum posts.',
  businessBlurb: 'Verify your business with a Public Registry extract to unlock job posting and B2B invoicing.',
  taxIdLabel: 'Company Identification Code (ID)',
  taxIdPlaceholder: 'e.g. 123456789',
  uploadLabel: 'Upload document',
  uploadReplace: 'Replace document',
  uploadHint: 'PDF, JPG, PNG, or WEBP — up to 10MB',
  uploading: 'Uploading…',
  statusUnverified: 'Not submitted yet',
  statusPending: 'Under review',
  statusApproved: 'Verified',
  statusRejected: 'Rejected — please resubmit',
  viewDocument: 'View submitted document',
  close: 'Close',
};

const dict = {
  ka: {
    title: 'ექაუნთის ვერიფიკაცია',
    individualTab: 'ფიზიკური პირი',
    businessTab: 'ბიზნესი',
    individualBlurb: 'დაადასტურეთ თქვენი ვინაობა პირადობის მოწმობით ან პასპორტით — გახსენით ფრილანსერის უფლებები: წინადადებების გაგზავნა, ვაკანსიებზე განაცხადი და ფორუმზე ულიმიტო პოსტინგი.',
    businessBlurb: 'დაადასტურეთ თქვენი ბიზნესი საჯარო რეესტრის ამონაწერით — გახსენით ვაკანსიის განთავსება და B2B ინვოისირება.',
    taxIdLabel: 'საიდენტიფიკაციო კოდი (ს/კ)',
    taxIdPlaceholder: 'მაგ. 123456789',
    uploadLabel: 'დოკუმენტის ატვირთვა',
    uploadReplace: 'დოკუმენტის შეცვლა',
    uploadHint: 'PDF, JPG, PNG ან WEBP — მაქს. 10MB',
    uploading: 'იტვირთება…',
    statusUnverified: 'ჯერ არ არის გაგზავნილი',
    statusPending: 'განხილვის პროცესშია',
    statusApproved: 'ვერიფიცირებულია',
    statusRejected: 'უარყოფილია — გთხოვთ თავიდან გაგზავნოთ',
    viewDocument: 'გაგზავნილი დოკუმენტის ნახვა',
    close: 'დახურვა',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

type IndividualStatus = 'unverified' | 'pending' | 'approved' | 'rejected';
type BusinessStatus = 'unverified' | 'pending' | 'approved' | 'rejected';

function StatusPill({ status, t }: { status: IndividualStatus | BusinessStatus; t: typeof dict.ka }) {
  const config = {
    approved: { icon: ShieldCheck, label: t.statusApproved, className: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30' },
    pending: { icon: Clock, label: t.statusPending, className: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30' },
    rejected: { icon: ShieldAlert, label: t.statusRejected, className: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30' },
    unverified: { icon: ShieldAlert, label: t.statusUnverified, className: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700' },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${config.className}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

export default function VerificationDrawer() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const { user, refreshUser } = useAuth();
  const { isOpen, contextMessage, initialTab, onSuccess, closeVerificationDrawer } = useVerificationDrawer();
  const [tab, setTab] = useState<'individual' | 'business'>('individual');
  const [taxId, setTaxId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setTaxId(user?.taxId ?? '');
      setError(null);
    }
  }, [isOpen, initialTab, user?.taxId]);

  if (!isOpen || !user) return null;

  const individualStatus: IndividualStatus =
    user.verificationLevel !== 'INDIVIDUAL'
      ? 'unverified'
      : user.verificationStatus === 'APPROVED'
        ? 'approved'
        : user.verificationStatus === 'REJECTED'
          ? 'rejected'
          : 'pending';

  const businessStatus: BusinessStatus = user.isVerified
    ? 'approved'
    : user.verificationDocUrl && user.verificationLevel === 'BUSINESS'
      ? user.verificationStatus === 'REJECTED'
        ? 'rejected'
        : 'pending'
      : 'unverified';

  const handleIndividualFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const updated = await uploadIndividualVerificationDoc(file);
      await refreshUser();
      if (onSuccess && (updated.isVerified || updated.verificationStatus === 'APPROVED')) onSuccess(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleBusinessFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      if (taxId.trim() && taxId.trim() !== (user.taxId ?? '')) {
        await updateProfile({ taxId: taxId.trim() });
      }
      const updated = await uploadVerificationDoc(file);
      await refreshUser();
      if (onSuccess && updated.isVerified) onSuccess(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const message = contextMessage ? (typeof contextMessage === 'string' ? contextMessage : contextMessage[lang === 'ka' ? 'ka' : 'en']) : null;

  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeVerificationDrawer} />
      <div className="relative w-full max-w-md h-full bg-white dark:bg-[#0e1422] shadow-2xl overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0e1422]/95 backdrop-blur-md">
          <h2 className="text-base font-black text-slate-900 dark:text-white">{t.title}</h2>
          <button
            type="button"
            onClick={closeVerificationDrawer}
            aria-label={t.close}
            className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {message && (
          <div className="mx-6 mt-5 rounded-xl bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/30 px-4 py-3 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
            {message}
          </div>
        )}

        <div className="flex gap-1 px-6 mt-5 border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTab('individual')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
              tab === 'individual' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            {t.individualTab}
          </button>
          <button
            type="button"
            onClick={() => setTab('business')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
              tab === 'business' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            {t.businessTab}
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-2.5 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {tab === 'individual' ? (
            <>
              <StatusPill status={individualStatus} t={t} />
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t.individualBlurb}</p>
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 dark:hover:bg-cyan-500/5 transition-colors">
                <UserCheck className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {uploading ? t.uploading : individualStatus === 'unverified' ? t.uploadLabel : t.uploadReplace}
                </span>
                <span className="text-[11px] text-slate-400">{t.uploadHint}</span>
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleIndividualFile} disabled={uploading} className="hidden" />
              </label>
            </>
          ) : (
            <>
              <StatusPill status={businessStatus} t={t} />
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t.businessBlurb}</p>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">{t.taxIdLabel}</label>
                <input
                  type="text"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder={t.taxIdPlaceholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
              <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 px-4 py-8 text-center cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 dark:hover:bg-cyan-500/5 transition-colors">
                <Building2 className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {uploading ? t.uploading : businessStatus === 'unverified' ? t.uploadLabel : t.uploadReplace}
                </span>
                <span className="text-[11px] text-slate-400">{t.uploadHint}</span>
                <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={handleBusinessFile} disabled={uploading} className="hidden" />
              </label>
              {user.verificationDocUrl && (
                <a href={user.verificationDocUrl} target="_blank" rel="noopener noreferrer" className="block text-xs font-bold text-cyan-600 dark:text-cyan-400 no-underline hover:underline">
                  {t.viewDocument}
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
