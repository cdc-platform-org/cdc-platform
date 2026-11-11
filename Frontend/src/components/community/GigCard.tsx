import { Gig } from '../../types/community';
import JobPostCard from './JobPostCard';

interface GigCardProps {
  gig: Gig;
  onApply: (gig: Gig) => void;
  canApply: boolean;
  isOwnerOrAdmin: boolean;
  canReview?: boolean;
  alreadyReviewed?: boolean;
  onReview?: (gig: Gig) => void;
}

// Thin adapter over the shared job-board card — see JobPostCard.tsx.
export default function GigCard({ gig, onApply, canApply, isOwnerOrAdmin, canReview, alreadyReviewed, onReview }: GigCardProps) {
  return (
    <JobPostCard
      post={{ kind: 'gig', data: gig }}
      canApply={canApply}
      onApply={() => onApply(gig)}
      isOwnerOrAdmin={isOwnerOrAdmin}
      canReview={canReview}
      alreadyReviewed={alreadyReviewed}
      onReview={() => onReview?.(gig)}
    />
  );
}
