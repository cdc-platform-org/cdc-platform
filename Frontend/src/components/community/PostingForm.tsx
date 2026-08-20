import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { postVacancy, VacancyFormPayload } from '../../services/vacancyService';
import { postGig, PostGigPayload } from '../../services/gigService';
import { EmploymentType, GigBudgetType, JobCategory } from '../../types/community';
import { JOB_CATEGORIES, JOB_CATEGORY_LABEL } from '../../utils/jobCategory';
import { resolveLocale } from '../../utils/locale';
import RichTextEditor from '../shared/RichTextEditor';

type PostType = 'vacancy' | 'gig';

interface FieldErrors {
  [key: string]: string;
}

interface PostingFormProps {
  initialType: PostType;
  allowTypeToggle?: boolean;
  // Lets embedding contexts (e.g. the community page's sidebar) replace the
  // default centered-page card styling with something that fits a narrower
  // column, without duplicating the whole form.
  className?: string;
}

const emptyVacancyForm = {
  title: '',
  description: '',
  employmentType: 'full_time' as EmploymentType,
  location: '',
  skillsRequired: '',
  category: '' as JobCategory | '',
  salaryMin: '',
  salaryMax: '',
  currency: 'GEL',
  applicationDeadline: '',
};

const emptyGigForm = {
  title: '',
  description: '',
  budgetType: 'fixed' as GigBudgetType,
  budgetAmount: '',
  currency: 'GEL',
  skillsRequired: '',
  category: '' as JobCategory | '',
  deadline: '',
};

const DEFAULT_CLASS_NAME =
  'max-w-2xl mx-auto bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-8';

const EN_STRINGS = {
  tutorial: '🎥 Watch tutorial',
  vacancy: 'Vacancy',
  gig: 'Gig',
  title: 'Title',
  titlePlaceholderVacancy: 'e.g. Senior Frontend Developer',
  titlePlaceholderGig: 'e.g. Build a landing page in Next.js',
  description: 'Description',
  descriptionPlaceholder: 'Describe the role or project in detail…',
  skills: 'Required skills',
  skillsHint: '(comma-separated)',
  skillsPlaceholder: 'React, TypeScript, Figma',
  category: 'Category',
  optional: '(optional)',
  categoryEmpty: '—',
  employmentType: 'Employment type',
  employmentFullTime: 'Full-time',
  employmentPartTime: 'Part-time',
  employmentContract: 'Contract',
  employmentInternship: 'Internship',
  location: 'Location',
  locationPlaceholder: 'Remote / Ozurgeti, Georgia',
  minSalary: 'Min salary',
  maxSalary: 'Max salary',
  optionalPlaceholder: 'Optional',
  currency: 'Currency',
  deadline: 'Deadline',
  applicationDeadline: 'Application deadline',
  budgetType: 'Budget type',
  budgetFixed: 'Fixed price',
  budgetHourly: 'Hourly',
  budget: 'Budget',
  postVacancy: 'Post Vacancy',
  postGig: 'Post Gig',
  posting: 'Posting…',
  errTitle: 'Title must be at least 5 characters.',
  errDescription: 'Description must be at least 20 characters.',
  errLocation: 'Location is required.',
  errSkills: 'Add at least one skill.',
  errSalaryMax: 'Maximum salary must be greater than minimum.',
  errBudget: 'Enter a budget greater than 0.',
  errSubmitVacancy: 'Unable to post this vacancy. Please try again.',
  errSubmitGig: 'Unable to post this gig. Please try again.',
};

const dict = {
  ka: {
    tutorial: '🎥 ვიდეო ინსტრუქცია',
    vacancy: 'ვაკანსია',
    gig: 'გიგი',
    title: 'დასახელება',
    titlePlaceholderVacancy: 'მაგ. უფროსი Frontend დეველოპერი',
    titlePlaceholderGig: 'მაგ. საიტის მთავარი გვერდის შექმნა Next.js-ზე',
    description: 'აღწერა',
    descriptionPlaceholder: 'დეტალურად აღწერეთ პოზიცია ან პროექტი…',
    skills: 'საჭირო უნარები',
    skillsHint: '(მძიმით გამოყოფილი)',
    skillsPlaceholder: 'React, TypeScript, Figma',
    category: 'კატეგორია',
    optional: '(არასავალდებულო)',
    categoryEmpty: '—',
    employmentType: 'დასაქმების ტიპი',
    employmentFullTime: 'სრული განაკვეთი',
    employmentPartTime: 'ნახევარი განაკვეთი',
    employmentContract: 'ხელშეკრულებით',
    employmentInternship: 'სტაჟირება',
    location: 'მდებარეობა',
    locationPlaceholder: 'დისტანციური / ოზურგეთი, საქართველო',
    minSalary: 'მინ. ხელფასი',
    maxSalary: 'მაქს. ხელფასი',
    optionalPlaceholder: 'არასავალდებულო',
    currency: 'ვალუტა',
    deadline: 'ვადა',
    applicationDeadline: 'განაცხადის ვადა',
    budgetType: 'ბიუჯეტის ტიპი',
    budgetFixed: 'ფიქსირებული ფასი',
    budgetHourly: 'საათობრივი',
    budget: 'ბიუჯეტი',
    postVacancy: 'ვაკანსიის გამოქვეყნება',
    postGig: 'გიგის გამოქვეყნება',
    posting: 'ქვეყნდება…',
    errTitle: 'დასახელება უნდა შეიცავდეს მინიმუმ 5 სიმბოლოს.',
    errDescription: 'აღწერა უნდა შეიცავდეს მინიმუმ 20 სიმბოლოს.',
    errLocation: 'მდებარეობის მითითება სავალდებულოა.',
    errSkills: 'დაამატეთ მინიმუმ ერთი უნარი.',
    errSalaryMax: 'მაქსიმალური ხელფასი უნდა აღემატებოდეს მინიმალურს.',
    errBudget: 'მიუთითეთ ბიუჯეტი, რომელიც 0-ზე მეტია.',
    errSubmitVacancy: 'ვაკანსიის გამოქვეყნება ვერ მოხერხდა. სცადეთ თავიდან.',
    errSubmitGig: 'გიგის გამოქვეყნება ვერ მოხერხდა. სცადეთ თავიდან.',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

export default function PostingForm({ initialType, allowTypeToggle = false, className }: PostingFormProps) {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const [postType, setPostType] = useState<PostType>(initialType);
  const [vacancyForm, setVacancyForm] = useState(emptyVacancyForm);
  const [gigForm, setGigForm] = useState(emptyGigForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parseSkills = (raw: string) =>
    raw.split(',').map((s) => s.trim()).filter(Boolean);

  // <input type="date"> gives "YYYY-MM-DD"; the backend requires full ISO
  // 8601 datetime. Anchoring to UTC midnight (rather than `new Date(raw)`,
  // which parses as *local* midnight) avoids shifting the calendar date the
  // user picked when their timezone is behind UTC.
  const toIsoDatetime = (dateOnly: string) => (dateOnly ? `${dateOnly}T00:00:00.000Z` : null);

  const validateVacancy = (): FieldErrors => {
    const e: FieldErrors = {};
    if (vacancyForm.title.trim().length < 5) e.title = t.errTitle;
    if (vacancyForm.description.trim().length < 20) e.description = t.errDescription;
    if (!vacancyForm.location.trim()) e.location = t.errLocation;
    if (parseSkills(vacancyForm.skillsRequired).length === 0) e.skillsRequired = t.errSkills;
    if (vacancyForm.salaryMin && vacancyForm.salaryMax) {
      if (parseFloat(vacancyForm.salaryMin) > parseFloat(vacancyForm.salaryMax)) {
        e.salaryMax = t.errSalaryMax;
      }
    }
    return e;
  };

  const validateGig = (): FieldErrors => {
    const e: FieldErrors = {};
    if (gigForm.title.trim().length < 5) e.title = t.errTitle;
    if (gigForm.description.trim().length < 20) e.description = t.errDescription;
    if (!gigForm.budgetAmount || parseFloat(gigForm.budgetAmount) <= 0) {
      e.budgetAmount = t.errBudget;
    }
    if (parseSkills(gigForm.skillsRequired).length === 0) e.skillsRequired = t.errSkills;
    return e;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    const fieldErrors = postType === 'vacancy' ? validateVacancy() : validateGig();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;
    setSubmitting(true);

    try {
      if (postType === 'vacancy') {
        const payload: VacancyFormPayload = {
          title: vacancyForm.title.trim(),
          description: vacancyForm.description.trim(),
          employmentType: vacancyForm.employmentType,
          location: vacancyForm.location.trim(),
          skillsRequired: parseSkills(vacancyForm.skillsRequired),
          category: vacancyForm.category || null,
          salaryMin: vacancyForm.salaryMin ? Math.round(parseFloat(vacancyForm.salaryMin) * 100) : null,
          salaryMax: vacancyForm.salaryMax ? Math.round(parseFloat(vacancyForm.salaryMax) * 100) : null,
          currency: vacancyForm.salaryMin || vacancyForm.salaryMax ? vacancyForm.currency : null,
          applicationDeadline: toIsoDatetime(vacancyForm.applicationDeadline),
        };
        await postVacancy(payload);
        router.push('/vacancies');
      } else {
        const payload: PostGigPayload = {
          title: gigForm.title.trim(),
          description: gigForm.description.trim(),
          budgetType: gigForm.budgetType,
          budgetAmount: Math.round(parseFloat(gigForm.budgetAmount) * 100),
          currency: gigForm.currency,
          skillsRequired: parseSkills(gigForm.skillsRequired),
          category: gigForm.category || null,
          deadline: toIsoDatetime(gigForm.deadline),
        };
        await postGig(payload);
        router.push('/gigs');
      }
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || (postType === 'vacancy' ? t.errSubmitVacancy : t.errSubmitGig));
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full rounded-lg border px-3.5 py-2.5 text-sm dark:bg-slate-800/60 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
      hasError ? 'border-red-300 dark:border-red-500/50' : 'border-gray-300 dark:border-slate-700'
    }`;
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5';

  return (
    <div className={className ?? DEFAULT_CLASS_NAME}>
      <div className="flex justify-end mb-4">
        <Link href="/tutorials" target="_blank" className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap">
          {t.tutorial}
        </Link>
      </div>
      {allowTypeToggle && (
        <div className="flex gap-2 mb-8 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setPostType('vacancy')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              postType === 'vacancy' ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-sm' : 'text-gray-500 dark:text-slate-400'
            }`}
          >
            {t.vacancy}
          </button>
          <button
            type="button"
            onClick={() => setPostType('gig')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              postType === 'gig' ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-sm' : 'text-gray-500 dark:text-slate-400'
            }`}
          >
            {t.gig}
          </button>
        </div>
      )}

      {submitError && (
        <div className="mb-6 rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className={labelClass}>{t.title}</label>
          <input
            type="text"
            value={postType === 'vacancy' ? vacancyForm.title : gigForm.title}
            onChange={(e) =>
              postType === 'vacancy'
                ? setVacancyForm({ ...vacancyForm, title: e.target.value })
                : setGigForm({ ...gigForm, title: e.target.value })
            }
            className={inputClass(!!errors.title)}
            placeholder={postType === 'vacancy' ? t.titlePlaceholderVacancy : t.titlePlaceholderGig}
          />
          {errors.title && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.title}</p>}
        </div>

        <div>
          <label className={labelClass}>{t.description}</label>
          <RichTextEditor
            rows={5}
            value={postType === 'vacancy' ? vacancyForm.description : gigForm.description}
            onChange={(v) =>
              postType === 'vacancy'
                ? setVacancyForm({ ...vacancyForm, description: v })
                : setGigForm({ ...gigForm, description: v })
            }
            className={errors.description ? 'border-red-300' : ''}
            placeholder={t.descriptionPlaceholder}
          />
          {errors.description && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.description}</p>}
        </div>

        <div>
          <label className={labelClass}>
            {t.skills} <span className="text-gray-400 dark:text-slate-500 font-normal">{t.skillsHint}</span>
          </label>
          <input
            type="text"
            value={postType === 'vacancy' ? vacancyForm.skillsRequired : gigForm.skillsRequired}
            onChange={(e) =>
              postType === 'vacancy'
                ? setVacancyForm({ ...vacancyForm, skillsRequired: e.target.value })
                : setGigForm({ ...gigForm, skillsRequired: e.target.value })
            }
            className={inputClass(!!errors.skillsRequired)}
            placeholder={t.skillsPlaceholder}
          />
          {errors.skillsRequired && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.skillsRequired}</p>}
        </div>

        <div>
          <label className={labelClass}>
            {t.category} <span className="text-gray-400 dark:text-slate-500 font-normal">{t.optional}</span>
          </label>
          <select
            value={postType === 'vacancy' ? vacancyForm.category : gigForm.category}
            onChange={(e) =>
              postType === 'vacancy'
                ? setVacancyForm({ ...vacancyForm, category: e.target.value as JobCategory | '' })
                : setGigForm({ ...gigForm, category: e.target.value as JobCategory | '' })
            }
            className={inputClass(false)}
          >
            <option value="">{t.categoryEmpty}</option>
            {JOB_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {JOB_CATEGORY_LABEL[cat][lang]}
              </option>
            ))}
          </select>
        </div>

        {postType === 'vacancy' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t.employmentType}</label>
                <select
                  value={vacancyForm.employmentType}
                  onChange={(e) =>
                    setVacancyForm({ ...vacancyForm, employmentType: e.target.value as EmploymentType })
                  }
                  className={inputClass(false)}
                >
                  <option value="full_time">{t.employmentFullTime}</option>
                  <option value="part_time">{t.employmentPartTime}</option>
                  <option value="contract">{t.employmentContract}</option>
                  <option value="internship">{t.employmentInternship}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.location}</label>
                <input
                  type="text"
                  value={vacancyForm.location}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, location: e.target.value })}
                  className={inputClass(!!errors.location)}
                  placeholder={t.locationPlaceholder}
                />
                {errors.location && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.location}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>{t.minSalary}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={vacancyForm.salaryMin}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, salaryMin: e.target.value })}
                  className={inputClass(false)}
                  placeholder={t.optionalPlaceholder}
                />
              </div>
              <div>
                <label className={labelClass}>{t.maxSalary}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={vacancyForm.salaryMax}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, salaryMax: e.target.value })}
                  className={inputClass(!!errors.salaryMax)}
                  placeholder={t.optionalPlaceholder}
                />
                {errors.salaryMax && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.salaryMax}</p>}
              </div>
              <div>
                <label className={labelClass}>{t.currency}</label>
                <select
                  value={vacancyForm.currency}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, currency: e.target.value })}
                  className={inputClass(false)}
                >
                  <option value="GEL">GEL</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>
                {t.applicationDeadline} <span className="text-gray-400 dark:text-slate-500 font-normal">{t.optional}</span>
              </label>
              <input
                type="date"
                value={vacancyForm.applicationDeadline}
                onChange={(e) => setVacancyForm({ ...vacancyForm, applicationDeadline: e.target.value })}
                className={inputClass(false)}
              />
            </div>
          </>
        )}

        {postType === 'gig' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>{t.budgetType}</label>
                <select
                  value={gigForm.budgetType}
                  onChange={(e) => setGigForm({ ...gigForm, budgetType: e.target.value as GigBudgetType })}
                  className={inputClass(false)}
                >
                  <option value="fixed">{t.budgetFixed}</option>
                  <option value="hourly">{t.budgetHourly}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{t.budget}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={gigForm.budgetAmount}
                  onChange={(e) => setGigForm({ ...gigForm, budgetAmount: e.target.value })}
                  className={inputClass(!!errors.budgetAmount)}
                  placeholder="0.00"
                />
                {errors.budgetAmount && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.budgetAmount}</p>}
              </div>
              <div>
                <label className={labelClass}>{t.currency}</label>
                <select
                  value={gigForm.currency}
                  onChange={(e) => setGigForm({ ...gigForm, currency: e.target.value })}
                  className={inputClass(false)}
                >
                  <option value="GEL">GEL</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>
                {t.deadline} <span className="text-gray-400 dark:text-slate-500 font-normal">{t.optional}</span>
              </label>
              <input
                type="date"
                value={gigForm.deadline}
                onChange={(e) => setGigForm({ ...gigForm, deadline: e.target.value })}
                className={inputClass(false)}
              />
            </div>
          </>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 px-4 py-3.5 text-sm font-bold text-white transition-opacity disabled:opacity-60 mt-2"
        >
          {submitting ? t.posting : postType === 'vacancy' ? t.postVacancy : t.postGig}
        </button>
      </form>
    </div>
  );
}
