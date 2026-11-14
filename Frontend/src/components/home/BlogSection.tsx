/**
 * Homepage news & blog section (#blog) with the latest published posts.
 * 2026-11 redesign: SectionHeader + Figma-style cards on cdc-* tokens.
 */
import Link from 'next/link';
import { blogDescription, blogTitle, resolveBlogImageUrl } from '../../services/blogService';
import { onImageErrorFallback } from '../../utils/imageFallback';
import { FileText } from 'lucide-react';
import SectionHeader from './SectionHeader';
import { BlogPost } from '../../types/blog';
import type { TFunction } from 'i18next';

interface BlogSectionProps {
  // Kept for the existing call site; styling is token-based now.
  darkMode?: boolean;
  t: TFunction<"home", undefined>;
  blogPosts: BlogPost[];
  contentLang: "ka" | "en";
}

export default function BlogSection({ t, blogPosts, contentLang }: BlogSectionProps) {
  return (
    <section id="blog" className="max-w-7xl mx-auto py-16 sm:py-24 scroll-mt-24">
      <SectionHeader title={t('blogHeading')} action={{ href: '/blog', label: String(t('allArticles')).replace(/\s*→\s*$/, '') }} />
      {blogPosts.length === 0 ? (
        <p className="text-center text-sm text-cdc-muted">{t('blogEmpty')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {blogPosts.map((post) => (
            <Link key={post.id} href={`/blog/${post.slug}`} className="vip-card p-4 sm:p-5 flex flex-col no-underline text-current">
              <div className="overflow-hidden rounded-xl aspect-[16/10] bg-cdc-primary-soft">
                {post.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a CDN thumbnail, next/image gains nothing here.
                  <img src={resolveBlogImageUrl(post.imageUrl)} alt={blogTitle(post, contentLang)} onError={onImageErrorFallback} loading="lazy" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-cdc-primary-ink">
                    <FileText className="w-9 h-9" aria-hidden="true" />
                  </div>
                )}
              </div>
              {post.category && <span className="cdc-chip self-start mt-4">{post.category}</span>}
              <h3 className="mt-3 text-lg font-bold text-cdc-ink">{blogTitle(post, contentLang)}</h3>
              <p className="mt-2 text-sm leading-relaxed text-cdc-muted line-clamp-3">{blogDescription(post, contentLang)}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
