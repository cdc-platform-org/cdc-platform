import apiClient from './apiClient';

interface ProctoringBusiness {
  id: string;
  name: string;
  email: string;
}

interface ProctoringExamSession {
  id: string;
  title: string;
  topic: string;
  business: ProctoringBusiness;
}

export interface CandidateVerificationRow {
  id: string;
  examSessionId: string;
  examSession: ProctoringExamSession;
  candidateName: string;
  candidateEmail: string;
  mcqScore: number | null;
  practicalScore: number | null;
  totalScore: number | null;
  proctoringViolations: number;
  tabSwitches: number;
  copyPasteCount: number;
  integrityScore: number | null;
  aiTextScore: number | null;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FLAGGED';
  startedAt: string;
  completedAt: string | null;
}

export async function getCandidateVerifications(status?: string): Promise<{
  data: CandidateVerificationRow[];
  counts: Record<string, number>;
}> {
  const response = await apiClient.get<{ data: CandidateVerificationRow[]; counts: Record<string, number> }>(
    '/admin/exam-proctoring',
    { params: { status } }
  );
  return response.data;
}
