/**
 * Homepage news & blog section (#blog) with the latest published posts.
 */
import Link from 'next/link';
import { blogDescription, blogTitle, resolveBlogImageUrl } from '../../services/blogService';
import { onImageErrorFallback } from '../../utils/imageFallback';
import { FileText } from 'lucide-react';
import { BlogPost } from '../../types/blog';
import type { TFunction } from 'i18next';

interface BlogSectionProps {
  darkMode: boolean;
  t: TFunction<"home", undefined>;
  blogPosts: BlogPost[];
  contentLang: "ka" | "en";
}

export default function BlogSection({ darkMode, t, blogPosts, contentLang }: BlogSectionProps) {
  return (
    <>
      {/* 📰 NEWS & BLOG SECTION — real published posts from GET /api/v1/blog */}
      <section id="blog" className={`py-16 sm:py-28 border-t ${darkMode ? 'bg-[#0e1422]/40 border-slate-800' : 'bg-slate-50/60 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-0 sm:px-6">
          <h2 className="section-title text-center mb-10 sm:mb-16 text-2xl md:text-[2.15rem] font-black tracking-wide">{t('blogHeading')}</h2>
          {blogPosts.length === 0 ? (
            <p className="text-center text-sm text-slate-400 font-medium">{t('blogEmpty')}</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-8">
              {blogPosts.map((post, idx) => {
                const badgeColor = [
                  darkMode ? 'text-cyan-400' : 'text-cyan-500',
                  darkMode ? 'text-purple-400' : 'text-purple-500',
                  darkMode ? 'text-emerald-400' : 'text-emerald-500',
                ][idx % 3];
                return (
                  <Link
                    key={post.id}
                    href={`/blog/${post.slug}`}
                    className={`rounded-3xl border backdrop-blur-md overflow-hidden flex flex-col transition-all duration-300 transform hover:scale-[1.02] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] no-underline text-current ${darkMode ? 'bg-[#0e1422] border-slate-800' : 'bg-white border-slate-200'}`}
                  >
                    {post.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a CDN thumbnail, next/image gains nothing here (same as pages/blog/index.tsx's own card grid).
                      <img src={resolveBlogImageUrl(post.imageUrl)} alt={blogTitle(post, contentLang)} onError={onImageErrorFallback} className="w-full h-44 object-cover" />
                    ) : (
                      <div className={`w-full h-44 flex items-center justify-center ${darkMode ? 'bg-gradient-to-br from-slate-900 to-slate-800' : 'bg-gradient-to-br from-slate-100 to-slate-50'}`}>
                        <FileText className="w-8 h-8 text-cyan-500/40" />
                      </div>
                    )}
                    <div className="p-5 sm:p-8">
                      <span className={`text-[11px] font-black uppercase tracking-widest block mb-3 ${badgeColor}`}>{post.category}</span>
                      <h3 className="text-lg font-black mb-3">{blogTitle(post, contentLang)}</h3>
                      <p className="text-sm text-slate-400 leading-relaxed font-medium line-clamp-3">{blogDescription(post, contentLang)}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
          <div className="text-center mt-14">
            <Link
              href="/blog"
              className={`inline-block px-8 py-3 rounded-full text-sm font-black uppercase tracking-widest border transition-all duration-300 hover:scale-105 ${darkMode ? 'border-cyan-500 text-cyan-400 hover:bg-cyan-500/10' : 'border-cyan-500 text-cyan-600 hover:bg-cyan-50'}`}
            >
              {t('allArticles')}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
