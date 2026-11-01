import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { TeamMember } from '../../types/teamMember';
import { getTeamMembers } from '../../services/teamMemberService';
import { onImageErrorFallback } from '../../utils/imageFallback';
import { localizeTeamMember } from '../../utils/localizeTeamMember';

interface TeamSectionProps {
  lang: 'ka' | 'en';
  darkMode?: boolean;
}

const dict = {
  ka: { title: 'ჩვენი გუნდი', subtitle: 'ადამიანები, რომლებიც CDC-ს ქმნიან', viewAll: 'იხილეთ ყველა', showLess: 'ნაკლების ჩვენება' },
  en: { title: 'Our Team', subtitle: 'The people building CDC', viewAll: 'View all', showLess: 'Show less' },
};

// How many members the homepage shows before "View all".
const PREVIEW_COUNT = 4;

// Homepage "ჩვენი გუნდი" block — fetches every active TeamMember (both
// MANAGEMENT and TRAINER) from GET /api/team. Renders nothing while loading
// or if the admin hasn't added anyone yet, same posture as SuccessStoriesCarousel.
export default function TeamSection({ lang, darkMode = false }: TeamSectionProps) {
  const t = dict[lang];
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    getTeamMembers()
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || members.length === 0) return null;

  const visible = expanded ? members : members.slice(0, PREVIEW_COUNT);
  const hiddenCount = members.length - PREVIEW_COUNT;

  return (
    <section id="team" className={`py-20 sm:py-28 border-t scroll-mt-24 ${darkMode ? 'bg-[#0e1422]/20 border-slate-800' : 'bg-slate-100/40 border-slate-200'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-14">
          <h2 className="text-2xl md:text-3xl font-black tracking-wide">{t.title}</h2>
          <p className={`mt-3 text-sm sm:text-base ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.subtitle}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
          {visible.map((member) => {
            const localized = localizeTeamMember(member, lang);
            return (
              <article
                key={member.id}
                className={`group relative flex flex-col items-center text-center p-6 sm:p-7 rounded-3xl border transition-all duration-300 hover:-translate-y-1 hover:border-cyan-400/60 hover:shadow-[0_20px_50px_-20px_rgba(34,211,238,0.45)] ${
                  darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
                }`}
              >
                <div className="relative mb-5">
                  <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-cyan-400 to-purple-600 opacity-60 blur-[6px] group-hover:opacity-90 transition-opacity" aria-hidden="true" />
                  {member.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.imageUrl}
                      alt={localized.name}
                      onError={onImageErrorFallback}
                      className={`relative w-24 h-24 rounded-full object-cover ring-4 ${darkMode ? 'ring-[#0e1422]' : 'ring-white'}`}
                    />
                  ) : (
                    <div className={`relative w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-2xl ring-4 ${darkMode ? 'ring-[#0e1422]' : 'ring-white'}`}>
                      {localized.name
                        .split(' ')
                        .map((part) => part.charAt(0))
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}
                </div>
                <h3 className="font-black text-base sm:text-lg mb-1">{localized.name}</h3>
                <span className="text-[11px] text-cyan-500 font-bold block mb-3 uppercase tracking-wider">{localized.role}</span>
                {localized.bio && (
                  <p className={`text-sm leading-relaxed line-clamp-4 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`} title={localized.bio}>
                    {localized.bio}
                  </p>
                )}
              </article>
            );
          })}
        </div>
        {hiddenCount > 0 && (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold border cursor-pointer transition-colors ${
                darkMode
                  ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                  : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-50 shadow-sm'
              }`}
            >
              {expanded ? t.showLess : `${t.viewAll} (${members.length})`}
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
