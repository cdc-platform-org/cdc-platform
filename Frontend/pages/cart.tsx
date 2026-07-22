import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function CDCCart() {
  const [lang, setLang] = useState<'ka' | 'en'>('ka');
  const [currency, setCurrency] = useState<'GEL' | 'USD' | 'EUR'>('GEL');
  const [isPaying, setIsPaying] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'paypal'>('card');
  const [darkMode, setDarkMode] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = localStorage.getItem('darkMode') === 'true' || document.documentElement.classList.contains('dark');
      setDarkMode(isDark);
      const savedLang = localStorage.getItem('lang') as 'ka' | 'en';
      if (savedLang) setLang(savedLang);
    }
  }, []);

  const [cartItems, setCartItems] = useState([
    { id: 2, titleKA: "მასწავლებლის ციფრული დამხმარე (ვიდეო პაკეტი)", titleEN: "Teacher's Digital Assistant (Video Package)", priceGEL: 49, typeKA: "ვიდეო", typeEN: "Video" }
  ]);

  const exchangeRates = { GEL: 1, USD: 0.36, EUR: 0.33 };
  const currencySymbols = { GEL: "₾", USD: "$", EUR: "€" };

  const removeItem = (id: number) => {
    setCartItems(cartItems.filter(item => item.id !== id));
  };

  const convertPrice = (priceInGEL: number) => {
    const converted = priceInGEL * exchangeRates[currency];
    return currency === 'GEL' ? converted : Math.round(converted);
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + convertPrice(item.priceGEL), 0);

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    if (cartItems.length === 0) return;
    setIsPaying(true);
    
    setTimeout(() => {
      setIsPaying(false);
      if (paymentMethod === 'paypal') {
        alert(`🚀 Redirecting to PayPal... Total: ${totalPrice} ${currencySymbols[currency]}`);
      } else {
        alert(`✅ ${lang === 'ka' ? 'გადახდა წარმატებით დასრულდა ბარათით!' : 'Payment completed successfully by Card!'} - ${totalPrice} ${currencySymbols[currency]}`);
      }
      setCartItems([]);
    }, 2000);
  };

  const trans = {
    ka: {
      title: "შერჩეული პროგრამები",
      empty: "თქვენი კალათა ცარიელია",
      summary: "შეკვეთის შეჯამება",
      total: "ჯამური ფასი:",
      cardNum: "ბარათის ნომერი",
      payCard: `უსაფრთხო გადახდა (${totalPrice} ${currencySymbols[currency]})`,
      payPaypal: `PayPal Checkout (${totalPrice} ${currencySymbols[currency]})`,
      paypalDesc: "ტრანზაქციის უსაფრთხოდ დასასრულებლად გადამისამართდებით PayPal-ის ოფიციალურ პლატფორმაზე.",
      paying: "მიმდინარეობს გადახდა...",
      redirect: "მიმდინარეობს გადამისამართება...",
      btnMain: "← მთავარზე",
      methodCard: "💳 ბარათით",
      methodPaypal: "PayPal"
    },
    en: {
      title: "Selected Programs",
      empty: "Your cart is empty",
      summary: "Order Summary",
      total: "Total Price:",
      cardNum: "Card Number",
      payCard: `Secure Checkout (${totalPrice} ${currencySymbols[currency]})`,
      payPaypal: `PayPal Checkout (${totalPrice} ${currencySymbols[currency]})`,
      paypalDesc: "You will be securely redirected to the official PayPal platform to complete the transaction.",
      paying: "Processing payment...",
      redirect: "Redirecting...",
      btnMain: "← Back Home",
      methodCard: "💳 Card",
      methodPaypal: "PayPal"
    }
  };

  const t = trans[lang] || trans.ka;

  return (
    <div className={`min-h-screen font-sans antialiased transition-colors duration-300 relative ${darkMode ? 'bg-[#0b0f17] text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
      <Head>
        <title>{lang === 'ka' ? 'ჩემი კალათა' : 'My Cart'} | CDC Platform</title>
        <link href="https://fonts.googleapis.com/css2?family=Fira+GO:wght@400;700&display=swap" rel="stylesheet" />
        <style>{`
          @font-face {
            font-family: 'Dachi The Lynx';
            /* ფაილის სახელი ზუსტად გასწორდა შენი სკრინშოტის მიხედვით 👇 */
            src: url('/fonts/Dachi the Lynx-46841546889.otf') format('opentype');
            font-weight: normal;
            font-style: normal;
          }
          body { font-family: 'Fira GO', sans-serif; }
          .custom-title { 
            font-family: 'Dachi The Lynx', sans-serif !important; 
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
        `}</style>
      </Head>

      <nav className={`relative z-10 border-b px-6 md:px-12 py-5 transition-colors ${darkMode ? 'border-slate-800/80 bg-[#0e1422]' : 'border-slate-200/60 bg-white'}`}>
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-cyan-500 to-purple-600 text-white px-4 py-1.5 rounded-xl font-black text-sm tracking-wider">CDC</div>
            <span className={`font-bold text-xs uppercase tracking-widest ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>Cart Ecosystem</span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex border rounded-xl p-1 text-[11px] font-bold ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-slate-100 border-slate-200'}`}>
              <button type="button" onClick={() => { setLang('ka'); localStorage.setItem('lang', 'ka'); }} className={`px-3 py-1 rounded-lg transition border-none cursor-pointer font-bold ${lang === 'ka' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 bg-transparent'}`}>KA</button>
              <button type="button" onClick={() => { setLang('en'); localStorage.setItem('lang', 'en'); }} className={`px-3 py-1 rounded-lg transition border-none cursor-pointer font-bold ${lang === 'en' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 bg-transparent'}`}>EN</button>
            </div>
            <button type="button" onClick={() => { setDarkMode(!darkMode); localStorage.setItem('darkMode', String(!darkMode)); }} className={`p-2 rounded-xl transition text-base border-none bg-transparent cursor-pointer ${darkMode ? 'text-yellow-400' : 'text-slate-500'}`}>{darkMode ? '☀️' : '🌙'}</button>
            <a href="/" className={`text-xs font-bold uppercase tracking-wider transition no-underline px-4 py-2 rounded-xl border ${darkMode ? 'text-slate-300 bg-slate-800 border-slate-700 hover:bg-slate-700' : 'text-slate-700 bg-slate-100 border-slate-200 hover:bg-slate-200'}`}>{t.btnMain}</a>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-16 grid md:grid-cols-3 gap-10">
        <div className="md:col-span-2 space-y-6">
          <div className="flex items-center gap-3 mb-8">
            <svg className="w-6 h-6 text-cyan-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M2.25 2.25h1.5l1.35 6.75M5.1 9h14.4l1.35-6.75H4.65" strokeLinecap="round" strokeLinejoin="round"/><circle cx="7.5" cy="19.5" r="2.25"/><circle cx="18" cy="19.5" r="2.25"/>
            </svg>
            <h2 className={`text-2xl font-black custom-title m-0 ${darkMode ? 'text-white' : 'text-slate-900'}`}>{t.title}</h2>
          </div>
          
          {cartItems.length === 0 ? (
            <div className={`rounded-2xl p-16 text-center border ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200/60'}`}><p className="text-slate-400 font-bold text-sm">{t.empty}</p></div>
          ) : (
            cartItems.map((item) => (
              <div key={item.id} className={`border rounded-2xl p-6 flex justify-between items-center transition-all duration-300 transform hover:-translate-y-0.5 hover:border-transparent hover:ring-2 hover:ring-cyan-500 ${darkMode ? 'bg-[#0e1422] border-slate-800 hover:bg-[#121b2d]' : 'bg-white border-slate-200/80 hover:shadow-md'}`}>
                <div>
                  <span className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${darkMode ? 'text-purple-400 bg-purple-500/10 border-purple-500/20' : 'text-purple-600 bg-purple-50 border-purple-100'}`}>{lang === 'ka' ? item.typeKA : item.typeEN}</span>
                  <h4 className={`font-bold text-base tracking-wide mt-4 leading-snug ${darkMode ? 'text-white' : 'text-slate-900'}`}>{lang === 'ka' ? item.titleKA : item.titleEN}</h4>
                </div>
                <div className="flex items-center gap-6">
                  <span className={`font-black text-lg tracking-wider ${darkMode ? 'text-cyan-400' : 'text-slate-900'}`}>{convertPrice(item.priceGEL)} {currencySymbols[currency]}</span>
                  <button type="button" onClick={() => removeItem(item.id)} className={`font-bold border rounded-xl p-2 cursor-pointer transition ${darkMode ? 'text-rose-400 bg-rose-500/5 border-rose-500/20 hover:bg-rose-500/10' : 'text-rose-600 bg-rose-50 border-rose-100 hover:bg-rose-100'}`}>✕</button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className={`border rounded-2xl p-6 shadow-sm h-fit space-y-6 transition-all duration-300 ${darkMode ? 'bg-[#0e1422] border-slate-800 hover:border-slate-700' : 'bg-white border-slate-200 hover:border-slate-300'}`}>
          <div className="flex justify-between items-center">
            <div className={`flex items-center gap-1.5 border px-3 py-1 rounded-xl text-[10px] font-bold ${darkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>SECURED</span>
            </div>
            <div className={`flex border rounded-xl p-1 text-[10px] font-bold ${darkMode ? 'bg-[#161f30] border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
              {(['GEL', 'USD', 'EUR'] as const).map((cur) => (
                <button key={cur} type="button" onClick={() => setCurrency(cur)} className={`px-3 py-1 rounded-lg transition-all cursor-pointer border-none font-bold ${currency === cur ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-400 bg-transparent'}`}>{cur}</button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-base font-bold custom-title mb-2">{t.summary}</h3>
            <div className={`flex justify-between border-b py-3 text-xs font-medium ${darkMode ? 'border-slate-800 text-slate-400' : 'border-slate-100 text-slate-500'}`}>
              <span>{t.total}</span><span className={`text-base font-black tracking-wider ${darkMode ? 'text-cyan-400' : 'text-slate-900'}`}>{totalPrice} {currencySymbols[currency]}</span>
            </div>
          </div>

          <div className={`grid grid-cols-2 gap-2 p-1 rounded-xl text-xs font-bold border ${darkMode ? 'bg-[#161f30] border-slate-800' : 'bg-slate-100 border-slate-200'}`}>
            <button type="button" onClick={() => setPaymentMethod('card')} className={`py-2.5 rounded-lg transition-all border-none cursor-pointer font-bold ${paymentMethod === 'card' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 bg-transparent'}`}>{t.methodCard}</button>
            <button type="button" onClick={() => setPaymentMethod('paypal')} className={`py-2.5 rounded-lg transition-all border-none cursor-pointer font-bold ${paymentMethod === 'paypal' ? 'bg-[#ffc439] text-blue-950 shadow-sm' : 'text-slate-400 bg-transparent'}`}>{t.methodPaypal}</button>
          </div>

          <form onSubmit={handleCheckout} className="space-y-4">
            {paymentMethod === 'card' ? (
              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold block mb-1.5 uppercase tracking-widest text-slate-400">{t.cardNum}</label>
                  <input required={paymentMethod === 'card'} type="text" placeholder="0000 0000 0000 0000" className={`w-full rounded-xl p-3.5 text-xs focus:outline-none border ${darkMode ? 'bg-[#161f30] border-slate-800 text-white focus:border-cyan-500' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-sky-500'}`} />
                </div>
                <button type="submit" className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl text-xs uppercase border-none cursor-pointer active:scale-95 duration-150">{isPaying ? t.paying : t.payCard}</button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className={`text-[11px] font-medium p-3 rounded-xl text-center border ${darkMode ? 'bg-blue-500/5 border-blue-500/20 text-slate-400' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>{t.paypalDesc}</p>
                <button type="submit" className="w-full bg-[#003087] text-white font-bold py-4 rounded-xl text-xs uppercase border-none cursor-pointer active:scale-95 duration-150 shadow-md">{isPaying ? t.redirect : t.payPaypal}</button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}