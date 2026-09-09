import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AlertCircle, Bug, Camera, Lightbulb, Wrench, X } from 'lucide-react';
import SiteHeader from '../layout/SiteHeader';
import { askIako, getIakoConversation, IakoMessage, IakoResource, IakoUsage } from '../../services/iakoAssistantService';

const copy = {
  ka: {
    title: 'IAKO', defaultTagline: 'AI ტრენინგის ასისტენტი', active: 'აქტიური', expired: 'ვადაგასული',
    accessUntil: 'წვდომა', requestsUsed: 'მოთხოვნა გამოყენებულია', loading: 'იტვირთება…',
    quickError: 'შემეშალა შეცდომა', quickScreenshot: 'Screenshot-ის გაგზავნა', quickFeature: 'დამეხმარე ფუნქციის აგებაში',
    quickExplain: 'თემის ახსნა', quickGuide: 'დღევანდელი გზამკვლევი',
    placeholder: 'დასვი შეკითხვა, ჩასვი კოდი ან აღწერე შეცდომა…', send: 'გაგზავნა', sending: 'ფიქრობს…',
    retry: 'ხელახლა ცდა', remove: 'წაშლა', addImage: 'სქრინშოთის დამატება',
    remaining: (n: number) => `დარჩენილია ${n} IAKO მოთხოვნა.`,
    limitReached: 'IAKO-ს მიმდინარე წვდომის ლიმიტი ამოიწურა. თუ დამატებითი დახმარება გჭირდება, მიმართე ტრენერს.',
    errorPrefixError: 'შემეშალა შეცდომა: ', errorPrefixFeature: 'დამეხმარე ავაშენო ფუნქცია: ', errorPrefixExplain: 'ამიხსენი: ',
    genericError: 'პასუხის მიღება ვერ მოხერხდა.',
    outOfScopeNote: 'ეს კითხვა ტრენინგის ფარგლებს სცდება.',
    maxImages: (n: number) => `მაქსიმუმ ${n} სქრინშოთი ერთ შეტყობინებაზე.`,
  },
  en: {
    title: 'IAKO', defaultTagline: 'AI Training Assistant', active: 'Active', expired: 'Expired',
    accessUntil: 'Access until', requestsUsed: 'requests used', loading: 'Loading…',
    quickError: 'I have an error', quickScreenshot: 'Send Screenshot', quickFeature: 'Help me build a feature',
    quickExplain: 'Explain a topic', quickGuide: "Today's Guide",
    placeholder: 'Ask a question, paste code, or describe an error…', send: 'Send', sending: 'Thinking…',
    retry: 'Retry', remove: 'Remove', addImage: 'Attach a screenshot',
    remaining: (n: number) => `You have ${n} IAKO requests remaining.`,
    limitReached: 'Your current IAKO access limit has been reached. If you need further help, please reach out to your trainer.',
    errorPrefixError: 'I\'m getting an error: ', errorPrefixFeature: 'Help me build a feature: ', errorPrefixExplain: 'Can you explain: ',
    genericError: 'Could not get a response.',
    outOfScopeNote: 'That question is outside this training.',
    maxImages: (n: number) => `Max ${n} screenshots per message.`,
  },
};

function usageLine(usage: IakoUsage, lang: 'ka' | 'en'): string {
  const t = copy[lang];
  return usage.requestLimit != null ? `${usage.requestsUsed} / ${usage.requestLimit} ${t.requestsUsed}` : `${usage.requestsUsed} ${t.requestsUsed}`;
}

export default function IakoMentorPage({ resource, backHref, backLabel, guideHref, resourceTitle }: {
  resource: IakoResource; backHref: string; backLabel: string; guideHref?: string; resourceTitle?: string;
}) {
  const router = useRouter();
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const t = copy[lang];
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [profile, setProfile] = useState<{ name: string; mentorTagline: string | null; visionEnabled: boolean; welcomeMessageKa: string | null; welcomeMessageEn: string | null } | null>(null);
  const [messages, setMessages] = useState<IakoMessage[]>([]);
  const [usage, setUsage] = useState<IakoUsage | null>(null);
  const [question, setQuestion] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(false);
  const idempotencyKey = useRef(crypto.randomUUID());
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const data = await getIakoConversation(resource);
      setProfile(data.profile); setMessages(data.messages); setUsage(data.usage);
    } catch { setFailed(true); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resource is a stable object literal supplied by the page, not expected to change identity.
  }, []);
  useEffect(() => { void load(); }, [load]);

  const maxImages = usage?.maxScreenshotsPerMessage ?? 3;
  const limitReached = usage?.requestLimit != null && usage.requestsUsed >= usage.requestLimit;
  const remaining = usage?.requestLimit != null ? usage.requestLimit - usage.requestsUsed : null;

  const addImages = (files: FileList | null) => {
    if (!files) return;
    setImages((current) => [...current, ...Array.from(files)].slice(0, maxImages));
  };
  const removeImage = (index: number) => setImages((current) => current.filter((_, i) => i !== index));

  const prefill = (prefix: string) => {
    setQuestion((current) => current || prefix);
    questionRef.current?.focus();
    questionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const sendMessage = async () => {
    const message = question.trim();
    if (!message || sending || limitReached) return;
    setSending(true); setError(false);
    const sentImages = images;
    try {
      const result = await askIako(resource, message, idempotencyKey.current, sentImages);
      setMessages((current) => [...current,
        { id: `local-${Date.now()}-u`, role: 'USER', content: message, imageUrls: sentImages.map((file) => URL.createObjectURL(file)), createdAt: new Date().toISOString() },
        { id: `local-${Date.now()}-a`, role: 'ASSISTANT', content: result.reply, imageUrls: [], createdAt: new Date().toISOString() },
      ]);
      setUsage(result.usage);
      setQuestion(''); setImages([]);
      idempotencyKey.current = crypto.randomUUID();
    } catch {
      setError(true); // Same idempotencyKey stays — Retry resends it unchanged, safe against double-charging.
    } finally {
      setSending(false);
    }
  };

  const welcome = profile && (lang === 'ka' ? profile.welcomeMessageKa : profile.welcomeMessageEn);

  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    <Head><title>{t.title} | CDC</title></Head>
    <SiteHeader />
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <Link href={backHref} className="text-sm text-cyan-700 dark:text-cyan-300">← {backLabel}</Link>

      {loading ? <p role="status" className="mt-8">{t.loading}</p> : failed ? (
        <div role="alert" className="mt-8 rounded-2xl border border-red-200 p-6"><p>{t.genericError}</p><button type="button" onClick={() => void load()} className="mt-3 underline">{t.retry}</button></div>
      ) : <>
        <div className="my-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black">{t.title}</h1>
            <p className="text-cyan-600 dark:text-cyan-400 font-bold mt-1">{profile?.mentorTagline || t.defaultTagline}</p>
            {resourceTitle && <p className="text-sm text-slate-500 mt-1">{resourceTitle}</p>}
          </div>
          {usage && <div className="text-right shrink-0">
            <span className={`inline-block rounded-full px-3 py-1 text-xs font-bold ${usage.revokedAt || (usage.expiresAt && new Date(usage.expiresAt) < new Date()) ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              ● {usage.revokedAt || (usage.expiresAt && new Date(usage.expiresAt) < new Date()) ? t.expired : t.active}
            </span>
            {usage.expiresAt && <p className="text-xs text-slate-500 mt-1">{t.accessUntil} {new Date(usage.expiresAt).toLocaleDateString()}</p>}
            <p className="text-xs text-slate-500 mt-1">{usageLine(usage, lang)}</p>
          </div>}
        </div>

        {remaining != null && remaining > 0 && remaining <= 20 && !limitReached && (
          <p role="status" className="text-xs text-amber-600 mb-4">{t.remaining(remaining)}</p>
        )}
        {limitReached && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 mb-6 text-sm text-red-700">{t.limitReached}</div>}

        <div className="flex flex-wrap gap-2 mb-6">
          <button type="button" onClick={() => prefill(t.errorPrefixError)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-900"><Bug className="w-3.5 h-3.5" />{t.quickError}</button>
          <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-900"><Camera className="w-3.5 h-3.5" />{t.quickScreenshot}</button>
          <button type="button" onClick={() => prefill(t.errorPrefixFeature)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-900"><Wrench className="w-3.5 h-3.5" />{t.quickFeature}</button>
          <button type="button" onClick={() => prefill(t.errorPrefixExplain)} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-900"><Lightbulb className="w-3.5 h-3.5" />{t.quickExplain}</button>
          {guideHref && <Link href={guideHref} className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-900 no-underline text-slate-900 dark:text-slate-100">{t.quickGuide}</Link>}
        </div>

        <div role="log" aria-live="polite" className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-4 min-h-[16rem] max-h-[36rem] overflow-y-auto mb-4">
          {welcome && messages.length === 0 && <div className="rounded-xl bg-cyan-50 dark:bg-cyan-950/40 p-4 text-sm whitespace-pre-wrap leading-6">{welcome}</div>}
          {messages.map((message) => <div key={message.id} className={`rounded-xl p-3.5 text-sm ${message.role === 'USER' ? 'bg-slate-100 dark:bg-slate-800 ml-8' : 'bg-cyan-50 dark:bg-cyan-950/40 mr-8'}`}>
            {message.imageUrls.length > 0 && <div className="flex flex-wrap gap-2 mb-2">
              {message.imageUrls.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- a blob:/CDN thumbnail in a chat bubble, next/image gains nothing here.
                <img key={i} src={url} alt="" className="rounded-lg max-h-40" />
              ))}
            </div>}
            <p className="whitespace-pre-wrap break-words leading-6">{message.content}</p>
          </div>)}
        </div>
        {error && <div role="alert" className="text-sm text-red-600 mb-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" />{t.genericError} <button type="button" onClick={() => void sendMessage()} className="underline">{t.retry}</button></div>}

        <form onSubmit={(event: FormEvent) => { event.preventDefault(); void sendMessage(); }}>
          {images.length > 0 && <div className="flex flex-wrap gap-2 mb-3">
            {images.map((file, i) => <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local object-URL preview of a not-yet-uploaded file. */}
              <img src={URL.createObjectURL(file)} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-200 dark:border-slate-700" />
              <button type="button" onClick={() => removeImage(i)} aria-label={t.remove} className="absolute -top-2 -right-2 bg-slate-900 text-white rounded-full p-0.5"><X className="w-3 h-3" /></button>
            </div>)}
          </div>}
          <div className="flex items-end gap-2">
            {profile?.visionEnabled && <>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple hidden onChange={(event) => { if (images.length >= maxImages) return; addImages(event.target.files); event.target.value = ''; }} />
              <button type="button" onClick={() => images.length < maxImages ? fileRef.current?.click() : undefined} disabled={images.length >= maxImages} aria-label={t.addImage} title={images.length >= maxImages ? t.maxImages(maxImages) : t.addImage} className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 disabled:opacity-40"><Camera className="w-4 h-4" /></button>
            </>}
            <textarea ref={questionRef} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t.placeholder} rows={2} maxLength={4000} disabled={sending || limitReached} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm resize-none" />
            <button type="submit" disabled={sending || !question.trim() || limitReached} className="rounded-xl bg-cyan-600 text-white text-sm font-bold px-4 py-2.5 disabled:opacity-50">{sending ? t.sending : t.send}</button>
          </div>
        </form>
      </>}
    </main>
  </div>;
}
