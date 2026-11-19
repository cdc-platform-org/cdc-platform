/**
 * AI Course Mentor — course status chip (draft / planning / plan ready / active / failed).
 */
import { useTranslation } from 'next-i18next';
import { FileEdit, Loader2, ClipboardCheck, PlayCircle, AlertTriangle, Archive } from 'lucide-react';
import { ToolChip } from '../ToolShell';
import type { MentorCourseStatus } from '../../../services/courseMentorService';

const MAP = {
  DRAFT: { tone: 'neutral', icon: FileEdit },
  PLANNING: { tone: 'warning', icon: Loader2 },
  PLAN_READY: { tone: 'brand', icon: ClipboardCheck },
  ACTIVE: { tone: 'success', icon: PlayCircle },
  PLAN_FAILED: { tone: 'danger', icon: AlertTriangle },
  ARCHIVED: { tone: 'neutral', icon: Archive },
} as const;

export default function StatusChip({ status }: { status: MentorCourseStatus }) {
  const { t } = useTranslation('courseMentor');
  const { tone, icon } = MAP[status];
  return <ToolChip tone={tone} icon={icon}>{t(`status.${status}`)}</ToolChip>;
}
