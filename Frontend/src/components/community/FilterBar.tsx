interface SelectFilter {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}

interface FilterBarProps {
  skills: string;
  onSkillsChange: (value: string) => void;
  skillsPlaceholder?: string;
  extraFilter?: SelectFilter;
  // Second dropdown, rendered after extraFilter — kept as its own prop
  // rather than turning extraFilter into an array, so every existing
  // single-filter call site keeps working unchanged.
  categoryFilter?: SelectFilter;
}

function FilterSelect({ filter }: { filter: SelectFilter }) {
  return (
    <select
      value={filter.value}
      onChange={(e) => filter.onChange(e.target.value)}
      className="rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
    >
      <option value="">{filter.label}</option>
      {filter.options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

export default function FilterBar({ skills, onSkillsChange, skillsPlaceholder, extraFilter, categoryFilter }: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-8">
      <input
        type="text"
        value={skills}
        onChange={(e) => onSkillsChange(e.target.value)}
        placeholder={skillsPlaceholder ?? 'Filter by skill (e.g. React, Figma)'}
        className="flex-1 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 bg-white/80 dark:bg-slate-900/50 backdrop-blur-xl px-4 py-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition"
      />
      {categoryFilter && <FilterSelect filter={categoryFilter} />}
      {extraFilter && <FilterSelect filter={extraFilter} />}
    </div>
  );
}