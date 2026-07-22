import { useState, useEffect } from 'react';
import Head from 'next/head';

interface Post {
  id: number;
  type: 'employer' | 'freelancer';
  author: string;
  authorInfo: string;
  title: React.ReactNode;
  desc: React.ReactNode;
  price: string;
  tags: string[];
}

export default function Community() {
  const [darkMode, setDarkMode] = useState<boolean>(false);
  const [filter, setFilter] = useState<'all' | 'employer' | 'freelancer'>('all');
  
  // ფორმის სთეითები
  const [role, setRole] = useState<'employer' | 'freelancer'>('employer');
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [budget, setBudget] = useState('');
  const [desc, setDesc] = useState('');

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

  const [posts, setPosts] = useState<Post[]>([
    {
      id: 1,
      type: 'employer',
      author: 'გიორგი',
      authorInfo: 'რესტორანი მწვანე გურია',
      title: <>გვერდისთვის გვესაჭიროება ლოგოს დამზადება და მენიუს დიზაინი</>,
      desc: <>ოზურგეთში მდებარე ტურისტული ობიექტისთვის გვჭირდება ბრენდინგი. სასურველია გამოყენებულ იქნას <span className="font-sans font-bold">AI</span> ინსტრუმენტები იდეებისთვის.</>,
      price: '250 ₾',
      tags: ['გრაფიკული დიზაინი', 'Photoshop', 'AI Tools']
    },
    {
      id: 2,
      type: 'freelancer',
      author: 'ნიკა კალანდაძე',
      authorInfo: 'CDC კურსდამთავრებული',
      title: <>ავაწყობ სრულფასოვან ვებგვერდებს უახლესი <span className="font-sans font-bold">AI</span> ტექნოლოგიებით</>,
      desc: <>გთავაზობთ სწრაფ და ოპტიმიზებულ ვებგვერდებს. ვიყენებ <span className="font-sans font-medium">Claude AI, VS Code, GitHub</span> და <span className="font-sans font-medium">Supabase</span> ეკოსისტემას.</>,
      price: '1200 ₾-დან',
      tags: ['Vibe Coding', 'React', 'Next.js', 'Supabase']
    }
  ]);

  const handleCreatePost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !title || !budget || !desc) return;

    const newPost: Post = {
      id: Date.now(),
      type: role,
      author: name,
      authorInfo: role === 'employer' ? 'დამკვეთი' : 'CDC კურსდამთავრებული',
      title: <>{title}</>,
      desc: <>{desc}</>,
      price: budget.includes('₾') ? budget : `${budget} ₾`,
      tags: role === 'employer' ? ['დიზაინი', 'AI'] : ['Vibe Coding', 'Dev']
    };

    setPosts([newPost, ...posts]);
    setName('');
    setTitle('');
    setBudget('');
    setDesc('');
  };

  const filteredPosts = posts.filter(p => filter === 'all' || p.type === filter);

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 relative overflow-hidden ${darkMode ? 'text-slate-200 bg-[#0b0f19]' : 'text-slate-800 bg-[#f8fafc]'}`}>
      <Head>
        <title>CDC | Community & Freelance</title>
        <link href="https://fonts.googleapis.com/css2?family=Fira+GO:wght@400;500;700&display=swap" rel="stylesheet" />
        <style>{`
          body { font-family: 'Fira GO', sans-serif; }
        `}</style>
      </Head>

      {/* 🧭 NAVIGATION */}
      <nav className={`sticky top-0 z-50 border-b px-4 md:px-12 py-4 md:py-5 ${darkMode ? 'border-slate-800 bg-[#0e1422]/90 backdrop-blur-md' : 'border-slate-200/60 bg-white/90 backdrop-blur-md'}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="bg-gradient-to-tr from-cyan-500 to-purple-600 text-white px-3 md:px-4 py-1.5 rounded-xl font-black text-xs md:text-sm tracking-wider">CDC</div>
            <div>
              <span className={`font-bold text-sm md:text-base block leading-none tracking-tight ${darkMode ? 'text-white' : 'text-slate-900'}`}>CDC Studio</span>
              <span className="text-[9px] md:text-[10px] text-slate-400 font-medium block mt-1">Community & Freelance</span>
            </div>
          </div>

          <div className={`hidden lg:flex items-center space-x-8 text-sm font-bold tracking-wide ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>
            <a href="/" className="hover:text-cyan-500 transition no-underline text-current">მთავარზე დაბრუნება</a>
          </div>

          <div className="flex items-center space-x-4">
            <button type="button" onClick={toggleDarkMode} className="p-2 rounded-xl transition text-base md:text-lg border-none bg-transparent cursor-pointer hover:rotate-12 duration-200">{darkMode ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </nav>

      {/* 🏙️ MAIN CONTAINER */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* 📝 LEFT COLUMN: PREMIUM POST FORM */}
        <div className="lg:col-span-1">
          <div className={`rounded-3xl p-6 border backdrop-blur-xl sticky top-28 ${darkMode ? 'bg-[#0e1422]/60 border-slate-800 shadow-2xl' : 'bg-white border-slate-200/80 shadow-md'}`}>
            <div className="flex items-center space-x-3 mb-6">
              <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-lg font-bold tracking-tight">განცხადების დამატება</h2>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-5">
              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-widest">ვინ ხართ თქვენ?</label>
                <select 
                  value={role} 
                  onChange={(e) => setRole(e.target.value as 'employer' | 'freelancer')} 
                  className={`w-full border rounded-xl p-3 text-xs focus:outline-none transition font-medium ${darkMode ? 'bg-[#161f30] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-800 focus:border-cyan-500'}`}
                >
                  <option value="employer">დამკვეთი (ვეძებ შემსრულებელს)</option>
                  <option value="freelancer">ფრილანსერი (CDC კურსდამთავრებული)</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-widest">სახელი ან კომპანია</label>
                <input 
                  required 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="მაგ: გიორგი ან ტეილორ.გე" 
                  className={`w-full border rounded-xl p-3.5 text-xs focus:outline-none transition-all ${darkMode ? 'bg-[#161f30] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'}`} 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-widest">სათაური</label>
                <input 
                  required 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)} 
                  placeholder="მაგ: მენიუს დიზაინის შექმნა" 
                  className={`w-full border rounded-xl p-3.5 text-xs focus:outline-none transition-all ${darkMode ? 'bg-[#161f30] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'}`} 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-widest">ბიუჯეტი / ანაზღაურება</label>
                <input 
                  required 
                  type="text" 
                  value={budget} 
                  onChange={(e) => setBudget(e.target.value)} 
                  placeholder="მაგ: 500 ₾" 
                  className={`w-full border rounded-xl p-3.5 text-xs focus:outline-none transition-all ${darkMode ? 'bg-[#161f30] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'}`} 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 block mb-2 uppercase tracking-widest">დეტალური აღწერა</label>
                <textarea 
                  required 
                  rows={4} 
                  value={desc} 
                  onChange={(e) => setDesc(e.target.value)} 
                  placeholder="აღწერეთ პროექტი დეტალურად..." 
                  className={`w-full border rounded-xl p-3.5 text-xs focus:outline-none transition-all resize-none ${darkMode ? 'bg-[#161f30] border-slate-700 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-cyan-500'}`} 
                />
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold py-4 rounded-xl text-xs uppercase border-none cursor-pointer transform active:scale-[0.98] transition-all shadow-lg shadow-cyan-500/10 tracking-wider">
                გამოქვეყნება
              </button>
            </form>
          </div>
        </div>

        {/* 📊 RIGHT COLUMN: FILTERS & POSTS FEED */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* PREMIUM FILTER SWITCHER */}
          <div className={`p-1.5 rounded-2xl border flex space-x-2 backdrop-blur-md max-w-md ${darkMode ? 'bg-[#0e1422]/60 border-slate-800' : 'bg-white border-slate-200/80'}`}>
            <button 
              type="button" 
              onClick={() => setFilter('all')} 
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition border-none cursor-pointer ${filter === 'all' ? (darkMode ? 'bg-slate-800 text-white shadow' : 'bg-slate-900 text-white shadow') : 'text-slate-400 bg-transparent'}`}
            >
              ყველა
            </button>
            <button 
              type="button" 
              onClick={() => setFilter('employer')} 
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition border-none cursor-pointer ${filter === 'employer' ? 'bg-amber-500 text-white shadow' : 'text-slate-400 bg-transparent'}`}
            >
              ვაკანსიები
            </button>
            <button 
              type="button" 
              onClick={() => setFilter('freelancer')} 
              className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition border-none cursor-pointer ${filter === 'freelancer' ? 'bg-emerald-500 text-white shadow' : 'text-slate-400 bg-transparent'}`}
            >
              ფრილანსერები
            </button>
          </div>

          {/* POSTS FEED */}
          <div className="space-y-6">
            {filteredPosts.map(p => (
              <div 
                key={p.id} 
                className={`border rounded-3xl p-6 transition-all duration-300 transform hover:scale-[1.005] flex flex-col justify-between min-h-[220px] ${darkMode ? 'bg-[#0e1422] border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200/80 hover:shadow-md'}`}
              >
                <div>
                  {/* TOP CARD BAR */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="space-y-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${
                        p.type === 'employer' 
                          ? (darkMode ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-amber-700 bg-amber-50 border-amber-100')
                          : (darkMode ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-100')
                      }`}>
                        {p.type === 'employer' ? 'დამკვეთი' : 'შემსრულებელი / FULL-STACK'}
                      </span>
                      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 pt-1">
                        {p.author} <span className="text-[10px] font-normal opacity-60">({p.authorInfo})</span>
                      </h4>
                    </div>
                    
                    <div className="text-right">
                      <span className={`text-base font-black tracking-tight ${p.type === 'employer' ? 'text-cyan-500' : 'text-purple-500'}`}>
                        {p.price}
                      </span>
                    </div>
                  </div>

                  {/* POST CONTENT */}
                  <h3 className={`text-base font-bold mb-2 tracking-wide leading-snug ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                    {p.title}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-400 leading-relaxed font-normal mb-6">
                    {p.desc}
                  </p>
                </div>

                {/* BOTTOM CARD BAR */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800/60">
                  <div className="flex flex-wrap gap-2">
                    {p.tags.map((tag, idx) => (
                      <span 
                        key={idx} 
                        className={`text-[10px] font-medium px-2.5 py-1 rounded-lg border ${
                          darkMode ? 'bg-slate-900 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200/60 text-slate-600'
                        } ${tag.match(/[A-Za-z]/) ? 'font-sans' : ''}`}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <button 
                    type="button" 
                    className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition border border-transparent cursor-pointer shadow-sm ${
                      p.type === 'employer'
                        ? 'bg-gradient-to-r from-cyan-500 to-sky-600 text-white hover:opacity-95'
                        : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700'
                    }`}
                  >
                    <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                      <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                    </svg>
                    <span>{p.type === 'employer' ? 'შეთავაზების გაგზავნა' : 'კონტაქტი'}</span>
                  </button>
                </div>

              </div>
            ))}
          </div>

        </div>
      </div>

      <footer className="text-center py-8 border-t bg-slate-900 text-slate-500 border-slate-800 text-[11px] m-0 mt-12">
        © 2026 CDC Platform. All rights reserved.
      </footer>
    </div>
  );
}