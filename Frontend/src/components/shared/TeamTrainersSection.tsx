import { useState, useEffect } from 'react';
import { TeamMember } from '../../types/teamMember';
import { getTeamMembers, getTrainers } from '../../services/teamMemberService';
import { onImageErrorFallback } from '../../utils/imageFallback';
import { localizeTeamMember } from '../../utils/localizeTeamMember';

interface TeamTrainersSectionProps {
  lang: 'ka' | 'en';
}

type Tab = 'team' | 'trainers';

const dict = {
  ka: { heading: 'ჩვენი გუნდი', team: 'ადმინისტრაცია', trainers: 'ტრენერები', empty: 'ინფორმაცია მალე დაემატება.' },
  en: { heading: 'Our Team', team: 'Administration', trainers: 'Trainers', empty: 'Coming soon.' },
};

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

// /about's "ჩვენი გუნდი" block — replaces the old hardcoded aboutContent.team
// array with live data from the admin CRUD (Backend routes/team.ts and
// routes/trainers.ts), so adding/editing/removing a team member or trainer
// in /admin/team-trainers shows up here immediately, photo included.
export default function TeamTrainersSection({ lang }: TeamTrainersSectionProps) {
  const t = dict[lang];
  const [tab, setTab] = useState<Tab>('team');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [trainers, setTrainers] = useState<TeamMember[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getTeamMembers('MANAGEMENT'), getTrainers()])
      .then(([teamData, trainerData]) => {
        setTeam(teamData);
        setTrainers(trainerData);
      })
      .catch(() => {
        setTeam([]);
        setTrainers([]);
      })
      .finally(() => setLoaded(true));
  }, []);

  const active = tab === 'team' ? team : trainers;

  if (loaded && team.length === 0 && trainers.length === 0) return null;

  return (
    <div className="mb-14">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h2 className="text-xl font-black">{t.heading}</h2>
        {team.length > 0 && trainers.length > 0 && (
          <div className="flex gap-2 p-1 rounded-xl border border-slate-800 bg-slate-900/60">
            <button
              type="button"
              onClick={() => setTab('team')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                tab === 'team' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.team}
            </button>
            <button
              type="button"
              onClick={() => setTab('trainers')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                tab === 'trainers' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {t.trainers}
            </button>
          </div>
        )}
      </div>

      {!loaded ? null : active.length === 0 ? (
        <p className="text-xs text-slate-500">{t.empty}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {active.map((member) => {
            const localized = localizeTeamMember(member, lang);
            return (
              <div key={member.id} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
                {member.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={member.imageUrl}
                    alt={localized.name}
                    onError={onImageErrorFallback}
                    className="w-16 h-16 rounded-full mx-auto mb-4 object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full mx-auto mb-4 bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-lg">
                    {initialsOf(localized.name)}
                  </div>
                )}
                <h3 className="font-black text-sm mb-1">{localized.name}</h3>
                <span className="text-[11px] text-cyan-400 font-bold block mb-3 uppercase tracking-wider">{localized.role}</span>
                {localized.bio && <p className="text-xs text-slate-500 leading-relaxed">{localized.bio}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
