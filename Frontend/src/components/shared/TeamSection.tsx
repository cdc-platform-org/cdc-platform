import { useState, useEffect } from 'react';
import { TeamMember } from '../../types/teamMember';
import { getTeamMembers } from '../../services/teamMemberService';
import { onImageErrorFallback } from '../../utils/imageFallback';

interface TeamSectionProps {
  lang: 'ka' | 'en';
  darkMode?: boolean;
}

const dict = {
  ka: { title: 'ჩვენი გუნდი' },
  en: { title: 'Our Team' },
};

// Homepage "ჩვენი გუნდი" block — fetches every active TeamMember (both
// MANAGEMENT and TRAINER) from GET /api/team. Renders nothing while loading
// or if the admin hasn't added anyone yet, same posture as SuccessStoriesCarousel.
export default function TeamSection({ lang, darkMode = false }: TeamSectionProps) {
  const t = dict[lang];
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTeamMembers()
      .then(setMembers)
      .catch(() => setMembers([]))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || members.length === 0) return null;

  return (
    <section className={`py-28 border-t ${darkMode ? 'bg-[#0e1422]/20 border-slate-800' : 'bg-slate-100/40 border-slate-200'}`}>
      <div className="max-w-7xl mx-auto text-center px-6">
        <h2 className="mb-16 text-2xl md:text-3xl font-black tracking-wide">{t.title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {members.map((member) => (
            <div
              key={member.id}
              className={`p-8 rounded-3xl border transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${
                darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              {member.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={member.imageUrl}
                  alt={member.name}
                  onError={onImageErrorFallback}
                  className="w-20 h-20 rounded-full mx-auto mb-5 object-cover"
                />
              ) : (
                <div className="w-20 h-20 rounded-full mx-auto mb-5 bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-xl">
                  {member.name
                    .split(' ')
                    .map((part) => part.charAt(0))
                    .slice(0, 2)
                    .join('')
                    .toUpperCase()}
                </div>
              )}
              <h3 className="font-black text-lg mb-1">{member.name}</h3>
              <span className="text-[11px] text-cyan-500 font-bold block mb-4 uppercase tracking-wider">{member.role}</span>
              {member.bio && <p className="text-sm text-slate-400 leading-relaxed font-medium">{member.bio}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
