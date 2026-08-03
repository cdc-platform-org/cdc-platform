import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getAdminSubmissions, gradeSubmission } from '../../src/services/courseService';
import { AdminAssignmentSubmission, AssignmentStatus } from '../../src/types/lms';

const STATUS_BADGE: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  NEEDS_REVISION: 'bg-red-50 text-red-700 border-red-200',
};

function SubmissionCard({ submission, onGraded }: { submission: AdminAssignmentSubmission; onGraded: () => void }) {
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [grading, setGrading] = useState(false);

  const handleGrade = async (status: 'APPROVED' | 'NEEDS_REVISION') => {
    setGrading(true);
    try {
      await gradeSubmission(submission.id, status, feedback.trim() || undefined);
      onGraded();
    } catch {
      alert('Failed to save grading.');
    } finally {
      setGrading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 flex-wrap mb-1.5">
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_BADGE[submission.status]}`}>{submission.status.replace('_', ' ')}</span>
        <span className="text-xs text-gray-500">
          {submission.lesson.section.course.title} → {submission.lesson.section.title} → {submission.lesson.title}
        </span>
      </div>
      <p className="text-sm font-semibold text-gray-900">
        {submission.user.name} <span className="text-gray-400 font-normal">({submission.user.email})</span>
      </p>
      {submission.comment && <p className="text-sm text-gray-600 mt-1">{submission.comment}</p>}
      <div className="flex items-center gap-3 mt-2">
        {submission.fileUrl && (
          <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-indigo-600 hover:underline">
            Uploaded file →
          </a>
        )}
        {submission.linkUrl && (
          <a href={submission.linkUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-indigo-600 hover:underline">
            {submission.linkUrl}
          </a>
        )}
      </div>
      <textarea
        rows={2}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Feedback for the student (optional)"
        className="w-full mt-3 rounded-lg border border-gray-300 px-3 py-2 text-xs"
      />
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={() => handleGrade('APPROVED')}
          disabled={grading}
          className="text-xs font-medium text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="button"
          onClick={() => handleGrade('NEEDS_REVISION')}
          disabled={grading}
          className="text-xs font-medium text-white bg-red-600 px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-60"
        >
          Needs Revision
        </button>
      </div>
    </div>
  );
}

function AdminAssignmentsDashboard() {
  const [submissions, setSubmissions] = useState<AdminAssignmentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<AssignmentStatus | ''>('PENDING');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSubmissions(await getAdminSubmissions(statusFilter || undefined));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Head>
        <title>Homework Submissions | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Homework Submissions</h1>
          <p className="text-sm text-gray-500 mt-1">Review and grade student assignment submissions.</p>
        </div>

        <div className="flex items-center gap-2 mb-4">
          {(['PENDING', 'APPROVED', 'NEEDS_REVISION', ''] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${statusFilter === s ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}
            >
              {s ? s.replace('_', ' ') : 'All'}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-gray-500">No submissions here.</p>
        ) : (
          <div className="space-y-3">
            {submissions.map((s) => (
              <SubmissionCard key={s.id} submission={s} onGraded={load} />
            ))}
          </div>
        )}

        <Link href="/admin/courses" className="inline-block mt-6 text-xs text-gray-500 hover:text-gray-700">
          ← Back to Course Management
        </Link>
      </div>
    </>
  );
}

export default function AdminAssignmentsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <AdminAssignmentsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
