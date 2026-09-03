import { GetServerSideProps } from 'next';

// The real, DB-backed, shareable-link AI Exam Proctoring system lives at
// /dashboard/ai-tools (ExamProctoringTab component) — this page was a
// separate, simpler client-only "practice exam" tool with no persistence
// and no shareable links. Consolidated into one seamless proctoring suite
// rather than maintaining two parallel exam-taking experiences.
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: { destination: '/dashboard/ai-tools', permanent: false },
});

export default function ProctoredExamRedirect() {
  return null;
}
