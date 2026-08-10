import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/router';
import { Building2, FileUp, CheckCircle2 } from 'lucide-react';
import ProtectedRoute from '../src/components/auth/ProtectedRoute';
import { useAuth } from '../src/context/AuthContext';
import { updateProfile, uploadVerificationDoc } from '../src/services/authService';

// Step 2 of registration for the "Business" sub-role picked in
// register.tsx's wizard — collects the fields Backend's businessKycService
// already knows how to auto-verify (company name + tax ID + registry
// extract), reusing the existing PUT /auth/me and POST /auth/me/
// verification-doc endpoints rather than new ones.
function OnboardingPage() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const lang = router.locale === 'en' ? 'en' : 'ka';

  const [companyName, setCompanyName] = useState(user?.companyName ?? '');
  const [taxId, setTaxId] = useState(user?.taxId ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await updateProfile({ companyName: companyName.trim() || null, taxId: taxId.trim() || null });
      if (file) {
        await uploadVerificationDoc(file);
      }
      await refreshUser();
      setDone(true);
    } catch {
      setError(
        lang === 'ka'
          ? 'რაღაც შეცდომა მოხდა. სცადეთ ხელახლა, ან შეავსეთ პროფილი პარამეტრებში მოგვიანებით.'
          : 'Something went wrong. Please try again, or finish this later from Settings.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#0b0f19] px-4">
        <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl shadow-lg shadow-slate-200/40 dark:shadow-none border border-slate-200/80 dark:border-white/10 p-8 text-center transition-colors">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          </div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
            {lang === 'ka' ? 'გმადლობთ!' : 'Thank you!'}
          </h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-6">
            {lang === 'ka'
              ? 'საჯარო რეესტრის ამონაწერი განხილვის პროცესშია. AI ინსტრუმენტები და 7-დღიანი საცდელი ვადა გააქტიურდება ადმინისტრაციის დადასტურებისთანავე.'
              : 'Your public registry extract is under review. AI tools and the 7-day trial will activate as soon as our team approves it.'}
          </p>
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm py-3 hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            {lang === 'ka' ? 'დაშბორდზე გადასვლა' : 'Go to Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#0b0f19] px-4">
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl shadow-lg shadow-slate-200/40 dark:shadow-none border border-slate-200/80 dark:border-white/10 p-8 transition-colors">
        <div className="flex items-center gap-3 mb-6">
          <span className="shrink-0 w-10 h-10 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </span>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              {lang === 'ka' ? 'ბიზნეს ვერიფიკაცია' : 'Business Verification'}
            </h1>
            <p className="text-xs text-gray-500 dark:text-slate-400">
              {lang === 'ka' ? 'დაასრულეთ ანგარიშის დადასტურება' : 'Finish verifying your account'}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {lang === 'ka' ? 'კომპანიის დასახელება' : 'Company Name'}
            </label>
            <input
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder={lang === 'ka' ? 'შპს მაგალითი' : 'Example LLC'}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {lang === 'ka' ? 'საიდენტიფიკაციო კოდი (ს/კ)' : 'Tax ID'}
            </label>
            <input
              type="text"
              required
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              className="w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              placeholder="123456789"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5">
              {lang === 'ka' ? 'საჯარო რეესტრის ამონაწერი (PDF/სურათი)' : 'Public Registry Extract (PDF/Image)'}
            </label>
            <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleFileChange} className="hidden" />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-300 dark:border-slate-700 px-4 py-4 text-sm font-medium text-gray-600 dark:text-slate-400 bg-transparent cursor-pointer hover:border-cyan-400/50 transition-colors"
            >
              <FileUp className="w-4 h-4" />
              {file ? file.name : lang === 'ka' ? 'ფაილის არჩევა' : 'Choose file'}
            </button>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold text-sm py-3 hover:shadow-lg hover:shadow-cyan-500/30 disabled:opacity-60 transition-all"
          >
            {submitting
              ? lang === 'ka' ? 'იგზავნება…' : 'Submitting…'
              : lang === 'ka' ? 'გაგზავნა' : 'Submit'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="w-full text-center text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white bg-transparent border-none cursor-pointer py-1"
          >
            {lang === 'ka' ? 'გამოტოვება — მოგვიანებით პარამეტრებში' : 'Skip — finish this later in Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function OnboardingPageWrapper() {
  return (
    <ProtectedRoute>
      <OnboardingPage />
    </ProtectedRoute>
  );
}
