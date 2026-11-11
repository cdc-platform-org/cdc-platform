import { Vacancy } from '../../types/community';
import JobPostCard from './JobPostCard';

interface VacancyCardProps {
  vacancy: Vacancy;
  onApply: (vacancy: Vacancy) => void;
  canApply: boolean;
  isOwnerOrAdmin: boolean;
}

// Thin adapter over the shared job-board card — see JobPostCard.tsx.
export default function VacancyCard({ vacancy, onApply, canApply, isOwnerOrAdmin }: VacancyCardProps) {
  return (
    <JobPostCard
      post={{ kind: 'vacancy', data: vacancy }}
      canApply={canApply}
      onApply={() => onApply(vacancy)}
      isOwnerOrAdmin={isOwnerOrAdmin}
    />
  );
}
