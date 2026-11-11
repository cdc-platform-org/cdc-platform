import { Vacancy, Gig } from '../../types/community';
import JobPostCard from './JobPostCard';

export type CommunityListing = { kind: 'vacancy'; data: Vacancy } | { kind: 'gig'; data: Gig };

interface CommunityListingCardProps {
  item: CommunityListing;
  // Kept for API compatibility — the shared card follows the site's
  // Tailwind `dark:` classes instead of a prop.
  darkMode?: boolean;
  canApply: boolean;
  onApply: (item: CommunityListing) => void;
  isOwnerOrAdmin: boolean;
  canReview?: boolean;
  alreadyReviewed?: boolean;
  onReview?: (item: CommunityListing) => void;
}

// Thin adapter over the shared job-board card — see JobPostCard.tsx.
export default function CommunityListingCard({
  item,
  canApply,
  onApply,
  isOwnerOrAdmin,
  canReview,
  alreadyReviewed,
  onReview,
}: CommunityListingCardProps) {
  return (
    <JobPostCard
      post={item}
      canApply={canApply}
      onApply={() => onApply(item)}
      isOwnerOrAdmin={isOwnerOrAdmin}
      canReview={canReview}
      alreadyReviewed={alreadyReviewed}
      onReview={() => onReview?.(item)}
    />
  );
}
