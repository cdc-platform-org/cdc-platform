import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useAuthModal } from '../src/context/AuthModalContext';

export default function Home() {
  const router = useRouter();
  const { openAuthModal } = useAuthModal();
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [cartAdded, setCartAdded] = useState<number | null>(null);

  // 🌐 ენის გადართვის სთეითი
  const [lang, setLang] = useState<'GEO' | 'ENG'>('GEO');

  // 🔍 საძიებო ველის სთეითები
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false);
  const suggestions = [
    'Vibe Coding კურსი',
    'სოციალური მედიის მარკეტინგი',
    'ხელოვნური ინტელექტი (AI)',
    'CDC Studio სააგენტო',
    'ფრილანსერების ფორუმი',
    'ბლოგი სტატიები'
  ];

  // 📱 მობილური მენიუს სთეითი
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // 🤖 ჩატბოტის ინტერაქტიული სთეითები
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [testStep, setTestStep] = useState<number>(0);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'bot' | 'user'; text: string }>>([
    { sender: 'bot', text: 'გამარჯობა! მე იაკო ვარ, CDC-ის ციფრული ასისტენტი. 🌟 გსურთ გაიაროთ სწრაფი ტესტირება, რომ კურსის სწორად შერჩევაში დაგეხმაროთ?' }
  ]);
  const [userInput, setUserInput] = useState('');

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

  useEffect(() => {
    if (router.query.assistant === '1') {
      setIsChatOpen(true);
      router.replace('/', undefined, { shallow: true });
    }
  }, [router, router.query.assistant]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  useEffect(() => {
    if (router.query.toast === 'account_deleted') {
      const toastLang = router.query.toastLang === 'en' ? 'en' : 'ka';
      setToastMessage(
        toastLang === 'en'
          ? 'Your account has been successfully deleted.'
          : 'თქვენი ანგარიში წარმატებით წაიშალა.'
      );
      router.replace('/', undefined, { shallow: true });
      const timer = setTimeout(() => setToastMessage(null), 6000);
      return () => clearTimeout(timer);
    }
  }, [router, router.query.toast, router.query.toastLang]);

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

  const handleAddToCart = (index: number) => {
    setCartAdded(index);
    setTimeout(() => setCartAdded(null), 2000);
  };

  // 🌐 ჭკვიანი ავტომატური თარგმანის მექანიზმი
  const translate = (geo: React.ReactNode, eng: React.ReactNode) => {
    return lang === 'GEO' ? geo : eng;
  };

  // 🛡️ დამცავი მექანიზმი ლათინური ასოებისთვის
  const safeText = (text: string) => {
    return <span className="font-sans inline-block font-bold tracking-normal">{text}</span>;
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const userText = userInput.trim();
    const updatedMessages = [...chatMessages, { sender: 'user' as const, text: userText }];
    setChatMessages(updatedMessages);
    setUserInput('');

    setChatMessages([...updatedMessages, { sender: 'bot' as const, text: lang === 'GEO' ? '✍️ ასისტენტი ფიქრობს...' : '✍️ Assistant is thinking...' }]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, lang }),
      });

      const data = await response.json();
      
      setChatMessages([
        ...updatedMessages,
        { sender: 'bot', text: data.reply }
      ]);
      
      if (userText.includes('ვიზუალ') || userText.includes('კოდ')) {
        setTestStep(2);
      }
    } catch (error) {
      setChatMessages([
        ...updatedMessages,
        { sender: 'bot', text: lang === 'GEO' ? '❌ კავშირის ხარვეზი. გთხოვთ სცადოთ მოგვიანებით.' : '❌ Connection error. Please try again later.' }
      ]);
    }
  };

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 relative overflow-hidden ${darkMode ? 'text-slate-200 bg-[#0b0f19]' : 'text-slate-800 bg-[#f8fafc]'}`}>
      <Head>
        <title>CDC | ციფრული პროფესიების ცენტრი</title>
        <link href="https://fonts.googleapis.com/css2?family=Fira+GO:wght@400;500;700&display=swap" rel="stylesheet" />
        <style>{`
          body { font-family: 'Fira GO', sans-serif; }
        `}</style>
      </Head>

      {/* ✅ POST-ACTION TOAST */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-2xl bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-opacity duration-300">
          ✅ {toastMessage}
        </div>
      )}

      {/* BACKGROUND GLOW ORBS */}
      <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] rounded-full bg-cyan-500/5 blur-[120px] pointer-events-none dark:bg-cyan-500/10" />
      <div className="absolute top-[50%] right-[-10%] w-[600px] h-[600px] rounded-full bg-purple-500/5 blur-[150px] pointer-events-none dark:bg-purple-500/5" />

      {/* 🧭 NAVIGATION */}
      <nav className={`sticky top-0 z-50 w-full max-w-full overflow-x-hidden border-b px-4 sm:px-6 md:px-12 py-4 sm:py-5 ${darkMode ? 'border-slate-800 bg-[#0e1422]/90 backdrop-blur-md' : 'border-slate-200/60 bg-white/90 backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center gap-3 sm:gap-6">
          <div className="flex items-center space-x-3 shrink-0">
            <div className="bg-gradient-to-tr from-cyan-500 to-purple-600 text-white px-4 py-2 rounded-xl font-black text-sm tracking-wider">{safeText('CDC')}</div>
            <div className="hidden sm:block">
              <span className="font-bold text-lg block leading-none tracking-tight">{safeText('CDC')}</span>
              <span className="text-[11px] text-slate-400 font-bold block mt-1">{translate('ციფრული პროფესიები', 'Digital Careers')}</span>
            </div>
          </div>

          {/* 🔍 SEARCH BAR */}
          <div className="relative flex-1 max-w-sm md:max-w-md hidden sm:block">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSuggestions(e.target.value.length > 0);
                }}
                onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                placeholder={translate('მოძებნე კურსი, ბლოგი...', 'Search courses, blog...') as string}
                className={`w-full text-sm pl-10 pr-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-cyan-400 transition-all ${
                  darkMode ? 'bg-[#161f30] border-slate-700 text-white' : 'bg-slate-50 border-slate-200 text-slate-900'
                }`}
              />
              <svg className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <div className={`hidden lg:flex items-center space-x-8 text-base font-bold tracking-wide shrink-0 ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            <a href="#about" className="hover:text-cyan-500 transition no-underline text-current">{translate('ჩვენ შესახებ', 'About Us')}</a>
            <a href="#courses" className="hover:text-cyan-500 transition no-underline text-current">{translate('კურსები', 'Courses')}</a>
            <a href="#blog" className="hover:text-cyan-500 transition no-underline text-current">{translate('ბლოგი', 'Blog')}</a>
            <a href="/agency" className="hover:text-cyan-500 transition no-underline text-current">{safeText('CDC Studio')}</a>
            <a href="/community" className="hover:text-cyan-500 transition no-underline text-current">{translate('ფორუმი', 'Forum')}</a>
          </div>

          <div className="flex items-center space-x-1.5 sm:space-x-2 md:space-x-4 shrink-0">
            <button
              type="button"
              onClick={() => setLang(lang === 'GEO' ? 'ENG' : 'GEO')}
              className={`font-sans font-black text-xs px-2.5 py-1.5 rounded-lg border transition duration-200 cursor-pointer ${
                darkMode ? 'border-slate-800 bg-slate-900/60 text-cyan-400' : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {lang}
            </button>
            <button type="button" onClick={toggleDarkMode} aria-label="Toggle dark mode" className="p-2 rounded-xl transition text-xl border-none bg-transparent cursor-pointer hover:rotate-12 duration-200">{darkMode ? '☀️' : '🌙'}</button>
            <button type="button" onClick={() => openAuthModal()} className={`hidden sm:inline-flex border font-black text-xs md:text-sm px-4 py-2.5 rounded-xl transition bg-transparent cursor-pointer ${darkMode ? 'text-white border-slate-700 hover:bg-slate-800' : 'text-slate-700 border-slate-200 hover:bg-slate-100'}`}>👤 {translate('შესვლა', 'Login')}</button>

            {/* 🍔 MOBILE MENU TOGGLE */}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
              className={`lg:hidden p-2 rounded-xl border-none bg-transparent cursor-pointer text-2xl leading-none transition ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}
            >
              {isMobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* 📱 MOBILE MENU PANEL */}
        {isMobileMenuOpen && (
          <div className={`lg:hidden max-w-full overflow-x-hidden mt-4 pt-4 border-t flex flex-col gap-1 ${darkMode ? 'border-slate-800' : 'border-slate-200'}`}>
            <a href="#about" onClick={() => setIsMobileMenuOpen(false)} className={`px-2 py-3 rounded-lg font-bold text-sm no-underline hover:text-cyan-500 transition ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{translate('ჩვენ შესახებ', 'About Us')}</a>
            <a href="#courses" onClick={() => setIsMobileMenuOpen(false)} className={`px-2 py-3 rounded-lg font-bold text-sm no-underline hover:text-cyan-500 transition ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{translate('კურსები', 'Courses')}</a>
            <a href="#blog" onClick={() => setIsMobileMenuOpen(false)} className={`px-2 py-3 rounded-lg font-bold text-sm no-underline hover:text-cyan-500 transition ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{translate('ბლოგი', 'Blog')}</a>
            <a href="/agency" onClick={() => setIsMobileMenuOpen(false)} className={`px-2 py-3 rounded-lg font-bold text-sm no-underline hover:text-cyan-500 transition ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{safeText('CDC Studio')}</a>
            <a href="/community" onClick={() => setIsMobileMenuOpen(false)} className={`px-2 py-3 rounded-lg font-bold text-sm no-underline hover:text-cyan-500 transition ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{translate('ფორუმი', 'Forum')}</a>
            <button
              type="button"
              onClick={() => { setIsMobileMenuOpen(false); openAuthModal(); }}
              className={`sm:hidden mt-2 border font-black text-sm px-4 py-3 rounded-xl transition bg-transparent cursor-pointer text-left ${darkMode ? 'text-white border-slate-700 hover:bg-slate-800' : 'text-slate-700 border-slate-200 hover:bg-slate-100'}`}
            >
              👤 {translate('შესვლა', 'Login')}
            </button>
          </div>
        )}
      </nav>

      {/* 🎬 HERO SECTION — left-aligned content, unobstructed video on the right */}
      <div className="relative w-full overflow-hidden min-h-[70vh] sm:min-h-[80vh] lg:min-h-[92vh] flex items-center bg-slate-950">
        {/* Background video — always fills the full hero, never cropped/shifted;
            the gradient scrim below is what visually "reveals" it on the right. */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden scale-150">
          <iframe
            className="w-full h-full object-cover border-none"
            src="https://www.youtube.com/embed/zIDWV4e6R8I?autoplay=1&mute=1&loop=1&playlist=zIDWV4e6R8I&controls=0&showinfo=0&rel=0&modestbranding=1"
            title="CDC Hero Background Video"
            allow="autoplay; encrypted-media"
          />
        </div>

        {/* Ambient scrim: opaque over the text column, fully transparent past it —
            no card, no backdrop-blur, so the video stays crisp on the right.
            Mobile has no room for a split layout, so it darkens top-to-bottom instead. */}
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-black/90 via-black/85 to-black/70 sm:bg-gradient-to-r sm:from-black/85 sm:via-black/55 sm:to-transparent" />

        <header className="relative z-20 w-full max-w-7xl mx-auto px-6 sm:px-10 lg:px-16 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 items-center gap-10">
            <div className="lg:col-span-7">
              {/* Badge */}
              <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full text-xs font-black tracking-wider mb-7 border border-white/20 bg-white/10 backdrop-blur-md text-white">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
                </span>
                {translate('გააციფრულე შენი უნარები | დაარსდა 2023 წელს', 'Digitize Your Skills | Est. 2023')}
              </div>

              {/* Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight text-white mb-6">
                {translate(
                  <>გახდი მოთხოვნადი <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">ციფრული ეპოქის</span> პროფესიონალი</>,
                  <>Become a High-Demand <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Digital-Era</span> Professional</>
                )}
              </h1>

              {/* Description */}
              <p className="text-base sm:text-lg text-slate-200/90 max-w-xl leading-relaxed mb-9 font-medium">
                {translate(
                  <>{safeText('HEKS/EPER Georgia')}-ს მხარდაჭერით შექმნილი ეკოსისტემა გურიაში. ჩვენ ვაძლიერებთ ახალგაზრდებსა და ქალებს ციფრული წიგნიერების, ხელოვნური ინტელექტისა და კრეატიული ინდუსტრიების საშუალებით.</>,
                  <>An ecosystem created in Guria with the support of {safeText('HEKS/EPER Georgia')}. We empower youth and women through digital literacy, artificial intelligence, and creative industries.</>
                )}
              </p>

              {/* CTA */}
              <a
                href="#courses"
                className="group inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black px-9 py-4 rounded-xl text-sm uppercase tracking-widest no-underline shadow-xl shadow-cyan-500/20 hover:shadow-2xl hover:shadow-cyan-500/40 hover:scale-105 transition-all duration-300"
              >
                {translate('კურსების ნახვა', 'View Courses')}
                <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
              </a>
            </div>
            {/* lg:col-span-5 intentionally left empty — this is where the video reads clearly */}
          </div>
        </header>
      </div>

      {/* 📊 BENTO GRID SECTION */}
      <section id="about" className="max-w-7xl mx-auto pt-28 px-6">
        <h2 className="text-center mb-16 text-2xl md:text-3xl font-black tracking-wide">{translate('ციფრული ეკოსისტემის მიღწევები', 'Ecosystem Achievements')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 auto-rows-[240px]">
          <div className={`md:col-span-2 md:row-span-2 rounded-3xl p-10 border backdrop-blur-md flex flex-col justify-end transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422]/60 border-slate-800' : 'bg-white/60 border-slate-200'}`}>
            <div className="flex items-center space-x-3 mb-6 text-sky-500">
              <svg className="w-10 h-10" fill="currentColor" viewBox="0 0 24 24"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zm0-1.5a8.5 8.5 0 1 1 0-17 8.5 8.5 0 0 1 0 17zm0-11.85l.91 1.84 2.04 .3-1.48 1.44 .35 2.02-1.82-.96-1.82 .96 .35-2.02-1.48-1.44 2.04-.3 .91-1.84z" /></svg>
              <span className="text-xl font-black tracking-widest text-slate-400 font-sans">EU</span>
            </div>
            <h3 className="text-xl md:text-2xl font-black mb-4">{translate(<>{safeText('HEKS/EPER Georgia')}-ს მხარდაჭერა</>, <>{safeText('HEKS/EPER Georgia')} Support</>)}</h3>
            <p className="text-sm md:text-base text-slate-400 leading-relaxed font-medium">{translate('საერთაშორისო სტანდარტების სასწავლო მეთოდოლოგია და რესურსები, რომელიც სპეციალურად რეგიონული ტექნოლოგიური წინსვლისთვის შეიქმნა.', 'International standard educational methodology and resources specially designed for regional technological progress.')}</p>
          </div>
          <div className={`rounded-3xl p-8 border backdrop-blur-md flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422]/60 border-slate-800' : 'bg-white/60 border-slate-200'}`}>
            <span className="text-5xl font-black text-cyan-500">200+</span>
            <span className="text-sm font-black uppercase tracking-wider text-slate-400">{translate('კურსდამთავრებული', 'Graduates')}</span>
          </div>
          <div className={`rounded-3xl p-8 border backdrop-blur-md flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422]/60 border-slate-800' : 'bg-white/60 border-slate-200'}`}>
            <span className="text-5xl font-black text-purple-500">100%</span>
            <span className="text-sm font-black uppercase tracking-wider text-slate-400">{translate('პრაქტიკული დავალებები', 'Practical Tasks')}</span>
          </div>
        </div>
      </section>

      {/* 📚 COURSES CATALOG */}
      <section id="courses" className="max-w-7xl mx-auto py-28 px-6">
        <h2 className="text-center mb-16 text-2xl md:text-3xl font-black tracking-wide">{translate('ავტორიზებული სასწავლო პროგრამები', 'Authorized Programs')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* კურსი 1 */}
          <div className={`border rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200/80'}`}>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-purple-400 bg-purple-500/10 border-purple-500/20">{translate('2 თვე', '2 Months')}</span>
              <h3 className="text-lg font-black mt-5 mb-3">{safeText('Vibe Coding')} - {translate('ვებ-დეველოპმენტი AI-ით', `Web Development with ${safeText('AI')}`)}</h3>
              <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-medium mb-8">{translate('რეალური ვებ პროექტების შექმნა, კოდის გენერირება ხელოვნური ინტელექტის დახმარებით და მონაცემთა ბაზების ინტეგრაცია.', 'Creating real web projects, code generation using artificial intelligence.')}</p>
              
              <div className={`p-4 rounded-2xl border flex items-center space-x-4 ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <div className="w-10 h-10 rounded-full bg-cyan-500 flex items-center justify-center text-white text-sm font-black">IM</div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">{translate('იმედო მარტიკოვი', 'Imedo Martikovi')}</h4>
                  <p className="text-xs text-slate-400 font-bold">{translate(`კურსის ლექტორი & AI ინჟინერი`, `Course Lecturer & ${safeText('AI')} Engineer`)}</p>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => handleAddToCart(0)} className="w-full text-center py-4 bg-slate-900 text-white rounded-xl font-black text-sm mt-8 cursor-pointer border-none shadow-md duration-150">{cartAdded === 0 ? translate('დაემატა! 🎉', 'Added! 🎉') : translate('კალათაში დამატება 🛒', 'Add to Cart 🛒')}</button>
          </div>

          {/* კურსი 2 */}
          <div className={`border rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200/80'}`}>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-purple-400 bg-purple-500/10 border-purple-500/20">{translate('2 თვე', '2 Months')}</span>
              <h3 className="text-lg font-black mt-5 mb-3">{translate(<>{safeText('Social Media Marketing')} & {safeText('AI')}</>, <>{safeText('Social Media Marketing')} & {safeText('AI')}</>)}</h3>
              <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-medium mb-8">{translate('ბიზნეს გვერდების ოპტიმიზაცია, Google SEO, სარეკლამო კამპანიების მართვა და AI კონტენტის გენერაცია.', 'Business page optimization, Google SEO, ad campaign management.')}</p>
              
              <div className={`p-4 rounded-2xl border flex items-center space-x-4 ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white text-sm font-black">MG</div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">{translate('მარიკა გაგუა', 'Marika Gagua')}</h4>
                  <p className="text-xs text-slate-400 font-bold">{translate(`კურსის ლექტორი & SMM სტრატეგი`, `Course Lecturer & ${safeText('SMM')} Strategist`)}</p>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => handleAddToCart(1)} className="w-full text-center py-4 bg-slate-900 text-white rounded-xl font-black text-sm mt-8 cursor-pointer border-none shadow-md duration-150">{cartAdded === 1 ? translate('დაემატა! 🎉', 'Added! 🎉') : translate('კალათაში დამატება 🛒', 'Add to Cart 🛒')}</button>
          </div>

          {/* კურსი 3 */}
          <div className={`border rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200/80'}`}>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-purple-400 bg-purple-500/10 border-purple-500/20">{translate('1 თვე', '1 Month')}</span>
              <h3 className="text-lg font-black mt-5 mb-3">{translate(<>{safeText('Figma')} გრაფიკული დიზაინი & {safeText('AI')}</>, <>Graphic Design with {safeText('Figma')} & {safeText('AI')}</>)}</h3>
              <p className="text-xs md:text-sm text-slate-400 leading-relaxed font-medium mb-8">{translate('თანამედროვე ინტერფეისების დიზაინი, პროტოტიპირება და ხელოვნური ინტელექტის გენერაციული მოდელები.', 'Modern interface design, prototyping and generative AI models.')}</p>
              
              <div className={`p-4 rounded-2xl border flex items-center space-x-4 ${darkMode ? 'bg-slate-900/60 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-black">IT</div>
                <div>
                  <h4 className="text-sm font-black text-slate-800 dark:text-slate-200">{translate('ია თავდიშვილი', 'Ia Tavdishvili')}</h4>
                  <p className="text-xs text-slate-400 font-bold">{translate('კურსის მენტორი & დირექტორი', 'Course Mentor & Director')}</p>
                </div>
              </div>
            </div>
            <button type="button" onClick={() => handleAddToCart(2)} className="w-full text-center py-4 bg-slate-900 text-white rounded-xl font-black text-sm mt-8 cursor-pointer border-none shadow-md duration-150">{cartAdded === 2 ? translate('დაემატა! 🎉', 'Added! 🎉') : translate('კალათაში დამატება 🛒', 'Add to Cart 🛒')}</button>
          </div>
        </div>
      </section>

      {/* 📰 NEWS & BLOG SECTION */}
      <section id="blog" className={`py-28 border-t ${darkMode ? 'bg-[#0e1422]/40 border-slate-800' : 'bg-slate-50/60 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-center mb-16 text-2xl md:text-3xl font-black tracking-wide">{translate('სიახლეები & სტატიები ბლოგიდან', 'News & Blog Articles')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className={`p-8 rounded-3xl border backdrop-blur-md transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'}`}>
              <span className="text-[11px] font-black text-cyan-500 uppercase tracking-widest block mb-3">{translate('ტექნოლოგიები', 'Tech')}</span>
              <h3 className="text-lg font-black mb-3">{translate(<>როგორ ცვლის {safeText('Vibe Coding')} ყოველდღიურობას?</>, <>How {safeText('Vibe Coding')} Changes Daily Work?</>)}</h3>
              <p className="text-sm text-slate-400 leading-relaxed font-medium">{translate('ხელოვნური ინტელექტის ინსტრუმენტების ეპოქაში კოდირება უფრო კრეატიული პროცესი გახდა.', 'In the era of AI tools, coding has become a more creative process.')}</p>
            </div>
            <div className={`p-8 rounded-3xl border backdrop-blur-md transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'}`}>
              <span className="text-[11px] font-black text-purple-500 uppercase tracking-widest block mb-3">{translate('მარკეტინგი', 'Marketing')}</span>
              <h3 className="text-lg font-black mb-3">{translate('ციფრული მარკეტინგის ტრენდები', 'Digital Marketing Trends')}</h3>
              <p className="text-sm text-slate-400 leading-relaxed font-medium">{translate('ლოკალური ბიზნესების განვითარებისთვის სოციალური მედიის სწორ ოპტიმიზაციას გადამწყვეტი როლი აქვს.', 'Proper social media optimization plays a crucial role for regional business growth.')}</p>
            </div>
            <div className={`p-8 rounded-3xl border backdrop-blur-md transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'}`}>
              <span className="text-[11px] font-black text-emerald-500 uppercase tracking-widest block mb-3">{translate('სტარტაპები', 'Startups')}</span>
              <h3 className="text-lg font-black mb-3">{translate('ინოვაციები გურიის რეგიონში', 'Innovations in Guria Region')}</h3>
              <p className="text-sm text-slate-400 leading-relaxed font-medium">{translate('როგორ ეხმარება ციფრული ეკოსისტემა ახალგაზრდებსა და ქალებს საკუთარი იდეების რეალიზებაში.', 'How the digital ecosystem helps young people realize their potential and startup ideas.')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 👥 OFFICIAL TEAM SECTION */}
      <section className={`py-28 border-t ${darkMode ? 'bg-[#0e1422]/20 border-slate-800' : 'bg-slate-100/40 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto text-center px-6">
          <h2 className="mb-16 text-2xl md:text-3xl font-black tracking-wide">{translate('ჩვენი გუნდი', 'Our Team')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className={`p-8 rounded-3xl border transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="w-20 h-20 rounded-full mx-auto mb-5 bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-xl">IT</div>
              <h3 className="font-black text-lg mb-1">{translate('ია თავდიშვილი', 'Ia Tavdishvili')}</h3>
              <span className="text-[11px] text-cyan-500 font-bold block mb-4 uppercase tracking-wider">{translate('დირექტორი', 'Director')}</span>
              <p className="text-sm text-slate-400 leading-relaxed font-medium">{translate('ციფრული პროფესიების ცენტრის სტრატეგიული მართვა, პარტნიორობები და განვითარება.', 'Strategic management, partnerships, and core center development.')}</p>
            </div>
            <div className={`p-8 rounded-3xl border transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="w-20 h-20 rounded-full mx-auto mb-5 bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-xl">MG</div>
              <h3 className="font-black text-lg mb-1">{translate('მარიკა გაგუა', 'Marika Gagua')}</h3>
              <span className="text-[11px] text-cyan-500 font-bold block mb-4 uppercase tracking-wider">{translate('სასწავლო მიმართულებების კოორდინატორი', 'Academic Coordinator')}</span>
              <p className="text-sm text-slate-400 leading-relaxed font-medium">{translate('სასწავლო პროცესების მართვა, სილაბუსების ოპტიმიზაცია და სტუდენტების მონიტორინგი.', 'Academic path coordination, syllabus optimization and student tracking.')}</p>
            </div>
            <div className={`p-8 rounded-3xl border transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="w-20 h-20 rounded-full mx-auto mb-5 bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white font-black text-xl">IM</div>
              <h3 className="font-black text-lg mb-1">{translate('იმედო მარტიკოვი', 'Imedo Martikovi')}</h3>
              <span className="text-[11px] text-cyan-500 font-bold block mb-4 uppercase tracking-wider">{translate('პროექტების მენეჯერი', 'Project Manager')}</span>
              <p className="text-sm text-slate-400 leading-relaxed font-medium">{translate('პლატფორმის ციფრული ინფრასტრუქტურის, სააგენტოს და ინოვაციური პროექტების მართვა.', 'Digital infrastructure management, studio agency and innovation engineering.')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* 🤖 AI ASSISTANT CHAT PANEL */}
      <div className="fixed bottom-56 sm:bottom-60 right-4 md:right-6 z-50 flex flex-col gap-3 items-end">
        {isChatOpen && (
          <div className="w-[calc(100vw-2rem)] sm:w-96 border rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[380px] md:h-[420px] bg-white dark:bg-[#0e1422] text-slate-900 dark:text-white border-slate-200 dark:border-slate-800">
            <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
              <span className="text-xs font-bold">{translate('CDC კარიერული ასისტენტი', 'CDC Career Assistant')}</span>
              <button type="button" onClick={() => setIsChatOpen(false)} className="text-white font-bold border-none bg-transparent cursor-pointer">✕</button>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs bg-slate-50 dark:bg-[#0b0f17]">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-3 rounded-xl max-w-[85%] ${msg.sender === 'user' ? 'bg-cyan-500 text-white' : 'bg-white dark:bg-[#161f30] border border-slate-200 dark:border-slate-800'}`}>{msg.text}</div>
                </div>
              ))}
            </div>

            {/* QUICK REPLY BUTTONS */}
            {testStep === 0 && (
              <div className="flex gap-2 p-2 justify-center bg-slate-50 dark:bg-[#0b0f17]">
                <button type="button" onClick={() => { setUserInput(lang === 'GEO' ? 'კი' : 'Yes'); const mockEvent = { preventDefault: () => {} } as React.FormEvent; setTimeout(() => handleSendMessage(mockEvent), 50); }} className="bg-cyan-500 text-white px-4 py-1.5 rounded-full text-[11px] font-black cursor-pointer hover:bg-cyan-600 transition border-none shadow">{translate('დავიწყოთ ტესტი 🚀', 'Start Test 🚀')}</button>
              </div>
            )}
            {testStep === 1 && (
              <div className="flex flex-col gap-1.5 p-2 bg-slate-50 dark:bg-[#0b0f17]">
                <button type="button" onClick={() => { setUserInput(lang === 'GEO' ? 'კრეატიული ვიზუალები' : 'Creative Visuals'); const mockEvent = { preventDefault: () => {} } as React.FormEvent; setTimeout(() => handleSendMessage(mockEvent), 50); }} className="bg-purple-600 text-white px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer text-left hover:bg-purple-700 border-none shadow">{translate('🎨 კრეატივი და ვიზუალები', '🎨 Creative & Visuals')}</button>
                <button type="button" onClick={() => { setUserInput(lang === 'GEO' ? 'კოდირება და ლოგიკა' : 'Coding and Logic'); const mockEvent = { preventDefault: () => {} } as React.FormEvent; setTimeout(() => handleSendMessage(mockEvent), 50); }} className="bg-slate-900 text-white px-3 py-2 rounded-xl text-[11px] font-bold cursor-pointer text-left hover:bg-slate-800 dark:bg-slate-800 border-none shadow">{translate('💻 კოდირება და ლოგიკა', '💻 Coding and Logic')}</button>
              </div>
            )}

            <form onSubmit={handleSendMessage} className="p-3 border-t flex gap-2 bg-white dark:bg-[#0e1422] border-slate-100 dark:border-slate-800">
              <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder={translate('ჩაწერეთ პასუხი...', 'Type a reply...') as string} className="flex-1 border rounded-xl px-3 py-2 text-xs focus:outline-none" />
              <button type="submit" className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs border-none cursor-pointer">OK</button>
            </form>
          </div>
        )}
      </div>

      <footer className="text-center py-8 border-t bg-slate-900 text-slate-500 border-slate-800 text-[11px] m-0">
        © 2026 CDC Platform. All rights reserved.
      </footer>
    </div>
  );
}