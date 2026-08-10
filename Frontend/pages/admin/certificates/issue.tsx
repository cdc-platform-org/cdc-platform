import { useState, FormEvent } from 'react';
import Head from 'next/head';
import { Award, Eye, Send } from 'lucide-react';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { previewManualCertificate, issueManualCertificate } from '../../../src/services/adminPanelService';
import { ManualCertificate } from '../../../src/types/adminPanel';

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent';

const emptyForm = {
  studentNameKa: '',
  studentNameEn: '',
  studentEmail: '',
  courseTitleKa: '',
  courseTitleEn: '',
  instructorName: '',
  issueDate: new Date().toISOString().slice(0, 10),
};

function AdminIssueCertificateDashboard() {
  const [form, setForm] = useState(emptyForm);
  const [previewing, setPreviewing] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<ManualCertificate | null>(null);

  const validate = (): string | null => {
    if (form.studentNameKa.trim().length < 2) return 'Student name (KA) is required.';
    if (!/^\S+@\S+\.\S+$/.test(form.studentEmail.trim())) return 'A valid student email is required.';
    if (form.courseTitleKa.trim().length < 2) return 'Course title (KA) is required.';
    if (form.instructorName.trim().length < 2) return 'Instructor name is required.';
    if (!form.issueDate) return 'Issue date is required.';
    return null;
  };

  const buildPayload = () => ({
    studentNameKa: form.studentNameKa.trim(),
    studentNameEn: form.studentNameEn.trim() || undefined,
    studentEmail: form.studentEmail.trim(),
    courseTitleKa: form.courseTitleKa.trim(),
    courseTitleEn: form.courseTitleEn.trim() || undefined,
    instructorName: form.instructorName.trim(),
    issueDate: new Date(`${form.issueDate}T00:00:00.000Z`).toISOString(),
  });

  const handlePreview = async () => {
    const validationError = validate();
    if (validationError) return setError(validationError);
    setError(null);
    setPreviewing(true);
    try {
      const blob = await previewManualCertificate(buildPayload());
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to generate the preview. Please try again.');
    } finally {
      setPreviewing(false);
    }
  };

  const handleIssue = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) return setError(validationError);
    setError(null);
    setIssuing(true);
    setIssued(null);
    try {
      const result = await issueManualCertificate(buildPayload());
      setIssued(result);
      if (!result.emailSent) {
        setError(result.emailError || 'Certificate was issued, but the email could not be sent.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Unable to issue the certificate. Please try again.');
    } finally {
      setIssuing(false);
    }
  };

  return (
    <>
      <Head>
        <title>Issue Certificate | Admin</title>
      </Head>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
          <Award className="w-6 h-6 text-amber-500" />
          Manual Certificate Issuance
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Retroactively issue a certificate for a graduate/course that isn't tracked in the LMS. Uses the exact same
          bilingual PDF template as automatic certificates, and creates a real verification code so /verify works.
        </p>
      </div>

      <form onSubmit={handleIssue} className="bg-white rounded-2xl border border-gray-200 shadow-sm transition-all duration-300 hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10 p-6 max-w-2xl space-y-5">
        {error && <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}
        {issued && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
            Certificate issued — code <span className="font-mono font-semibold">{issued.verificationCode}</span>.
            {issued.emailSent ? ' Email sent to the student.' : ''}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Student Name (Georgian)</label>
            <input
              value={form.studentNameKa}
              onChange={(e) => setForm({ ...form, studentNameKa: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Student Name (English) — optional</label>
            <input
              value={form.studentNameEn}
              onChange={(e) => setForm({ ...form, studentNameEn: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Student Email</label>
          <input
            type="email"
            value={form.studentEmail}
            onChange={(e) => setForm({ ...form, studentEmail: e.target.value })}
            className={inputClass}
          />
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Title (Georgian)</label>
            <input
              value={form.courseTitleKa}
              onChange={(e) => setForm({ ...form, courseTitleKa: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Course Title (English) — optional</label>
            <input
              value={form.courseTitleEn}
              onChange={(e) => setForm({ ...form, courseTitleEn: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Instructor Name</label>
            <input
              value={form.instructorName}
              onChange={(e) => setForm({ ...form, instructorName: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Completion / Issue Date</label>
            <input
              type="date"
              value={form.issueDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setForm({ ...form, issueDate: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={previewing || issuing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            <Eye className="w-4 h-4" />
            {previewing ? 'Generating…' : 'Preview Certificate (PDF)'}
          </button>
          <button
            type="submit"
            disabled={previewing || issuing}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Send className="w-4 h-4" />
            {issuing ? 'Issuing…' : 'Generate & Email Certificate'}
          </button>
        </div>
      </form>
    </>
  );
}

export default function AdminIssueCertificatePage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminIssueCertificateDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
