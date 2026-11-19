// One planned Facebook/Instagram post: picture, product link, editable text,
// hashtags and time, and the approve → copy → mark-published flow.
// Used by pages/admin/marketing-planner.tsx; API in adminMarketingPlannerService.ts.
import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, RefreshCw, Send, Trash2, Undo2, X } from 'lucide-react';
import { PlannerPost } from '../../../services/adminMarketingPlannerService';

type Action = 'approve' | 'reject' | 'published' | 'unapprove';

interface Props {
  post: PlannerPost;
  busy: boolean;
  onSave: (id: string, patch: { caption?: string; hashtags?: string[]; scheduledAt?: string }) => Promise<void>;
  onRewrite: (id: string, feedback?: string) => Promise<void>;
  onMove: (id: string, action: Action, reason?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

const STATUS: Record<PlannerPost['status'], { label: string; cls: string }> = {
  DRAFT: { label: 'დრაფტი', cls: 'bg-gray-100 text-gray-700' },
  APPROVED: { label: 'დადასტურებული', cls: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { label: 'უარყოფილი', cls: 'bg-red-100 text-red-700' },
  PUBLISHED: { label: 'გამოქვეყნდა', cls: 'bg-indigo-100 text-indigo-800' },
};

// Tbilisi is UTC+4 all year; datetime-local inputs carry no zone, so convert by hand.
const toLocalInput = (iso: string) => new Date(new Date(iso).getTime() + 4 * 3_600_000).toISOString().slice(0, 16);
const fromLocalInput = (v: string) => new Date(`${v}:00+04:00`).toISOString();
const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ka-GE', { timeZone: 'Asia/Tbilisi', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export default function PlannerPostCard({ post, busy, onSave, onRewrite, onMove, onDelete }: Props) {
  const [caption, setCaption] = useState(post.caption);
  const [tags, setTags] = useState(post.hashtags.join(' '));
  const [when, setWhen] = useState(toLocalInput(post.scheduledAt));
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setCaption(post.caption);
    setTags(post.hashtags.join(' '));
    setWhen(toLocalInput(post.scheduledAt));
  }, [post]);

  const parsedTags = tags
    .split(/[\s,]+/)
    .map((t) => t.replace(/^#+/, ''))
    .filter(Boolean);
  const dirty = caption !== post.caption || parsedTags.join(' ') !== post.hashtags.join(' ') || when !== toLocalInput(post.scheduledAt);
  const locked = post.status === 'PUBLISHED';
  const isFb = post.platform === 'FACEBOOK';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(post.fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('დააკოპირე ტექსტი:', post.fullText);
    }
  };

  const btn = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border disabled:opacity-50';

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col md:flex-row">
      {post.imageUrl && (
        <img src={post.imageUrl} alt={post.product?.title ?? ''} className="w-full md:w-56 h-56 object-cover bg-gray-50 flex-shrink-0" />
      )}
      <div className="p-4 flex-1 space-y-3 min-w-0">
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isFb ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'}`}>
            {isFb ? 'Facebook' : 'Instagram'}
          </span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS[post.status].cls}`}>{STATUS[post.status].label}</span>
          <span className="text-gray-600">{fmt(post.scheduledAt)}</span>
          {post.originalCaption && <span className="text-xs text-amber-700">✎ შენ ჩაასწორე</span>}
        </div>

        <div className="text-sm">
          <a href={post.productUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-700 hover:underline break-all">
            {post.product?.title ?? 'პროდუქტი წაშლილია'} <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
          </a>
          {post.angle && <p className="text-gray-500 mt-1">💡 {post.angle}</p>}
          {post.status === 'REJECTED' && post.rejectionReason && <p className="text-red-600 mt-1">უარის მიზეზი: {post.rejectionReason}</p>}
        </div>

        <textarea
          rows={8}
          disabled={locked}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm leading-relaxed disabled:bg-gray-50"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />
        <p className="text-xs text-gray-500">
          {isFb ? 'ტექსტის ბოლოს ავტომატურად დაემატება პროდუქტის ლინკი.' : 'Instagram-ზე ლინკი არ იხსნება — ბოლოს დაემატება „ლინკი ბიოშია“. ბიოში ან Story-ს სტიკერში ჩასვი:'}{' '}
          {!isFb && <span className="font-mono break-all">{post.productUrl}</span>}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="text-xs text-gray-600">
            ჰეშთეგები
            <input disabled={locked} className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm" value={tags} onChange={(e) => setTags(e.target.value)} />
          </label>
          <label className="text-xs text-gray-600">
            დრო (თბილისი)
            <input
              type="datetime-local"
              disabled={locked}
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          {dirty && !locked && (
            <button
              type="button"
              disabled={busy}
              className={`${btn} bg-indigo-600 text-white border-indigo-600`}
              onClick={() => onSave(post.id, { caption, hashtags: parsedTags, scheduledAt: fromLocalInput(when) })}
            >
              <Check className="w-4 h-4" /> ცვლილებების შენახვა
            </button>
          )}
          {(post.status === 'DRAFT' || post.status === 'REJECTED') && (
            <button type="button" disabled={busy || dirty} className={`${btn} bg-emerald-600 text-white border-emerald-600`} onClick={() => onMove(post.id, 'approve')}>
              <Check className="w-4 h-4" /> დადასტურება
            </button>
          )}
          {post.status === 'DRAFT' && (
            <button
              type="button"
              disabled={busy || dirty}
              className={`${btn} border-gray-300 text-gray-700`}
              onClick={() => {
                const fb = window.prompt('რა შევცვალო? (არასავალდებულო)');
                if (fb !== null) onRewrite(post.id, fb.trim() || undefined);
              }}
            >
              <RefreshCw className="w-4 h-4" /> თავიდან დაწერა
            </button>
          )}
          {(post.status === 'DRAFT' || post.status === 'APPROVED') && (
            <button
              type="button"
              disabled={busy}
              className={`${btn} border-red-200 text-red-700`}
              onClick={() => {
                const reason = window.prompt('რატომ არ გამოდგება? (აგენტი ამას გაითვალისწინებს)');
                if (reason !== null) onMove(post.id, 'reject', reason.trim() || undefined);
              }}
            >
              <X className="w-4 h-4" /> უარყოფა
            </button>
          )}
          {post.status === 'APPROVED' && (
            <>
              <button type="button" className={`${btn} border-gray-300 text-gray-700`} onClick={copy}>
                <Copy className="w-4 h-4" /> {copied ? 'დაკოპირდა' : 'ტექსტის კოპირება'}
              </button>
              <button type="button" disabled={busy} className={`${btn} bg-indigo-600 text-white border-indigo-600`} onClick={() => onMove(post.id, 'published')}>
                <Send className="w-4 h-4" /> Meta-ში ავტვირთე
              </button>
              <button type="button" disabled={busy} className={`${btn} border-gray-300 text-gray-700`} onClick={() => onMove(post.id, 'unapprove')}>
                <Undo2 className="w-4 h-4" /> დრაფტში დაბრუნება
              </button>
            </>
          )}
          {!locked && (
            <button
              type="button"
              disabled={busy}
              className={`${btn} border-gray-200 text-gray-500 ml-auto`}
              onClick={() => window.confirm('წავშალო ეს პოსტი?') && onDelete(post.id)}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
