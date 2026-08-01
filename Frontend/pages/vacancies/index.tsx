import { useState, useEffect, useCallback } from 'react';
import { GetStaticProps } from 'next';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import VacancyCard from '../../src/components/community/VacancyCard';
import FilterBar from '../../src/components/community/FilterBar';
import BackButton from '../../src/components/common/BackButton';
import ApplicationModal from '../../src/components/community/ApplicationModal';
import GraduateOnlyModal from '../../src/components/community/GraduateOnlyModal';
import SiteHeader from '../../src/components/layout/SiteHeader';
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
const GRADUATES_ONLY_MESSAGE = {
  ka: 'ვაკანსიაზე განაცხადის გაგზავნა მხოლოდ CDC-ის კურსდამთავრებულებს შეუძლიათ.',
  en: 'Only verified CDC graduates can apply to job vacancies.',
};

function VacanciesPageContent() {
  const { t } = useTranslation('proposals');
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [loading, setLoading] = useState(true);
  const [skillsFilter, setSkillsFilter] = useState('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');
  const [applyingTo, setApplyingTo] = useState<Vacancy | null>(null);
  const [showGraduateGate, setShowGraduateGate] = useState(false);

  const handleApplyClick = (vacancy: Vacancy) => {
    if (!isAuthenticated) {
      // Preserve intent — reopen the application modal for this exact
      // vacancy right after the guest signs in, instead of leaving them
      // logged in with nothing happening.
      openAuthModal({
        message: SIGN_IN_TO_APPLY,
        onSuccess: (loggedInUser) => {
          if (loggedInUser?.isVerifiedGraduate) setApplyingTo(vacancy);
          else setShowGraduateGate(true);
        },
      });
      return;
    }
    if (user?.isVerifiedGraduate) {
      setApplyingTo(vacancy);
    } else {
      setShowGraduateGate(true);
    }
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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100">
      <SiteHeader />
      <div className="relative overflow-hidden border-b border-slate-200/60 dark:border-slate-800">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-16 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-10">
          <BackButton fallbackHref="/" className="text-slate-500 dark:text-slate-400 dark:hover:text-slate-100" />
          <div className="flex items-center justify-between gap-4 mt-8">
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
              <span className="bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                {t('marketplace.vacanciesTitle')}
              </span>
            </h1>
            {!isAuthenticated ? (
              <button
                type="button"
                onClick={handlePostVacancyClick}
                className="shrink-0 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-600 px-4 sm:px-5 py-2.5 rounded-xl hover:opacity-90 shadow-lg shadow-cyan-500/20 transition"
              >
                {t('marketplace.postVacancy')}
              </button>
            ) : (
              canPost && (
                <Link
                  href="/vacancies/post"
                  className="shrink-0 text-xs sm:text-sm font-bold text-white bg-gradient-to-r from-cyan-500 to-purple-600 px-4 sm:px-5 py-2.5 rounded-xl hover:opacity-90 shadow-lg shadow-cyan-500/20 transition no-underline"
                >
                  {t('marketplace.postVacancy')}
                </Link>
              )
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <FilterBar
          skills={skillsFilter}
          onSkillsChange={setSkillsFilter}
          skillsPlaceholder={t('marketplace.skillsFilterPlaceholder')}
          extraFilter={{
            label: t('marketplace.employmentTypeLabel'),
            value: employmentTypeFilter,
            onChange: setEmploymentTypeFilter,
            options: [
              { value: 'full_time', label: t('marketplace.employmentFullTime') },
              { value: 'part_time', label: t('marketplace.employmentPartTime') },
              { value: 'contract', label: t('marketplace.employmentContract') },
              { value: 'internship', label: t('marketplace.employmentInternship') },
            ],
          }}
        />

        {loading ? (
          <p className="text-sm text-gray-400">{t('marketplace.loading')}</p>
        ) : vacancies.length === 0 ? (
          <p className="text-sm text-gray-500">{t('marketplace.noVacanciesMatch')}</p>
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
          title={t('marketplace.applyToTitle', { title: applyingTo.title })}
          includeBid={false}
          onClose={() => setApplyingTo(null)}
          onSubmit={async ({ note }) => {
            await applyToVacancy(applyingTo.id, { coverNote: note });
          }}
        />
      )}
      {showGraduateGate && (
        <GraduateOnlyModal message={GRADUATES_ONLY_MESSAGE} onClose={() => setShowGraduateGate(false)} />
      )}
    </div>
  );
}

export default function VacanciesPage() {
  return <VacanciesPageContent />;
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['proposals'])) },
});