import Link from 'next/link';
import { Vacancy } from '../../types/community';

interface VacancyCardProps {
  vacancy: Vacancy;
  onApply: (vacancy: Vacancy) => void;
  canApply: boolean;
  isOwnerOrAdmin: boolean;
}

const employmentTypeLabels: Record<Vacancy['employmentType'], string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  internship: 'Internship',
};

export default function VacancyCard({ vacancy, onApply, canApply, isOwnerOrAdmin }: VacancyCardProps) {
  const hasSalaryRange = vacancy.salaryMin !== null || vacancy.salaryMax !== null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-indigo-300 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">{vacancy.title}</h3>
          <p className="text-sm text-gray-500 mt-0.5">{vacancy.postedBy.name}</p>
        </div>
        <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-1 rounded-full whitespace-nowrap">
          {employmentTypeLabels[vacancy.employmentType]}
        </span>
      </div>
      <p className="text-sm text-gray-600 mt-3 line-clamp-2">{vacancy.description}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {vacancy.skillsRequired.map((skill) => (
          <span
            key={skill}
            className="text-xs font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full"
          >
            {skill}
          </span>
        ))}
      </div>
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div className="text-xs text-gray-400 space-x-3">
          <span>{vacancy.location}</span>
          {hasSalaryRange && (
            <span>
              {vacancy.salaryMin !== null ? vacancy.salaryMin / 100 : '—'}
              {' – '}
              {vacancy.salaryMax !== null ? vacancy.salaryMax / 100 : '—'} {vacancy.currency}
            </span>
          )}
          {vacancy.applicationDeadline && (
            <span>Due {new Date(vacancy.applicationDeadline).toLocaleDateString()}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          {isOwnerOrAdmin && (
            <Link
              href={`/vacancies/${vacancy.id}/applications`}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              View Applications
            </Link>
          )}
          {canApply && vacancy.status === 'open' && (
            <button
              onClick={() => onApply(vacancy)}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              Apply
            </button>
          )}
          {!isOwnerOrAdmin && vacancy.status !== 'open' && (
            <span className="text-xs font-medium text-gray-400 capitalize">{vacancy.status}</span>
          )}
        </div>
      </div>
    </div>
  );
}