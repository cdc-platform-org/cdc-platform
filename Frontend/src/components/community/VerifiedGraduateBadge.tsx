interface VerifiedGraduateBadgeProps {
  size?: 'sm' | 'md';
}

// Distinct gold/blue treatment so it reads as an official credential, not
// just another status pill — deliberately different from every other badge
// color used in the app (indigo/emerald/amber elsewhere).
export default function VerifiedGraduateBadge({ size = 'md' }: VerifiedGraduateBadgeProps) {
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-0.5' : 'text-xs px-2.5 py-1 gap-1';

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border border-amber-300 bg-gradient-to-r from-amber-50 via-yellow-50 to-blue-50 text-blue-900 ${sizeClass}`}
      title="CDC-ის სერტიფიცირებული კურსდამთავრებული"
    >
      <span className="text-amber-500">🎓</span>
      CDC Verified Graduate
    </span>
  );
}
