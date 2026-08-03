import { useState, useEffect, useCallback, useRef, ChangeEvent, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import {
  Building2,
  Briefcase,
  ClipboardList,
  LayoutDashboard,
  Plus,
  Pencil,
  Eye,
  Globe,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Star,
  Upload,
  X,
  FileText,
  ShieldCheck,
  ShieldAlert,
  ShieldQuestion,
} from 'lucide-react';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import { useAuth } from '../../src/context/AuthContext';
import { useEscapeToClose } from '../../src/hooks/useEscapeToClose';
import { updateProfile, uploadAvatar, uploadVerificationDoc } from '../../src/services/authService';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../src/utils/imageUpload';
import Toast from '../../src/components/shared/Toast';
import { getVerificationStatus, VerificationStatus } from '../../src/types/auth';
import { MyGig } from '../../src/types/community';
import { getMyGigs, approveGigWork, openGigDispute } from '../../src/services/gigService';
import { createReview } from '../../src/services/reviewService';
import { checkoutGigEscrow } from '../../src/services/paymentService';
import { MyVacancy, EmploymentType, VacancyStatus } from '../../src/types/community';
import { getMyVacancies, updateVacancy, UpdateVacancyPayload } from '../../src/services/vacancyService';

type Tab = 'overview' | 'profile' | 'vacancies' | 'orders';

const dict = {
  ka: {
    title: 'ბიზნეს პანელი',
    subtitle: 'თქვენი კომპანიის პროფილი, ვაკანსიები და გარიგებები — ერთ სივრცეში.',
    tabOverview: 'მიმოხილვა',
    tabProfile: 'კომპანიის პროფილი',
    tabVacancies: 'ვაკანსიები',
    tabOrders: 'გარიგებები & შეთავაზებები',
    tabAgent: 'AI აგენტი',
    agentComingSoon: 'მალე — ხელოვნური ინტელექტის აგენტების მართვა თქვენი ბიზნესისთვის.',
    loading: 'იტვირთება…',
    // Overview
    statVacancies: 'აქტიური ვაკანსია',
    statApplicants: 'განმცხადებელი',
    statGigs: 'აქტიური გარიგება',
    statPending: 'გადასახედი',
    // Profile
    logoChange: 'ლოგოს შეცვლა',
    uploading: 'იტვირთება…',
    uploadError: 'ატვირთვა ვერ მოხერხდა.',
    uploadHint: 'მაქსიმუმ 10 MB (JPG, PNG, WEBP)',
    companyName: 'კომპანიის დასახელება',
    industry: 'ინდუსტრია',
    website: 'ვებსაიტი',
    description: 'აღწერა',
    descriptionPlaceholder: 'მოკლედ მოგვიყევით კომპანიაზე...',
    contactTitle: 'საკონტაქტო პირი',
    contactName: 'სახელი',
    contactEmail: 'ელ. ფოსტა',
    contactPhone: 'ტელეფონი',
    save: 'შენახვა',
    saving: 'ინახება…',
    saved: 'შენახულია ✓',
    // KYC verification
    kycTitle: 'ბიზნესის ვერიფიკაცია',
    kycHint: 'ატვირთეთ საჯარო რეესტრის ამონაწერი ან კომპანიის რეგისტრაციის დოკუმენტი (PDF, JPG, PNG ან WEBP, მაქს. 10MB).',
    taxId: 'საიდენტიფიკაციო კოდი (ს/კ)',
    kycUpload: 'დოკუმენტის ატვირთვა',
    kycReplace: 'დოკუმენტის შეცვლა',
    kycUploading: 'იტვირთება…',
    docUploadError: 'დოკუმენტის ატვირთვა ვერ მოხერხდა.',
    kycViewDoc: 'ატვირთული დოკუმენტის ნახვა',
    statusUnverified: 'მოითხოვს ვერიფიკაციას',
    statusUnderReview: 'განხილვის პროცესშია',
    statusVerified: 'დადასტურებული ბიზნესი',
    // Vacancies
    postVacancy: '+ ვაკანსიის გამოქვეყნება',
    noVacancies: 'ვაკანსიები ჯერ არ არის.',
    statusAll: 'ყველა',
    statusActive: 'აქტიური',
    statusClosed: 'დახურული',
    statusDraft: 'დრაფტი',
    applicants: 'განმცხადებელი',
    viewApplicants: 'განაცხადების ნახვა',
    edit: 'რედაქტირება',
    publish: 'გამოქვეყნება',
    close: 'დახურვა',
    reopen: 'ხელახლა გახსნა',
    editVacancyTitle: 'ვაკანსიის რედაქტირება',
    cancel: 'გაუქმება',
    // Orders
    postGig: '+ გიგის გამოქვეყნება',
    noGigs: 'გარიგებები ჯერ არ არის.',
    budget: 'ბიუჯეტი',
    fundEscrow: 'ესქროუს დაფინანსება',
    approveWork: 'სამუშაოს დამტკიცება',
    leaveReview: 'შეფასების დატოვება',
    reviewed: 'შეფასებულია ✓',
    openDispute: 'დავის გახსნა',
    disputeReasonPrompt: 'აღწერეთ დავის მიზეზი (მინ. 10 სიმბოლო):',
    disputeOpened: 'დავა გაიხსნა.',
    reviewModalTitle: 'შეაფასეთ ფრილანსერი',
    rating: 'შეფასება',
    comment: 'კომენტარი',
    submitReview: 'გაგზავნა',
    submitting: 'იგზავნება…',
  },
  en: {
    title: 'Business Dashboard',
    subtitle: 'Your company profile, vacancies, and orders — all in one place.',
    tabOverview: 'Overview',
    tabProfile: 'Company Profile',
    tabVacancies: 'Vacancies',
    tabOrders: 'Orders & Proposals',
    tabAgent: 'AI Agent',
    agentComingSoon: 'Coming soon — manage AI agents for your business.',
    loading: 'Loading…',
    statVacancies: 'Active Vacancies',
    statApplicants: 'Applicants',
    statGigs: 'Active Gigs',
    statPending: 'Needs Review',
    logoChange: 'Change Logo',
    uploading: 'Uploading…',
    uploadError: 'Unable to upload the image.',
    uploadHint: 'Max 10 MB (JPG, PNG, WEBP)',
    companyName: 'Company Name',
    industry: 'Industry',
    website: 'Website',
    description: 'Description',
    descriptionPlaceholder: 'Tell us a bit about your company...',
    contactTitle: 'Contact Person',
    contactName: 'Name',
    contactEmail: 'Email',
    contactPhone: 'Phone',
    save: 'Save Changes',
    saving: 'Saving…',
    saved: 'Saved ✓',
    // KYC verification
    kycTitle: 'Business Verification',
    kycHint: 'Upload a Public Registry Extract or company registration document (PDF, JPG, PNG, or WEBP, max 10MB).',
    taxId: 'Identification Code (ს/კ)',
    kycUpload: 'Upload Document',
    kycReplace: 'Replace Document',
    kycUploading: 'Uploading…',
    docUploadError: 'Unable to upload the document.',
    kycViewDoc: 'View Uploaded Document',
    statusUnverified: 'Unverified',
    statusUnderReview: 'Under Review',
    statusVerified: 'Verified Business',
    postVacancy: '+ Post a Vacancy',
    noVacancies: "You haven't posted any vacancies yet.",
    statusAll: 'All',
    statusActive: 'Active',
    statusClosed: 'Closed',
    statusDraft: 'Draft',
    applicants: 'applicants',
    viewApplicants: 'View Applicants',
    edit: 'Edit',
    publish: 'Publish',
    close: 'Close',
    reopen: 'Reopen',
    editVacancyTitle: 'Edit Vacancy',
    cancel: 'Cancel',
    postGig: '+ Post a Gig',
    noGigs: "You haven't posted any gigs yet.",
    budget: 'Budget',
    fundEscrow: 'Fund Escrow',
    approveWork: 'Approve Delivered Work',
    leaveReview: 'Leave a Review',
    reviewed: 'Reviewed ✓',
    openDispute: 'Open Dispute',
    disputeReasonPrompt: 'Describe the reason for the dispute (min. 10 characters):',
    disputeOpened: 'Dispute opened.',
    reviewModalTitle: 'Rate the Freelancer',
    rating: 'Rating',
    comment: 'Comment',
    submitReview: 'Submit',
    submitting: 'Submitting…',
  },
};

const VACANCY_STATUS_BADGE: Record<VacancyStatus, string> = {
  open: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  closed: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
  filled: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  draft: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
};

const GIG_STATUS_BADGE: Record<string, string> = {
  open: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30',
  assigned: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30',
  submitted: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
  completed: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
  cancelled: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30',
};

function formatMoney(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)} ${currency === 'GEL' ? '₾' : currency}`;
}

const inputClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';
const labelClass = 'block text-xs font-bold text-slate-600 dark:text-slate-400 mb-1.5';

function VerificationBadge({ status, t }: { status: VerificationStatus; t: typeof dict.ka }) {
  const config = {
    verified: { icon: ShieldCheck, label: t.statusVerified, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' },
    under_review: { icon: ShieldQuestion, label: t.statusUnderReview, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30' },
    unverified: { icon: ShieldAlert, label: t.statusUnverified, className: 'bg-slate-500/10 text-slate-500 dark:text-slate-400 border-slate-500/30' },
  }[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${config.className}`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  );
}

interface VacancyEditModalProps {
  vacancy: MyVacancy;
  lang: 'ka' | 'en';
  onClose: () => void;
  onSaved: (updated: MyVacancy) => void;
}

function VacancyEditModal({ vacancy, lang, onClose, onSaved }: VacancyEditModalProps) {
  const t = dict[lang];
  useEscapeToClose(true, onClose);
  const [form, setForm] = useState({
    title: vacancy.title,
    description: vacancy.description,
    employmentType: vacancy.employmentType,
    location: vacancy.location,
    skillsRequired: vacancy.skillsRequired.join(', '),
    salaryMin: vacancy.salaryMin ? String(vacancy.salaryMin / 100) : '',
    salaryMax: vacancy.salaryMax ? String(vacancy.salaryMax / 100) : '',
    currency: vacancy.currency ?? 'GEL',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: UpdateVacancyPayload = {
        title: form.title.trim(),
        description: form.description.trim(),
        employmentType: form.employmentType,
        location: form.location.trim(),
        skillsRequired: form.skillsRequired.split(',').map((s) => s.trim()).filter(Boolean),
        salaryMin: form.salaryMin ? Math.round(parseFloat(form.salaryMin) * 100) : null,
        salaryMax: form.salaryMax ? Math.round(parseFloat(form.salaryMax) * 100) : null,
        currency: form.salaryMin || form.salaryMax ? form.currency : null,
      };
      const updated = await updateVacancy(vacancy.id, payload);
      onSaved({ ...updated, _count: vacancy._count });
    } catch {
      setError(lang === 'ka' ? 'შენახვა ვერ მოხერხდა.' : 'Unable to save changes.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] px-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{t.editVacancyTitle}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white bg-transparent border-none cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input className={inputClass} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea rows={4} className={inputClass} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Employment Type</label>
              <select className={inputClass} value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as EmploymentType })}>
                <option value="full_time">Full-time</option>
                <option value="part_time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Location</label>
              <input className={inputClass} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Skills (comma-separated)</label>
            <input className={inputClass} value={form.skillsRequired} onChange={(e) => setForm({ ...form, skillsRequired: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className={labelClass}>Min Salary</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={form.salaryMin} onChange={(e) => setForm({ ...form, salaryMin: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Max Salary</label>
              <input type="number" min="0" step="0.01" className={inputClass} value={form.salaryMax} onChange={(e) => setForm({ ...form, salaryMax: e.target.value })} />
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <select className={inputClass} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                <option value="GEL">GEL</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300">
              {t.cancel}
            </button>
            <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
              {saving ? t.saving : t.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface ReviewModalProps {
  lang: 'ka' | 'en';
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => Promise<void>;
}

function ReviewModal({ lang, onClose, onSubmit }: ReviewModalProps) {
  const t = dict[lang];
  useEscapeToClose(true, onClose);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(rating, comment);
    } catch {
      setError(lang === 'ka' ? 'შეფასების გაგზავნა ვერ მოხერხდა.' : 'Unable to submit the review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] px-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-black text-slate-900 dark:text-white">{t.reviewModalTitle}</h2>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white bg-transparent border-none cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        {error && <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>{t.rating}</label>
            <div className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="p-1 bg-transparent border-none cursor-pointer"
                >
                  <Star className={`w-7 h-7 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-700'}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>{t.comment}</label>
            <textarea required minLength={10} rows={4} className={inputClass} value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <button type="submit" disabled={submitting} className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
            {submitting ? t.submitting : t.submitReview}
          </button>
        </form>
      </div>
    </div>
  );
}

function BusinessDashboardContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { user, refreshUser } = useAuth();

  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [vacancies, setVacancies] = useState<MyVacancy[]>([]);
  const [gigs, setGigs] = useState<MyGig[]>([]);
  const [vacancyStatusFilter, setVacancyStatusFilter] = useState<'all' | VacancyStatus>('all');
  const [editingVacancy, setEditingVacancy] = useState<MyVacancy | null>(null);
  const [vacancyBusyId, setVacancyBusyId] = useState<string | null>(null);

  const [gigBusyId, setGigBusyId] = useState<string | null>(null);
  const [reviewingGigId, setReviewingGigId] = useState<string | null>(null);
  const [reviewedGigIds, setReviewedGigIds] = useState<Set<string>>(new Set());
  const [gigActionError, setGigActionError] = useState<string | null>(null);

  // --- Company Profile form ---
  const [form, setForm] = useState({
    companyName: '',
    industry: '',
    websiteUrl: '',
    companyDescription: '',
    name: '',
    phone: '',
    taxId: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [sizeToast, setSizeToast] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!sizeToast) return;
    const timer = setTimeout(() => setSizeToast(null), 5000);
    return () => clearTimeout(timer);
  }, [sizeToast]);

  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Business routes are strictly for the Client role (mirrors the
    // backend's requireRole('Client', 'SuperAdmin') on the write endpoints)
    // — any other role gets bounced to their own dashboard.
    if (user && user.role !== 'Client' && user.role !== 'SuperAdmin') {
      router.replace('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (!user) return;
    setForm({
      companyName: user.companyName ?? '',
      industry: user.industry ?? '',
      websiteUrl: user.websiteUrl ?? '',
      companyDescription: user.companyDescription ?? '',
      name: user.name ?? '',
      phone: user.phone ?? '',
      taxId: user.taxId ?? '',
    });
  }, [user]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [vacancyData, gigData] = await Promise.all([getMyVacancies(), getMyGigs()]);
      setVacancies(vacancyData);
      setGigs(gigData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleLogoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isImageTooLarge(file)) {
      setSizeToast(IMAGE_SIZE_ERROR[lang]);
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }
    setUploadingLogo(true);
    setLogoError(null);
    try {
      await uploadAvatar(file);
      await refreshUser();
    } catch (err: any) {
      setLogoError(err?.response?.data?.message ?? t.uploadError);
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleDocChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    setDocError(null);
    try {
      await uploadVerificationDoc(file);
      await refreshUser();
    } catch (err: any) {
      setDocError(err?.response?.data?.message ?? t.docUploadError);
    } finally {
      setUploadingDoc(false);
      if (docInputRef.current) docInputRef.current.value = '';
    }
  };

  const handleProfileSave = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateProfile({
        name: form.name,
        phone: form.phone || null,
        companyName: form.companyName || null,
        industry: form.industry || null,
        websiteUrl: form.websiteUrl || null,
        companyDescription: form.companyDescription || null,
        taxId: form.taxId || null,
      });
      await refreshUser();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const handleVacancyStatusChange = async (vacancy: MyVacancy, status: VacancyStatus) => {
    setVacancyBusyId(vacancy.id);
    try {
      const updated = await updateVacancy(vacancy.id, { status });
      setVacancies((prev) => prev.map((v) => (v.id === vacancy.id ? { ...v, ...updated } : v)));
    } finally {
      setVacancyBusyId(null);
    }
  };

  const handleApproveWork = async (gigId: string) => {
    setGigBusyId(gigId);
    setGigActionError(null);
    try {
      const result = await approveGigWork(gigId);
      setGigs((prev) => prev.map((g) => (g.id === gigId ? { ...g, status: result.gig.status } : g)));
    } catch {
      setGigActionError(lang === 'ka' ? 'დამტკიცება ვერ მოხერხდა.' : 'Unable to approve this work.');
    } finally {
      setGigBusyId(null);
    }
  };

  const handleFundEscrow = async (gigId: string) => {
    setGigBusyId(gigId);
    setGigActionError(null);
    try {
      const { redirectUrl } = await checkoutGigEscrow(gigId);
      window.location.href = redirectUrl;
    } catch (err: any) {
      const serverMessage = err?.response?.data?.message;
      setGigActionError(serverMessage || (lang === 'ka' ? 'გადახდის დაწყება ვერ მოხერხდა.' : 'Unable to start payment.'));
      setGigBusyId(null);
    }
  };

  const handleOpenDispute = async (gigId: string) => {
    const reason = window.prompt(t.disputeReasonPrompt);
    if (!reason || reason.trim().length < 10) return;
    setGigBusyId(gigId);
    setGigActionError(null);
    try {
      await openGigDispute(gigId, reason.trim());
      window.alert(t.disputeOpened);
    } catch {
      setGigActionError(lang === 'ka' ? 'დავის გახსნა ვერ მოხერხდა.' : 'Unable to open a dispute.');
    } finally {
      setGigBusyId(null);
    }
  };

  const handleSubmitReview = async (gigId: string, rating: number, comment: string) => {
    await createReview({ gigId, rating, comment });
    setReviewedGigIds((prev) => new Set(prev).add(gigId));
    setReviewingGigId(null);
  };

  const filteredVacancies = vacancies.filter((v) => vacancyStatusFilter === 'all' || v.status === vacancyStatusFilter);
  const activeVacancyCount = vacancies.filter((v) => v.status === 'open').length;
  const totalApplicants = vacancies.reduce((sum, v) => sum + v._count.applications, 0);
  const activeGigCount = gigs.filter((g) => g.status === 'assigned' || g.status === 'submitted').length;
  const pendingReviewCount = gigs.filter((g) => g.status === 'submitted').length;

  const NAV: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { key: 'overview', label: t.tabOverview, icon: LayoutDashboard },
    { key: 'profile', label: t.tabProfile, icon: Building2 },
    { key: 'vacancies', label: t.tabVacancies, icon: Briefcase },
    { key: 'orders', label: t.tabOrders, icon: ClipboardList },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>

      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>
        <div className="mb-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-black flex items-center gap-2">
              <Building2 className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />
              {t.title}
            </h1>
            {user && <VerificationBadge status={getVerificationStatus(user)} t={t} />}
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-4 gap-6 md:gap-8">
          {/* SIDE MENU */}
          <div className="space-y-2 md:sticky md:top-24 self-start">
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  className={`w-full flex items-center gap-2.5 text-left p-3.5 rounded-xl text-xs font-bold transition border ${
                    activeTab === item.key
                      ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent shadow-sm'
                      : 'bg-white dark:bg-slate-900/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* CONTENT */}
          <div className="md:col-span-3 space-y-6">
            {loading ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t.loading}</p>
            ) : (
              <>
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: t.statVacancies, value: String(activeVacancyCount), color: 'text-cyan-600 dark:text-cyan-400' },
                      { label: t.statApplicants, value: String(totalApplicants), color: 'text-purple-600 dark:text-purple-400' },
                      { label: t.statGigs, value: String(activeGigCount), color: 'text-emerald-600 dark:text-emerald-400' },
                      { label: t.statPending, value: String(pendingReviewCount), color: 'text-amber-600 dark:text-amber-400' },
                    ].map((stat) => (
                      <div key={stat.label} className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5">
                        <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-1">{stat.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'profile' && (
                  <form onSubmit={handleProfileSave} className="space-y-6">
                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-4">
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shrink-0 flex items-center justify-center">
                          {user?.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={user.avatarUrl} alt={user.companyName ?? user.name} className="w-full h-full object-cover" />
                          ) : (
                            <Building2 className="w-7 h-7 text-slate-400" />
                          )}
                        </div>
                        <div>
                          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800">
                            <Upload className="w-4 h-4" />
                            {uploadingLogo ? t.uploading : t.logoChange}
                            <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" disabled={uploadingLogo} />
                          </label>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{t.uploadHint}</p>
                          {logoError && <p className="text-xs text-red-600 mt-1.5">{logoError}</p>}
                        </div>
                      </div>

                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>{t.companyName}</label>
                          <input className={inputClass} value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
                        </div>
                        <div>
                          <label className={labelClass}>{t.industry}</label>
                          <input className={inputClass} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
                        </div>
                      </div>

                      <div>
                        <label className={labelClass}>{t.website}</label>
                        <input type="url" placeholder="https://" className={inputClass} value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} />
                      </div>

                      <div>
                        <label className={labelClass}>{t.description}</label>
                        <textarea rows={4} className={inputClass} value={form.companyDescription} onChange={(e) => setForm({ ...form, companyDescription: e.target.value })} placeholder={t.descriptionPlaceholder} maxLength={2000} />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-4">
                      <h2 className="text-sm font-bold">{t.contactTitle}</h2>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label className={labelClass}>{t.contactName}</label>
                          <input className={inputClass} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                        </div>
                        <div>
                          <label className={labelClass}>{t.contactPhone}</label>
                          <input className={inputClass} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className={labelClass}>{t.contactEmail}</label>
                        <input className={`${inputClass} opacity-60 cursor-not-allowed`} value={user?.email ?? ''} disabled />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-6 space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-sm font-bold">{t.kycTitle}</h2>
                        {user && <VerificationBadge status={getVerificationStatus(user)} t={t} />}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.kycHint}</p>

                      <div>
                        <label className={labelClass}>{t.taxId}</label>
                        <input className={inputClass} value={form.taxId} onChange={(e) => setForm({ ...form, taxId: e.target.value })} placeholder="123456789" />
                      </div>

                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800">
                          <FileText className="w-4 h-4" />
                          {uploadingDoc ? t.kycUploading : user?.verificationDocUrl ? t.kycReplace : t.kycUpload}
                          <input
                            ref={docInputRef}
                            type="file"
                            accept="application/pdf,image/jpeg,image/png,image/webp"
                            onChange={handleDocChange}
                            className="hidden"
                            disabled={uploadingDoc}
                          />
                        </label>
                        {user?.verificationDocUrl && (
                          <a href={user.verificationDocUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:underline">
                            {t.kycViewDoc}
                          </a>
                        )}
                      </div>
                      {docError && <p className="text-xs text-red-600">{docError}</p>}
                    </div>

                    <button type="submit" disabled={saving} className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-3 text-sm font-bold text-white disabled:opacity-60">
                      {saving ? t.saving : saved ? t.saved : t.save}
                    </button>
                  </form>
                )}

                {activeTab === 'vacancies' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {(['all', 'open', 'closed', 'draft'] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setVacancyStatusFilter(s)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                              vacancyStatusFilter === s ? 'bg-slate-900 dark:bg-cyan-600 text-white border-transparent' : 'bg-white dark:bg-slate-900/60 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {s === 'all' ? t.statusAll : s === 'open' ? t.statusActive : s === 'closed' ? t.statusClosed : t.statusDraft}
                          </button>
                        ))}
                      </div>
                      <Link
                        href="/vacancies/post"
                        className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl no-underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t.postVacancy}
                      </Link>
                    </div>

                    {filteredVacancies.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.noVacancies}</p>
                    ) : (
                      <div className="space-y-3">
                        {filteredVacancies.map((v) => (
                          <div key={v.id} className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-slate-900 dark:text-white">{v.title}</span>
                                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${VACANCY_STATUS_BADGE[v.status]}`}>{v.status}</span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
                                  <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{v.location}</span>
                                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{v._count.applications} {t.applicants}</span>
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                              <Link
                                href={`/vacancies/${v.id}/applications`}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {t.viewApplicants}
                              </Link>
                              <button
                                type="button"
                                onClick={() => setEditingVacancy(v)}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                {t.edit}
                              </button>
                              {v.status === 'draft' && (
                                <button
                                  type="button"
                                  disabled={vacancyBusyId === v.id}
                                  onClick={() => handleVacancyStatusChange(v, 'open')}
                                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-60"
                                >
                                  {t.publish}
                                </button>
                              )}
                              {v.status === 'open' && (
                                <button
                                  type="button"
                                  disabled={vacancyBusyId === v.id}
                                  onClick={() => handleVacancyStatusChange(v, 'closed')}
                                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-60"
                                >
                                  {t.close}
                                </button>
                              )}
                              {v.status === 'closed' && (
                                <button
                                  type="button"
                                  disabled={vacancyBusyId === v.id}
                                  onClick={() => handleVacancyStatusChange(v, 'open')}
                                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 disabled:opacity-60"
                                >
                                  {t.reopen}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div className="space-y-4">
                    <div className="flex justify-end">
                      <Link
                        href="/gigs/post"
                        className="inline-flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl no-underline"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t.postGig}
                      </Link>
                    </div>

                    {gigActionError && (
                      <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">{gigActionError}</div>
                    )}

                    {gigs.length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t.noGigs}</p>
                    ) : (
                      <div className="space-y-3">
                        {gigs.map((gig) => (
                          <div key={gig.id} className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                            <div className="flex items-start justify-between gap-3 mb-3">
                              <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">{gig.title}</h3>
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                  {gig.applicationsCount} {t.applicants} · {t.budget}: {formatMoney(gig.budgetAmount, gig.currency)}
                                  {gig.budgetType === 'hourly' ? '/hr' : ''}
                                </p>
                              </div>
                              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${GIG_STATUS_BADGE[gig.status]}`}>{gig.status}</span>
                            </div>

                            {gig.transaction && (
                              <div className="rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 p-3 mb-3 grid grid-cols-3 gap-3 text-xs">
                                <div>
                                  <p className="text-slate-500">{lang === 'ka' ? 'სრული თანხა' : 'Gross'}</p>
                                  <p className="font-bold text-slate-900 dark:text-white">{formatMoney(gig.transaction.grossAmount, gig.transaction.currency)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">{lang === 'ka' ? 'საკომისიო' : 'Commission'}</p>
                                  <p className="font-bold text-slate-900 dark:text-white">{formatMoney(gig.transaction.commissionAmount, gig.transaction.currency)}</p>
                                </div>
                                <div>
                                  <p className="text-slate-500">{gig.transaction.status}</p>
                                  <p className="font-bold text-slate-900 dark:text-white">{formatMoney(gig.transaction.netAmount, gig.transaction.currency)}</p>
                                </div>
                              </div>
                            )}

                            <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                              <Link
                                href={`/gigs/${gig.id}/applications`}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 no-underline hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                {t.viewApplicants}
                              </Link>

                              {gig.status === 'assigned' && !gig.transaction && (
                                <button
                                  type="button"
                                  disabled={gigBusyId === gig.id}
                                  onClick={() => handleFundEscrow(gig.id)}
                                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-600 text-white disabled:opacity-60"
                                >
                                  {t.fundEscrow}
                                </button>
                              )}

                              {gig.status === 'submitted' && (
                                <>
                                  <button
                                    type="button"
                                    disabled={gigBusyId === gig.id}
                                    onClick={() => handleApproveWork(gig.id)}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 text-white disabled:opacity-60 flex items-center gap-1.5"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {t.approveWork}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={gigBusyId === gig.id}
                                    onClick={() => handleOpenDispute(gig.id)}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 disabled:opacity-60 flex items-center gap-1.5"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    {t.openDispute}
                                  </button>
                                </>
                              )}

                              {gig.status === 'completed' && (
                                reviewedGigIds.has(gig.id) ? (
                                  <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {t.reviewed}
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setReviewingGigId(gig.id)}
                                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 text-white flex items-center gap-1.5"
                                  >
                                    <Star className="w-3.5 h-3.5" />
                                    {t.leaveReview}
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {editingVacancy && (
        <VacancyEditModal
          vacancy={editingVacancy}
          lang={lang}
          onClose={() => setEditingVacancy(null)}
          onSaved={(updated) => {
            setVacancies((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            setEditingVacancy(null);
          }}
        />
      )}

      {reviewingGigId && (
        <ReviewModal
          lang={lang}
          onClose={() => setReviewingGigId(null)}
          onSubmit={(rating, comment) => handleSubmitReview(reviewingGigId, rating, comment)}
        />
      )}

      <SiteFooter lang={lang === 'ka' ? 'GEO' : 'ENG'} />
      {sizeToast && <Toast message={sizeToast} icon="⚠️" />}
    </div>
  );
}

export default function BusinessDashboardPage() {
  return (
    <ProtectedRoute>
      <BusinessDashboardContent />
    </ProtectedRoute>
  );
}
