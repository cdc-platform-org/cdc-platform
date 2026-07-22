import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { postVacancy, PostVacancyPayload } from '../../services/vacancyService';
import { postGig, PostGigPayload } from '../../services/gigService';
import { EmploymentType, GigBudgetType } from '../../types/community';

type PostType = 'vacancy' | 'gig';

interface FieldErrors {
  [key: string]: string;
}

interface PostingFormProps {
  initialType: PostType;
  allowTypeToggle?: boolean;
}

const emptyVacancyForm = {
  title: '',
  description: '',
  employmentType: 'full_time' as EmploymentType,
  location: '',
  skillsRequired: '',
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
  deadline: '',
};

export default function PostingForm({ initialType, allowTypeToggle = false }: PostingFormProps) {
  const router = useRouter();
  const [postType, setPostType] = useState<PostType>(initialType);
  const [vacancyForm, setVacancyForm] = useState(emptyVacancyForm);
  const [gigForm, setGigForm] = useState(emptyGigForm);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const parseSkills = (raw: string) =>
    raw.split(',').map((s) => s.trim()).filter(Boolean);

  const validateVacancy = (): FieldErrors => {
    const e: FieldErrors = {};
    if (vacancyForm.title.trim().length < 5) e.title = 'Title must be at least 5 characters.';
    if (vacancyForm.description.trim().length < 20) e.description = 'Description must be at least 20 characters.';
    if (!vacancyForm.location.trim()) e.location = 'Location is required.';
    if (parseSkills(vacancyForm.skillsRequired).length === 0) e.skillsRequired = 'Add at least one skill.';
    if (vacancyForm.salaryMin && vacancyForm.salaryMax) {
      if (parseFloat(vacancyForm.salaryMin) > parseFloat(vacancyForm.salaryMax)) {
        e.salaryMax = 'Maximum salary must be greater than minimum.';
      }
    }
    return e;
  };

  const validateGig = (): FieldErrors => {
    const e: FieldErrors = {};
    if (gigForm.title.trim().length < 5) e.title = 'Title must be at least 5 characters.';
    if (gigForm.description.trim().length < 20) e.description = 'Description must be at least 20 characters.';
    if (!gigForm.budgetAmount || parseFloat(gigForm.budgetAmount) <= 0) {
      e.budgetAmount = 'Enter a budget greater than 0.';
    }
    if (parseSkills(gigForm.skillsRequired).length === 0) e.skillsRequired = 'Add at least one skill.';
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
        const payload: PostVacancyPayload = {
          title: vacancyForm.title.trim(),
          description: vacancyForm.description.trim(),
          employmentType: vacancyForm.employmentType,
          location: vacancyForm.location.trim(),
          skillsRequired: parseSkills(vacancyForm.skillsRequired),
          salaryMin: vacancyForm.salaryMin ? Math.round(parseFloat(vacancyForm.salaryMin) * 100) : null,
          salaryMax: vacancyForm.salaryMax ? Math.round(parseFloat(vacancyForm.salaryMax) * 100) : null,
          currency: vacancyForm.salaryMin || vacancyForm.salaryMax ? vacancyForm.currency : null,
          applicationDeadline: vacancyForm.applicationDeadline || null,
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
          deadline: gigForm.deadline || null,
        };
        await postGig(payload);
        router.push('/gigs');
      }
    } catch {
      setSubmitError(`Unable to post this ${postType}. Please try again.`);
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full rounded-lg border px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
      hasError ? 'border-red-300' : 'border-gray-300'
    }`;

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      {allowTypeToggle && (
        <div className="flex gap-2 mb-8 bg-gray-100 rounded-lg p-1 w-fit">
          <button
            type="button"
            onClick={() => setPostType('vacancy')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              postType === 'vacancy' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            Vacancy
          </button>
          <button
            type="button"
            onClick={() => setPostType('gig')}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              postType === 'gig' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500'
            }`}
          >
            Gig
          </button>
        </div>
      )}

      {submitError && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Title</label>
          <input
            type="text"
            value={postType === 'vacancy' ? vacancyForm.title : gigForm.title}
            onChange={(e) =>
              postType === 'vacancy'
                ? setVacancyForm({ ...vacancyForm, title: e.target.value })
                : setGigForm({ ...gigForm, title: e.target.value })
            }
            className={inputClass(!!errors.title)}
            placeholder={postType === 'vacancy' ? 'e.g. Senior Frontend Developer' : 'e.g. Build a landing page in Next.js'}
          />
          {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            rows={5}
            value={postType === 'vacancy' ? vacancyForm.description : gigForm.description}
            onChange={(e) =>
              postType === 'vacancy'
                ? setVacancyForm({ ...vacancyForm, description: e.target.value })
                : setGigForm({ ...gigForm, description: e.target.value })
            }
            className={inputClass(!!errors.description)}
            placeholder="Describe the role or project in detail…"
          />
          {errors.description && <p className="mt-1 text-xs text-red-600">{errors.description}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Required skills <span className="text-gray-400 font-normal">(comma-separated)</span>
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
            placeholder="React, TypeScript, Figma"
          />
          {errors.skillsRequired && <p className="mt-1 text-xs text-red-600">{errors.skillsRequired}</p>}
        </div>

        {postType === 'vacancy' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Employment type</label>
                <select
                  value={vacancyForm.employmentType}
                  onChange={(e) =>
                    setVacancyForm({ ...vacancyForm, employmentType: e.target.value as EmploymentType })
                  }
                  className={inputClass(false)}
                >
                  <option value="full_time">Full-time</option>
                  <option value="part_time">Part-time</option>
                  <option value="contract">Contract</option>
                  <option value="internship">Internship</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
                <input
                  type="text"
                  value={vacancyForm.location}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, location: e.target.value })}
                  className={inputClass(!!errors.location)}
                  placeholder="Remote / Ozurgeti, Georgia"
                />
                {errors.location && <p className="mt-1 text-xs text-red-600">{errors.location}</p>}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Min salary</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={vacancyForm.salaryMin}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, salaryMin: e.target.value })}
                  className={inputClass(false)}
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Max salary</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={vacancyForm.salaryMax}
                  onChange={(e) => setVacancyForm({ ...vacancyForm, salaryMax: e.target.value })}
                  className={inputClass(!!errors.salaryMax)}
                  placeholder="Optional"
                />
                {errors.salaryMax && <p className="mt-1 text-xs text-red-600">{errors.salaryMax}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Application deadline <span className="text-gray-400 font-normal">(optional)</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget type</label>
                <select
                  value={gigForm.budgetType}
                  onChange={(e) => setGigForm({ ...gigForm, budgetType: e.target.value as GigBudgetType })}
                  className={inputClass(false)}
                >
                  <option value="fixed">Fixed price</option>
                  <option value="hourly">Hourly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Budget</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={gigForm.budgetAmount}
                  onChange={(e) => setGigForm({ ...gigForm, budgetAmount: e.target.value })}
                  className={inputClass(!!errors.budgetAmount)}
                  placeholder="0.00"
                />
                {errors.budgetAmount && <p className="mt-1 text-xs text-red-600">{errors.budgetAmount}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Deadline <span className="text-gray-400 font-normal">(optional)</span>
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
          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 mt-2"
        >
          {submitting ? 'Posting…' : `Post ${postType === 'vacancy' ? 'Vacancy' : 'Gig'}`}
        </button>
      </form>
    </div>
  );
}