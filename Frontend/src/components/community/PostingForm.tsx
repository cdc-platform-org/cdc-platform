import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { postVacancy, VacancyFormPayload } from '../../services/vacancyService';
import { postGig, PostGigPayload } from '../../services/gigService';
import { EmploymentType, GigBudgetType, GigOfferType, JobCategory } from '../../types/community';
import { JOB_CATEGORIES, JOB_CATEGORY_LABEL } from '../../utils/jobCategory';
import { resolveLocale } from '../../utils/locale';
import RichTextEditor from '../shared/RichTextEditor';

// Three distinct posting types, two directions:
//   - 'vacancy'     Group A (employer): a long-term job opening.
//   - 'gig_request' Group A (employer): "შეკვეთა" — a client asking for a
//                    freelancer for a project (maps to Gig.offerType
//                    CLIENT_REQUEST).
//   - 'gig_offer'    Group B (freelancer): "მომსახურების შეთავაზება" — a
//                    freelancer advertising their own service (maps to
//                    Gig.offerType FREELANCER_OFFER). Same Gig table, see
//                    the GigOfferType comment in Backend/prisma/schema.prisma.
type PostType = 'vacancy' | 'gig_request' | 'gig_offer';

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
  // FREELANCER_OFFER only:
  portfolioLinks: '',
  deliveryDays: '',
};

const DEFAULT_CLASS_NAME =
  'max-w-2xl mx-auto bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-gray-200 dark:border-slate-800 p-8';

const EN_STRINGS = {
  tutorial: '🎥 Watch tutorial',
  vacancy: 'Vacancy',
  gigRequest: 'Freelance Order',
  gigOffer: 'Service Offer',
  title: 'Title',
  titlePlaceholderVacancy: 'e.g. Senior Frontend Developer',
  titlePlaceholderGigRequest: 'e.g. Looking for a designer to create a logo',
  titlePlaceholderGigOffer: 'e.g. I design vector logos — hire me',
  description: 'Description',
  descriptionOffer: 'Skill Description',
  descriptionPlaceholder: 'Describe the role or project in detail…',
  descriptionOfferPlaceholder: 'Describe the service you offer and your experience…',
  skills: 'Required skills',
  skillsHint: '(comma-separated)',
  skillsPlaceholder: 'React, TypeScript, Figma',
  category: 'Category',
  categoryEmpty: 'Select a category…',
  employmentType: 'Employment type',
  employmentFullTime: 'Full-time',
  employmentPartTime: 'Part-time',
  employmentContract: 'Contract',
  employmentInternship: 'Internship',
  location: 'Location',
  locationPlaceholder: 'Remote / Ozurgeti, Georgia',
  minSalary: 'Min salary',
  maxSalary: 'Max salary',
  salaryPlaceholder: 'e.g. 1500',
  currency: 'Currency',
  deadline: 'Deadline',
  applicationDeadline: 'Application deadline',
  budgetType: 'Budget type',
  budgetFixed: 'Fixed price',
  budgetHourly: 'Hourly',
  budget: 'Budget',
  startingPriceType: 'Starting price type',
  startingPrice: 'Starting price / rate',
  portfolioLinks: 'Portfolio links',
  portfolioLinksHint: '(one per line or comma-separated)',
  portfolioLinksPlaceholder: 'https://behance.net/yourprofile',
  deliveryDays: 'Delivery time (days)',
  deliveryDaysPlaceholder: 'e.g. 3',
  postVacancy: 'Post Vacancy',
  postGigRequest: 'Post Order',
  postGigOffer: 'Post Service Offer',
  posting: 'Posting…',
  errTitle: 'Title must be at least 5 characters.',
  errDescription: 'Description must be at least 20 characters.',
  errLocation: 'Location is required.',
  errSkills: 'Add at least one skill.',
  errCategory: 'Please choose a category.',
  errSalaryMin: 'Minimum salary is required.',
  errSalaryMaxRequired: 'Maximum salary is required.',
  errSalaryMax: 'Maximum salary must be greater than or equal to minimum salary.',
  errDeadline: 'A deadline is required.',
  errBudget: 'Enter a budget greater than 0.',
  errPortfolioLinks: 'Add at least one portfolio link.',
  errPortfolioLinkInvalid: 'Enter valid links starting with http:// or https://.',
  errDeliveryDays: 'Delivery time is required.',
  errSubmitVacancy: 'Unable to post this vacancy. Please try again.',
  errSubmitGigRequest: 'Unable to post this order. Please try again.',
  errSubmitGigOffer: 'Unable to post this service offer. Please try again.',
};

const dict = {
  ka: {
    tutorial: '🎥 ვიდეო ინსტრუქცია',
    vacancy: 'ვაკანსია',
    gigRequest: 'შეკვეთა',
    gigOffer: 'მომსახურების შეთავაზება',
    title: 'დასახელება',
    titlePlaceholderVacancy: 'მაგ. უფროსი Frontend დეველოპერი',
    titlePlaceholderGigRequest: 'მაგ. საჭიროა დიზაინერი ლოგოს შესაქმნელად',
    titlePlaceholderGigOffer: 'მაგ. ვქმნი ვექტორულ ლოგოებს — დამიქირავეთ',
    description: 'აღწერა',
    descriptionOffer: 'უნარების აღწერა',
    descriptionPlaceholder: 'დეტალურად აღწერეთ პოზიცია ან პროექტი…',
    descriptionOfferPlaceholder: 'აღწერეთ თქვენი მომსახურება და გამოცდილება…',
    skills: 'საჭირო უნარები',
    skillsHint: '(მძიმით გამოყოფილი)',
    skillsPlaceholder: 'React, TypeScript, Figma',
    category: 'კატეგორია',
    categoryEmpty: 'აირჩიეთ კატეგორია…',
    employmentType: 'დასაქმების ტიპი',
    employmentFullTime: 'სრული განაკვეთი',
    employmentPartTime: 'ნახევარი განაკვეთი',
    employmentContract: 'ხელშეკრულებით',
    employmentInternship: 'სტაჟირება',
    location: 'მდებარეობა',
    locationPlaceholder: 'დისტანციური / ოზურგეთი, საქართველო',
    minSalary: 'მინ. ხელფასი',
    maxSalary: 'მაქს. ხელფასი',
    salaryPlaceholder: 'მაგ. 1500',
    currency: 'ვალუტა',
    deadline: 'ვადა',
    applicationDeadline: 'განაცხადის ვადა',
    budgetType: 'ბიუჯეტის ტიპი',
    budgetFixed: 'ფიქსირებული ფასი',
    budgetHourly: 'საათობრივი',
    budget: 'ბიუჯეტი',
    startingPriceType: 'საწყისი ფასის ტიპი',
    startingPrice: 'საწყისი ფასი / განაკვეთი',
    portfolioLinks: 'პორტფოლიოს ბმულები',
    portfolioLinksHint: '(თითო ხაზზე ერთი ან მძიმით გამოყოფილი)',
    portfolioLinksPlaceholder: 'https://behance.net/yourprofile',
    deliveryDays: 'მიწოდების ვადა (დღეებში)',
    deliveryDaysPlaceholder: 'მაგ. 3',
    postVacancy: 'ვაკანსიის გამოქვეყნება',
    postGigRequest: 'შეკვეთის გამოქვეყნება',
    postGigOffer: 'შეთავაზების გამოქვეყნება',
    posting: 'ქვეყნდება…',
    errTitle: 'დასახელება უნდა შეიცავდეს მინიმუმ 5 სიმბოლოს.',
    errDescription: 'აღწერა უნდა შეიცავდეს მინიმუმ 20 სიმბოლოს.',
    errLocation: 'მდებარეობის მითითება სავალდებულოა.',
    errSkills: 'დაამატეთ მინიმუმ ერთი უნარი.',
    errCategory: 'გთხოვთ აირჩიოთ კატეგორია.',
    errSalaryMin: 'მინიმალური ხელფასის მითითება სავალდებულოა.',
    errSalaryMaxRequired: 'მაქსიმალური ხელფასის მითითება სავალდებულოა.',
    errSalaryMax: 'მაქსიმალური ხელფასი უნდა აღემატებოდეს ან უდრიდეს მინიმალურს.',
    errDeadline: 'ვადის მითითება სავალდებულოა.',
    errBudget: 'მიუთითეთ ბიუჯეტი, რომელიც 0-ზე მეტია.',
    errPortfolioLinks: 'დაამატეთ მინიმუმ ერთი პორტფოლიოს ბმული.',
    errPortfolioLinkInvalid: 'ბმულები უნდა იწყებოდეს http:// ან https://-ით.',
    errDeliveryDays: 'მიწოდების ვადის მითითება სავალდებულოა.',
    errSubmitVacancy: 'ვაკანსიის გამოქვეყნება ვერ მოხერხდა. სცადეთ თავიდან.',
    errSubmitGigRequest: 'შეკვეთის გამოქვეყნება ვერ მოხერხდა. სცადეთ თავიდან.',
    errSubmitGigOffer: 'შეთავაზების გამოქვეყნება ვერ მოხერხდა. სცადეთ თავიდან.',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

function parsePortfolioLinks(raw: string): string[] {
  return Array.from(new Set(raw.split(/[\n,]/).map((s) => s.trim()).filter(Boolean)));
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\/.+/i.test(value);
}

export default function PostingForm({ initialType, allowTypeToggle = false, className }: PostingFormProps) {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const [postType, setPostType] = useState<PostType>(initialType);
  const [vacancyForm, setVacancyForm] = useState(emptyVacancyForm);
  const [gigForm, setGigForm] = useState(emptyGigForm);
  // Field-level errors only ever *display* once the user has tried to
  // submit at least once (`attempted`) — otherwise every required field
  // would render red before they've typed anything. Once true, errors are
  // recomputed live from current form state every render (see `errors`
  // below) so a field's red state clears the moment it's fixed, not just on
  // the next submit click.
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isGig = postType === 'gig_request' || postType === 'gig_offer';
  const offerType: GigOfferType = postType === 'gig_offer' ? 'FREELANCER_OFFER' : 'CLIENT_REQUEST';

  const parseSkills = (raw: string) =>
    raw.split(',').map((s) => s.trim()).filter(Boolean);

  // <input type="date"> gives "YYYY-MM-DD"; the backend requires full ISO
  // 8601 datetime. Anchoring to UTC midnight (rather than `new Date(raw)`,
  // which parses as *local* midnight) avoids shifting the calendar date the
  // user picked when their timezone is behind UTC.
  const toIsoDatetime = (dateOnly: string) => (dateOnly ? `${dateOnly}T00:00:00.000Z` : null);

  // Every field the backend's postVacancySchema now requires at creation
  // (see Backend/src/schemas/vacancySchemas.ts) is validated here too, so a
  // user sees the specific missing field before submitting rather than a
  // generic 400 back from the API.
  const validateVacancy = (): FieldErrors => {
    const e: FieldErrors = {};
    if (vacancyForm.title.trim().length < 5) e.title = t.errTitle;
    if (vacancyForm.description.trim().length < 20) e.description = t.errDescription;
    if (!vacancyForm.location.trim()) e.location = t.errLocation;
    if (parseSkills(vacancyForm.skillsRequired).length === 0) e.skillsRequired = t.errSkills;
    if (!vacancyForm.category) e.category = t.errCategory;
    if (!vacancyForm.salaryMin) {
      e.salaryMin = t.errSalaryMin;
    }
    if (!vacancyForm.salaryMax) {
      e.salaryMax = t.errSalaryMaxRequired;
    } else if (vacancyForm.salaryMin && parseFloat(vacancyForm.salaryMin) > parseFloat(vacancyForm.salaryMax)) {
      e.salaryMax = t.errSalaryMax;
    }
    if (!vacancyForm.applicationDeadline) e.applicationDeadline = t.errDeadline;
    return e;
  };

  // Shared by both gig sub-types (see postGigSchema's matching refinements
  // on the backend) — gig_request additionally requires a deadline,
  // gig_offer additionally requires portfolioLinks + deliveryDays.
  const validateGig = (): FieldErrors => {
    const e: FieldErrors = {};
    if (gigForm.title.trim().length < 5) e.title = t.errTitle;
    if (gigForm.description.trim().length < 20) e.description = t.errDescription;
    if (!gigForm.budgetAmount || parseFloat(gigForm.budgetAmount) <= 0) {
      e.budgetAmount = t.errBudget;
    }
    if (parseSkills(gigForm.skillsRequired).length === 0) e.skillsRequired = t.errSkills;
    if (!gigForm.category) e.category = t.errCategory;

    if (postType === 'gig_request') {
      if (!gigForm.deadline) e.deadline = t.errDeadline;
    } else {
      const links = parsePortfolioLinks(gigForm.portfolioLinks);
      if (links.length === 0) {
        e.portfolioLinks = t.errPortfolioLinks;
      } else if (!links.every(isHttpUrl)) {
        e.portfolioLinks = t.errPortfolioLinkInvalid;
      }
      if (!gigForm.deliveryDays || parseInt(gigForm.deliveryDays, 10) <= 0) {
        e.deliveryDays = t.errDeliveryDays;
      }
    }
    return e;
  };

  // Recomputed every render from current form state — drives both the
  // submit button's disabled state and (once `attempted`) the field-level
  // error messages/highlights below.
  const currentErrors = postType === 'vacancy' ? validateVacancy() : validateGig();
  const isFormValid = Object.keys(currentErrors).length === 0;
  const errors = attempted ? currentErrors : {};

  const submitErrorFallback =
    postType === 'vacancy' ? t.errSubmitVacancy : postType === 'gig_request' ? t.errSubmitGigRequest : t.errSubmitGigOffer;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setAttempted(true);
    if (!isFormValid) return;
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
          offerType,
          deadline: postType === 'gig_request' ? toIsoDatetime(gigForm.deadline) : null,
          portfolioLinks: postType === 'gig_offer' ? parsePortfolioLinks(gigForm.portfolioLinks) : [],
          deliveryDays: postType === 'gig_offer' ? parseInt(gigForm.deliveryDays, 10) : null,
        };
        await postGig(payload);
        router.push('/gigs');
      }
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message || submitErrorFallback);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full rounded-lg border px-3.5 py-2.5 text-sm dark:bg-slate-800/60 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent ${
      hasError ? 'border-red-300 dark:border-red-500/50' : 'border-gray-300 dark:border-slate-700'
    }`;
  // Native <select> text clips silently once its own box gets too narrow
  // (a 2-3up grid on a modal-width form) — there's no CSS that lets a closed
  // select wrap or ellipsize its selected option, so the real fix is width
  // (grids below now stack to 1 column until sm:) plus enough right padding
  // that the option text never sits flush against the custom arrow.
  // appearance-none + this SVG replaces each browser's own inconsistent
  // native arrow with one smooth, uniform chevron across the group.
  const selectClass = (hasError: boolean) =>
    `${inputClass(hasError)} appearance-none pr-10 bg-no-repeat bg-[right_0.75rem_center] bg-[length:1rem] bg-[url('data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%2F%3E%3C%2Fsvg%3E')]`;
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1.5';

  const titlePlaceholder =
    postType === 'vacancy' ? t.titlePlaceholderVacancy : postType === 'gig_request' ? t.titlePlaceholderGigRequest : t.titlePlaceholderGigOffer;
  const descriptionPlaceholder = postType === 'gig_offer' ? t.descriptionOfferPlaceholder : t.descriptionPlaceholder;
  const postButtonLabel =
    postType === 'vacancy' ? t.postVacancy : postType === 'gig_request' ? t.postGigRequest : t.postGigOffer;

  return (
    <div className={className ?? DEFAULT_CLASS_NAME}>
      <div className="flex justify-end mb-4">
        <Link href="/tutorials" target="_blank" className="text-xs font-semibold text-cyan-600 dark:text-cyan-400 hover:underline whitespace-nowrap">
          {t.tutorial}
        </Link>
      </div>
      {allowTypeToggle && (
        <div className="flex flex-wrap gap-2 mb-8 bg-gray-100 dark:bg-slate-800 rounded-lg p-1 w-fit">
          {(
            [
              ['vacancy', t.vacancy],
              ['gig_request', t.gigRequest],
              ['gig_offer', t.gigOffer],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => setPostType(type)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                postType === type ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-sm' : 'text-gray-500 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
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
            placeholder={titlePlaceholder}
          />
          {errors.title && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.title}</p>}
        </div>

        <div>
          <label className={labelClass}>{postType === 'gig_offer' ? t.descriptionOffer : t.description}</label>
          <RichTextEditor
            rows={5}
            value={postType === 'vacancy' ? vacancyForm.description : gigForm.description}
            onChange={(v) =>
              postType === 'vacancy'
                ? setVacancyForm({ ...vacancyForm, description: v })
                : setGigForm({ ...gigForm, description: v })
            }
            className={errors.description ? 'border-red-300' : ''}
            placeholder={descriptionPlaceholder}
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
          <label className={labelClass}>{t.category}</label>
          <select
            value={postType === 'vacancy' ? vacancyForm.category : gigForm.category}
            onChange={(e) =>
              postType === 'vacancy'
                ? setVacancyForm({ ...vacancyForm, category: e.target.value as JobCategory | '' })
                : setGigForm({ ...gigForm, category: e.target.value as JobCategory | '' })
            }
            className={selectClass(!!errors.category)}
          >
            <option value="">{t.categoryEmpty}</option>
            {JOB_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {JOB_CATEGORY_LABEL[cat][lang]}
              </option>
            ))}
          </select>
          {errors.category && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.category}</p>}
        </div>

        {postType === 'vacancy' && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{t.employmentType}</label>
                <select
                  value={vacancyForm.employmentType}
                  onChange={(e) =>
                    setVacancyForm({ ...vacancyForm, employmentType: e.target.value as EmploymentType })
                  }
                  className={selectClass(false)}
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

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>{t.minSalary}</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={vacancyForm.salaryMin}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, salaryMin: e.target.value })}
                  className={inputClass(!!errors.salaryMin)}
                  placeholder={t.salaryPlaceholder}
                />
                {errors.salaryMin && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.salaryMin}</p>}
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
                  placeholder={t.salaryPlaceholder}
                />
                {errors.salaryMax && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.salaryMax}</p>}
              </div>
              <div>
                <label className={labelClass}>{t.currency}</label>
                <select
                  value={vacancyForm.currency}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, currency: e.target.value })}
                  className={selectClass(false)}
                >
                  <option value="GEL">GEL</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClass}>{t.applicationDeadline}</label>
              <input
                type="date"
                value={vacancyForm.applicationDeadline}
                onChange={(e) => setVacancyForm({ ...vacancyForm, applicationDeadline: e.target.value })}
                className={inputClass(!!errors.applicationDeadline)}
              />
              {errors.applicationDeadline && (
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.applicationDeadline}</p>
              )}
            </div>
          </>
        )}

        {isGig && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>{postType === 'gig_offer' ? t.startingPriceType : t.budgetType}</label>
                <select
                  value={gigForm.budgetType}
                  onChange={(e) => setGigForm({ ...gigForm, budgetType: e.target.value as GigBudgetType })}
                  className={selectClass(false)}
                >
                  <option value="fixed">{t.budgetFixed}</option>
                  <option value="hourly">{t.budgetHourly}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>{postType === 'gig_offer' ? t.startingPrice : t.budget}</label>
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
                  className={selectClass(false)}
                >
                  <option value="GEL">GEL</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            {postType === 'gig_request' ? (
              <div>
                <label className={labelClass}>{t.deadline}</label>
                <input
                  type="date"
                  value={gigForm.deadline}
                  onChange={(e) => setGigForm({ ...gigForm, deadline: e.target.value })}
                  className={inputClass(!!errors.deadline)}
                />
                {errors.deadline && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.deadline}</p>}
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass}>
                    {t.portfolioLinks} <span className="text-gray-400 dark:text-slate-500 font-normal">{t.portfolioLinksHint}</span>
                  </label>
                  <textarea
                    rows={3}
                    value={gigForm.portfolioLinks}
                    onChange={(e) => setGigForm({ ...gigForm, portfolioLinks: e.target.value })}
                    className={inputClass(!!errors.portfolioLinks)}
                    placeholder={t.portfolioLinksPlaceholder}
                  />
                  {errors.portfolioLinks && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.portfolioLinks}</p>}
                </div>
                <div>
                  <label className={labelClass}>{t.deliveryDays}</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={gigForm.deliveryDays}
                    onChange={(e) => setGigForm({ ...gigForm, deliveryDays: e.target.value })}
                    className={inputClass(!!errors.deliveryDays)}
                    placeholder={t.deliveryDaysPlaceholder}
                  />
                  {errors.deliveryDays && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{errors.deliveryDays}</p>}
                </div>
              </>
            )}
          </>
        )}

        <button
          type="submit"
          disabled={submitting || (attempted && !isFormValid)}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90 px-4 py-3.5 text-sm font-bold text-white transition-opacity disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {submitting ? t.posting : postButtonLabel}
        </button>
      </form>
    </div>
  );
}
