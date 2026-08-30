import { GetServerSideProps } from 'next';
import { getBlogPosts } from '@/src/services/blogService';
import { getCourses } from '@/src/services/courseService';
import { getSuccessStories } from '@/src/services/successStoryService';
import { getStudioCases } from '@/src/services/studioCaseService';
import { DEFAULT_LOCALE, SITE_LOCALES, localizedUrl } from '@/src/utils/seo';

// Hand-curated, not auto-crawled from pages/ — every entry here has been
// verified to be a real, public, non-<ProtectedRoute>/<AdminGuard> page
// (see public/robots.txt's own comment on how that was verified). Adding a
// new public page means adding it here too; that's a deliberate tradeoff
// over silently indexing something gated by accident.
const STATIC_ROUTES = [
  '/',
  '/about',
  '/about/ia-tavdishvili',
  '/tools',
  '/contact',
  '/blog',
  '/gallery',
  '/agency',
  '/mentors',
  '/community',
  '/marketplace',
  '/store',
  '/tutorials',
  '/success-stories',
  '/cases',
  '/trainers',
  '/live-trainings',
  '/forum',
  '/search',
  '/terms',
  '/privacy',
  '/refund-policy',
  '/courses',
  '/gigs',
  '/vacancies',
  '/auth/login',
  '/auth/register',
];

interface SitemapUrl {
  path: string;
  changefreq: string;
  priority: string;
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderUrlEntry({ path, changefreq, priority }: SitemapUrl): string {
  const alternates = [
    ...SITE_LOCALES.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${xmlEscape(localizedUrl(l, path))}" />`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEscape(localizedUrl(DEFAULT_LOCALE, path))}" />`,
  ].join('\n');

  return `  <url>
    <loc>${xmlEscape(localizedUrl(DEFAULT_LOCALE, path))}</loc>
${alternates}
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// Each fetch is independently wrapped so a single slow/unavailable backend
// endpoint degrades that section to "skipped" instead of 500ing the whole
// sitemap — the static routes above (the bulk of real SEO value) must
// always render regardless of API health.
async function safeFetch<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const [posts, courses, stories, cases] = await Promise.all([
    safeFetch(() => getBlogPosts()),
    safeFetch(() => getCourses()),
    safeFetch(() => getSuccessStories()),
    safeFetch(() => getStudioCases()),
  ]);

  const urls: SitemapUrl[] = [
    ...STATIC_ROUTES.map((path) => ({ path, changefreq: path === '/' ? 'daily' : 'weekly', priority: path === '/' ? '1.0' : '0.7' })),
    ...posts.map((p) => ({ path: `/blog/${p.slug}`, changefreq: 'monthly', priority: '0.6' })),
    ...courses.map((c) => ({ path: `/courses/${c.id}`, changefreq: 'weekly', priority: '0.8' })),
    ...stories.map((s) => ({ path: `/success-stories/${s.slug}`, changefreq: 'monthly', priority: '0.5' })),
    ...cases.map((c) => ({ path: `/cases/${c.slug}`, changefreq: 'monthly', priority: '0.5' })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.map(renderUrlEntry).join('\n')}
</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.write(xml);
  res.end();

  return { props: {} };
};

// Body never renders — getServerSideProps ends the response directly above.
export default function Sitemap() {
  return null;
}
