import { useState } from 'react';
import { X } from 'lucide-react';
import { FREELANCER_SKILLS, FREELANCER_SKILL_GROUPS } from '../../data/freelancerSkills';
import { SupportedLocale } from '../../utils/locale';

const STRINGS_BASE = {
  ka: {
    otherPlaceholder: 'სხვა უნარი…',
    addButton: 'დამატება',
    selectedLabel: 'არჩეული უნარები',
    noneSelected: 'უნარი არჩეული არ არის',
  },
  en: {
    otherPlaceholder: 'Other skill…',
    addButton: 'Add',
    selectedLabel: 'Selected skills',
    noneSelected: 'No skills selected yet',
  },
} as const;

// English fallback for locales without a translation yet. Cast through
// `unknown` because ka's and en's per-key literal string types otherwise
// don't structurally match under a single Record<SupportedLocale, ...>
// annotation — a TS inference artifact, not a real shape mismatch (de/es/fr/
// uk are literally the same object as en).
const STRINGS = {
  ...STRINGS_BASE,
  de: STRINGS_BASE.en,
  es: STRINGS_BASE.en,
  fr: STRINGS_BASE.en,
  uk: STRINGS_BASE.en,
} as unknown as Record<SupportedLocale, typeof STRINGS_BASE.en>;

// Shared "pick predefined skills + add custom ones" control — used by the
// Freelancer registration step, dashboard/settings.tsx's profile editor, and
// the admin course form's skillsTaught field. Predefined and custom skills
// are stored identically (just strings in `value`); this component doesn't
// distinguish them once added, only while picking.
export default function SkillPicker({
  value,
  onChange,
  lang,
}: {
  value: string[];
  onChange: (skills: string[]) => void;
  lang: SupportedLocale;
}) {
  const t = STRINGS[lang];
  const [customInput, setCustomInput] = useState('');

  const toggleSkill = (skill: string) => {
    onChange(value.includes(skill) ? value.filter((s) => s !== skill) : [...value, skill]);
  };

  const addCustomSkill = () => {
    const trimmed = customInput.trim();
    if (!trimmed || value.includes(trimmed)) return;
    onChange([...value, trimmed]);
    setCustomInput('');
  };

  const removeSkill = (skill: string) => {
    onChange(value.filter((s) => s !== skill));
  };

  const groups = Array.from(new Set(FREELANCER_SKILLS.map((s) => s.group)));

  return (
    <div className="space-y-4">
      {value.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{t.selectedLabel}</p>
          <div className="flex flex-wrap gap-2">
            {value.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30"
              >
                {skill}
                <button
                  type="button"
                  onClick={() => removeSkill(skill)}
                  aria-label={`Remove ${skill}`}
                  className="hover:text-red-500 bg-transparent border-none p-0 cursor-pointer flex items-center"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group}>
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
              {FREELANCER_SKILL_GROUPS[group]?.[lang] ?? group}
            </p>
            <div className="flex flex-wrap gap-2">
              {FREELANCER_SKILLS.filter((s) => s.group === group).map((skill) => {
                const selected = value.includes(skill.value);
                return (
                  <button
                    key={skill.value}
                    type="button"
                    onClick={() => toggleSkill(skill.value)}
                    aria-pressed={selected}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border cursor-pointer transition-colors ${
                      selected
                        ? 'bg-cyan-600 border-cyan-600 text-white'
                        : 'bg-white dark:bg-slate-800/60 border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:border-cyan-400/50'
                    }`}
                  >
                    {lang === 'ka' ? skill.labelKa : skill.labelEn}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustomSkill();
            }
          }}
          placeholder={t.otherPlaceholder}
          maxLength={80}
          className="flex-1 rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-800/60 px-3.5 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
        />
        <button
          type="button"
          onClick={addCustomSkill}
          className="text-xs font-bold px-4 py-2 rounded-lg bg-slate-900 dark:bg-cyan-600 text-white cursor-pointer disabled:opacity-50"
          disabled={!customInput.trim()}
        >
          {t.addButton}
        </button>
      </div>
    </div>
  );
}
