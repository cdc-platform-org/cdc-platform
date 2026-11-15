import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { ArrowDown, ArrowRight, ArrowUpRight, Building2, CalendarDays, FileText, GraduationCap, ImageIcon, Layers3, Quote, Sparkles, Target, Users } from 'lucide-react';
import SiteHeader from '../layout/SiteHeader';
import SiteFooter from '../layout/SiteFooter';
import SEOHead from '../seo/SEOHead';
import Lightbox from '../shared/Lightbox';
import { getSiteContent } from '../../services/siteContentService';
import { onImageErrorFallback } from '../../utils/imageFallback';
import { ABOUT_CATEGORIES, ABOUT_COPY, ABOUT_PATHS } from '../../data/aboutHubCopy';
import { ABOUT_SEED, aboutAssetUrl, isAboutHubContent } from '../../utils/aboutHubContent';
import type { AboutCopy, AboutEntry, AboutHubContent, AboutSection } from '../../types/aboutHub';
import styles from './AboutHubPage.module.css';

const sections = Object.keys(ABOUT_PATHS) as AboutSection[];
const panel = 'rounded-xl border border-cdc-border bg-cdc-surface';
const safeLink = (url: string) => /^(https?:\/\/|\/(?!\/))/.test(url) && !url.includes('\\') ? url : '';

export default function AboutHubPage({ section = 'overview' }: { section?: AboutSection }) {
  const { locale } = useRouter();
  const lang = locale === 'ka' || !locale ? 'ka' : 'en';
  const t = ABOUT_COPY[lang];
  const [content, setContent] = useState<AboutHubContent>(ABOUT_SEED);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState('newest');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false);
    getSiteContent<unknown>('about').then(row => {
      if (!active) return;
      if (row && !isAboutHubContent(row.content)) throw new Error('Unsupported About content.');
      setContent(row ? row.content as AboutHubContent : ABOUT_SEED);
    }).catch(() => { if (active) setError(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => { setCategory('all'); setLightboxIndex(null); }, [section]);
  const text = (value: AboutCopy) => value[lang];
  const list = useMemo(() => section === 'overview' ? [] : content[section], [section, content]);
  const filtered = useMemo(() => list.filter(entry => category === 'all' || entry.category === category).sort((a, b) => {
    const dates = a.startDate.localeCompare(b.startDate);
    return sort === 'newest' ? -dates : dates;
  }), [list, category, sort]);
  const hasDemo = section === 'overview'
    ? content.overview.stats.some(stat => stat.isDemo) || [...content.overview.team, ...content.overview.accreditations].some(entry => entry.isDemo)
    : list.some(entry => entry.isDemo);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const categoryLabel = (value: string) => t.categories[value as keyof typeof t.categories] ?? value;
  const demoBadge = <span className="rounded bg-amber-100 px-2 py-1 text-[10px] font-bold text-amber-950 dark:bg-amber-950 dark:text-amber-200">{t.demo}</span>;
  const image = (entry: AboutEntry, className = '') => aboutAssetUrl(entry.imageUrl)
    ? <Image unoptimized src={aboutAssetUrl(entry.imageUrl)} alt={text(entry.title)} width={900} height={600} loading="lazy" onError={onImageErrorFallback} className={`h-full w-full transition-transform duration-500 group-hover:scale-[1.035] motion-reduce:transition-none ${className || 'object-cover'}`} />
    : <div className="flex h-full min-h-36 items-center justify-center bg-cdc-primary-soft text-cdc-primary-ink"><Layers3 className="h-10 w-10" aria-hidden="true" /></div>;
  const externalLink = (entry: AboutEntry, label: string) => safeLink(entry.url) && <a href={safeLink(entry.url)} target={entry.url.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-cdc-primary-ink no-underline hover:underline">{label}<ArrowUpRight size={16} aria-hidden="true" /></a>;
  // Explicit month labels keep SSR and browsers consistent across ICU versions.
  const date = (value: string) => {
    if (!value || !Number.isFinite(Date.parse(value))) return '';
    const parsed = new Date(value);
    const months = lang === 'ka' ? ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'] : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
  };

  return <div className={`learning-surface bg-cdc-bg text-cdc-ink min-h-screen -mx-4 sm:-mx-6 ${styles.hub}`} data-about-hub={section}>
    <SEOHead title={t.sections[section]} description={section === 'overview' ? text(content.overview.intro) : t.descriptions[section]} canonicalPath={ABOUT_PATHS[section]} />
    <SiteHeader />
    <main id="about-main" className="mx-auto max-w-7xl px-5 pb-20 pt-7 sm:px-8 lg:pt-10">
      <nav aria-label={t.about} className="mb-7 flex flex-wrap items-center gap-2 text-xs text-cdc-muted"><Link href="/" className="text-current no-underline hover:text-cdc-primary-ink">{t.home}</Link><span aria-hidden="true">/</span>{section !== 'overview' && <><Link href="/about" className="text-current no-underline">{t.about}</Link><span aria-hidden="true">/</span></>}<span aria-current="page">{t.sections[section]}</span></nav>
      <nav aria-label={t.about} className="mb-10 flex gap-6 overflow-x-auto border-b border-cdc-border pb-0.5 lg:gap-9">
        {sections.map(key => <Link key={key} href={ABOUT_PATHS[key]} aria-current={section === key ? 'page' : undefined} className={`shrink-0 border-b-2 pb-4 text-xs font-bold no-underline sm:text-sm ${section === key ? 'border-cdc-primary text-cdc-primary-ink' : 'border-transparent text-cdc-muted hover:text-cdc-ink'}`}>{t.sections[key]}</Link>)}
      </nav>
      {loading && <div role="status" className="mb-4 h-1 animate-pulse rounded bg-cdc-primary-soft motion-reduce:animate-none"><span className="sr-only">{t.loading}</span></div>}
      {error && <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-lg border border-cdc-border p-3 text-sm text-cdc-muted"><span>{t.error}</span><button type="button" onClick={() => setReload(value => value + 1)} className="font-bold text-cdc-primary-ink">{t.retry}</button></div>}
      {section === 'overview' ? <>
        <section className="grid items-center gap-9 pb-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-16">
          <div><p className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-cdc-primary-ink"><span className="h-2 w-2 rounded-full bg-cdc-primary" />{t.eyebrow}</p>
            <h1 className="whitespace-pre-line text-[2.3rem] font-black sm:text-5xl lg:text-[3.35rem]">{text(content.overview.title)}</h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-cdc-muted">{text(content.overview.intro)}</p>
            <a href="#mission" className="mt-7 inline-flex items-center gap-3 text-sm font-bold text-cdc-ink no-underline">{t.explore}<ArrowDown size={18} /></a>
          </div>
          <figure className="relative m-0 overflow-hidden rounded-xl bg-cdc-primary-soft"><Image unoptimized priority src={aboutAssetUrl(content.overview.heroImage) || '/images/heks-eper.jpg'} alt={t.eyebrow} width={1000} height={625} onError={onImageErrorFallback} className="aspect-[16/10] w-full object-cover" /><figcaption className="absolute bottom-5 left-5 rounded bg-cdc-surface/95 px-4 py-2 text-xs font-bold text-cdc-ink">CDC <span className="mx-2 text-cdc-muted">/</span> {lang === 'ka' ? 'დაარსდა 2023' : 'Est. 2023'}</figcaption></figure>
        </section>
        {hasDemo && <p className="mb-5 flex items-start gap-2 text-xs leading-relaxed text-cdc-muted"><Sparkles size={15} className="shrink-0 text-cdc-primary-ink" />{t.demoNotice}</p>}
        <section aria-label={t.impact} className="mb-16 grid gap-5 border-y border-cdc-border py-7 sm:grid-cols-3">
          {content.overview.stats.map((stat, index) => <div key={index} className="flex flex-col gap-2 sm:border-r sm:border-cdc-border sm:pr-5 last:border-0"><strong className="text-4xl font-black tabular-nums sm:text-5xl">{stat.value}</strong><span className="text-sm text-cdc-muted">{text(stat.label)}</span>{stat.isDemo && <span className="text-[10px] font-bold uppercase tracking-wide text-cdc-primary-ink">{t.demo}</span>}</div>)}
        </section>
        <section id="mission" className="mb-16 grid scroll-mt-28 gap-5 md:grid-cols-2">{[['mission', Target], ['vision', Sparkles]].map(([key, Icon]) => {
          const field = key as 'mission' | 'vision'; const FieldIcon = Icon as typeof Target;
          return <article key={field} className={`${panel} p-7 sm:p-9`}><FieldIcon className="mb-6 h-7 w-7 text-cdc-primary-ink" /><h2 className="text-2xl font-black">{t[field]}</h2><p className="mt-4 text-sm leading-relaxed text-cdc-muted">{text(content.overview[field])}</p></article>;
        })}</section>
        <section className="mb-16"><p className="mb-3 text-xs font-bold uppercase tracking-widest text-cdc-primary-ink">CDC / 01</p><h2 className="text-2xl font-black sm:text-3xl">{t.ecosystem}</h2><p className="mt-3 max-w-2xl text-sm text-cdc-muted">{t.ecosystemIntro}</p>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[GraduationCap, Layers3, Building2, Users].map((Icon, index) => <Link key={index} href={['/courses', '/marketplace', '/community', '/forum'][index]} className={`${panel} group p-6 text-cdc-ink no-underline transition hover:border-cdc-primary/40`}><Icon className="mb-6 h-6 w-6 text-cdc-primary-ink" /><h3 className="text-base font-bold">{t.pillars[index]}</h3><p className="mt-3 text-xs leading-relaxed text-cdc-muted">{t.pillarDescriptions[index]}</p><ArrowUpRight className="mt-5 h-4 w-4" /></Link>)}</div>
        </section>
        <section id="team" className="mb-16 scroll-mt-28"><h2 className="mb-7 text-2xl font-black sm:text-3xl">{t.team}</h2><div className="grid gap-5 sm:grid-cols-2">{content.overview.team.map(entry => <article key={entry.id} className={`${panel} flex flex-col items-start p-6`}><div className="mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-cdc-primary-soft text-cdc-primary-ink">{entry.imageUrl ? image(entry) : <Users size={25} />}</div>{entry.isDemo && demoBadge}<h3 className="mt-4 text-lg font-bold">{text(entry.title)}</h3><p className="mt-3 text-sm text-cdc-muted">{text(entry.summary)}</p>{externalLink(entry, t.details)}</article>)}</div>{content.overview.team.length === 0 && <p className="text-sm text-cdc-muted">{t.emptyHint}</p>}</section>
        <section className="mb-16"><h2 className="mb-7 text-2xl font-black sm:text-3xl">{t.accreditations}</h2>{content.overview.accreditations.map(entry => <article key={entry.id} className={`${panel} mb-4 flex items-start gap-4 p-6`}><FileText className="h-6 w-6 shrink-0 text-cdc-muted" /><div>{entry.isDemo && demoBadge}<h3 className="mt-3 font-bold">{text(entry.title)}</h3><p className="mt-2 text-sm text-cdc-muted">{text(entry.summary)}</p>{externalLink(entry, t.document)}</div></article>)}</section>
      </> : <>
        <header className="mb-10 max-w-3xl"><p className="mb-4 text-xs font-bold uppercase tracking-widest text-cdc-primary-ink">{t.eyebrow} / {t.sections[section]}</p><h1 className="text-4xl font-black sm:text-5xl lg:text-[3.35rem]">{t.titles[section]}</h1><p className="mt-5 max-w-2xl text-base leading-relaxed text-cdc-muted">{t.descriptions[section]}</p></header>
        {hasDemo && <p className="mb-6 border-l-2 border-cdc-primary pl-4 text-xs leading-relaxed text-cdc-muted">{t.demoNotice}</p>}
        <div className="mb-8 flex flex-col gap-4 border-y border-cdc-border py-4 md:flex-row md:items-center md:justify-between">
          <div role="group" aria-label={t.filter} className="flex gap-2 overflow-x-auto pb-1">{['all', ...ABOUT_CATEGORIES[section]].map(key => <button type="button" key={key} aria-pressed={category === key} onClick={() => { setCategory(key); setLightboxIndex(null); }} className={`shrink-0 rounded-full border px-4 py-2 text-xs font-semibold transition-colors ${category === key ? 'border-cdc-primary bg-cdc-primary text-white' : 'border-cdc-border bg-cdc-surface text-cdc-muted hover:text-cdc-ink'}`}>{categoryLabel(key)}</button>)}</div>
          <div className="flex shrink-0 items-center gap-4"><span aria-live="polite" className="text-xs text-cdc-muted">{filtered.length} {t.count}</span>{section === 'projects' && <label className="text-xs text-cdc-muted"><span className="sr-only">{t.sort}</span><select value={sort} onChange={event => setSort(event.target.value)} className="rounded-lg border border-cdc-border bg-cdc-surface p-2 text-cdc-ink"><option value="newest">{t.newest}</option><option value="oldest">{t.oldest}</option></select></label>}</div>
        </div>
        {filtered.length ? <div className={`grid gap-6 ${section === 'gallery' ? 'sm:grid-cols-2 lg:grid-cols-3' : section === 'partners' ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
          {filtered.map((entry, index) => <article key={entry.id} data-about-card className={`${panel} group flex min-w-0 flex-col overflow-hidden transition duration-200 hover:shadow-md motion-reduce:transition-none`}>
            {section === 'gallery' ? <button type="button" onClick={() => setLightboxIndex(index)} aria-label={`${t.lightbox}: ${text(entry.title)}`} className="relative aspect-[4/3] overflow-hidden text-left">{image(entry)}<span className="absolute bottom-3 right-3 rounded-full bg-white/95 p-2 text-slate-950"><ImageIcon size={18} /></span></button>
              : section === 'partners' ? <div className="flex h-36 items-center justify-center border-b border-cdc-border bg-cdc-primary-soft break-words px-6 text-center text-xl font-black tracking-tight text-cdc-primary-ink">{entry.imageUrl ? image(entry, 'object-contain p-5') : text(entry.title)}</div>
              : <div className="aspect-[16/10] overflow-hidden">{image(entry)}</div>}
            <div className="flex flex-1 flex-col p-5 sm:p-6"><div className="mb-4 flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wide text-cdc-primary-ink">{categoryLabel(entry.category)}</span>{entry.isDemo && demoBadge}</div>
              {section === 'stories' && <Quote size={23} className="mb-3 text-cdc-primary-ink" />}<h2 className="text-lg font-bold">{text(entry.title)}</h2><p className="mb-5 mt-3 text-sm leading-relaxed text-cdc-muted">{text(entry.summary)}</p>
              {(entry.startDate || entry.endDate) && <div className="mb-4 flex items-start gap-2 text-xs text-cdc-muted"><CalendarDays size={15} className="shrink-0" /><div><span className="sr-only">{t.timeline}: </span>{date(entry.startDate)}{entry.endDate && ` — ${date(entry.endDate)}`}</div></div>}
              {text(entry.partners) && <p className="mb-4 text-xs text-cdc-muted"><strong className="font-semibold text-cdc-ink">{t.collaborators}: </strong>{text(entry.partners)}</p>}
              {(entry.metricValue || text(entry.metric)) && <div className="mt-auto border-t border-cdc-border pt-4"><span className="sr-only">{t.impact}: </span>{entry.metricValue && <strong className="mr-2 text-3xl font-black text-cdc-ink">{entry.metricValue}</strong>}<span className="text-xs font-semibold text-cdc-primary-ink">{text(entry.metric)}</span></div>}{externalLink(entry, section === 'partners' ? t.visit : t.details)}
            </div>
          </article>)}
        </div> : <div className={`${panel} flex flex-col items-center px-6 py-16 text-center`}><Layers3 size={32} className="mb-5 text-cdc-muted" /><h2 className="text-lg font-bold">{t.empty}</h2><p className="mt-3 text-sm text-cdc-muted">{t.emptyHint}</p>{category !== 'all' && <button type="button" onClick={() => setCategory('all')} className="mt-6 text-sm font-bold text-cdc-primary-ink">{t.reset}</button>}</div>}
      </>}
      <section className="mt-16 flex flex-col gap-6 rounded-xl border border-cdc-border bg-cdc-primary-soft p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-2xl font-black">{t.connect}</h2><p className="mt-3 max-w-xl text-sm text-cdc-muted">{t.connectText}</p></div><Link href="/contact" className="learning-primary shrink-0 no-underline">{t.contact}<ArrowRight size={17} /></Link></section>
    </main>
    <Lightbox images={filtered.map(entry => ({ url: aboutAssetUrl(entry.imageUrl), alt: text(entry.title) }))} index={section === 'gallery' ? lightboxIndex : null} onClose={closeLightbox} onIndexChange={setLightboxIndex} labels={{ close: t.close, previous: t.previous, next: t.next, zoomIn: t.zoomIn, zoomOut: t.zoomOut }} />
    <SiteFooter />
  </div>;
}
