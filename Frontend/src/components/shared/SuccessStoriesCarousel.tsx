import { useState, useEffect, useMemo } from 'react';
import { Quote, GraduationCap } from 'lucide-react';
import { SuccessStory } from '../../types/successStory';
import { getSuccessStories } from '../../services/successStoryService';
import { onImageErrorFallback } from '../../utils/imageFallback';
import Lightbox from './Lightbox';

interface SuccessStoriesCarouselProps {
  lang: 'ka' | 'en';
  // 'dark' fixes dark-friendly colors regardless of a page-level toggle (the
  // homepage passes its own darkMode state instead — see darkMode prop).
  darkMode?: boolean;
}

const dict = {
  ka: {
    title: 'წარმატებული კურსდამთავრებულები',
    subtitle: 'რეალური ისტორიები მათგან, ვინც უკვე შეცვალა კარიერა CDC-სთან ერთად.',
  },
  en: {
    title: 'Successful Graduates',
    subtitle: 'Real stories from people who already changed their careers with CDC.',
  },
};

// LinkedIn brand icon — lucide-react v1 dropped brand/logo icons, so this is
// the same inline SVG path used by SocialShareButtons for visual consistency.
function LinkedInIcon({ size = 14 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM3 9h4v12H3V9Zm7 0h3.8v1.64h.05c.53-1 1.83-2.06 3.77-2.06 4.03 0 4.78 2.65 4.78 6.1V21H18v-5.6c0-1.34-.02-3.06-1.87-3.06-1.87 0-2.16 1.46-2.16 2.96V21H10V9Z" />
    </svg>
  );
}

export default function SuccessStoriesCarousel({ lang, darkMode = false }: SuccessStoriesCarouselProps) {
  const t = dict[lang];
  const [stories, setStories] = useState<SuccessStory[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    getSuccessStories(true)
      .then(setStories)
      .catch(() => setStories([]))
      .finally(() => setLoaded(true));
  }, []);

  // Photos only — stories without an avatar don't participate in the
  // gallery, so their card doesn't render a (non-functional) zoom target.
  const avatarImages = useMemo(
    () =>
      stories
        .filter((s): s is SuccessStory & { avatarUrl: string } => !!s.avatarUrl)
        .map((s) => ({ url: s.avatarUrl, alt: s.studentName })),
    [stories]
  );

  // Nothing to show yet (or admin hasn't added any) — render nothing rather
  // than an empty section on the homepage/course pages.
  if (!loaded || stories.length === 0) return null;

  return (
    <section className={`py-20 border-t ${darkMode ? 'bg-[#0e1422]/30 border-slate-800' : 'bg-slate-50/50 border-slate-200'}`}>
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-center text-2xl md:text-3xl font-black tracking-wide mb-3">{t.title}</h2>
        <p className={`text-center text-sm mb-14 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{t.subtitle}</p>

        <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory sm:grid sm:grid-cols-2 lg:grid-cols-3 sm:overflow-visible">
          {stories.map((story) => (
            <div
              key={story.id}
              className={`shrink-0 w-[85vw] sm:w-auto snap-start p-6 rounded-3xl border backdrop-blur-md transition-all duration-300 hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.2)] ${
                darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'
              }`}
            >
              <Quote size={22} className="text-cyan-500/60 mb-3" />
              <p className={`text-sm leading-relaxed mb-6 line-clamp-5 break-words ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>{story.testimonial}</p>
              <div className="flex items-center gap-3">
                {story.avatarUrl ? (
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(avatarImages.findIndex((img) => img.url === story.avatarUrl))}
                    aria-label={story.studentName}
                    className="shrink-0 w-11 h-11 rounded-full p-0 border-0 bg-transparent cursor-zoom-in"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={story.avatarUrl}
                      alt={story.studentName}
                      onError={onImageErrorFallback}
                      className="w-11 h-11 rounded-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-sm font-black shrink-0">
                    {story.studentName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-black text-sm truncate">{story.studentName}</p>
                    {story.linkedinUrl && (
                      <a
                        href={story.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="LinkedIn"
                        className="text-[#0A66C2] hover:opacity-80 shrink-0"
                      >
                        <LinkedInIcon size={13} />
                      </a>
                    )}
                  </div>
                  <p className={`text-xs font-medium truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{story.roleTitle}</p>
                  <p className="flex items-center gap-1 text-[11px] font-bold text-cyan-500 truncate mt-0.5">
                    <GraduationCap size={12} /> {story.courseName}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Lightbox
        images={avatarImages}
        index={lightboxIndex}
        onClose={() => setLightboxIndex(null)}
        onIndexChange={setLightboxIndex}
      />
    </section>
  );
}
