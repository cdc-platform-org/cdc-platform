import { useState, useEffect, useCallback, useRef, FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ChatMessage } from '../../types/message';
import { getMessages, sendMessage } from '../../services/messageService';
import { sanitizeChatMessage } from '../../utils/sanitizeChatMessage';

const POLL_INTERVAL_MS = 5000;

interface ChatBoxProps {
  otherUserId: string;
  otherUserName: string;
}

export default function ChatBox({ otherUserId, otherUserName }: ChatBoxProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const data = await getMessages(otherUserId);
      setMessages(data);
    } catch {
      // Silent — polling failures shouldn't interrupt an open conversation.
    }
  }, [otherUserId]);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [loadMessages]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const draftPreview = sanitizeChatMessage(draft);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError(null);
    try {
      const sent = await sendMessage(otherUserId, draft.trim());
      setMessages((prev) => [...prev, sent]);
      setDraft('');
    } catch {
      setError('Unable to send this message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="border rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[420px] bg-white dark:bg-[#0e1422] text-slate-900 dark:text-white border-slate-200 dark:border-slate-800">
      <div className="bg-slate-900 text-white p-3 shrink-0">
        <span className="text-xs font-bold">💬 {otherUserName}</span>
      </div>

      {/* Persistent safety banner — always visible, not dismissible */}
      <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-[11px] leading-relaxed text-amber-800 shrink-0">
        ⚠️ ყურადღება! პლატფორმის გვერდის ავლით გადახდა არღვევს წესებს. CDC პასუხს არ აგებს პლატფორმის გარეთ
        განხორციელებულ გარიგებებზე.
      </div>

      <div className="flex-1 p-3 overflow-y-auto space-y-2 text-xs bg-slate-50 dark:bg-[#0b0f17]">
        {messages.length === 0 ? (
          <p className="text-center text-gray-400 mt-6">No messages yet — say hello 👋</p>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender.id === user?.id;
            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`p-2.5 rounded-xl max-w-[80%] ${
                    isOwn
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <p>{msg.content}</p>
                  {msg.wasFiltered && (
                    <p className={`text-[10px] mt-1 ${isOwn ? 'text-indigo-200' : 'text-amber-600'}`}>
                      ⚠ Contact info was blocked in this message
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={listEndRef} />
      </div>

      {error && <div className="px-3 py-1.5 text-[11px] text-red-600 bg-red-50 shrink-0">{error}</div>}

      {draft.trim() && draftPreview.wasFiltered && (
        <div className="px-3 py-1.5 text-[11px] text-amber-700 bg-amber-50 shrink-0">
          ⚠ This message contains contact info that will be blocked before sending.
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="p-2.5 border-t flex gap-2 bg-white dark:bg-[#0e1422] border-slate-100 dark:border-slate-800 shrink-0"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Type a message…"
          className="flex-1 border rounded-xl px-3 py-2 text-xs focus:outline-none border-slate-200 dark:border-slate-700 bg-transparent"
        />
        <button
          type="submit"
          disabled={sending || !draft.trim()}
          className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs border-none cursor-pointer disabled:opacity-50"
        >
          {sending ? '…' : 'Send'}
        </button>
      </form>
    </div>
  );
}
