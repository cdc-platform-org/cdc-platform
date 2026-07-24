import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import { useAuth } from '../../src/context/AuthContext';
import { updateProfile, changePassword } from '../../src/services/authService';

const dict = {
  ka: {
    title: 'ანგარიშის პარამეტრები',
    back: '← პირად კაბინეტში დაბრუნება',
    identityTitle: 'იურიდიული ვინაობა',
    identityHint:
      'ეს მონაცემები გამოიყენება სერტიფიკატებზე და გადახდის დოკუმენტაციაში — შეავსეთ ისე, როგორც პირადობის მოწმობაშია.',
    firstNameKa: 'სახელი (ქართულად)',
    lastNameKa: 'გვარი (ქართულად)',
    firstNameEn: 'სახელი (ლათინურად)',
    lastNameEn: 'გვარი (ლათინურად)',
    nationalId: 'პირადი ნომერი',
    phone: 'ტელეფონის ნომერი',
    email: 'ელ. ფოსტა',
    emailHint: 'ელ. ფოსტის შეცვლა შეუძლებელია.',
    payoutTitle: 'გადახდის რეკვიზიტები',
    payoutIban: 'IBAN (გატანისთვის)',
    save: 'შენახვა',
    saving: 'ინახება…',
    saved: 'შენახულია ✓',
    passwordTitle: 'პაროლის შეცვლა',
    currentPassword: 'მიმდინარე პაროლი',
    newPassword: 'ახალი პაროლი',
    confirmPassword: 'გაიმეორეთ ახალი პაროლი',
    updatePassword: 'პაროლის განახლება',
    updating: 'ნახლდება…',
    passwordUpdated: 'პაროლი წარმატებით განახლდა ✓',
    passwordMismatch: 'ახალი პაროლები არ ემთხვევა.',
  },
  en: {
    title: 'Account Settings',
    back: '← Back to Dashboard',
    identityTitle: 'Legal Identity',
    identityHint: 'Used on certificates and payout paperwork — fill in exactly as it appears on your ID.',
    firstNameKa: 'First Name (Georgian)',
    lastNameKa: 'Last Name (Georgian)',
    firstNameEn: 'First Name (English)',
    lastNameEn: 'Last Name (English)',
    nationalId: 'National ID / Personal Number',
    phone: 'Phone Number',
    email: 'Email',
    emailHint: 'Email cannot be changed.',
    payoutTitle: 'Payout Details',
    payoutIban: 'IBAN (for payouts)',
    save: 'Save Changes',
    saving: 'Saving…',
    saved: 'Saved ✓',
    passwordTitle: 'Change Password',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm New Password',
    updatePassword: 'Update Password',
    updating: 'Updating…',
    passwordUpdated: 'Password updated successfully ✓',
    passwordMismatch: 'New passwords do not match.',
  },
};

const inputClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';
const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5';

function SettingsContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { user, refreshUser } = useAuth();

  const [form, setForm] = useState({
    legalFirstNameKa: '',
    legalLastNameKa: '',
    legalFirstNameEn: '',
    legalLastNameEn: '',
    nationalId: '',
    phone: '',
    payoutIban: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    setForm({
      legalFirstNameKa: user.legalFirstNameKa ?? '',
      legalLastNameKa: user.legalLastNameKa ?? '',
      legalFirstNameEn: user.legalFirstNameEn ?? '',
      legalLastNameEn: user.legalLastNameEn ?? '',
      nationalId: user.nationalId ?? '',
      phone: user.phone ?? '',
      payoutIban: user.payoutIban ?? '',
    });
  }, [user]);

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      await updateProfile({
        legalFirstNameKa: form.legalFirstNameKa || null,
        legalLastNameKa: form.legalLastNameKa || null,
        legalFirstNameEn: form.legalFirstNameEn || null,
        legalLastNameEn: form.legalLastNameEn || null,
        nationalId: form.nationalId || null,
        phone: form.phone || null,
        payoutIban: form.payoutIban || null,
      });
      // Re-syncs the cached user everywhere it's read from context — the
      // certificate confirm modal and wallet payout form both pick this up
      // immediately, no reload needed (data-sync requirement).
      await refreshUser();
      setSaved(true);
    } catch (err: any) {
      setSaveError(err?.response?.data?.message ?? (lang === 'ka' ? 'შენახვა ვერ მოხერხდა.' : 'Unable to save changes.'));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: 'error', text: t.passwordMismatch });
      return;
    }
    setUpdatingPassword(true);
    try {
      await changePassword({ currentPassword: passwordForm.currentPassword, newPassword: passwordForm.newPassword });
      setPasswordMessage({ type: 'success', text: t.passwordUpdated });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err: any) {
      setPasswordMessage({
        type: 'error',
        text: err?.response?.data?.message ?? (lang === 'ka' ? 'პაროლის განახლება ვერ მოხერხდა.' : 'Unable to update password.'),
      });
    } finally {
      setUpdatingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{t.title} | CDC Platform</title>
      </Head>

      <SiteHeader />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <Link
          href="/dashboard"
          className="inline-block text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 no-underline mb-6"
        >
          {t.back}
        </Link>
        <h1 className="text-2xl font-black mb-8">{t.title}</h1>

        <form onSubmit={handleSave} className="space-y-8">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-4">
            <div>
              <h2 className="text-sm font-bold mb-1">{t.identityTitle}</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.identityHint}</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t.firstNameKa}</label>
                <input className={inputClass} value={form.legalFirstNameKa} onChange={handleChange('legalFirstNameKa')} />
              </div>
              <div>
                <label className={labelClass}>{t.lastNameKa}</label>
                <input className={inputClass} value={form.legalLastNameKa} onChange={handleChange('legalLastNameKa')} />
              </div>
              <div>
                <label className={labelClass}>{t.firstNameEn}</label>
                <input className={inputClass} value={form.legalFirstNameEn} onChange={handleChange('legalFirstNameEn')} />
              </div>
              <div>
                <label className={labelClass}>{t.lastNameEn}</label>
                <input className={inputClass} value={form.legalLastNameEn} onChange={handleChange('legalLastNameEn')} />
              </div>
              <div>
                <label className={labelClass}>{t.nationalId}</label>
                <input className={inputClass} value={form.nationalId} onChange={handleChange('nationalId')} />
              </div>
              <div>
                <label className={labelClass}>{t.phone}</label>
                <input className={inputClass} value={form.phone} onChange={handleChange('phone')} />
              </div>
            </div>

            <div>
              <label className={labelClass}>{t.email}</label>
              <input className={`${inputClass} opacity-60 cursor-not-allowed`} value={user?.email ?? ''} disabled />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{t.emailHint}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-4">
            <h2 className="text-sm font-bold">{t.payoutTitle}</h2>
            <div>
              <label className={labelClass}>{t.payoutIban}</label>
              <input className={inputClass} value={form.payoutIban} onChange={handleChange('payoutIban')} placeholder="GE00XX0000000000000000" />
            </div>
          </div>

          {saveError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">{saveError}</div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? t.saving : saved ? t.saved : t.save}
          </button>
        </form>

        <form onSubmit={handlePasswordSubmit} className="mt-10 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-4">
          <h2 className="text-sm font-bold">{t.passwordTitle}</h2>
          <div className="grid sm:grid-cols-1 gap-4">
            <div>
              <label className={labelClass}>{t.currentPassword}</label>
              <input
                type="password"
                required
                className={inputClass}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t.newPassword}</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className={inputClass}
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelClass}>{t.confirmPassword}</label>
                <input
                  type="password"
                  required
                  minLength={8}
                  className={inputClass}
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                />
              </div>
            </div>
          </div>

          {passwordMessage && (
            <div
              className={`rounded-lg px-4 py-3 text-xs border ${
                passwordMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-300'
              }`}
            >
              {passwordMessage.text}
            </div>
          )}

          <button
            type="submit"
            disabled={updatingPassword}
            className="rounded-lg border border-slate-300 dark:border-slate-700 px-6 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
          >
            {updatingPassword ? t.updating : t.updatePassword}
          </button>
        </form>
      </div>

      <SiteFooter lang={lang === 'ka' ? 'GEO' : 'ENG'} />
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
