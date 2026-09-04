import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Calendar, MapPin, X, ChevronLeft, ChevronRight } from 'lucide-react';
import SiteHeader from '../src/components/layout/SiteHeader';
import SiteFooter from '../src/components/layout/SiteFooter';
import BackButton from '../src/components/common/BackButton';
import { useEscapeToClose } from '../src/hooks/useEscapeToClose';
import { getProjects } from '../src/services/projectsService';
import { Project } from '../src/types/project';
import { resolveLocale } from '@/src/utils/locale';

const EN_STRINGS = {
  title: 'Projects & Past Events',
  subtitle: "A look at CDC's own workshops, hackathons, and community events.",
  loading: 'Loading…',
  empty: 'No projects have been published yet.',
  readMore: 'ვრცლად',
  close: 'Close',
};

const dict = {
  ka: {
    title: 'პროექტები და წარსული ღონისძიებები',
    subtitle: 'CDC-ის საკუთარი ვორქშოფები, ჰაკათონები და საზოგადოებრივი ღონისძიებები.',
    loading: 'იტვირთება…',
    empty: 'ჯერ არცერთი პროექტი არ არის გამოქვეყნებული.',
    readMore: 'ვრცლად',
    close: 'დახურვა',
  },
  en: EN_STRINGS,
  de: EN_STRINGS,
  es: EN_STRINGS,
  fr: EN_STRINGS,
  uk: EN_STRINGS,
};

function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const [activeImage, setActiveImage] = useState(0);
  const images = [project.coverImage, ...project.galleryImages];
  useEscapeToClose(true, onClose);

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4 py-8" onClick={onClose}>
      <div
        className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 border-none cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative aspect-video bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={images[activeImage]} alt={project.title} className="w-full h-full object-contain" />
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setActiveImage((i) => (i - 1 + images.length) % images.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 border-none cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setActiveImage((i) => (i + 1) % images.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 border-none cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-1.5 p-3 overflow-x-auto">
            {images.map((url, i) => (
              <button
                key={url}
                type="button"
                onClick={() => setActiveImage(i)}
                className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 cursor-pointer ${
                  i === activeImage ? 'border-cyan-500' : 'border-transparent'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-6">
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mb-2">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(project.date).toLocaleDateString()}
            </span>
            {project.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {project.location}
              </span>
            )}
          </div>
          <h2 className="text-xl font-black tracking-wide mb-4 text-slate-900 dark:text-white">{project.title}</h2>
          <div
            className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300"
            dangerouslySetInnerHTML={{ __html: project.fullContent }}
          />
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const lang = resolveLocale(router.locale);
  const t = dict[lang];
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Project | null>(null);

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${t.title} | CDC Platform`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-4">
          <BackButton fallbackHref="/" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>
        <div className="mb-10">
          <h1 className="text-3xl font-black tracking-wide mb-2">{t.title}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.subtitle}</p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400">{t.loading}</p>
        ) : projects.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.empty}</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="group text-left bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden cursor-pointer p-0 hover:shadow-lg hover:shadow-cyan-500/10 transition-all"
              >
                <div className="aspect-video overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.coverImage}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 mb-2">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(p.date).toLocaleDateString()}
                    </span>
                    {p.location && (
                      <span className="flex items-center gap-1 truncate">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {p.location}
                      </span>
                    )}
                  </div>
                  <h3 className="font-black text-base mb-1.5 line-clamp-2">{p.title}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{p.shortDescription}</p>
                  <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{t.readMore} →</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <SiteFooter />

      {selected && <ProjectModal project={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
