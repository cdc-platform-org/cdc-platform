import { useState, useEffect } from 'react';

const SHOW_AFTER_PX = 300;

interface ScrollToTopProps {
  // Overrides the default `bottom-6 right-6` position — needed on pages that
  // already have their own fixed bottom-right widgets (e.g. the homepage's
  // WhatsApp/AI-assistant cluster) so this button doesn't render on top of them.
  positionClassName?: string;
}

export default function ScrollToTop({ positionClassName = 'bottom-6 right-6' }: ScrollToTopProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`fixed ${positionClassName} z-50 flex items-center justify-center w-11 h-11 rounded-full border-none cursor-pointer shadow-lg bg-white text-slate-700 hover:bg-slate-100 hover:-translate-y-0.5 hover:shadow-xl dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-all duration-300 ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-3 pointer-events-none'
      }`}
    >
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    </button>
  );
}
