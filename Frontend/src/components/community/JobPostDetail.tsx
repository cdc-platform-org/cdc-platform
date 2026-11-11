import { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ArrowLeft, CalendarClock, MapPin, Tag, Timer, Users, Briefcase } from 'lucide-react';
import { Gig, Vacancy } from '../../types/community';
import { getGigById, applyToGig } from '../../services/gigService';
import { getVacancyById, applyToVacancy } from '../../services/vacancyService';
import { useAuth } from '../../context/AuthContext';
import { useAuthModal } from '../../context/AuthModalContext';
import { useVerificationDrawer } from '../../context/VerificationDrawerContext';
import { isFreelancerVerified } from '../../types/auth';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import MarkdownContent from '../shared/MarkdownContent';
import ShareMenu from '../shared/ShareMenu';
import ApplicationModal from './ApplicationModal';
import ProposalModal from './ProposalModal';
import SoftVerificationNudge from './SoftVerificationNudge';
import { JobPost, jobPostHref, useJobPostLabels } from './JobPostCard';
import { PosterHeader, SkillChips, formatDate, primaryBtn, secondaryBtn } from './jobPostShared';
import { isHtmlContent } from '../../utils/richContent';
import { htmlToMarkdown, stripMarkdown } from '../../utils/markdownLite';

// Public detail page for a single gig / service offer / vacancy. Two
// columns on desktop (content + sticky action sidebar), one column with a
// sticky bottom action bar on mobile.

export default function JobPostDetail({ kind, id }: { kind: 'gig' | 'vacancy'; id: string | undefined }) {
  const [post, setPost] = useState<JobPost | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing'>('loading');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setState('loading');
    (kind === 'gig' ? getGigById(id).then((data) => ({ kind, data } as JobPost)) : getVacancyById(id).then((data) => ({ kind, data } as JobPost)))
      .then((p) => {
        if (cancelled) return;
        setPost(p);
        setState('ready');
      })
      .catch(() => !cancelled && setState('missing'));
    return () => {
      cancelled = true;
    };
  }, [kind, id]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-900 dark:text-slate-100">
      <SiteHeader />
      {state === 'ready' && post ? (
        <DetailBody post={post} onPostChange={setPost} />
      ) : (
        <DetailPlaceholder kind={kind} state={state} />
      )}
      <SiteFooter />
    </div>
  );
}

function DetailPlaceholder({ kind, state }: { kind: 'gig' | 'vacancy'; state: 'loading' | 'ready' | 'missing' }) {
  const { t } = useJobPostLabels({ kind: 'gig', data: { status: 'open' } as Gig });
  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-16 text-center">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {state === 'missing' ? t('postCard.notFound') : t('marketplace.loading')}
      </p>
      {state === 'missing' && (
        <Link href={kind === 'gig' ? '/gigs' : '/vacancies'} className={`${secondaryBtn} mt-6`}>
          {t('postCard.backToList')}
        </Link>
      )}
    </main>
  );
}

function DetailBody({ post, onPostChange }: { post: JobPost; onPostChange: (p: JobPost) => void }) {
  const { t, lang, isVacancy, typeLabel, price, category, primaryLabel } = useJobPostLabels(post);
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const { openVerificationDrawer } = useVerificationDrawer();
  const [applying, setApplying] = useState(false);
  const [nudge, setNudge] = useState(false);

  const data = post.data;
  const gig = !isVacancy ? (data as Gig) : null;
  const vacancy = isVacancy ? (data as Vacancy) : null;
  const href = jobPostHref(post);
  const listHref = isVacancy ? '/vacancies' : '/gigs';
  const isOpen = data.status === 'open';
  const isOwnerOrAdmin = !!user && (data.postedBy.id === user.id || user.role === 'SuperAdmin');
  const canApply = (!isAuthenticated || user?.role === 'Student') && !isOwnerOrAdmin;
  const showApply = canApply && isOpen;

  // Legacy AI drafts may be stored as HTML — convert to Markdown (inert
  // DOMParser, no innerHTML) so everything renders through react-markdown,
  // which never emits raw HTML.
  const [markdown, setMarkdown] = useState(() => (isHtmlContent(data.description) ? stripMarkdown(data.description) : data.description));
  useEffect(() => {
    setMarkdown(isHtmlContent(data.description) ? htmlToMarkdown(data.description) : data.description);
  }, [data.description]);

  const startApply = useCallback(() => {
    const proceed = (u: typeof user) => (u && isFreelancerVerified(u) ? setApplying(true) : setNudge(true));
    if (!isAuthenticated) {
      openAuthModal({ message: t('signIn.toApply'), onSuccess: (loggedIn) => proceed(loggedIn ?? null) });
      return;
    }
    proceed(user);
  }, [isAuthenticated, openAuthModal, t, user]);

  const priceCaption = isVacancy ? t('postCard.salary') : gig?.offerType === 'FREELANCER_OFFER' ? t('postCard.price') : t('postCard.budget');
  const deadline = gig?.deadline ?? vacancy?.applicationDeadline ?? null;

  const facts = useMemo(
    () =>
      [
        { icon: Briefcase, label: t('postCard.type'), value: typeLabel },
        category ? { icon: Tag, label: t('postCard.category'), value: category } : null,
        vacancy?.location ? { icon: MapPin, label: t('postCard.location'), value: vacancy.location } : null,
        gig?.deliveryDays ? { icon: Timer, label: t('postCard.deliveryTime'), value: t('postCard.delivery', { count: gig.deliveryDays }) } : null,
        { icon: CalendarClock, label: t('postCard.deadline'), value: deadline ? formatDate(deadline, lang) : t('postCard.noDeadline') },
        gig ? { icon: Users, label: t('postCard.applicationsCount'), value: String(gig.applicationsCount) } : null,
      ].filter(Boolean) as { icon: typeof Tag; label: string; value: string }[],
    [t, typeLabel, category, vacancy, gig, deadline, lang]
  );

  const actions = (
    <>
      {showApply && (
        <button type="button" onClick={startApply} className={`${primaryBtn} w-full`} data-testid="detail-primary-action">
          {primaryLabel}
        </button>
      )}
      {isOwnerOrAdmin && (
        <Link href={`${href}/applications`} className={`${secondaryBtn} w-full`}>
          {t('marketplace.viewApplications')}
        </Link>
      )}
    </>
  );

  return (
    <>
      <Head>
        <title>{`${data.title} | CDC`}</title>
        <meta name="description" content={stripMarkdown(data.description).slice(0, 160)} />
        <meta property="og:title" content={data.title} />
        <meta property="og:description" content={stripMarkdown(data.description).slice(0, 200)} />
      </Head>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-28 lg:pb-16">
        <Link
          href={listHref}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white no-underline"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {t('postCard.backToList')}
        </Link>

        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
          {/* Main column */}
          <article className="min-w-0 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 px-2 py-0.5 font-medium text-slate-600 dark:text-slate-300">
                {typeLabel}
              </span>
              {category && <span className="font-medium text-slate-500 dark:text-slate-400">{category}</span>}
              {!isOpen && (
                <span className="inline-flex items-center rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-medium text-slate-600 dark:text-slate-300 capitalize">
                  {data.status}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl sm:text-[1.75rem] font-semibold leading-tight tracking-tight text-slate-900 dark:text-white break-words">
              {data.title}
            </h1>
            <div className="mt-5">
              <PosterHeader poster={data.postedBy} createdAt={data.createdAt} lang={lang} size="lg" />
            </div>

            <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-4">
              {facts.map(({ icon: Icon, label, value }, i) => (
                <div key={i} className="flex items-start gap-2.5 min-w-0">
                  <Icon className="w-4 h-4 mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
                    <dd className="text-sm font-medium text-slate-800 dark:text-slate-200 break-words m-0">{value}</dd>
                  </div>
                </div>
              ))}
            </dl>

            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('postCard.about')}</h2>
              <MarkdownContent content={markdown} className="mt-3 !text-[0.95rem] !text-slate-700 dark:!text-slate-300 break-words" />
            </section>

            {data.skillsRequired.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('postCard.skills')}</h2>
                <SkillChips skills={data.skillsRequired} className="mt-3" />
              </section>
            )}

            {gig && gig.portfolioLinks?.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('postCard.portfolio')}</h2>
                <ul className="mt-3 space-y-1.5 list-none p-0">
                  {gig.portfolioLinks.map((link) => (
                    <li key={link} className="min-w-0">
                      <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-cyan-700 dark:text-cyan-400 underline break-all">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </article>

          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block lg:sticky lg:top-24">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
              {price && (
                <>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{priceCaption}</p>
                  <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white" data-testid="detail-price">
                    {price}
                  </p>
                </>
              )}
              <div className={`${price ? 'mt-5' : ''} flex flex-col gap-2.5`}>
                {actions}
                <ShareMenu url={href} title={data.title} variant="button" />
              </div>
              {isOwnerOrAdmin && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t('postCard.ownerNotice')}</p>}
              {!isOpen && <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">{t('postCard.closedNotice')}</p>}
              <p className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
                {t('postCard.postedOn', { date: formatDate(data.createdAt, lang) })}
              </p>
            </div>
          </aside>
        </div>
      </main>

      {/* Sticky bottom action bar (mobile/tablet). Below `sm` it sits on top of
          MobileTabBar (h-16 + safe area), which is fixed at the very bottom. */}
      <div className="lg:hidden fixed inset-x-0 z-50 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] sm:bottom-0 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur px-4 py-3 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          {price && (
            <div className="min-w-0 shrink">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-none">{priceCaption}</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white whitespace-nowrap">{price}</p>
            </div>
          )}
          <div className="flex-1 min-w-0 flex items-center gap-2 justify-end">
            <div className="flex-1 min-w-0 flex flex-col gap-2">{actions}</div>
            <ShareMenu url={href} title={data.title} align="right" direction="up" />
          </div>
        </div>
      </div>

      {applying && vacancy && (
        <ApplicationModal
          title={t('marketplace.applyToTitle', { title: vacancy.title })}
          includeBid={false}
          onClose={() => setApplying(false)}
          onSubmit={async ({ note }) => {
            await applyToVacancy(vacancy.id, { coverNote: note });
          }}
        />
      )}
      {applying && gig && (
        <ProposalModal
          gigTitle={gig.title}
          clientBudgetAmount={gig.budgetAmount}
          currency={gig.currency}
          onClose={() => setApplying(false)}
          onSubmit={async ({ proposalNote, bidAmount, deliveryDays }) => {
            await applyToGig(gig.id, { proposalNote, bidAmount, deliveryDays });
            onPostChange({ kind: 'gig', data: { ...gig, applicationsCount: gig.applicationsCount + 1 } });
          }}
        />
      )}
      {nudge && (
        <SoftVerificationNudge
          onContinueWithoutVerifying={() => {
            setNudge(false);
            setApplying(true);
          }}
          onVerify={() => {
            setNudge(false);
            openVerificationDrawer({ initialTab: 'individual' });
          }}
          onClose={() => setNudge(false)}
        />
      )}
    </>
  );
}
