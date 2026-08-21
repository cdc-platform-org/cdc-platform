import { useState, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/router';
import { X, ShieldCheck, ShieldAlert, Clock, UserCheck, Building2, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useVerificationDrawer } from '../../context/VerificationDrawerContext';
import { uploadVerificationDoc, uploadIndividualVerificationDoc, updateProfile } from '../../services/authService';
import { resolveLocale } from '@/src/utils/locale';
import { JOB_CATEGORIES, JOB_CATEGORY_LABEL } from '@/src/utils/jobCategory';
import { JobCategory } from '@/src/types/community';

const EN_STRINGS = {
  title: 'Verify Your Account',
  individualTab: 'Individual',
  businessTab: 'Business',
  freelancerTab: 'Freelancer',
  individualBlurb: 'Verify your identity with an ID card or passport to unlock freelancer rights — submitting proposals, applying to vacancies, and unlimited forum posts.',
  businessBlurb: 'Verify your business with a Public Registry extract to unlock job posting and B2B invoicing.',
  freelancerBlurb: 'Pick the profession(s) you work in, then take a 15-question AI-generated skills test. Passing marks you as a CDC Verified Freelancer.',
  taxIdLabel: 'Company Identification Code (ID)',
  taxIdPlaceholder: 'e.g. 123456789',
  personalNumberLabel: 'Personal ID Number',
  personalNumberPlaceholder: 'e.g. 01234567890 (11 digits)',
  personalNumberHint: 'One ID number can only ever verify one CDC account.',
  personalNumberError: 'Enter exactly 11 digits.',
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
  professionsLabel: 'Professions',
  otherProfession: 'Other',
  otherProfessionPlaceholder: 'Type your profession…',
  selectAtLeastOne: 'Select at least one profession (or describe your own under "Other").',
  verifySkillsButton: 'Verify Skills',
  alreadyPassed: 'You already passed — CDC Verified Freelancer',
};

const dict = {
  ka: {
    title: 'ექაუნთის ვერიფიკაცია',
    individualTab: 'ფიზიკური პირი',
    businessTab: 'ბიზნესი',
    freelancerTab: 'ფრილანსერი',
    individualBlurb: 'დაადასტურეთ თქვენი ვინაობა პირადობის მოწმობით ან პასპორტით — გახსენით ფრილანსერის უფლებები: წინადადებების გაგზავნა, ვაკანსიებზე განაცხადი და ფორუმზე ულიმიტო პოსტინგი.',
    businessBlurb: 'დაადასტურეთ თქვენი ბიზნესი საჯარო რეესტრის ამონაწერით — გახსენით ვაკანსიის განთავსება და B2B ინვოისირება.',
    freelancerBlurb: 'აირჩიეთ თქვენი პროფესია(ები) და ჩააბარეთ 15 კითხვისგან შემდგარი AI-გენერირებული უნარების ტესტი. წარმატებით ჩაბარების შემთხვევაში მიიღებთ CDC Verified Freelancer სტატუსს.',
    taxIdLabel: 'საიდენტიფიკაციო კოდი (ს/კ)',
    taxIdPlaceholder: 'მაგ. 123456789',
    personalNumberLabel: 'პირადი ნომერი',
    personalNumberPlaceholder: 'მაგ. 01234567890 (11 ციფრი)',
    personalNumberHint: 'ერთი პირადი ნომერი შეიძლება გამოყენებულ იქნას მხოლოდ ერთი CDC ანგარიშის ვერიფიკაციისთვის.',
    personalNumberError: 'შეიყვანეთ ზუსტად 11 ციფრი.',
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
    professionsLabel: 'პროფესიები',
    otherProfession: 'სხვა',
    otherProfessionPlaceholder: 'ჩაწერეთ თქვენი პროფესია…',
    selectAtLeastOne: 'აირჩიეთ მინიმუმ ერთი პროფესია (ან აღწერეთ საკუთარი „სხვა“-ში).',
    verifySkillsButton: 'უნარების ვერიფიკაცია',
    alreadyPassed: 'თქვენ უკვე ჩააბარეთ — CDC Verified Freelancer',
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
  const [tab, setTab] = useState<'individual' | 'business' | 'freelancer'>('individual');
  const [taxId, setTaxId] = useState('');
  const [personalNumber, setPersonalNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedProfessions, setSelectedProfessions] = useState<JobCategory[]>([]);
  const [otherProfession, setOtherProfession] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTab(initialTab);
      setTaxId(user?.taxId ?? '');
      setPersonalNumber(user?.personalNumber ?? '');
      setSelectedProfessions([]);
      setOtherProfession('');
      setError(null);
    }
  }, [isOpen, initialTab, user?.taxId, user?.personalNumber]);

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

  const personalNumberValid = /^\d{11}$/.test(personalNumber.trim());

  const handleIndividualFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!personalNumberValid) {
      setError(t.personalNumberError);
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const updated = await uploadIndividualVerificationDoc(file, personalNumber.trim());
      await refreshUser();
      if (onSuccess && (updated.isVerified || updated.verificationStatus === 'APPROVED')) onSuccess(updated);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const toggleProfession = (category: JobCategory) => {
    setSelectedProfessions((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const canVerifySkills = selectedProfessions.length > 0 || otherProfession.trim().length > 0;

  const handleVerifySkills = () => {
    if (!canVerifySkills) return;
    const query: Record<string, string> = {};
    if (selectedProfessions.length > 0) query.categories = selectedProfessions.join(',');
    if (otherProfession.trim()) query.other = otherProfession.trim();
    closeVerificationDrawer();
    router.push({ pathname: '/freelancer/exam', query });
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
          <button
            type="button"
            onClick={() => setTab('freelancer')}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
              tab === 'freelancer' ? 'border-cyan-500 text-cyan-600 dark:text-cyan-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            {t.freelancerTab}
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-2.5 text-xs text-red-600 dark:text-red-300">
              {error}
            </div>
          )}

          {tab === 'individual' && (
            <>
              <StatusPill status={individualStatus} t={t} />
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t.individualBlurb}</p>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">{t.personalNumberLabel}</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={11}
                  value={personalNumber}
                  onChange={(e) => setPersonalNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                  placeholder={t.personalNumberPlaceholder}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-[11px] text-slate-400 mt-1.5">{t.personalNumberHint}</p>
              </div>
              <label
                className={`flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
                  personalNumberValid
                    ? 'border-slate-300 dark:border-slate-700 cursor-pointer hover:border-cyan-400 hover:bg-cyan-50/50 dark:hover:bg-cyan-500/5'
                    : 'border-slate-200 dark:border-slate-800 opacity-50 cursor-not-allowed'
                }`}
              >
                <UserCheck className="w-6 h-6 text-slate-400" />
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                  {uploading ? t.uploading : individualStatus === 'unverified' ? t.uploadLabel : t.uploadReplace}
                </span>
                <span className="text-[11px] text-slate-400">{t.uploadHint}</span>
                <input
                  type="file"
                  accept="application/pdf,image/jpeg,image/png,image/webp"
                  onChange={handleIndividualFile}
                  disabled={uploading || !personalNumberValid}
                  className="hidden"
                />
              </label>
            </>
          )}

          {tab === 'business' && (
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

          {tab === 'freelancer' && (
            <>
              {user.isVerifiedGraduate && (
                <div className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 w-fit">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {t.alreadyPassed}
                </div>
              )}
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t.freelancerBlurb}</p>
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-2">{t.professionsLabel}</label>
                <div className="flex flex-wrap gap-2">
                  {JOB_CATEGORIES.filter((c) => c !== 'other').map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => toggleProfession(category)}
                      className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors cursor-pointer ${
                        selectedProfessions.includes(category)
                          ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                          : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      {JOB_CATEGORY_LABEL[category][lang]}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setSelectedProfessions((prev) => (prev.includes('other') ? prev.filter((c) => c !== 'other') : [...prev, 'other']))}
                    className={`px-3 py-1.5 rounded-full border text-xs font-bold transition-colors cursor-pointer ${
                      selectedProfessions.includes('other')
                        ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                        : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {t.otherProfession}
                  </button>
                </div>
                {selectedProfessions.includes('other') && (
                  <input
                    type="text"
                    value={otherProfession}
                    onChange={(e) => setOtherProfession(e.target.value)}
                    placeholder={t.otherProfessionPlaceholder}
                    className="mt-2.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                )}
              </div>
              {!canVerifySkills && <p className="text-[11px] text-amber-600 dark:text-amber-400">{t.selectAtLeastOne}</p>}
              <button
                type="button"
                onClick={handleVerifySkills}
                disabled={!canVerifySkills}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm py-3 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="w-4 h-4" />
                {t.verifySkillsButton}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
