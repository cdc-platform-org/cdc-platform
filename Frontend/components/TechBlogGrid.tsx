'use client';

const posts = [
  {
    id: 'post-1',
    title: 'Designing Premium Glassmorphism Experiences',
    category: 'UI / UX',
    excerpt: 'A deep dive into high-contrast panels, text hierarchy, and accessibility in dark mode dashboards.'
  },
  {
    id: 'post-2',
    title: 'Scaling B2B Course Delivery Pipelines',
    category: 'Operations',
    excerpt: 'How to align order workflows, enterprise pricing, and mentoring cohorts for zero-loss SaaS rollouts.'
  },
  {
    id: 'post-3',
    title: 'Realtime Progress Analytics for Learners',
    category: 'Data',
    excerpt: 'Best practices for capturing nested lesson completion, certification triggers, and mentor visibility.'
  }
];

export default function TechBlogGrid() {
  return (
    <div className="glass-panel rounded-[32px] border border-white/10 p-8 shadow-glass">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/80">Tech Blog</p>
          <h2 className="mt-3 text-3xl font-semibold text-white">Insights for enterprise learning builders</h2>
        </div>
        <button className="button-primary">Browse all articles</button>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {posts.map((post) => (
          <article key={post.id} className="rounded-[28px] border border-white/10 bg-slate-950/70 p-7 transition hover:-translate-y-1 hover:border-cyan-400/50">
            <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-300/80">{post.category}</p>
            <h3 className="mt-4 text-2xl font-semibold text-white">{post.title}</h3>
            <p className="mt-4 text-slate-300 leading-7">{post.excerpt}</p>
            <button className="mt-6 text-sm font-semibold text-cyan-300 transition hover:text-cyan-200">Read more →</button>
          </article>
        ))}
      </div>
    </div>
  );
}
