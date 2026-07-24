import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Head from 'next/head';
import { BlogPost } from '../../src/types/blog';
import { getBlogPostById, resolveBlogImageUrl, blogTitle, blogContent, isSuccessStory } from '../../src/services/blogService';
import SocialShareButtons from '../../src/components/shared/SocialShareButtons';

const dict = {
  ka: {
    loading: 'იტვირთება…',
    notFound: 'სტატია ვერ მოიძებნა.',
    back: '← ბლოგზე დაბრუნება',
    by: 'ავტორი',
  },
  en: {
    loading: 'Loading…',
    notFound: 'Article not found.',
    back: '← Back to blog',
    by: 'By',
  },
};

export default function BlogPostPage() {
  const router = useRouter();
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const postId = typeof router.query.id === 'string' ? router.query.id : null;

  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    setNotFound(false);
    try {
      const data = await getBlogPostById(postId);
      if (!data.published) {
        setNotFound(true);
      } else {
        setPost(data);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-sm">{t.loading}</div>;
  }
  if (notFound || !post) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-950 text-slate-300 text-sm">
        <p>{t.notFound}</p>
        <Link href="/blog" className="text-cyan-400 hover:underline">
          {t.back}
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-16">
      <Head>
        <title>{blogTitle(post, lang)} | CDC Blog</title>
      </Head>
      <div className="max-w-2xl mx-auto">
        <Link href="/blog" className="text-sm text-slate-400 hover:text-white no-underline">
          {t.back}
        </Link>

        <div className="flex flex-wrap gap-2 mt-6">
          <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-cyan-300 bg-cyan-500/10 border-cyan-500/20">
            {post.category}
          </span>
          {isSuccessStory(post) && (
            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-md border text-amber-300 bg-amber-500/10 border-amber-500/20">
              {lang === 'ka' ? '🎓 კურსდამთავრებული' : '🎓 Graduate Success'}
            </span>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-black mt-4 mb-3">{blogTitle(post, lang)}</h1>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
          <p className="text-xs text-slate-500">
            {t.by} {post.author.name} · {new Date(post.createdAt).toLocaleDateString(lang === 'ka' ? 'ka-GE' : 'en-US')}
          </p>
          <SocialShareButtons title={blogTitle(post, lang)} lang={lang} variant="dark" />
        </div>

        {post.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resolveBlogImageUrl(post.imageUrl)} alt={blogTitle(post, lang)} className="w-full rounded-2xl mb-8 object-cover max-h-96" />
        )}

        <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">{blogContent(post, lang)}</div>
      </div>
    </div>
  );
}
