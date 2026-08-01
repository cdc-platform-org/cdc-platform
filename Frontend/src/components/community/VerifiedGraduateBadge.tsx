import { Wifi } from 'lucide-react';

interface VerifiedGraduateBadgeProps {
  size?: 'sm' | 'md';
  iconOnly?: boolean;
}

// Glowing cyan Wi-Fi/signal mark — echoes the broadcast-signal icon in the
// CDC logo's walking-girl mark, so a graduate's badge visually ties back to
// the brand instead of a generic 🎓 emoji. Deliberately a dark chip (not a
// light tint like other status pills) so the glow actually reads as a glow
// against both light and dark page backgrounds.
export default function VerifiedGraduateBadge({ size = 'md', iconOnly = false }: VerifiedGraduateBadgeProps) {
  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';
  const iconSize = size === 'sm' ? 10 : 13;

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold border border-cyan-400/70 bg-gradient-to-r from-slate-900 via-cyan-950 to-slate-900 text-cyan-300 shadow-[0_0_10px_1px_rgba(34,211,238,0.6)] ${sizeClass}`}
      title="CDC-ის სერტიფიცირებული კურსდამთავრებული"
    >
      <Wifi
        size={iconSize}
        strokeWidth={2.5}
        className="text-cyan-300 drop-shadow-[0_0_4px_rgba(34,211,238,0.95)] shrink-0"
      />
      {!iconOnly && 'CDC კურსდამთავრებული'}
    </span>
  );
}
