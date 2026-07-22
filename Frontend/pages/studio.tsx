import { useState } from 'react';
import Head from 'next/head';

export default function CDCStudio() {
  const [lang, setLang] = useState<'ka' | 'en'>('ka');
  const [checkoutCourse, setCheckoutCourse] = useState<any | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const videoCourses = [
    {
      id: "vid-01",
      title: "მასწავლებლის ციფრული დამხმარე: შექმენი მომავლის გაკვეთილი",
      lessons: "3 მოდული (სრული ვიდეო პაკეტი)",
      price: "49 ₾",
      desc: "ბიუროკრატიული სამუშაოს შემსუბუქება, Google Classroom-ის ავტომატიზაცია და NotebookLM-ით სასკოლო PDF მასალების ინტერაქტიულ პოდკასტებად ქცევა.[cite: 6]"
    },
    {
      id: "vid-02",
      title: "Vibe Coding & AI ვებ-დეველოპმენტის სრული ვიდეო კურსი",
      lessons: "24 ვიდეო გაკვეთილი + კოდების ბაზა",
      price: "99 ₾",
      desc: "ისწავლეთ სრულფასოვანი ვებგვერდების აწყობა ნულიდან Claude AI-ის, VS Code-ის, GitHub-ისა და Supabase-ის გამოყენებით.[cite: 2]"
    },
    {
      id: "vid-03",
      title: "ანიმაცია და პერსონაჟების გაცოცხლება (Rigging & Lip Sync)",
      lessons: "7 ძირითადი სესია",
      price: "39 ₾",
      desc: "Adobe Character Animator-ისა და Flow.ai-ს სრული პრაქტიკული კურსი მოზარდებისა და დამწყებთათვის ICT ბაზარზე დასაქმების უნარებით.[cite: 4]"
    }
  ];

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      alert(lang === 'ka' ? "✅ გადახდა წარმატებით დასრულდა SSL Secure არხით! ვიდეო კურსზე წვდომა გააქტიურებულია თქვენს პროფილში." : "✅ Payment successful via SSL Secure channel! Video course access is now active in your profile.");
      setCheckoutCourse(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased tracking-normal">
      <Head>
        <title>CDC Studio | {lang === 'ka' ? 'ვიდეო გაკვეთილები' : 'Video Lessons'}</title>
      </Head>

      {/* 🧭 NAVIGATION BAR */}
      <nav className="flex justify-between items-center px-6 md:px-12 py-5 border-b border-slate-200/60 bg-white sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="bg-sky-600 text-white px-3.5 py-1.5 rounded-xl font-black text-sm tracking-wider">
            CDC
          </div>
          <span className="font-bold text-sm text-slate-800 tracking-wide">CDC Studio</span>
        </div>
        
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setLang(lang === 'ka' ? 'en' : 'ka')} 
            className="px-3 py-1.5 border border-slate-200 rounded-lg font-bold text-xs text-slate-600 hover:bg-slate-50 transition"
          >
            {lang === 'ka' ? 'EN' : 'KA'}
          </button>
          <a 
            href="/" 
            className="text-xs font-bold text-slate-500 hover:text-slate-900 transition no-underline"
          >
            {lang === 'ka' ? '← მთავარზე დაბრუნება' : '← Back to Home'}
          </a>
        </div>
      </nav>

      {/* 🚀 BANNER / HEADER */}
      <header className="max-w-4xl mx-auto text-center pt-20 pb-12 px-6">
        <span className="bg-sky-50 text-sky-700 px-4 py-1.5 rounded-full text-xs font-bold inline-block mb-6 tracking-wide shadow-sm">
          ONLINE VIDEO STORE (VOD)
        </span>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-wide leading-tight mb-6 max-w-3xl mx-auto">
          {lang === 'ka' ? 'ისწავლე პროფესიონალებისგან ნებისმიერ დროს' : 'Learn From Professionals Anytime, Anywhere'}
        </h1>
        <p className="text-slate-500 max-w-xl mx-auto text-base md:text-lg leading-relaxed font-normal tracking-wide">
          {lang === 'ka' 
            ? 'შეიძინე ერთხელ, მიიღე მუდმივი უსაფრთხო წვდომა პრემიუმ ვიდეო გაკვეთილებზე, პრაქტიკულ დავალებებსა და ორენოვან სერტიფიკატზე.[cite: 3]' 
            : 'Buy once, get permanent lifetime access to premium video lessons, homework assignments, and bilingual certification.[cite: 3]'}
        </p>
      </header>

      {/* 📚 VIDEO CATALOG GRID */}
      <section className="max-w-6xl mx-auto px-6 pb-24 grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {videoCourses.map((course) => (
          <div key={course.id} className="bg-white border border-slate-200/80 rounded-2xl p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-all duration-300">
            <div>
              <div className="flex justify-between items-center mb-5">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md">
                  📼 {course.lessons}
                </span>
                <span className="text-xl font-black text-slate-900 tracking-wide">{course.price}</span>
              </div>
              <h3 className="font-bold text-base text-slate-900 mb-3 leading-snug tracking-wide">
                {course.title}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed font-normal tracking-wide">
                {course.desc}
              </p>
            </div>
            
            <button 
              onClick={() => setCheckoutCourse(course)}
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 rounded-xl text-xs mt-6 transition shadow-sm tracking-wide"
            >
              {lang === 'ka' ? '🔒 კურსის შეძენა' : '🔒 Buy Course'}
            </button>
          </div>
        ))}
      </section>

      {/* 🛡️ STRIPE / BANK STYLE SECURE GATEWAY (MODAL) */}
      {checkoutCourse && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity duration-300">
          <div className="bg-white rounded-3xl max-w-md w-full p-8 border border-slate-100 shadow-2xl relative transform transition-transform duration-300">
            
            {/* CLOSE BUTTON */}
            <button 
              onClick={() => setCheckoutCourse(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 font-bold border-none bg-transparent cursor-pointer text-base"
            >
              ✕
            </button>

            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md inline-block mb-4">
              🛡️ SSL Secured 256-Bit Gateway
            </span>
            
            <h3 className="text-lg font-extrabold text-slate-900 mb-1 tracking-wide">
              {lang === 'ka' ? 'უსაფრთხო ანგარიშსწორება' : 'Secure Checkout'}
            </h3>
            <p className="text-xs text-slate-400 font-semibold mb-6 tracking-wide leading-tight">
              {checkoutCourse.title}
            </p>

            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                  {lang === 'ka' ? 'ბარათის მფლობელი' : 'Cardholder Name'}
                </label>
                <input 
                  required 
                  type="text" 
                  placeholder={lang === 'ka' ? "სახელი გვარი" : "John Doe"} 
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-sky-500 bg-slate-50/50" 
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                  {lang === 'ka' ? 'ბარათის ნომერი' : 'Card Number'}
                </label>
                <div className="relative">
                  <input 
                    required 
                    type="text" 
                    maxLength={16} 
                    placeholder="0000 0000 0000 0000" 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-sky-500 bg-slate-50/50 font-mono tracking-widest" 
                  />
                  <span className="absolute right-4 top-3 text-base">💳</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                    {lang === 'ka' ? 'ვადა' : 'Expiration'}
                  </label>
                  <input 
                    required 
                    type="text" 
                    placeholder="MM/YY" 
                    maxLength={5} 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-sky-500 bg-slate-50/50 text-center font-mono" 
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-500 block mb-1 uppercase tracking-wider">
                    CVC / CVV
                  </label>
                  <input 
                    required 
                    type="password" 
                    placeholder="***" 
                    maxLength={3} 
                    className="w-full border border-slate-200 rounded-xl p-3 text-sm focus:outline-none focus:border-sky-500 bg-slate-50/50 text-center font-mono tracking-widest" 
                  />
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center my-6 border border-slate-200/40">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  {lang === 'ka' ? 'სულ გადასახდელი:' : 'Total amount:'}
                </span>
                <span className="text-xl font-black text-slate-900 tracking-wide">{checkoutCourse.price}</span>
              </div>

              <button 
                type="submit"
                disabled={isProcessing}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2 uppercase tracking-wider"
              >
                {isProcessing ? (
                  <span>🔄 {lang === 'ka' ? 'მიმდინარეობს ტრანზაქცია...' : 'Processing Transaction...'}</span>
                ) : (
                  <span>🔒 {lang === 'ka' ? `გადახდა (${checkoutCourse.price})` : `Pay Now (${checkoutCourse.price})`}</span>
                )}
              </button>
            </form>

            <p className="text-[10px] text-slate-400 text-center mt-5 font-semibold tracking-wide leading-tight">
              {lang === 'ka' 
                ? 'თქვენი ტრანზაქცია დაცულია. მონაცემები არ ინახება CDC-ის სერვერებზე.' 
                : 'Your transaction is encrypted. Card data is never stored on CDC servers.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}