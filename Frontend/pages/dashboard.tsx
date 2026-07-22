import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';

export default function StudentDashboard() {
  const [activeTab, setActiveTab] = useState<'my-courses' | 'my-videos' | 'certs'>('my-courses');

  // სიმულაციური მონაცემები რეალური სილაბუსებიდან
  const enrolledCourses = [
    { title: "Vibe Coding - ვებ-დეველოპმენტი AI-ით", progress: 65, nextLesson: "სამშაბათი, 20:00", mentor: "ია თავდიშვილი" },
    { title: "სოციალური მედიის მარკეტინგი & AI", progress: 20, nextLesson: "ხუთშაბათი, 19:00", mentor: "ია თავდიშვილი" }
  ];

  const purchasedVideos = [
    { title: "მასწავლებლის ციფრული დამხმარე (სრული პაკეტი)", duration: "4.5 საათი", modules: "3 მოდული" }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      <Head>
        <title>პირადი კაბინეტი | CDC Platform</title>
      </Head>

      {/* 🧭 NAVIGATION */}
      <nav className="flex justify-between items-center px-6 md:px-12 py-5 border-b border-slate-200/60 bg-white sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-3 no-underline cursor-pointer">
          <div className="bg-sky-600 text-white px-3.5 py-1.5 rounded-xl font-black text-sm tracking-wider">CDC</div>
          <span className="font-bold text-sm text-slate-800 tracking-wide">სტუდენტის პანელი</span>
        </Link>

        <div className="flex items-center gap-4">
          <Link href="/" className="hidden sm:flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-sky-600 transition no-underline">
            ← მთავარ გვერდზე დაბრუნება
          </Link>
          <div className="text-right hidden sm:block">
            <span className="font-bold text-xs block text-slate-900">სტუდენტი (ტესტერი)</span>
            <span className="text-[10px] text-slate-400 block font-medium">student@cdc.ge</span>
          </div>
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center font-bold text-slate-700 border border-slate-300/40">ST</div>
          <Link href="/profile/settings" className="text-xs font-bold text-slate-500 hover:text-sky-600 transition no-underline" title="პარამეტრები">
            ⚙️
          </Link>
          <a href="/" className="text-xs font-bold text-red-500 hover:text-red-700 transition no-underline ml-2">გასვლა</a>
        </div>
      </nav>

      {/* 💻 MAIN WORKSPACE */}
      <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
        
        {/* SIDE MENU */}
        <div className="space-y-2">
          <button 
            onClick={() => setActiveTab('my-courses')} 
            className={`w-full text-left p-3.5 rounded-xl text-xs font-bold transition ${activeTab === 'my-courses' ? 'bg-slate-950 text-white shadow-sm' : 'bg-white border border-slate-200/60 text-slate-600 hover:bg-slate-50'}`}
          >
            🎓 ჩემი კურსები
          </button>
          <button 
            onClick={() => setActiveTab('my-videos')} 
            className={`w-full text-left p-3.5 rounded-xl text-xs font-bold transition ${activeTab === 'my-videos' ? 'bg-slate-950 text-white shadow-sm' : 'bg-white border border-slate-200/60 text-slate-600 hover:bg-slate-50'}`}
          >
             Tape ჩემი ვიდეოები (VOD)
          </button>
          <button 
            onClick={() => setActiveTab('certs')} 
            className={`w-full text-left p-3.5 rounded-xl text-xs font-bold transition ${activeTab === 'certs' ? 'bg-slate-950 text-white shadow-sm' : 'bg-white border border-slate-200/60 text-slate-600 hover:bg-slate-50'}`}
          >
            📜 სერტიფიკატები
          </button>
        </div>

        {/* CONTENT DISPLAY */}
        <div className="md:col-span-3 space-y-6">
          
          {/* TAB: MY COURSES */}
          {activeTab === 'my-courses' && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold tracking-wide mb-2">აქტიური სასწავლო პროგრამები</h2>
              {enrolledCourses.map((course, idx) => (
                <div key={idx} className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-base text-slate-900 tracking-wide">{course.title}</h3>
                      <p className="text-[11px] text-slate-400 font-semibold mt-1">ლექტორი: {course.mentor}[cite: 2]</p>
                    </div>
                    <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2.5 py-1 rounded-md">⏳ შემდეგი: {course.nextLesson}</span>
                  </div>
                  
                  {/* PROGRESS BAR */}
                  <div>
                    <div className="flex justify-between text-[11px] font-bold text-slate-500 mb-1">
                      <span>პროგრესი</span>
                      <span>{course.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                      <div className="bg-sky-600 h-full transition-all duration-300" style={{ width: `${course.progress}%` }}></div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button onClick={() => alert('გადამისამართება სასწავლო ოთახში...')} className="bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition">
                      🖥️ ლექციაზე შესვლა (Google Meet)[cite: 2]
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* TAB: Purchased Videos */}
          {activeTab === 'my-videos' && (
            <div className="space-y-4">
              <h2 className="text-lg font-extrabold tracking-wide mb-2">ჩემი ვიდეო ბიბლიოთეკა</h2>
              {purchasedVideos.map((vid, idx) => (
                <div key={idx} className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm flex justify-between items-center">
                  <div>
                    <span className="text-[9px] font-black bg-purple-50 text-purple-600 px-2 py-0.5 rounded uppercase tracking-wider">{vid.modules}</span>
                    <h3 className="font-bold text-sm text-slate-900 tracking-wide mt-2">{vid.title}</h3>
                    <p className="text-[11px] text-slate-400 font-medium mt-1">ხანგრძლივობა: {vid.duration}</p>
                  </div>
                  <button onClick={() => alert('ვიდეო პლეერის ჩართვა...')} className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition">
                    ▶ ყურება
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* TAB: CERTIFICATES */}
          {activeTab === 'certs' && (
            <div className="bg-white border border-slate-200/60 rounded-2xl p-12 text-center shadow-sm">
              <span className="text-3xl block mb-2">📜</span>
              <p className="text-slate-400 font-semibold text-xs">სერტიფიკატები ხელმისაწვდომი იქნება კურსის დასრულებისა და ფინალური პროექტის წარდგენის შემდეგ (მინ. 71 ქულა)[cite: 2, 3].</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}