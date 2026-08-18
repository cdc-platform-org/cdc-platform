import { TeamMember } from '../types/teamMember';
import { SupportedLocale } from './locale';

// Same "falls back to Georgian when the English twin is unset" convention
// used across this codebase (mentor profiles, blog posts, etc.) — a team
// member/trainer added without English fields still renders correctly on
// the English locale, just in Georgian, rather than showing blank text.
// Non-ka/en locales fall through to the `else` branch below and get the
// English (or English-fallback) fields, same boundary as the rest of this
// i18n pass.
export function localizeTeamMember(member: TeamMember, lang: SupportedLocale) {
  if (lang === 'ka') {
    return { name: member.name, role: member.role, bio: member.bio };
  }
  return {
    name: member.nameEn || member.name,
    role: member.roleEn || member.role,
    bio: member.bioEn || member.bio,
  };
}
