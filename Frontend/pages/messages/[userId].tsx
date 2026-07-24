import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import ChatBox from '../../src/components/community/ChatBox';
import { useAuth } from '../../src/context/AuthContext';
import { getMessages } from '../../src/services/messageService';

const dict = {
  ka: {
    title: 'შეტყობინებები',
    back: '← უკან',
    loading: 'იტვირთება…',
    fallbackName: 'მომხმარებელი',
  },
  en: {
    title: 'Messages',
    back: '← Back',
    loading: 'Loading…',
    fallbackName: 'User',
  },
};

function MessagesThreadContent() {
  const router = useRouter();
  const { user } = useAuth();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const otherUserId = typeof router.query.userId === 'string' ? router.query.userId : null;

  const [otherUserName, setOtherUserName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
        <title>{t.title} | CDC</title>
      </Head>
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-sm text-slate-400 hover:text-white no-underline">
          {t.back}
        </Link>
        <h1 className="text-2xl font-black mt-4 mb-6">
          {loading ? t.loading : `💬 ${otherUserName ?? t.fallbackName}`}
        </h1>
        <ChatBox otherUserId={otherUserId} otherUserName={otherUserName ?? t.fallbackName} />
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
