/**
 * "Ask a CDC mentor" request modal state for /dashboard (sidebar button,
 * shown to verified graduates). Rendering lives in MentorshipRequestModal.tsx.
 */
import { FormEvent, useState } from 'react';
import { createMentorshipRequest } from '../../../services/mentorshipService';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { SupportedLocale } from '../../../utils/locale';
import { DashboardStrings } from './dashboardDict';

export function useMentorshipRequest({ lang, t }: { lang: SupportedLocale; t: DashboardStrings }) {
  const [showMentorshipModal, setShowMentorshipModal] = useState(false);
  const [mentorshipMessage, setMentorshipMessage] = useState('');
  const [mentorshipSubmitting, setMentorshipSubmitting] = useState(false);
  const [mentorshipError, setMentorshipError] = useState<string | null>(null);
  const [mentorshipSent, setMentorshipSent] = useState(false);

  useEscapeToClose(showMentorshipModal, () => setShowMentorshipModal(false));

  const openMentorshipModal = () => setShowMentorshipModal(true);

  const closeMentorshipModal = () => {
    setShowMentorshipModal(false);
    setMentorshipMessage('');
    setMentorshipError(null);
    setMentorshipSent(false);
  };

  const handleMentorshipSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMentorshipError(null);
    if (mentorshipMessage.trim().length < 5) {
      setMentorshipError(lang === 'ka' ? 'გთხოვთ დაწეროთ მეტი დეტალი.' : 'Please add a bit more detail.');
      return;
    }
    setMentorshipSubmitting(true);
    try {
      await createMentorshipRequest(mentorshipMessage.trim());
      setMentorshipSent(true);
    } catch {
      setMentorshipError(t.mentorshipError);
    } finally {
      setMentorshipSubmitting(false);
    }
  };

  return {
    showMentorshipModal,
    mentorshipMessage,
    setMentorshipMessage,
    mentorshipSubmitting,
    mentorshipError,
    mentorshipSent,
    openMentorshipModal,
    closeMentorshipModal,
    handleMentorshipSubmit,
  };
}

export type MentorshipRequest = ReturnType<typeof useMentorshipRequest>;
