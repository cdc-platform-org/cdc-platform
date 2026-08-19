import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { Star, Trash2 } from 'lucide-react';
import AdminGuard from '../../src/components/admin/AdminGuard';
import AdminLayout from '../../src/components/admin/AdminLayout';
import { getAdminProductReviews, deleteAdminProductReview } from '../../src/services/productReviewService';
import { AdminProductReview } from '../../src/types/productReview';

function StarsInline({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={`w-3.5 h-3.5 ${n <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
      ))}
    </span>
  );
}

function ProductReviewsModeration() {
  const [reviews, setReviews] = useState<AdminProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReviews(await getAdminProductReviews());
    } catch {
      setError('Failed to load product reviews.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this review? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteAdminProductReview(id);
      setReviews((prev) => prev.filter((r) => r.id !== id));
    } catch {
      setError('Failed to delete the review. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <Head>
        <title>Product Reviews | Admin</title>
      </Head>
      <div className="max-w-5xl">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Digital Store — Product Review Moderation</h1>
          <p className="text-sm text-gray-500 mt-1">
            Every verified-purchase review across the Digital Store — {reviews.length} review{reviews.length === 1 ? '' : 's'} total.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-gray-500">No product reviews yet.</p>
        ) : (
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <StarsInline rating={review.rating} />
                      <span className="text-xs text-gray-400">{new Date(review.createdAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-2 leading-relaxed max-w-2xl">{review.comment}</p>
                    <p className="text-xs text-gray-400 mt-2">
                      {review.user.name} ({review.user.email}) · &ldquo;{review.product.title}&rdquo; · {review.helpfulCount} helpful
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(review.id)}
                    disabled={deletingId === review.id}
                    className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 disabled:opacity-60"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {deletingId === review.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

export default function AdminProductReviewsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <ProductReviewsModeration />
      </AdminLayout>
    </AdminGuard>
  );
}
