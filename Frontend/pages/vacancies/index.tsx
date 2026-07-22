import { useState, useEffect, useCallback } from 'react';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import VacancyCard from '../../src/components/community/VacancyCard';
import FilterBar from '../../src/components/community/FilterBar';
import ApplicationModal from '../../src/components/community/ApplicationModal';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { Vacancy } from '../../src/types/community';
import { getVacancies, applyToVacancy } from '../../src/services/vacancyService';

const SIGN_IN_TO_APPLY = {
  ka: 'გთხოვთ გაიაროთ ავტორიზაცია შეკვეთის გასაგზავნად',
  en: 'Please sign in to submit a proposal',
};
const SIGN_IN_TO_POST = {
  ka: 'გთხოვთ გაიაროთ ავტორიზაცია ვაკანსიის გამოსაქვეყნებლად',
  en: 'Please sign in to post a job',
};

function VacanciesPageContent() {
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillsFilter, setSkillsFilter] = useState('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');
  const [applyingTo, setApplyingTo] = useState<Vacancy | null>(null);

  const handleApplyClick = (vacancy: Vacancy) => {
    if (!isAuthenticated) {
      openAuthModal({ message: SIGN_IN_TO_APPLY });
      return;
    }
    setApplyingTo(vacancy);
  };

  const handlePostVacancyClick = () => {
    openAuthModal({ message: SIGN_IN_TO_POST });
  };

  const loadVacancies = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVacancies({
        skills: skillsFilter ? skillsFilter.split(',').map((s) => s.trim()) : undefined,
        employmentType: employmentTypeFilter || undefined,
      });
      setVacancies(data);
    } catch (error) {
      console.error('Failed to load vacancies:', error);
    } finally {
      setLoading(false);
    }
  }, [skillsFilter, employmentTypeFilter]);

  useEffect(() => {
    loadVacancies();
  }, [loadVacancies]);

  const canApply = !isAuthenticated || user?.role === 'Student';
  const canPost = user?.role === 'Client' || user?.role === 'SuperAdmin';

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Vacancies</h1>
          {!isAuthenticated ? (
            <button
              type="button"
              onClick={handlePostVacancyClick}
              className="text-sm font-medium text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700"
            >
              Post a Vacancy
            </button>
          ) : (
            canPost && (
              <Link
                href="/vacancies/post"
                className="text-sm font-medium text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700"
              >
                Post a Vacancy
              </Link>
            )
          )}
        </div>

        <FilterBar
          skills={skillsFilter}
          onSkillsChange={setSkillsFilter}
          extraFilter={{
            label: 'Employment type',
            value: employmentTypeFilter,
            onChange: setEmploymentTypeFilter,
            options: [
              { value: 'full_time', label: 'Full-time' },
              { value: 'part_time', label: 'Part-time' },
              { value: 'contract', label: 'Contract' },
              { value: 'internship', label: 'Internship' },
            ],
          }}
        />

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : vacancies.length === 0 ? (
          <p className="text-sm text-gray-500">No vacancies match your filters right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {vacancies.map((vacancy) => (
              <VacancyCard
                key={vacancy.id}
                vacancy={vacancy}
                canApply={canApply}
                onApply={handleApplyClick}
                /* აი ეს პროპი აკლდა და დაემატა, ზუსტად როგორც გიგებზე ვქენით */
                isOwnerOrAdmin={vacancy.postedBy.id === user?.id || user?.role === 'SuperAdmin'}
              />
            ))}
          </div>
        )}
      </div>

      {applyingTo && (
        <ApplicationModal
          title={`Apply to "${applyingTo.title}"`}
          includeBid={false}
          onClose={() => setApplyingTo(null)}
          onSubmit={async ({ note }) => {
            await applyToVacancy(applyingTo.id, { coverNote: note });
          }}
        />
      )}
    </div>
  );
}

export default function VacanciesPage() {
  return <VacanciesPageContent />;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['common'])) },
});