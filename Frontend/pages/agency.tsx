import { useState, useEffect } from 'react';
import Head from 'next/head';
import SiteFooter from '../src/components/layout/SiteFooter';

interface Project {
  id: number;
  badge: React.ReactNode;
  title: React.ReactNode;
  subtitle: React.ReactNode;
  desc: React.ReactNode;
  status: React.ReactNode;
}

export default function Agency() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  
  // 🌐 ენის სთეითი სააგენტოს გვერდისთვისაც!
  const [lang, setLang] = useState<'GEO' | 'ENG'>('GEO');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = localStorage.getItem('darkMode') === 'true';
      setDarkMode(isDark);
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !darkMode;
    setDarkMode(nextDark);
    localStorage.setItem('darkMode', String(nextDark));
    if (nextDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const safeText = (text: string) => {
    return <span className="font-sans inline-block font-bold tracking-normal">{text}</span>;
  };

  // 🌐 ჭკვიანი ავტომატური თარგმანის მექანიზმი
  const translate = (geo: React.ReactNode, eng: React.ReactNode) => {
    return lang === 'GEO' ? geo : eng;
  };

  // 📂 გაწმენდილი და თარგმნილი პროექტების პორტფოლიო (ყოველგვარი [cite] ნაგვის გარეშე!)
  const projects: Project[] = [
    {
      id: 1,
      badge: translate(<>{safeText('GITA')} მხარდაჭერა</>, <>{safeText('GITA')} Support</>),
      title: translate(<>თაილორ.გე - ინოვაციური სტარტაპი</>, <>Taylor.ge - Innovative Startup</>),
      subtitle: translate(<>ვებ-დეველოპმენტი & მარკეტინგი</>, <>Web Development & Marketing</>),
      desc: translate(<>ციფრული სამკერვალო თარგების პლატფორმის სრული ვებ-მხარდაჭერა და სოციალური ქსელების მართვა.</>, <>Full web support and social media management for a digital sewing patterns platform.</>),
      status: translate(<>✓ წარმატებული ქეისი</>, <>✓ Success Case</>)
    },
    {
      id: 2,
      badge: translate(<>ტურიზმი</>, <>Tourism</>),
      title: translate(<>მწვანე გურია - ეკო ტურიზმი</>, <>Green Guria - Eco Tourism</>),
      subtitle: translate(<>{safeText('UI/UX')} დიზაინი & საიტი</>, <>{safeText('UI/UX')} Design & Web</>),
      desc: translate(<>გურიის 10 ნაკლებად ცნობილი ლოკაციის ციფრული პლატფორმა და საინფორმაციო QR ფირფიშების დიზაინი.</>, <>Digital platform and informational QR plates design for 10 hidden locations of Guria.</>),
      status: translate(<>✓ წარმატებული ქეისი</>, <>✓ Success Case</>)
    },
    {
      id: 3,
      badge: translate(<>{safeText('SMM')}</>, <>{safeText('SMM')}</>),
      title: translate(<>ლოკალური ბიზნესების ციფრული მხარდაჭერა</>, <>Digital Support for Local Businesses</>),
      subtitle: translate(<>{safeText('SMM')} & ანიმაცია</>, <>{safeText('SMM')} & Animation</>),
      desc: translate(<>სოციალური მედიის სარეკლამო კონტენტის, ანიმაციებისა და ბრენდინგის მიწოდება რეგიონული ბიზნესებისთვის.</>, <>Providing social media advertising content, animations, and branding for regional businesses.</>),
      status: translate(<>✓ წარმატებული ქეისი</>, <>✓ Success Case</>)
    }
  ];

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 relative overflow-hidden ${darkMode ? 'text-slate-200 bg-[#0b0f19]' : 'text-slate-800 bg-[#f8fafc]'}`}>
      <Head>
        <title>CDC Studio | ციფრული სააგენტო</title>
        <link href="https://fonts.googleapis.com/css2?family=Fira+GO:wght@400;500;700&display=swap" rel="stylesheet" />
        <style>{`
          body { font-family: 'Fira GO', sans-serif; }
        `}</style>
      </Head>

      {/* 🧭 NAVIGATION */}
      <nav className={`sticky top-0 z-50 border-b px-6 md:px-12 py-5 ${darkMode ? 'border-slate-800 bg-[#0e1422]/90 backdrop-blur-md' : 'border-slate-200/60 bg-white/90 backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-cyan-500 to-purple-600 text-white px-4 py-2 rounded-xl font-black text-sm tracking-wider">{safeText('CDC')}</div>
            <div>
              <span className="font-bold text-lg block leading-none tracking-tight">{safeText('CDC Studio')}</span>
              <span className="text-[11px] text-slate-400 font-bold block mt-1">{translate('სოციალური მეწარმეობა & ციფრული სააგენტო', 'Social Entrepreneurship & Digital Agency')}</span>
            </div>
          </div>

          <div className="flex items-center space-x-6 text-base font-bold tracking-wide">
            <a href="/" className="hover:text-cyan-500 transition no-underline text-current">{translate('მთავარზე დაბრუნება', 'Return Home')}</a>
            
            {/* 🌐 ენის გადამრთველი სააგენტოს გვერდზეც! */}
            <button 
              type="button"
              onClick={() => setLang(lang === 'GEO' ? 'ENG' : 'GEO')}
              className={`font-sans font-black text-xs px-2.5 py-1.5 rounded-lg border transition duration-200 cursor-pointer ${
                darkMode ? 'border-slate-800 bg-slate-900/60 text-cyan-400' : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {lang}
            </button>

            <button type="button" onClick={toggleDarkMode} className="p-2 rounded-xl transition text-xl border-none bg-transparent cursor-pointer duration-200">{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </nav>

      {/* 🏙️ HERO BANNER */}
      <div className={`border-b text-center py-20 backdrop-blur-md ${darkMode ? 'bg-[#0e1422]/40 border-slate-800' : 'bg-slate-100/40 border-slate-200'}`}>
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex justify-center mb-4">
            <span className="text-xs font-black uppercase tracking-widest px-4 py-2 bg-purple-500/10 text-purple-500 rounded-full border border-purple-500/20 flex items-center gap-2">
              💼 {translate('სოციალური მეწარმეობა & ციფრული სააგენტო', 'Social Entrepreneurship & Digital Agency')}
            </span>
          </div>
          
          <h1 className="text-3xl md:text-5xl font-black mt-4 mb-6 tracking-wide text-slate-900 dark:text-white leading-tight">
            {translate('პროფესიონალური ციფრული სერვისები თქვენი ბიზნესისთვის', 'Professional Digital Services For Your Business')}
          </h1>
          
          <p className="text-sm md:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
            {translate(
              <>{safeText('CDC Studio')} აერთიანებს ნიჭიერ სტუდენტებსა და გამოცდილ მენტორებს. ჩვენ ვქმნით საიტებს, რეკლამას, კონტენტსა და ვიზუალებს ლოკალური და საერთაშორისო ბიზნესებისთვის.</>,
              <>{safeText('CDC Studio')} combines talented students and experienced mentors. We create websites, advertisement, content, and visuals for local and international businesses.</>
            )}
          </p>
        </div>
      </div>

      {/* 📊 PORTFOLIO PROJECTS FEED */}
      <main className="max-w-7xl mx-auto px-6 py-16">
        <h2 className="text-xl md:text-2xl font-black mb-10 tracking-wide flex items-center gap-2">
          ✨ {translate('ჩვენი შესრულებული სამუშაოები', 'Our Portfolio')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {projects.map(p => (
            <div 
              key={p.id} 
              className={`border rounded-3xl p-8 transition-all duration-300 transform hover:scale-[1.03] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] flex flex-col justify-between min-h-[300px] ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'}`}
            >
              <div>
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border ${
                  darkMode ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' : 'text-cyan-700 bg-cyan-50 border-cyan-100'
                }`}>
                  {p.badge}
                </span>
                
                <h3 className="text-lg font-black mt-5 mb-2 tracking-wide leading-snug">
                  {p.title}
                </h3>
                
                <h4 className="text-xs font-bold text-slate-400 mb-5 uppercase tracking-wide">
                  {p.subtitle}
                </h4>
                
                <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-medium">
                  {p.desc}
                </p>
              </div>

              <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800/60 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-500">
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </main>

      <SiteFooter lang={lang} />
    </div>
  );
}