import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import VacancyCard from './VacancyCard';
import GigCard from './GigCard';
import FilterBar from './FilterBar';
import PostingForm from './PostingForm';
import ApplicationModal from './ApplicationModal';
import ProposalModal from './ProposalModal';
import ReviewModal from './ReviewModal';
import GraduateOnlyModal from './GraduateOnlyModal';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import BackButton from '../common/BackButton';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { Vacancy, Gig } from '../../types/community';
import { getVacancies, applyToVacancy } from '../../services/vacancyService';
import { getGigs, applyToGig } from '../../services/gigService';
import { createReview } from '../../services/reviewService';
import { JOB_CATEGORIES, JOB_CATEGORY_LABEL } from '../../utils/jobCategory';

const SIGN_IN_TO_APPLY = {
  ka: 'გთხოვთ გაიაროთ ავტორიზაცია შეკვეთის გასაგზავნად',
  en: 'Please sign in to submit a proposal',
};
const SIGN_IN_TO_POST = {
  ka: 'გთხოვთ გაიაროთ ავტორიზაცია განცხადების გამოსაქვეყნებლად',
  en: 'Please sign in to post a job',
};
const SIGN_IN_TO_REVIEW = {
  ka: 'გთხოვთ გაიაროთ ავტორიზაცია შეფასების დასატოვებლად',
  en: 'Please sign in to leave a review',
};
const GRADUATES_ONLY_MESSAGE = {
  ka: 'განაცხადის გაგზავნა მხოლოდ CDC-ის კურსდამთავრებულებს შეუძლიათ.',
  en: 'Only verified CDC graduates can apply.',
};

type Tab = 'vacancies' | 'gigs';

export default function JobsDashboard({ defaultTab }: { defaultTab: Tab }) {
  const { t } = useTranslation('proposals');
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [tab, setTab] = useState<Tab>(defaultTab);

  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacanciesLoading, setVacanciesLoading] = useState(true);
  const [vacancySkills, setVacancySkills] = useState('');
  const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');
  const [vacancyCategoryFilter, setVacancyCategoryFilter] = useState('');
  const [applyingToVacancy, setApplyingToVacancy] = useState<Vacancy | null>(null);

  const [gigs, setGigs] = useState<Gig[]>([]);
  const [gigsLoading, setGigsLoading] = useState(true);
  const [gigSkills, setGigSkills] = useState('');
  const [budgetTypeFilter, setBudgetTypeFilter] = useState('');
  const [gigCategoryFilter, setGigCategoryFilter] = useState('');
  const [applyingToGig, setApplyingToGig] = useState<Gig | null>(null);
  const [reviewingGig, setReviewingGig] = useState<Gig | null>(null);
  const [reviewedGigIds, setReviewedGigIds] = useState<Set<string>>(new Set());

  const [showGraduateGate, setShowGraduateGate] = useState(false);

  const loadVacancies = useCallback(async () => {
    setVacanciesLoading(true);
    try {
      const data = await getVacancies({
        skills: vacancySkills ? vacancySkills.split(',').map((s) => s.trim()) : undefined,
        employmentType: employmentTypeFilter || undefined,
        category: vacancyCategoryFilter || undefined,
      });
      setVacancies(data);
    } catch (error) {
      console.error('Failed to load vacancies:', error);
    } finally {
      setVacanciesLoading(false);
    }
  }, [vacancySkills, employmentTypeFilter, vacancyCategoryFilter]);

  const loadGigs = useCallback(async () => {
    setGigsLoading(true);
    try {
      const data = await getGigs({
        skills: gigSkills ? gigSkills.split(',').map((s) => s.trim()) : undefined,
        budgetType: budgetTypeFilter || undefined,
        category: gigCategoryFilter || undefined,
      });
      setGigs(data);
    } catch (error) {
      console.error('Failed to load gigs:', error);
    } finally {
      setGigsLoading(false);
    }
  }, [gigSkills, budgetTypeFilter, gigCategoryFilter]);

  useEffect(() => {
    loadVacancies();
  }, [loadVacancies]);

  useEffect(() => {
    loadGigs();
  }, [loadGigs]);

  const canApply = !isAuthenticated || user?.role === 'Student';
  const isAdmin = !!user?.adminRole || user?.role === 'SuperAdmin';
  const isVerifiedBusiness = user?.role === 'Client' && !!user?.isVerified;
  const isVerifiedGraduate = !!user?.isVerifiedGraduate;

  const handleApplyVacancy = (vacancy: Vacancy) => {
    if (!isAuthenticated) {
      openAuthModal({
        message: SIGN_IN_TO_APPLY,
        onSuccess: (loggedInUser) => {
          if (loggedInUser?.isVerifiedGraduate) setApplyingToVacancy(vacancy);
          else setShowGraduateGate(true);
        },
      });
      return;
    }
    if (user?.isVerifiedGraduate) setApplyingToVacancy(vacancy);
    else setShowGraduateGate(true);
  };

  const handleApplyGig = (gig: Gig) => {
    if (!isAuthenticated) {
      openAuthModal({
        message: SIGN_IN_TO_APPLY,
        onSuccess: (loggedInUser) => {
          if (loggedInUser?.isVerifiedGraduate) setApplyingToGig(gig);
          else setShowGraduateGate(true);
        },
      });
      return;
    }
    if (user?.isVerifiedGraduate) setApplyingToGig(gig);
    else setShowGraduateGate(true);
  };

  const handleReviewClick = (gig: Gig) => {
    if (!isAuthenticated) {
      openAuthModal({ message: SIGN_IN_TO_REVIEW });
      return;
    }
    setReviewingGig(gig);
  };

  const tabButtonClass = (active: boolean) =>
    `flex-1 text-xs sm:text-sm font-bold px-4 py-3 rounded-xl transition text-center ${
      active
        ? 'bg-slate-900 text-white dark:bg-cyan-500 shadow'
        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
    }`;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100">
      <SiteHeader />

      <div className="relative overflow-hidden border-b border-slate-200/60 dark:border-slate-800">
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-cyan-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-16 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-8">
          <BackButton fallbackHref="/" className="text-slate-500 dark:text-slate-400 dark:hover:text-slate-100" />
          <div className="text-center mt-6">
            {/* leading-[1.2] + pb-1 give Georgian descenders (ვ, ჯ, ყ, ღ, პ, ხ...)
                room inside the box — without it, bg-clip-text + this section's
                overflow-hidden (needed for the blur blobs above) crops the
                bottom of the heading. */}
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-[1.2] pb-1">
              <span className="bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                დასაქმების ცენტრი
              </span>
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              იპოვეთ სამუშაო შესაძლებლობა ან გამოაქვეყნეთ საკუთარი განცხადება.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT — employer post form. Eligibility: verified business
            (Client + KYC isVerified), verified graduate (isVerifiedGraduate,
            typically Students who passed the freelancer exam), or any admin
            — everyone else authenticated sees why they can't post yet and a
            link to go get verified, rather than a bare RoleGate block. */}
        <div className="lg:col-span-1">
          <div className="rounded-3xl p-6 border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl shadow-sm sticky top-24">
            <h2 className="text-lg font-bold tracking-tight mb-6 leading-snug">დამსაქმებლის განცხადების დამატება</h2>
            {!isAuthenticated ? (
              <div className="text-center py-6">
                <p className="text-xs text-slate-400 mb-4">{SIGN_IN_TO_POST.ka}</p>
                <button
                  type="button"
                  onClick={() => openAuthModal({ message: SIGN_IN_TO_POST })}
                  className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold py-3 rounded-xl text-xs uppercase transition-all shadow-lg shadow-cyan-500/10 tracking-wider"
                >
                  ავტორიზაცია
                </button>
              </div>
            ) : isAdmin || isVerifiedBusiness || isVerifiedGraduate ? (
              <PostingForm initialType={tab === 'vacancies' ? 'vacancy' : 'gig'} allowTypeToggle />
            ) : (
              <div className="text-center py-6">
                <p className="text-xs text-slate-400 mb-4">
                  განცხადების გამოქვეყნება შეუძლიათ მხოლოდ ვერიფიცირებულ დამსაქმებლებსა და ვერიფიცირებულ (გამოცდაგავლილ)
                  ფრილანსერებს.
                </p>
                {user?.role === 'Client' ? (
                  <Link
                    href="/dashboard/settings"
                    className="inline-block w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold py-3 rounded-xl text-xs uppercase transition-all no-underline tracking-wider"
                  >
                    ბიზნეს ვერიფიკაციის გავლა
                  </Link>
                ) : (
                  <Link
                    href="/freelancer/exam"
                    className="inline-block w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold py-3 rounded-xl text-xs uppercase transition-all no-underline tracking-wider"
                  >
                    უნარების ვერიფიკაციის გავლა
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — tabbed listings */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex gap-2 p-1.5 rounded-2xl border border-slate-200/70 dark:border-slate-700/60 bg-white/70 dark:bg-slate-900/40 backdrop-blur-xl">
            <button type="button" onClick={() => setTab('vacancies')} className={tabButtonClass(tab === 'vacancies')}>
              დამსაქმებლის ვაკანსიები
            </button>
            <button type="button" onClick={() => setTab('gigs')} className={tabButtonClass(tab === 'gigs')}>
              დასაქმების მსურველთა განცხადებები
            </button>
          </div>

          {tab === 'vacancies' ? (
            <>
              <FilterBar
                skills={vacancySkills}
                onSkillsChange={setVacancySkills}
                skillsPlaceholder={t('marketplace.skillsFilterPlaceholder')}
                categoryFilter={{
                  label: 'კატეგორია',
                  value: vacancyCategoryFilter,
                  onChange: setVacancyCategoryFilter,
                  options: JOB_CATEGORIES.map((cat) => ({ value: cat, label: JOB_CATEGORY_LABEL[cat].ka })),
                }}
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
              {vacanciesLoading ? (
                <p className="text-sm text-slate-400">{t('marketplace.loading')}</p>
              ) : vacancies.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('marketplace.noVacanciesMatch')}</p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  {vacancies.map((vacancy) => (
                    <VacancyCard
                      key={vacancy.id}
                      vacancy={vacancy}
                      canApply={canApply}
                      onApply={handleApplyVacancy}
                      isOwnerOrAdmin={vacancy.postedBy.id === user?.id || user?.role === 'SuperAdmin'}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <FilterBar
                skills={gigSkills}
                onSkillsChange={setGigSkills}
                skillsPlaceholder={t('marketplace.skillsFilterPlaceholder')}
                categoryFilter={{
                  label: 'კატეგორია',
                  value: gigCategoryFilter,
                  onChange: setGigCategoryFilter,
                  options: JOB_CATEGORIES.map((cat) => ({ value: cat, label: JOB_CATEGORY_LABEL[cat].ka })),
                }}
                extraFilter={{
                  label: t('marketplace.budgetTypeLabel'),
                  value: budgetTypeFilter,
                  onChange: setBudgetTypeFilter,
                  options: [
                    { value: 'fixed', label: t('marketplace.budgetFixed') },
                    { value: 'hourly', label: t('marketplace.budgetHourly') },
                  ],
                }}
              />
              {gigsLoading ? (
                <p className="text-sm text-slate-400">{t('marketplace.loading')}</p>
              ) : gigs.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('marketplace.noGigsMatch')}</p>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  {gigs.map((gig) => (
                    <GigCard
                      key={gig.id}
                      gig={gig}
                      canApply={canApply}
                      onApply={handleApplyGig}
                      isOwnerOrAdmin={gig.postedBy.id === user?.id || user?.role === 'SuperAdmin'}
                      canReview={gig.postedBy.id === user?.id || gig.assignedFreelancerId === user?.id}
                      alreadyReviewed={reviewedGigIds.has(gig.id)}
                      onReview={handleReviewClick}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {applyingToVacancy && (
        <ApplicationModal
          title={t('marketplace.applyToTitle', { title: applyingToVacancy.title })}
          includeBid={false}
          onClose={() => setApplyingToVacancy(null)}
          onSubmit={async ({ note }) => {
            await applyToVacancy(applyingToVacancy.id, { coverNote: note });
          }}
        />
      )}

      {applyingToGig && (
        <ProposalModal
          gigTitle={applyingToGig.title}
          clientBudgetAmount={applyingToGig.budgetAmount}
          currency={applyingToGig.currency}
          onClose={() => setApplyingToGig(null)}
          onSubmit={async ({ proposalNote, bidAmount, deliveryDays }) => {
            await applyToGig(applyingToGig.id, { proposalNote, bidAmount, deliveryDays });
            setGigs((prev) =>
              prev.map((g) => (g.id === applyingToGig.id ? { ...g, applicationsCount: g.applicationsCount + 1 } : g))
            );
          }}
        />
      )}

      {showGraduateGate && <GraduateOnlyModal message={GRADUATES_ONLY_MESSAGE} onClose={() => setShowGraduateGate(false)} />}

      {reviewingGig && (
        <ReviewModal
          gigTitle={reviewingGig.title}
          revieweeName={
            reviewingGig.postedBy.id === user?.id
              ? reviewingGig.assignedFreelancer?.name ?? t('marketplace.freelancerFallbackName')
              : reviewingGig.postedBy.name
          }
          onClose={() => setReviewingGig(null)}
          onSubmit={async ({ rating, comment }) => {
            try {
              await createReview({ gigId: reviewingGig.id, rating, comment });
            } catch (err: any) {
              if (err?.response?.status === 409) {
                setReviewedGigIds((prev) => new Set(prev).add(reviewingGig.id));
              }
              throw err;
            }
            setReviewedGigIds((prev) => new Set(prev).add(reviewingGig.id));
          }}
        />
      )}

      <SiteFooter lang="GEO" />
    </div>
  );
}
