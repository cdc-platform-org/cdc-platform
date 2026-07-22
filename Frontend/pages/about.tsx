import SimpleSiteLayout from '@/src/components/layout/SimpleSiteLayout';
import { aboutContent } from '@/src/data/aboutContent';

export default function AboutPage() {
  return (
    <SimpleSiteLayout titleKa={aboutContent.heading.ka} titleEn={aboutContent.heading.en}>
      {(lang) => {
        const l = lang === 'GEO' ? 'ka' : 'en';
        return (
          <>
            <h1 className="text-3xl md:text-4xl font-black mb-4">{aboutContent.heading[l]}</h1>
            <p className="text-xs text-slate-500 mb-8">{aboutContent.foundingProject[l]}</p>

            <p className="text-lg text-slate-200 leading-relaxed mb-10 font-medium">{aboutContent.mission[l]}</p>

            <div className="space-y-5 mb-10">
              {aboutContent.descriptionParagraphs.map((p, i) => (
                <p key={i} className="text-sm text-slate-400 leading-relaxed">
                  {p[l]}
                </p>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mb-14">
              {aboutContent.focusAreas.map((area, i) => (
                <span
                  key={i}
                  className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border text-cyan-300 bg-cyan-500/10 border-cyan-500/20"
                >
                  {area[l]}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-16">
              {aboutContent.stats.map((stat, i) => (
                <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-center">
                  <div className="text-2xl md:text-3xl font-black text-cyan-400">{stat.value}</div>
                  <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold mt-1">{stat.label[l]}</div>
                </div>
              ))}
            </div>

            <h2 className="text-xl font-black mb-8">{lang === 'GEO' ? 'პროექტები და მიღწევები' : 'Projects & Achievements'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-16">
              {aboutContent.achievements.map((item, i) => (
                <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
                  <h3 className="font-black text-sm mb-2 text-white">{item.title[l]}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{item.description[l]}</p>
                </div>
              ))}
            </div>

            <h2 className="text-xl font-black mb-8">{lang === 'GEO' ? 'ჩვენი გუნდი' : 'Our Team'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-14">
              {aboutContent.team.map((member, i) => (
                <div key={i} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
                  <div className="w-16 h-16 rounded-full mx-auto mb-4 bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-lg">
                    {member.initials}
                  </div>
                  <h3 className="font-black text-sm mb-1">{member.name[l]}</h3>
                  <span className="text-[11px] text-cyan-400 font-bold block mb-3 uppercase tracking-wider">{member.role[l]}</span>
                  <p className="text-xs text-slate-500 leading-relaxed">{member.bio[l]}</p>
                </div>
              ))}
            </div>

            <p className="text-xs text-slate-500 border-t border-slate-800 pt-6">
              📍 {aboutContent.physicalAddress[l]}
            </p>
          </>
        );
      }}
    </SimpleSiteLayout>
  );
}
