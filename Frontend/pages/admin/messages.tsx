import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getMessageThreads, getMessageThread, AdminMessageThread, AdminMessageRow } from '../../src/services/adminMessagesService';

function ThreadView({ thread, onBack }: { thread: AdminMessageThread; onBack: () => void }) {
  const [messages, setMessages] = useState<AdminMessageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMessageThread(thread.participantA.id, thread.participantB.id)
      .then(setMessages)
      .finally(() => setLoading(false));
  }, [thread]);

  return (
    <div>
      <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 mb-4">
        ← All threads
      </button>
      <h2 className="font-semibold text-gray-900 mb-4">
        {thread.participantA.name} ↔ {thread.participantB.name}
      </h2>
      {loading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {messages.map((m) => (
            <div key={m.id} className={`text-sm ${m.wasFiltered ? 'bg-amber-50 border border-amber-200 rounded-lg p-2' : ''}`}>
              <p className="text-xs text-gray-400">
                {m.sender.name} · {new Date(m.createdAt).toLocaleString()}
                {m.wasFiltered && ' · ⚠ contact info was filtered'}
              </p>
              <p className="text-gray-700">{m.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminMessagesDashboard() {
  const [threads, setThreads] = useState<AdminMessageThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [selected, setSelected] = useState<AdminMessageThread | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setThreads(await getMessageThreads(onlyFlagged));
    } finally {
      setLoading(false);
    }
  }, [onlyFlagged]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <Head>
        <title>Message Oversight | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Message Oversight</h1>
          <p className="text-sm text-gray-500 mt-1">
            Inspect direct-message threads to prevent off-platform bypass. Content flagging (bank numbers, phone numbers, off-site payment
            requests) runs automatically on every message.
          </p>
        </div>

        {selected ? (
          <ThreadView thread={selected} onBack={() => setSelected(null)} />
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              <input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} />
              Only show threads with flagged messages
            </label>

            {loading ? (
              <p className="text-sm text-gray-400">Loading…</p>
            ) : threads.length === 0 ? (
              <p className="text-sm text-gray-500">No message threads found.</p>
            ) : (
              <div className="space-y-2">
                {threads.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelected(t)}
                    className="w-full text-left bg-white border border-gray-200 rounded-xl p-4 hover:border-indigo-300 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {t.participantA.name} ↔ {t.participantB.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {t.flaggedCount > 0 && (
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border bg-amber-50 text-amber-700 border-amber-200">
                            {t.flaggedCount} flagged
                          </span>
                        )}
                        <span className="text-xs text-gray-400">{t.messageCount} messages</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Last message {new Date(t.lastMessageAt).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

export default function AdminMessagesPage() {
  return (
    <AdminGuard>
      <AdminLayout>
        <AdminMessagesDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
