import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import ProtectedRoute from '../../src/components/auth/ProtectedRoute';
import { useAuth } from '../../src/context/AuthContext';
import { MyGig } from '../../src/types/community';
import { getMyGigs } from '../../src/services/gigService';

const dict = {
  ka: {
    title: 'დამკვეთის პანელი',
    subtitle: 'თქვენი გამოქვეყნებული გარიგებები, პროექტების სტატუსი და ინვოისები.',
    postNew: '+ ახალი გარიგების გამოქვეყნება',
    loading: 'იტვირთება…',
    empty: 'ჯერ არცერთი გარიგება არ გაქვთ გამოქვეყნებული.',
    applications: 'განაცხადი',
    budget: 'ბიუჯეტი',
    status: 'სტატუსი',
    invoice: 'ინვოისი',
    noInvoice: 'ესქროუ ჯერ არ არის დაფინანსებული',
    gross: 'სრული თანხა',
    commission: 'პლატფორმის საკომისიო (10%)',
    net: 'გადაცემული ფრილანსერზე',
    escrowStatus: { HELD_IN_ESCROW: 'ესქროუში დაცული', RELEASED: 'გათავისუფლებულია' } as Record<string, string>,
    gigStatus: { open: 'ღიაა', assigned: 'მინიჭებულია', submitted: 'გადმოცემულია', completed: 'დასრულებულია', cancelled: 'გაუქმებულია' } as Record<string, string>,
    viewApplications: 'განაცხადების ნახვა',
  },
  en: {
    title: 'Client Portal',
    subtitle: 'Your posted gigs, project statuses, and invoices.',
    postNew: '+ Post a New Gig',
    loading: 'Loading…',
    empty: "You haven't posted any gigs yet.",
    applications: 'applications',
    budget: 'Budget',
    status: 'Status',
    invoice: 'Invoice',
    noInvoice: 'Escrow not funded yet',
    gross: 'Gross amount',
    commission: 'Platform commission (10%)',
    net: 'Paid to freelancer',
    escrowStatus: { HELD_IN_ESCROW: 'Held in escrow', RELEASED: 'Released' } as Record<string, string>,
    gigStatus: { open: 'Open', assigned: 'Assigned', submitted: 'Submitted', completed: 'Completed', cancelled: 'Cancelled' } as Record<string, string>,
    viewApplications: 'View Applications',
  },
};

const statusColors: Record<string, string> = {
  open: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
  assigned: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  submitted: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
  completed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
  cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

function formatMoney(minorUnits: number, currency: string): string {
  return `${(minorUnits / 100).toFixed(2)} ${currency === 'GEL' ? '₾' : currency}`;
}

function ClientPortalContent() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { user } = useAuth();

  const [gigs, setGigs] = useState<MyGig[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setGigs(await getMyGigs());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{t.title} | CDC</title>
      </Head>
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-3xl font-black">{t.title}</h1>
            {user && <p className="text-sm text-slate-500 mt-1">{user.name} · {user.email}</p>}
          </div>
          <Link
            href="/gigs/post"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black text-sm px-5 py-2.5 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
          >
            {t.postNew}
          </Link>
        </div>
        <p className="text-slate-400 mb-10">{t.subtitle}</p>

        {loading ? (
          <p className="text-slate-400 text-sm">{t.loading}</p>
        ) : gigs.length === 0 ? (
          <p className="text-slate-400 text-sm">{t.empty}</p>
        ) : (
          <div className="space-y-5">
            {gigs.map((gig) => (
              <div key={gig.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-black text-white mb-1">{gig.title}</h3>
                    <p className="text-xs text-slate-500">
                      {gig.applicationsCount} {t.applications} · {t.budget}: {formatMoney(gig.budgetAmount, gig.currency)}
                      {gig.budgetType === 'hourly' ? '/hr' : ''}
                    </p>
                  </div>
                  <span className={`text-[11px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border ${statusColors[gig.status] ?? statusColors.open}`}>
                    {t.gigStatus[gig.status] ?? gig.status}
                  </span>
                </div>

                <div className="rounded-xl bg-slate-950/60 border border-slate-800 p-4 mb-4">
                  <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 mb-2">{t.invoice}</p>
                  {gig.transaction ? (
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-slate-500 text-xs">{t.gross}</p>
                        <p className="font-bold text-white">{formatMoney(gig.transaction.grossAmount, gig.transaction.currency)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">{t.commission}</p>
                        <p className="font-bold text-white">{formatMoney(gig.transaction.commissionAmount, gig.transaction.currency)}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">{t.net}</p>
                        <p className="font-bold text-white">
                          {formatMoney(gig.transaction.netAmount, gig.transaction.currency)}{' '}
                          <span className="text-[10px] text-slate-500">({t.escrowStatus[gig.transaction.status] ?? gig.transaction.status})</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">{t.noInvoice}</p>
                  )}
                </div>

                <Link
                  href={`/gigs/${gig.id}/applications`}
                  className="text-xs font-bold text-cyan-400 hover:text-cyan-300 no-underline"
                >
                  {t.viewApplications} →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ClientPortalPage() {
  return (
    <ProtectedRoute>
      <ClientPortalContent />
    </ProtectedRoute>
  );
}
