// Products the agent created, with approve / edit / delete. Approving uses
// the normal admin products endpoint; full editing happens on
// /admin/products (the same editor as hand-made listings).
import Image from 'next/image';
import Link from 'next/link';
import { Bot, Check, Pencil, Trash2 } from 'lucide-react';
import { AgentProduct } from '../../../services/adminProductAgentService';
import { formatPrice } from '../../../utils/coursePricing';

const STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'ელოდება დამტკიცებას', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APPROVED: { label: 'გამოქვეყნებულია', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  REJECTED: { label: 'უარყოფილია', cls: 'bg-red-50 text-red-700 border-red-200' },
  NEEDS_REVISION: { label: 'საჭიროებს შესწორებას', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
};

interface Props {
  products: AgentProduct[];
  actingId: string | null;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function AgentProductsList({ products, actingId, onApprove, onDelete }: Props) {
  if (!products.length) return <p className="text-sm text-gray-500">აგენტს ჯერ პროდუქტი არ შეუქმნია.</p>;
  return (
    <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
      {products.map((p) => {
        const s = STATUS[p.status] ?? STATUS.PENDING;
        return (
          <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
            <div className="relative aspect-[4/3] bg-gray-100">
              <Image src={p.imageUrl} alt={p.title} fill className="object-cover" unoptimized />
              <span className="absolute top-2 left-2 inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-600 text-white">
                <Bot className="w-3 h-3" /> AI აგენტი
              </span>
            </div>
            <div className="p-4 flex-1 flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${s.cls}`}>{s.label}</span>
                <span className="text-[10px] text-gray-400">{p.category}</span>
              </div>
              <p className="text-sm font-semibold text-gray-900 line-clamp-3">{p.title}</p>
              <p className="text-xs text-gray-500">
                {formatPrice(p.price)} · {new Date(p.createdAt).toLocaleString('ka-GE')} · გაყიდვები: {p.salesCount}
              </p>
              <div className="mt-auto flex gap-2 flex-wrap pt-2">
                {p.status !== 'APPROVED' && (
                  <button
                    type="button"
                    disabled={actingId === p.id}
                    onClick={() => onApprove(p.id)}
                    className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" /> დამტკიცება
                  </button>
                )}
                <Link href={`/admin/products#product-${p.id}`} className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5 border border-gray-300 text-gray-700 hover:bg-gray-50">
                  <Pencil className="w-3.5 h-3.5" /> რედაქტირება
                </Link>
                <button
                  type="button"
                  disabled={actingId === p.id}
                  onClick={() => onDelete(p.id)}
                  className="inline-flex items-center gap-1 text-xs font-medium rounded-lg px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" /> წაშლა
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
