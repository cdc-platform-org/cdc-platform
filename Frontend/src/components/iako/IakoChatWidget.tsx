import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { MessageCircle, X, Image as ImageIcon } from 'lucide-react';
import { askIako, getIakoConversation, IakoMessage } from '../../services/iakoAssistantService';

const copy = {
  ka: { open: 'IAKO ასისტენტი', title: 'IAKO', placeholder: 'დასვით შეკითხვა…', send: 'გაგზავნა', sending: 'იფიქრებს…', error: 'პასუხის მიღება ვერ მოხერხდა.', close: 'დახურვა', attach: 'სქრინშოთის მიმაგრება' },
  en: { open: 'IAKO Assistant', title: 'IAKO', placeholder: 'Ask a question…', send: 'Send', sending: 'Thinking…', error: 'Could not get a response.', close: 'Close', attach: 'Attach a screenshot' },
};

// Drop this into any page for a Digital Tool or a Live Training that has an
// IAKO profile assigned — self-contained (own open/closed state, own
// fetch), safe to add without touching the host page's own state. If no
// profile is assigned to this resource, getIakoConversation's first call
// 404s and the widget simply never opens (see the `available` state).
export default function IakoChatWidget({ resource }: { resource: { liveTrainingId: string } | { digitalToolKey: string } }) {
  const router = useRouter();
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const t = copy[lang];
  const [available, setAvailable] = useState<boolean | null>(null);
  const [visionEnabled, setVisionEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<IakoMessage[]>([]);
  const [question, setQuestion] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    getIakoConversation(resource)
      .then((data) => { if (cancelled) return; setAvailable(true); setVisionEnabled(data.profile.visionEnabled); setMessages(data.messages); })
      .catch(() => { if (!cancelled) setAvailable(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resource is a plain object literal from the caller; keying on its identity would refetch every render.
  }, []);

  if (!available) return null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const message = question.trim();
    if (!message || sending) return;
    setSending(true); setError(false);
    try {
      const result = await askIako(resource, message, image ?? undefined);
      setMessages((current) => [...current,
        { id: `local-${Date.now()}-u`, role: 'USER', content: message, imageUrl: image ? URL.createObjectURL(image) : null, createdAt: new Date().toISOString() },
        { id: `local-${Date.now()}-a`, role: 'ASSISTANT', content: result.reply, imageUrl: null, createdAt: new Date().toISOString() },
      ]);
      setQuestion(''); setImage(null);
    } catch {
      setError(true);
    } finally {
      setSending(false);
    }
  };

  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label={t.open} className="fixed bottom-6 right-6 z-40 rounded-full bg-cyan-600 text-white p-4 shadow-lg hover:bg-cyan-700">
      <MessageCircle className="w-5 h-5" />
    </button>
    {open && <div className="fixed bottom-6 right-6 z-50 w-[22rem] max-w-[calc(100vw-2rem)] h-[32rem] max-h-[calc(100vh-6rem)] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
        <h2 className="font-black text-sm">{t.title}</h2>
        <button type="button" onClick={() => setOpen(false)} aria-label={t.close} className="p-1"><X className="w-4 h-4" /></button>
      </div>
      <div role="log" aria-live="polite" className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message) => <div key={message.id} className={`rounded-xl p-3 text-sm ${message.role === 'USER' ? 'bg-slate-100 dark:bg-slate-800 ml-6' : 'bg-cyan-50 dark:bg-cyan-950/40 mr-6'}`}>
          {message.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a blob:/CDN url thumbnail in a chat bubble, next/image gains nothing for this transient element.
            <img src={message.imageUrl} alt="" className="rounded-lg mb-2 max-h-32" />
          )}
          <p className="whitespace-pre-wrap break-words leading-6">{message.content}</p>
        </div>)}
      </div>
      {error && <p role="alert" className="text-xs text-red-600 px-4">{t.error}</p>}
      <form onSubmit={submit} className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-end gap-2">
        {visionEnabled && <>
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => setImage(event.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileRef.current?.click()} aria-label={t.attach} className={`p-2 rounded-lg border ${image ? 'border-cyan-500 text-cyan-600' : 'border-slate-300 dark:border-slate-700'}`}><ImageIcon className="w-4 h-4" /></button>
        </>}
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t.placeholder} rows={1} disabled={sending} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm resize-none" />
        <button type="submit" disabled={sending || !question.trim()} className="rounded-lg bg-cyan-600 text-white text-sm font-bold px-3 py-2 disabled:opacity-50">{sending ? t.sending : t.send}</button>
      </form>
    </div>}
  </>;
}
