import { MapPin, Trophy, ExternalLink, GraduationCap, Briefcase, ShoppingBag, Building2, Bot } from 'lucide-react';
import SimpleSiteLayout from '@/src/components/layout/SimpleSiteLayout';
import TeamTrainersSection from '@/src/components/shared/TeamTrainersSection';
import { aboutContent } from '@/src/data/aboutContent';

// The five pillars of the CDC ecosystem — each a distinct product area,
// not just a marketing bullet, so the icon+glow treatment doubles as a
// visual map of "everything one CDC account can do."
const ECOSYSTEM_FEATURES = [
  {
    icon: GraduationCap,
    title: { ka: 'LMS & ლაივ ვორქშოფები', en: 'LMS & Live Workshops' },
    description: {
      ka: 'თვითტემპური კურსები სერტიფიკატებით, პლუს დაგეგმილი ლაივ სესიები ტრენერებთან ერთად.',
      en: 'Self-paced courses with certificates, plus scheduled live sessions with real trainers.',
    },
  },
  {
    icon: Briefcase,
    title: { ka: 'დასაქმების ფორუმი & ფრილანს ჰაბი', en: 'Employment Forum & Freelance Hub' },
    description: {
      ka: 'ვაკანსიები, შეკვეთები და დისკუსიები ერთ სივრცეში — ვერიფიცირებული ფრილანსერებისთვის.',
      en: 'Vacancies, gigs, and discussions in one place — for verified freelancers.',
    },
  },
  {
    icon: ShoppingBag,
    title: { ka: 'ციფრული პროდუქტების მაღაზია', en: 'Digital Product Store' },
    description: {
      ka: 'UI ნაკრებები, AI პრომფტები, შაბლონები და ელ-წიგნები — მზად გამოსაყენებლად.',
      en: 'UI kits, AI prompts, templates, and e-books — ready to use.',
    },
  },
  {
    icon: Building2,
    title: { ka: 'CDC სააგენტო / სტუდია', en: 'CDC Agency / Studio' },
    description: {
      ka: 'რეალური კლიენტების პროექტები — სტუდენტები და მენტორები ერთად ქმნიან საიტებს, რეკლამასა და ვიზუალებს.',
      en: 'Real client projects — students and mentors building websites, ads, and visuals together.',
    },
  },
  {
    icon: Bot,
    title: { ka: 'CDC AI ასისტენტი & ხელსაწყოები', en: 'CDC AI Assistant & Tools' },
    description: {
      ka: 'ბიზნესებისთვის მორგებული AI ავტომატიზაცია და ანალიტიკური ხელსაწყოები.',
      en: 'AI automation and analytics tools tailored for businesses.',
    },
  },
] as const;

export default function AboutPage() {
  return (
    <SimpleSiteLayout titleKa={aboutContent.heading.ka} titleEn={aboutContent.heading.en}>
      {(lang) => {
        const l = lang === 'GEO' ? 'ka' : 'en';
        return (
          <>
            <h1 className="text-3xl md:text-4xl font-black mb-4">{aboutContent.heading[l]}</h1>
            <p className="text-xs text-slate-500 mb-8">{aboutContent.foundingProject[l]}</p>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between rounded-2xl border border-cyan-500/30 bg-gradient-to-r from-cyan-500/10 to-purple-600/10 px-6 py-5 mb-10">
              <p className="flex items-center gap-2.5 text-sm font-semibold text-cyan-100 leading-relaxed">
                <Trophy className="w-4 h-4 text-cyan-300 shrink-0" />
                {aboutContent.grantAnnouncement.text[l]}
              </p>
              <a
                href={aboutContent.grantAnnouncement.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-600 text-white no-underline whitespace-nowrap hover:opacity-90 transition-opacity"
              >
                {aboutContent.grantAnnouncement.linkLabel.ka} / {aboutContent.grantAnnouncement.linkLabel.en}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            <p className="text-lg text-slate-200 leading-relaxed mb-10 font-medium">{aboutContent.mission[l]}</p>

            <div className="space-y-5 mb-10">
              {aboutContent.descriptionParagraphs.map((p, i) => (
                <p key={i} className="text-sm text-slate-400 leading-relaxed">
                  {p[l]}
                </p>
              ))}
            </div>

            <h2 className="text-xl font-black mb-8">{lang === 'GEO' ? 'CDC ეკოსისტემა' : 'The CDC Ecosystem'}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
              {ECOSYSTEM_FEATURES.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={i}
                    className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 transition-all duration-300 hover:border-indigo-400/40 hover:shadow-[0_0_25px_rgba(99,102,241,0.15)]"
                  >
                    <div className="inline-flex bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-400 p-3.5 rounded-2xl shadow-lg shadow-indigo-500/10 mb-4">
                      <Icon className="w-5 h-5" />
                    </div>
                    <h3 className="font-black text-sm mb-2 text-white">{feature.title[l]}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{feature.description[l]}</p>
                  </div>
                );
              })}
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

            <TeamTrainersSection lang={l} />

            <p className="text-xs text-slate-500 border-t border-slate-800 pt-6 flex items-center">
              <MapPin className="w-4 h-4 text-cyan-400 opacity-80 inline-block mr-2 shrink-0" />
              {aboutContent.physicalAddress[l]}
            </p>
          </>
        );
      }}
    </SimpleSiteLayout>
  );
}
