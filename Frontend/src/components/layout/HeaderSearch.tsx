import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { Course } from '../../types/lms';
import { BlogPost } from '../../types/blog';
import { DigitalProduct } from '../../services/productService';
import { getCourses } from '../../services/courseService';
import { getBlogPosts, blogTitle } from '../../services/blogService';
import { getProducts } from '../../services/productService';
import { formatPrice } from '../../utils/coursePricing';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { isPublishedCourse } from '../../utils/courseCatalog';

function SearchPortal({ children }: { children: ReactNode }) { return createPortal(children, document.body); }

const dict = {
  GEO: {
    placeholder: 'მოძებნე კურსი, სტატია, პროდუქტი...',
    shortcutHint: 'სწრაფი ძებნისთვის',
    courses: 'კურსები',
    articles: 'სტატიები',
    marketplace: 'ციფრული მაღაზია',
    viewAll: (q: string) => `ყველა შედეგი "${q}"-სთვის →`,
    empty: 'ვერაფერი მოიძებნა.',
    startTyping: 'დაიწყეთ წერა ძებნისთვის…',
    loading: 'იტვირთება…',
  },
  ENG: {
    placeholder: 'Search courses, articles, products...',
    shortcutHint: 'to search',
    courses: 'Courses',
    articles: 'Articles',
    marketplace: 'Marketplace',
    viewAll: (q: string) => `View all results for "${q}" →`,
    empty: 'Nothing matched your search.',
    startTyping: 'Start typing to search…',
    loading: 'Loading…',
  },
};

function matches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;
  return fields.some((f) => f?.toLowerCase().includes(q));
}

const RESULT_LIMIT = 4;

export default function HeaderSearch({ darkMode, lang, prominent = false }: { darkMode: boolean; lang: 'GEO' | 'ENG'; prominent?: boolean }) {
  const router = useRouter();
  const t = dict[lang];
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [products, setProducts] = useState<DigitalProduct[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEscapeToClose(open, () => setOpen(false));

  // Cmd/Ctrl+K opens the palette from anywhere on the page.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      const controls = dialogRef.current?.querySelectorAll<HTMLElement>('input,button,a[href]');
      if (!controls?.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { window.clearTimeout(timer); document.body.style.overflow = overflow; document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [open]);

  const loadData = useCallback(async () => {
    if (dataLoaded) return;
    setLoading(true);
    try {
      const [coursesData, postsData, productsData] = await Promise.all([
        getCourses().catch(() => []),
        getBlogPosts().catch(() => []),
        getProducts().catch(() => []),
      ]);
      setCourses(coursesData.filter(isPublishedCourse));
      setPosts(postsData.filter((p) => p.published));
      setProducts(productsData);
      setDataLoaded(true);
    } finally {
      setLoading(false);
    }
  }, [dataLoaded]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const matchedCourses = useMemo(
    () => (query ? courses.filter((c) => matches(query, c.title, c.description, c.category, c.mentorName)).slice(0, RESULT_LIMIT) : []),
    [courses, query]
  );
  const matchedPosts = useMemo(
    () => (query ? posts.filter((p) => matches(query, p.title, p.description, p.category)).slice(0, RESULT_LIMIT) : []),
    [posts, query]
  );
  const matchedProducts = useMemo(
    () => (query ? products.filter((p) => matches(query, p.title, p.description, p.category)).slice(0, RESULT_LIMIT) : []),
    [products, query]
  );
  const hasResults = matchedCourses.length > 0 || matchedPosts.length > 0 || matchedProducts.length > 0;

  const goToFullResults = () => {
    if (!query.trim()) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const linkClass = `flex items-start gap-3 px-4 py-2.5 rounded-lg no-underline transition-colors ${
    darkMode ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-100'
  }`;

  return (
    <>
      {prominent ? <form onSubmit={event => { event.preventDefault(); goToFullResults(); }} className="relative min-w-0 w-full">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cdc-muted" />
        <input type="search" value={query} onChange={event => { setQuery(event.target.value); setOpen(true); }} onClick={() => setOpen(true)} onKeyDown={event => { if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); } }} aria-label={t.placeholder} placeholder={t.placeholder} className="w-full rounded-lg border border-cdc-border bg-cdc-bg py-2.5 pl-9 pr-3 text-xs text-cdc-ink focus:outline-none focus:ring-2 focus:ring-cdc-primary/40" />
      </form> : <button type="button" onClick={() => setOpen(true)} aria-label={lang === 'GEO' ? 'ძებნა' : 'Search'} className="rounded-lg border border-cdc-border p-2.5 text-cdc-muted hover:bg-cdc-bg"><Search className="h-4 w-4" /></button>}

      {open && (
        <SearchPortal><div
          className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-[10vh] px-4"
          onClick={close}
        >
          <div
            ref={dialogRef} role="dialog" aria-modal="true" aria-label={t.placeholder}
            className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex items-center gap-3 px-4 border-b ${darkMode ? 'border-slate-800' : 'border-slate-100'}`}>
              <Search className={`w-4 h-4 shrink-0 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && goToFullResults()}
                placeholder={t.placeholder}
                className={`flex-1 bg-transparent border-none py-4 text-sm focus:outline-none ${darkMode ? 'text-white placeholder:text-slate-500' : 'text-slate-900 placeholder:text-slate-400'}`}
              />
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className={`shrink-0 p-1.5 rounded-lg border-none bg-transparent cursor-pointer ${darkMode ? 'text-slate-500 hover:text-slate-200' : 'text-slate-400 hover:text-slate-700'}`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {!query ? (
                <p className={`text-sm text-center py-10 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.startTyping}</p>
              ) : loading ? (
                <p className={`text-sm text-center py-10 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.loading}</p>
              ) : !hasResults ? (
                <p className={`text-sm text-center py-10 ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.empty}</p>
              ) : (
                <>
                  {matchedCourses.length > 0 && (
                    <div className="mb-2">
                      <p className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.courses}</p>
                      {matchedCourses.map((c) => (
                        <Link key={c.id} href={`/courses/${c.id}`} onClick={close} className={linkClass}>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold truncate">{c.title}</span>
                            <span className={`block text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{c.category}</span>
                          </span>
                          <span className="text-xs font-bold shrink-0">{formatPrice(c.currentPrice)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                  {matchedPosts.length > 0 && (
                    <div className="mb-2">
                      <p className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.articles}</p>
                      {matchedPosts.map((p) => (
                        <Link key={p.id} href={`/blog/${p.id}`} onClick={close} className={linkClass}>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold truncate">{blogTitle(p, lang === 'GEO' ? 'ka' : 'en')}</span>
                            <span className={`block text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{p.category}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                  {matchedProducts.length > 0 && (
                    <div className="mb-2">
                      <p className={`px-4 py-1.5 text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{t.marketplace}</p>
                      {matchedProducts.map((p) => (
                        <Link key={p.id} href={`/store/${p.id}`} onClick={close} className={linkClass}>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm font-bold truncate">{p.title}</span>
                            <span className={`block text-xs ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>{p.category}</span>
                          </span>
                          <span className="text-xs font-bold shrink-0">{p.price === 0 ? '' : formatPrice(p.price)}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {query && (
              <button
                type="button"
                onClick={goToFullResults}
                className={`w-full text-left px-4 py-3 text-sm font-bold border-t cursor-pointer bg-transparent ${
                  darkMode ? 'border-slate-800 text-cyan-400 hover:bg-slate-800' : 'border-slate-100 text-cyan-600 hover:bg-slate-50'
                }`}
              >
                {t.viewAll(query)}
              </button>
            )}
          </div>
        </div></SearchPortal>
      )}
    </>
  );
}
