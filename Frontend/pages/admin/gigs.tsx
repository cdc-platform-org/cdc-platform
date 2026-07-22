import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { ModeratedListing } from '../../src/types/adminPanel';
import {
  getListings,
  moderateGig,
  restoreGig,
  moderateVacancy,
  restoreVacancy,
} from '../../src/services/adminPanelService';

function GigsVacanciesModeration() {
  const [listings, setListings] = useState<ModeratedListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'' | 'approved' | 'removed'>('');
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [reasonDraft, setReasonDraft] = useState<Record<string, string>>({});

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getListings(filter ? { moderationStatus: filter } : undefined);
      setListings(data);
    } catch {
      setError('Unable to load listings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadListings();
  }, [loadListings]);

  const handleRemove = async (listing: ModeratedListing) => {
    setActioningId(listing.id);
    setError(null);
    try {
      const reason = reasonDraft[listing.id]?.trim() || undefined;
      if (listing.listingType === 'gig') {
        await moderateGig(listing.id, reason);
      } else {
        await moderateVacancy(listing.id, reason);
      }
      await loadListings();
    } catch {
      setError('Unable to remove this listing. Please try again.');
    } finally {
      setActioningId(null);
    }
  };

  const handleRestore = async (listing: ModeratedListing) => {
    setActioningId(listing.id);
    setError(null);
    try {
      if (listing.listingType === 'gig') {
        await restoreGig(listing.id);
      } else {
        await restoreVacancy(listing.id);
      }
      await loadListings();
    } catch {
      setError('Unable to restore this listing. Please try again.');
    } finally {
      setActioningId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Gigs & Vacancies Moderation | Admin</title>
      </Head>
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Gigs & Vacancies Moderation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Listings go live immediately when posted — remove one here to take it down from public browsing, or
            restore it.
          </p>
        </div>

        <div className="flex gap-2 mb-6">
          {(['', 'approved', 'removed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
                filter === f ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {f === '' ? 'All' : f === 'approved' ? 'Live' : 'Removed'}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : listings.length === 0 ? (
          <p className="text-sm text-gray-500">No listings match this filter.</p>
        ) : (
          <div className="space-y-3">
            {listings.map((listing) => {
              const isActioning = actioningId === listing.id;
              const isRemoved = listing.moderationStatus === 'removed';
              return (
                <div key={listing.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-gray-100 text-gray-600">
                          {listing.listingType}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${
                            isRemoved ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'
                          }`}
                        >
                          {listing.moderationStatus}
                        </span>
                        <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded bg-gray-50 text-gray-500">
                          {listing.status}
                        </span>
                      </div>
                      <h3 className="font-semibold text-sm text-gray-900 mt-1.5 truncate">{listing.title}</h3>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{listing.description}</p>
                      <p className="text-xs text-gray-400 mt-2">
                        Posted by {listing.postedBy.name} ({listing.postedBy.email})
                      </p>
                      {isRemoved && listing.moderationReason && (
                        <p className="text-xs text-rose-600 mt-1">Reason: {listing.moderationReason}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {isRemoved ? (
                        <button
                          disabled={isActioning}
                          onClick={() => handleRestore(listing)}
                          className="text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          Restore
                        </button>
                      ) : (
                        <div className="flex flex-col items-end gap-1.5 w-48">
                          <input
                            type="text"
                            value={reasonDraft[listing.id] ?? ''}
                            onChange={(e) => setReasonDraft((prev) => ({ ...prev, [listing.id]: e.target.value }))}
                            placeholder="Reason (optional)"
                            className="w-full text-xs rounded-lg border border-gray-300 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-rose-400"
                          />
                          <button
                            disabled={isActioning}
                            onClick={() => handleRemove(listing)}
                            className="text-xs font-medium text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 px-3 py-1.5 rounded-lg disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminGigsPage() {
  return (
    <AdminGuard>
      <AdminLayout>
        <GigsVacanciesModeration />
      </AdminLayout>
    </AdminGuard>
  );
}
