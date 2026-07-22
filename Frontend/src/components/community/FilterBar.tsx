interface FilterBarProps {
  skills: string;
  onSkillsChange: (value: string) => void;
  extraFilter?: {
    label: string;
    value: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  };
}

export default function FilterBar({ skills, onSkillsChange, extraFilter }: FilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 mb-6">
      <input
        type="text"
        value={skills}
        onChange={(e) => onSkillsChange(e.target.value)}
        placeholder="Filter by skill (e.g. React, Figma)"
        className="flex-1 rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      {extraFilter && (
        <select
          value={extraFilter.value}
          onChange={(e) => extraFilter.onChange(e.target.value)}
          className="rounded-lg border border-gray-300 px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">{extraFilter.label}</option>          {extraFilter.options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}