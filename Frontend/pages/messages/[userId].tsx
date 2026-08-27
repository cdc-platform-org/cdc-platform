import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import BackButton from '../../src/components/common/BackButton';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import ChatBox from '../../src/components/community/ChatBox';
import { useAuth } from '../../src/context/AuthContext';
import { getMessages } from '../../src/services/messageService';
import { getUserReviews } from '../../src/services/reviewService';
import { sendChatRequest, getChatRequestStatus, acceptChatRequest, rejectChatRequest } from '../../src/services/chatRequestService';
import { ChatRequest } from '../../src/types/chatRequest';
import { resolveLocale } from '@/src/utils/locale';

const dict = {
  ka: {
    title: 'შეტყობინებები',
    home: 'მთავარი გვერდი',
    loading: 'იტვირთება…',
    fallbackName: 'მომხმარებელი',
    requestIntro: 'სტუდენტებს შორის პირდაპირი მიმოწერისთვის საჭიროა თანხმობა — ჯერ გაუგზავნეთ საუბრის მოთხოვნა.',
    requestPlaceholder: 'მოკლე შესავალი (არასავალდებულო)',
    sendRequest: 'მოთხოვნის გაგზავნა',
    sending: 'იგზავნება…',
    requestSent: 'მოთხოვნა გაგზავნილია — ველოდებით პასუხს.',
    requestReceivedTitle: 'გსურთ საუბრის დაწყება?',
    accept: 'დათანხმება',
    reject: 'უარყოფა',
    requestRejectedBySelf: 'თქვენ უარყავით ეს მოთხოვნა.',
    requestRejectedByOther: 'თქვენი მოთხოვნა უარყოფილია.',
    sendAnyway: 'საკუთარი მოთხოვნის გაგზავნა',
    requestFailed: 'მოთხოვნის გაგზავნა ვერ მოხერხდა.',
  },
  en: {
    title: 'Messages',
    home: 'Home',
    loading: 'Loading…',
    fallbackName: 'User',
    requestIntro: 'Direct messages between students need consent first — send a chat request to start.',
    requestPlaceholder: 'Short intro (optional)',
    sendRequest: 'Send Chat Request',
    sending: 'Sending…',
    requestSent: 'Request sent — waiting for a response.',
    requestReceivedTitle: 'Wants to start a conversation',
    accept: 'Accept',
    reject: 'Decline',
    requestRejectedBySelf: 'You declined this request.',
    requestRejectedByOther: 'Your chat request was declined.',
    sendAnyway: 'Send your own request instead',
    requestFailed: 'Could not send the chat request.',
  },
};
// de/es/fr/uk fall back to English for this page's copy — same "widened
// dict, English placeholder until native review" posture as dashboard.tsx's
// product-submission strings, not yet real translations.
const localizedDict: Record<'ka' | 'en' | 'de' | 'es' | 'fr' | 'uk', (typeof dict)['en']> = {
  ...dict,
  de: dict.en,
  es: dict.en,
  fr: dict.en,
  uk: dict.en,
};

function ChatRequestGate({
  otherUserId,
  otherUserName,
  chatRequest,
  onChanged,
  t,
}: {
  otherUserId: string;
  otherUserName: string;
  chatRequest: ChatRequest | null;
  onChanged: () => void;
  t: (typeof dict)['en'];
}) {
  const { user } = useAuth();
  const [intro, setIntro] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setBusy(true);
    setError(null);
    try {
      await sendChatRequest(otherUserId, intro.trim() || undefined);
      onChanged();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? t.requestFailed);
    } finally {
      setBusy(false);
    }
  };

  const handleAccept = async () => {
    if (!chatRequest) return;
    setBusy(true);
    try {
      await acceptChatRequest(chatRequest.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const handleReject = async () => {
    if (!chatRequest) return;
    setBusy(true);
    try {
      await rejectChatRequest(chatRequest.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  // No request exists yet, or I was the one rejected — I can (re)send.
  const canSend = !chatRequest || (chatRequest.status === 'REJECTED' && chatRequest.recipientId === user?.id);
  // A request I sent is still pending their decision.
  const isMyPendingSend = chatRequest?.status === 'PENDING' && chatRequest.senderId === user?.id;
  // A request they sent is awaiting MY decision.
  const isIncomingPending = chatRequest?.status === 'PENDING' && chatRequest.recipientId === user?.id;
  const wasRejected = chatRequest?.status === 'REJECTED';

  return (
    <div className="border rounded-2xl shadow-2xl overflow-hidden bg-white dark:bg-[#0e1422] text-slate-900 dark:text-white border-slate-200 dark:border-slate-800 p-6 text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{t.requestIntro}</p>

      {isIncomingPending && (
        <div className="mb-4">
          <p className="text-sm font-bold mb-3">
            {otherUserName} — {t.requestReceivedTitle}
          </p>
          {chatRequest?.introMessage && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-3">"{chatRequest.introMessage}"</p>
          )}
          <div className="flex gap-2 justify-center">
            <button
              type="button"
              onClick={handleAccept}
              disabled={busy}
              className="bg-emerald-600 text-white font-bold px-4 py-2 rounded-xl text-xs border-none cursor-pointer disabled:opacity-50"
            >
              {t.accept}
            </button>
            <button
              type="button"
              onClick={handleReject}
              disabled={busy}
              className="bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold px-4 py-2 rounded-xl text-xs border-none cursor-pointer disabled:opacity-50"
            >
              {t.reject}
            </button>
          </div>
        </div>
      )}

      {isMyPendingSend && <p className="text-sm font-medium text-cyan-600 dark:text-cyan-400 mb-2">{t.requestSent}</p>}

      {wasRejected && !canSend && (
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{t.requestRejectedByOther}</p>
      )}
      {wasRejected && canSend && (
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">{t.requestRejectedBySelf}</p>
      )}

      {canSend && (
        <div className="space-y-2">
          <input
            type="text"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder={t.requestPlaceholder}
            maxLength={500}
            className="w-full border rounded-xl px-3 py-2 text-xs focus:outline-none border-slate-200 dark:border-slate-700 bg-transparent"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="button"
            onClick={handleSend}
            disabled={busy}
            className="bg-slate-900 dark:bg-cyan-600 text-white font-bold px-4 py-2 rounded-xl text-xs border-none cursor-pointer disabled:opacity-50"
          >
            {busy ? t.sending : wasRejected ? t.sendAnyway : t.sendRequest}
          </button>
        </div>
      )}
    </div>
  );
}

function MessagesThreadContent() {
  const router = useRouter();
  const { user } = useAuth();
  const lang = resolveLocale(router.locale);
  const t = localizedDict[lang];
  const otherUserId = typeof router.query.userId === 'string' ? router.query.userId : null;

  const [otherUserName, setOtherUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // null = not yet determined; true/false once we know whether a gate applies.
  const [gateRequired, setGateRequired] = useState<boolean | null>(null);
  const [chatRequest, setChatRequest] = useState<ChatRequest | null>(null);

  const load = useCallback(async () => {
    if (!otherUserId || !user) return;
    setLoading(true);
    try {
      const messages = await getMessages(otherUserId);
      const firstMessage = messages[0];
      if (firstMessage) {
        const other = firstMessage.sender.id === user.id ? firstMessage.recipient : firstMessage.sender;
        setOtherUserName(other.name);
      }

      // A prior conversation already existing is itself proof consent isn't
      // needed — mirrors Backend's chatConsentService.ts exactly, so the
      // gate here never disagrees with what POST /messages will actually do.
      if (messages.length > 0) {
        setGateRequired(false);
        setLoading(false);
        return;
      }

      const [{ user: otherProfile }, status] = await Promise.all([getUserReviews(otherUserId), getChatRequestStatus(otherUserId)]);
      setOtherUserName((prev) => prev ?? otherProfile.name);
      setChatRequest(status);
      const bothStudents = user.role === 'Student' && otherProfile.role === 'Student';
      setGateRequired(bothStudents && status?.status !== 'ACCEPTED');
    } catch {
      // Profile lookup failing shouldn't block messaging entirely — fall
      // back to the open behavior rather than a dead end.
      setGateRequired(false);
    } finally {
      setLoading(false);
    }
  }, [otherUserId, user]);

  useEffect(() => {
    load();
  }, [load]);

  if (!otherUserId) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{`${t.title} | CDC`}</title>
      </Head>
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <BackButton fallbackHref="/dashboard" className="text-slate-400 hover:text-slate-100" />
          <Link href="/" className="text-sm text-slate-400 hover:text-white no-underline">
            {t.home}
          </Link>
        </div>
        <h1 className="blog-heading-safe text-2xl font-black mt-4 mb-6">{loading ? t.loading : `💬 ${otherUserName ?? t.fallbackName}`}</h1>
        {loading ? null : gateRequired ? (
          <ChatRequestGate otherUserId={otherUserId} otherUserName={otherUserName ?? t.fallbackName} chatRequest={chatRequest} onChanged={load} t={t} />
        ) : (
          <ChatBox otherUserId={otherUserId} otherUserName={otherUserName ?? t.fallbackName} />
        )}
      </div>
    </div>
  );
}

export default function MessagesThreadPage() {
  return (
    <ProtectedRoute>
      <MessagesThreadContent />
    </ProtectedRoute>
  );
}
