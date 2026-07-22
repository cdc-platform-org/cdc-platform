import { useState, FormEvent } from 'react';
import StarRating from './StarRating';

interface ReviewModalProps {
  gigTitle: string;
  revieweeName: string;
  onSubmit: (data: { rating: number; comment: string }) => Promise<void>;
  onClose: () => void;
}

export default function ReviewModal({ gigTitle, revieweeName, onSubmit, onClose }: ReviewModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (rating < 1) {
      setError('Please select a star rating.');
      return;
    }
    if (comment.trim().length < 10) {
      setError('Comment must be at least 10 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({ rating, comment: comment.trim() });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'Unable to submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900">Leave a review</h2>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          Rate your experience with <span className="font-medium text-gray-700">{revieweeName}</span> on
          &ldquo;{gigTitle}&rdquo;.
        </p>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex flex-col items-center gap-2 py-2">
            <StarRating value={rating} onChange={setRating} size="lg" />
            <span className="text-xs text-gray-400">{rating > 0 ? `${rating} / 5` : 'Tap a star to rate'}</span>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Comment</label>
            <textarea
              required
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="How was your experience working together?"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? 'Submitting…' : 'Submit review'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
