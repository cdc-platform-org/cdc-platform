import { useState, useEffect, useRef, ChangeEvent } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Upload, FileText, Briefcase, Building2 } from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import { useAuth } from '../../src/context/AuthContext';
import { updateProfile, changePassword, uploadAvatar, uploadCv, forgotPassword } from '../../src/services/authService';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../src/utils/imageUpload';
import Toast from '../../src/components/shared/Toast';
import SkillPicker from '../../src/components/shared/SkillPicker';
import { resolveLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    title: 'ანგარიშის პარამეტრები',
    back: '← პირად კაბინეტში დაბრუნება',
    profileTitle: 'პროფილი',
    avatarChange: 'სურათის შეცვლა',
    avatarUploading: 'იტვირთება…',
    avatarError: 'სურათის ატვირთვა ვერ მოხერხდა.',
    avatarHint: 'მაქსიმუმ 10 MB (JPG, PNG, WEBP)',
    cvTitle: 'რეზიუმე / CV',
    cvHint: 'ატვირთეთ თქვენი CV — გამოჩნდება გიგებზე/ვაკანსიებზე განაცხადებში და თქვენს პროფილში.',
    cvUpload: 'CV-ის ატვირთვა',
    cvReplace: 'CV-ის შეცვლა',
    cvUploading: 'იტვირთება…',
    cvView: 'CV-ის ნახვა',
    cvUploadError: 'ფაილის ატვირთვა ვერ მოხერხდა.',
    intentTitle: 'დაშბორდის ფოკუსი',
    intentHint: 'ეს მხოლოდ განსაზღვრავს, რომელი მალსახმობი გამოჩნდება პირველად თქვენს დაშბორდზე — არცერთ შესაძლებლობას არ ზღუდავს.',
    intentTalent: 'ფრილანსი',
    intentEmployer: 'დაქირავება / ბიზნესი',
    intentSaved: 'შენახულია ✓',
    displayName: 'სახელი (საჯარო)',
    bio: 'ბიო / სათაური',
    bioPlaceholder: 'მოკლედ მოგვიყევით საკუთარ თავზე...',
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
    skillsTitle: 'ჩემი უნარები',
    skillsHint: 'აირჩიეთ თქვენი უნარები — შეგიძლიათ დაადასტუროთ ისინი AI ტესტით პროფილში „უნარების ვერიფიკაცია"-ს გვერდზე.',
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
    forgotCurrentPassword: 'არ გვახსოვს მიმდინარე პაროლი? გააგზავნე აღდგენის ბმული მეილზე',
    sendingResetLink: 'იგზავნება…',
    resetLinkSentToast: 'აღდგენის ბმული გაიგზავნა თქვენს ელ-ფოსტაზე',
    passwordUpdated: 'პაროლი წარმატებით განახლდა ✓',
    passwordMismatch: 'ახალი პაროლები არ ემთხვევა.',
    termsTitle: 'წესები და პირობები',
    termsAccepted: (date: string) => `თქვენ დაეთანხმეთ წესებსა და პირობებს — ${date}`,
    termsNotAccepted: 'თქვენ ჯერ არ დაგიდასტურებიათ წესები და პირობები.',
    termsViewLink: 'წესებისა და პირობების სრულად ნახვა',
  },
  en: {
    title: 'Account Settings',
    back: '← Back to Dashboard',
    profileTitle: 'Profile',
    avatarChange: 'Change Photo',
    avatarUploading: 'Uploading…',
    avatarError: 'Unable to upload the image.',
    avatarHint: 'Max 10 MB (JPG, PNG, WEBP)',
    cvTitle: 'CV / Resume',
    cvHint: 'Upload your CV — shown on gig/vacancy applications and your profile.',
    cvUpload: 'Upload CV',
    cvReplace: 'Replace CV',
    cvUploading: 'Uploading…',
    cvView: 'View CV',
    cvUploadError: 'Unable to upload the file.',
    intentTitle: 'Dashboard Focus',
    intentHint: "This only decides which shortcut appears first on your dashboard — it never restricts what you can do.",
    intentTalent: 'Freelancing',
    intentEmployer: 'Hiring / Business',
    intentSaved: 'Saved ✓',
    displayName: 'Display Name',
    bio: 'Bio / Headline',
    bioPlaceholder: 'Tell us a bit about yourself...',
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
    skillsTitle: 'My Skills',
    skillsHint: 'Select your skills — you can get them AI-verified on the "Skill Verification" page.',
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
    forgotCurrentPassword: "Forgot your current password? Send a reset link to your email",
    sendingResetLink: 'Sending…',
    resetLinkSentToast: 'A reset link has been sent to your email',
    passwordUpdated: 'Password updated successfully ✓',
    passwordMismatch: 'New passwords do not match.',
    termsTitle: 'Terms & Conditions',
    termsAccepted: (date: string) => `You accepted our Terms & Conditions on ${date}`,
    termsNotAccepted: "You haven't accepted our Terms & Conditions yet.",
    termsViewLink: 'View the full Terms & Conditions',
  },
  de: {
    title: 'Account Settings',
    back: '← Back to Dashboard',
    profileTitle: 'Profile',
    avatarChange: 'Change Photo',
    avatarUploading: 'Uploading…',
    avatarError: 'Unable to upload the image.',
    avatarHint: 'Max 10 MB (JPG, PNG, WEBP)',
    cvTitle: 'CV / Resume',
    cvHint: 'Upload your CV — shown on gig/vacancy applications and your profile.',
    cvUpload: 'Upload CV',
    cvReplace: 'Replace CV',
    cvUploading: 'Uploading…',
    cvView: 'View CV',
    cvUploadError: 'Unable to upload the file.',
    intentTitle: 'Dashboard Focus',
    intentHint: "This only decides which shortcut appears first on your dashboard — it never restricts what you can do.",
    intentTalent: 'Freelancing',
    intentEmployer: 'Hiring / Business',
    intentSaved: 'Saved ✓',
    displayName: 'Display Name',
    bio: 'Bio / Headline',
    bioPlaceholder: 'Tell us a bit about yourself...',
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
    skillsTitle: 'My Skills',
    skillsHint: 'Select your skills — you can get them AI-verified on the "Skill Verification" page.',
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
    forgotCurrentPassword: "Forgot your current password? Send a reset link to your email",
    sendingResetLink: 'Sending…',
    resetLinkSentToast: 'A reset link has been sent to your email',
    passwordUpdated: 'Password updated successfully ✓',
    passwordMismatch: 'New passwords do not match.',
    termsTitle: 'Terms & Conditions',
    termsAccepted: (date: string) => `You accepted our Terms & Conditions on ${date}`,
    termsNotAccepted: "You haven't accepted our Terms & Conditions yet.",
    termsViewLink: 'View the full Terms & Conditions',
  },
  es: {
    title: 'Account Settings',
    back: '← Back to Dashboard',
    profileTitle: 'Profile',
    avatarChange: 'Change Photo',
    avatarUploading: 'Uploading…',
    avatarError: 'Unable to upload the image.',
    avatarHint: 'Max 10 MB (JPG, PNG, WEBP)',
    cvTitle: 'CV / Resume',
    cvHint: 'Upload your CV — shown on gig/vacancy applications and your profile.',
    cvUpload: 'Upload CV',
    cvReplace: 'Replace CV',
    cvUploading: 'Uploading…',
    cvView: 'View CV',
    cvUploadError: 'Unable to upload the file.',
    intentTitle: 'Dashboard Focus',
    intentHint: "This only decides which shortcut appears first on your dashboard — it never restricts what you can do.",
    intentTalent: 'Freelancing',
    intentEmployer: 'Hiring / Business',
    intentSaved: 'Saved ✓',
    displayName: 'Display Name',
    bio: 'Bio / Headline',
    bioPlaceholder: 'Tell us a bit about yourself...',
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
    skillsTitle: 'My Skills',
    skillsHint: 'Select your skills — you can get them AI-verified on the "Skill Verification" page.',
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
    forgotCurrentPassword: "Forgot your current password? Send a reset link to your email",
    sendingResetLink: 'Sending…',
    resetLinkSentToast: 'A reset link has been sent to your email',
    passwordUpdated: 'Password updated successfully ✓',
    passwordMismatch: 'New passwords do not match.',
    termsTitle: 'Terms & Conditions',
    termsAccepted: (date: string) => `You accepted our Terms & Conditions on ${date}`,
    termsNotAccepted: "You haven't accepted our Terms & Conditions yet.",
    termsViewLink: 'View the full Terms & Conditions',
  },
  fr: {
    title: 'Account Settings',
    back: '← Back to Dashboard',
    profileTitle: 'Profile',
    avatarChange: 'Change Photo',
    avatarUploading: 'Uploading…',
    avatarError: 'Unable to upload the image.',
    avatarHint: 'Max 10 MB (JPG, PNG, WEBP)',
    cvTitle: 'CV / Resume',
    cvHint: 'Upload your CV — shown on gig/vacancy applications and your profile.',
    cvUpload: 'Upload CV',
    cvReplace: 'Replace CV',
    cvUploading: 'Uploading…',
    cvView: 'View CV',
    cvUploadError: 'Unable to upload the file.',
    intentTitle: 'Dashboard Focus',
    intentHint: "This only decides which shortcut appears first on your dashboard — it never restricts what you can do.",
    intentTalent: 'Freelancing',
    intentEmployer: 'Hiring / Business',
    intentSaved: 'Saved ✓',
    displayName: 'Display Name',
    bio: 'Bio / Headline',
    bioPlaceholder: 'Tell us a bit about yourself...',
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
    skillsTitle: 'My Skills',
    skillsHint: 'Select your skills — you can get them AI-verified on the "Skill Verification" page.',
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
    forgotCurrentPassword: "Forgot your current password? Send a reset link to your email",
    sendingResetLink: 'Sending…',
    resetLinkSentToast: 'A reset link has been sent to your email',
    passwordUpdated: 'Password updated successfully ✓',
    passwordMismatch: 'New passwords do not match.',
    termsTitle: 'Terms & Conditions',
    termsAccepted: (date: string) => `You accepted our Terms & Conditions on ${date}`,
    termsNotAccepted: "You haven't accepted our Terms & Conditions yet.",
    termsViewLink: 'View the full Terms & Conditions',
  },
  uk: {
    title: 'Account Settings',
    back: '← Back to Dashboard',
    profileTitle: 'Profile',
    avatarChange: 'Change Photo',
    avatarUploading: 'Uploading…',
    avatarError: 'Unable to upload the image.',
    avatarHint: 'Max 10 MB (JPG, PNG, WEBP)',
    cvTitle: 'CV / Resume',
    cvHint: 'Upload your CV — shown on gig/vacancy applications and your profile.',
    cvUpload: 'Upload CV',
    cvReplace: 'Replace CV',
    cvUploading: 'Uploading…',
    cvView: 'View CV',
    cvUploadError: 'Unable to upload the file.',
    intentTitle: 'Dashboard Focus',
    intentHint: "This only decides which shortcut appears first on your dashboard — it never restricts what you can do.",
    intentTalent: 'Freelancing',
    intentEmployer: 'Hiring / Business',
    intentSaved: 'Saved ✓',
    displayName: 'Display Name',
    bio: 'Bio / Headline',
    bioPlaceholder: 'Tell us a bit about yourself...',
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
    skillsTitle: 'My Skills',
    skillsHint: 'Select your skills — you can get them AI-verified on the "Skill Verification" page.',
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
    forgotCurrentPassword: "Forgot your current password? Send a reset link to your email",
    sendingResetLink: 'Sending…',
    resetLinkSentToast: 'A reset link has been sent to your email',
    passwordUpdated: 'Password updated successfully ✓',
    passwordMismatch: 'New passwords do not match.',
    termsTitle: 'Terms & Conditions',
    termsAccepted: (date: string) => `You accepted our Terms & Conditions on ${date}`,
    termsNotAccepted: "You haven't accepted our Terms & Conditions yet.",
    termsViewLink: 'View the full Terms & Conditions',
  },
};

const inputClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';
const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5';

function SettingsContent() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const { user, refreshUser } = useAuth();

  const [form, setForm] = useState({
    name: '',
    bio: '',
    legalFirstNameKa: '',
    legalLastNameKa: '',
    legalFirstNameEn: '',
    legalLastNameEn: '',
    nationalId: '',
    phone: '',
    payoutIban: '',
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [sizeToast, setSizeToast] = useState<string | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const [uploadingCv, setUploadingCv] = useState(false);
  const [cvError, setCvError] = useState<string | null>(null);
  const cvFileInputRef = useRef<HTMLInputElement>(null);

  const [savingIntent, setSavingIntent] = useState(false);
  const [intentSaved, setIntentSaved] = useState(false);

  useEffect(() => {
    if (!sizeToast) return;
    const timer = setTimeout(() => setSizeToast(null), 5000);
    return () => clearTimeout(timer);
  }, [sizeToast]);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [sendingResetLink, setSendingResetLink] = useState(false);
  const [resetLinkToast, setResetLinkToast] = useState<string | null>(null);

  useEffect(() => {
    if (!resetLinkToast) return;
    const timer = setTimeout(() => setResetLinkToast(null), 5000);
    return () => clearTimeout(timer);
  }, [resetLinkToast]);

  useEffect(() => {
    if (!user) return;
    setForm({
      name: user.name ?? '',
      bio: user.bio ?? '',
      legalFirstNameKa: user.legalFirstNameKa ?? '',
      legalLastNameKa: user.legalLastNameKa ?? '',
      legalFirstNameEn: user.legalFirstNameEn ?? '',
      legalLastNameEn: user.legalLastNameEn ?? '',
      nationalId: user.nationalId ?? '',
      phone: user.phone ?? '',
      payoutIban: user.payoutIban ?? '',
    });
    setSkills(user.freelancerSkills ?? []);
  }, [user]);

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isImageTooLarge(file)) {
      setSizeToast(IMAGE_SIZE_ERROR[lang]);
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
      return;
    }
    setUploadingAvatar(true);
    setAvatarError(null);
    try {
      await uploadAvatar(file);
      await refreshUser();
    } catch (err: any) {
      setAvatarError(err?.response?.data?.message ?? t.avatarError);
    } finally {
      setUploadingAvatar(false);
      if (avatarFileInputRef.current) avatarFileInputRef.current.value = '';
    }
  };

  const handleCvFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCv(true);
    setCvError(null);
    try {
      await uploadCv(file);
      await refreshUser();
    } catch (err: any) {
      setCvError(err?.response?.data?.message ?? t.cvUploadError);
    } finally {
      setUploadingCv(false);
      if (cvFileInputRef.current) cvFileInputRef.current.value = '';
    }
  };

  const handleIntentChange = async (intent: 'TALENT' | 'EMPLOYER') => {
    if (savingIntent || user?.primaryIntent === intent) return;
    setSavingIntent(true);
    setIntentSaved(false);
    try {
      await updateProfile({ primaryIntent: intent });
      await refreshUser();
      setIntentSaved(true);
    } finally {
      setSavingIntent(false);
    }
  };

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSaved(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      await updateProfile({
        name: form.name,
        bio: form.bio || null,
        legalFirstNameKa: form.legalFirstNameKa || null,
        legalLastNameKa: form.legalLastNameKa || null,
        legalFirstNameEn: form.legalFirstNameEn || null,
        legalLastNameEn: form.legalLastNameEn || null,
        nationalId: form.nationalId || null,
        phone: form.phone || null,
        payoutIban: form.payoutIban || null,
        freelancerSkills: skills,
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

  const handleSendResetLink = async () => {
    if (!user?.email || sendingResetLink) return;
    setSendingResetLink(true);
    try {
      // The reset-link email only has 'ka'/'en' templates.
      await forgotPassword({ email: user.email, lang: lang === 'ka' ? 'ka' : 'en' });
      setResetLinkToast(t.resetLinkSentToast);
    } catch {
      // Same fail-soft posture as the rest of this page's error handling —
      // the backend already responds 200 regardless of outcome to avoid
      // leaking account existence, so a thrown error here is a genuine
      // network/server issue, not "email not found".
      setResetLinkToast(t.resetLinkSentToast);
    } finally {
      setSendingResetLink(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
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
          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-4">
            <h2 className="text-sm font-bold">{t.profileTitle}</h2>

            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xl font-black text-slate-400">{(user?.name ?? '?').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <label className="inline-flex items-center gap-2 justify-center px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800">
                  <Upload className="w-4 h-4" />
                  {uploadingAvatar ? t.avatarUploading : t.avatarChange}
                  <input
                    ref={avatarFileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    className="hidden"
                    disabled={uploadingAvatar}
                  />
                </label>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{t.avatarHint}</p>
                {avatarError && <p className="text-xs text-red-600 mt-1.5">{avatarError}</p>}
              </div>
            </div>

            <div>
              <label className={labelClass}>{t.cvTitle}</label>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">{t.cvHint}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800">
                  <Upload className="w-4 h-4" />
                  {uploadingCv ? t.cvUploading : user?.cvUrl ? t.cvReplace : t.cvUpload}
                  <input
                    ref={cvFileInputRef}
                    type="file"
                    accept="application/pdf,.doc,.docx"
                    onChange={handleCvFileChange}
                    className="hidden"
                    disabled={uploadingCv}
                  />
                </label>
                {user?.cvUrl && (
                  <a
                    href={user.cvUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {t.cvView}
                  </a>
                )}
              </div>
              {cvError && <p className="text-xs text-red-600 mt-1.5">{cvError}</p>}
            </div>

            <div>
              <label className={labelClass}>{t.displayName}</label>
              <input className={inputClass} value={form.name} onChange={handleChange('name')} />
            </div>

            <div>
              <label className={labelClass}>{t.bio}</label>
              <textarea rows={3} className={inputClass} value={form.bio} onChange={handleChange('bio')} placeholder={t.bioPlaceholder} maxLength={300} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-4">
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

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-4">
            <div>
              <h2 className="text-sm font-bold mb-1">{t.skillsTitle}</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.skillsHint}</p>
            </div>
            <SkillPicker value={skills} onChange={setSkills} lang={lang} />
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-4">
            <div>
              <h2 className="text-sm font-bold mb-1">{t.intentTitle}</h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.intentHint}</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {(
                [
                  { value: 'TALENT' as const, label: t.intentTalent, icon: Briefcase },
                  { value: 'EMPLOYER' as const, label: t.intentEmployer, icon: Building2 },
                ]
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={savingIntent}
                  onClick={() => handleIntentChange(option.value)}
                  className={`flex items-center gap-2.5 rounded-xl border p-3.5 text-left text-sm font-bold transition-colors disabled:opacity-60 ${
                    user?.primaryIntent === option.value
                      ? 'border-cyan-500 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-400'
                  }`}
                >
                  <option.icon className="w-4 h-4 shrink-0" />
                  {option.label}
                </button>
              ))}
            </div>
            {intentSaved && <p className="text-xs text-emerald-600 dark:text-emerald-400">{t.intentSaved}</p>}
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-4">
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

        <form onSubmit={handlePasswordSubmit} className="mt-10 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-sm font-bold">{t.passwordTitle}</h2>
            <button
              type="button"
              onClick={handleSendResetLink}
              disabled={sendingResetLink}
              className="text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:underline bg-transparent border-none p-0 cursor-pointer disabled:opacity-60"
            >
              {sendingResetLink ? t.sendingResetLink : t.forgotCurrentPassword}
            </button>
          </div>
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

        <div className="mt-10 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 p-6 space-y-3">
          <h2 className="text-sm font-bold">{t.termsTitle}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {user?.termsAcceptedAt ? t.termsAccepted(new Date(user.termsAcceptedAt).toLocaleDateString()) : t.termsNotAccepted}
          </p>
          <Link href="/terms" target="_blank" className="inline-block text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline">
            {t.termsViewLink} →
          </Link>
        </div>
      </div>

      <SiteFooter />
      {sizeToast && <Toast message={sizeToast} icon="⚠️" />}
      {resetLinkToast && <Toast message={resetLinkToast} icon="✅" />}
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
