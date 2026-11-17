import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, ImagePlus, Plus, Save, Trash2 } from 'lucide-react';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { useAdminLang } from '../../../src/context/AdminLangContext';
import { getAdminSiteContent, updateSiteContent, uploadCmsImage } from '../../../src/services/siteContentService';
import { ABOUT_CATEGORIES, ABOUT_COPY, ABOUT_PATHS } from '../../../src/data/aboutHubCopy';
import { ABOUT_SEED, aboutAssetUrl, isAboutHubContent } from '../../../src/utils/aboutHubContent';
import type { AboutCollection, AboutCopy, AboutEntry, AboutHubContent, AboutSection } from '../../../src/types/aboutHub';
import { isImageTooLarge, IMAGE_SIZE_ERROR } from '../../../src/utils/imageUpload';

import { at } from '../../../src/i18n/admin';
const copy = {
  ka: { title: 'ჩვენ შესახებ — კონტენტის მართვა', intro: 'ამ რედაქტორში იმართება /about და მისი ქვე-გვერდები. ძველი გალერეისა და პროექტების ჩანაწერები დამოუკიდებლად ინახება.', save: 'შენახვა და გამოქვეყნება', saving: 'ინახება…', saved: 'ცვლილებები გამოქვეყნდა', dirty: 'გაქვთ შეუნახავი ცვლილებები', failed: 'შენახვა ვერ მოხერხდა. შეავსეთ ორივე ენის ველები და გადაამოწმეთ ბმულები და თარიღები.', loadFailed: 'არსებული კონტენტის ჩატვირთვა ვერ მოხერხდა. სცადეთ ხელახლა.', loading: 'იტვირთება…', preview: 'გვერდის ნახვა', name: 'სათაური / სახელი', description: 'აღწერა', image: 'ფოტოს ან ლოგოს ბმული', upload: 'ფოტოს ატვირთვა', uploading: 'ფოტო იტვირთება…', category: 'კატეგორია', start: 'დაწყების თარიღი', end: 'დასრულების თარიღი', partners: 'პარტნიორები', metric: 'შედეგის აღწერა', value: 'მაჩვენებელი', link: 'ვრცელი ინფორმაციის / დოკუმენტის ბმული', demo: 'საილუსტრაციო ჩანაწერი — რეალური შედეგი ჯერ არ არის დადასტურებული', add: 'ჩანაწერის დამატება', remove: 'წაშლა', starter: 'საილუსტრაციო ჩანაწერების დამატება', empty: 'ჩანაწერები არ არის. დაამატეთ ახალი ან გამოიყენეთ საწყისი ნიმუშები.', hero: 'მთავარი სათაური', introField: 'შესავალი', mission: 'მისია', vision: 'ხედვა', heroImage: 'მთავარი ფოტო', stats: 'შედეგების მაჩვენებლები', label: 'მაჩვენებლის აღწერა', team: 'გუნდის პროფილები', accreditations: 'აკრედიტაციები და დოკუმენტები', newContent: 'შენახული კონტენტი ჯერ არ არის. ნაჩვენებია რედაქტირებადი საწყისი ვერსია.', bilingual: 'ორივე ენის შევსება აუცილებელია. მხოლოდ გადამოწმებული ჩანაწერებიდან მოხსენით საილუსტრაციო მონიშვნა.', badUpload: 'ფოტოს ატვირთვა ვერ მოხერხდა.' },
  en: { get title() { return at("About Us — content management"); }, intro: 'This editor manages /about and its sub-pages. Legacy gallery and project records are kept separately.', save: 'Save and publish', saving: 'Saving…', saved: 'Changes published', dirty: 'You have unsaved changes', failed: 'Could not save. Complete both languages and check links and dates.', loadFailed: 'Could not load existing content. Please try again.', loading: 'Loading…', preview: 'View page', name: 'Title / name', get description() { return at("Description"); }, image: 'Photo or logo URL', upload: 'Upload image', uploading: 'Uploading image…', category: 'Category', start: 'Start date', end: 'End date', partners: 'Partners', metric: 'Outcome description', value: 'Value', link: 'Further information / document URL', demo: 'Illustrative entry — a real outcome has not been verified', add: 'Add entry', remove: 'Remove', starter: 'Add starter entries', empty: 'No entries. Add your own or use the starter examples.', hero: 'Main headline', introField: 'Introduction', mission: 'Mission', vision: 'Vision', heroImage: 'Hero image', stats: 'Impact metrics', get label() { return at("Metric label"); }, team: 'Team profiles', accreditations: 'Accreditations & documents', newContent: 'No saved content yet. Showing the editable starter version.', bilingual: 'Both languages are required. Remove the illustrative label only after verifying a record.', badUpload: 'Could not upload image.' },
};
const input = 'mt-1 w-full rounded-lg border border-cdc-border bg-cdc-bg px-3 py-2 text-sm text-cdc-ink focus:border-cdc-primary';
type EntryList = AboutCollection | 'team' | 'accreditations';
const getList = (content: AboutHubContent, key: EntryList) => key === 'team' || key === 'accreditations' ? content.overview[key] : content[key];
const withList = (content: AboutHubContent, key: EntryList, entries: AboutEntry[]): AboutHubContent => key === 'team' || key === 'accreditations' ? { ...content, overview: { ...content.overview, [key]: entries } } : { ...content, [key]: entries };
const emptyCopy = (): AboutCopy => ({ ka: '', en: '' });

function AboutEditor() {
  const { lang } = useAdminLang();
  const t = copy[lang];
  const publicCopy = ABOUT_COPY[lang];
  const [content, setContent] = useState<AboutHubContent>(ABOUT_SEED);
  const [tab, setTab] = useState<AboutSection>('overview');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [uploading, setUploading] = useState('');
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setLoadFailed(false);
    getAdminSiteContent<unknown>('about').then(row => {
      if (!active) return;
      if (row && !isAboutHubContent(row.content)) throw new Error('Unsupported content.');
      setContent(row ? row.content as AboutHubContent : ABOUT_SEED); setIsNew(!row); setDirty(false);
    }).catch(() => { if (active) setLoadFailed(true); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  const change = (update: (previous: AboutHubContent) => AboutHubContent) => { setContent(update); setDirty(true); setSaved(false); };
  const overview = (patch: Partial<AboutHubContent['overview']>) => change(previous => ({ ...previous, overview: { ...previous.overview, ...patch } }));
  const updateEntry = (key: EntryList, id: string, patch: Partial<AboutEntry>) => change(previous => withList(previous, key, getList(previous, key).map(entry => entry.id === id ? { ...entry, ...patch } : entry)));
  const bilingual = (label: string, value: AboutCopy, onChange: (value: AboutCopy) => void, multiline = false, optional = false) => <fieldset className="min-w-0"><legend className="text-sm font-semibold">{label}</legend><div className="grid gap-3 sm:grid-cols-2">{(['ka', 'en'] as const).map(language => <label key={language} className="min-w-0 text-xs text-cdc-muted">{language === 'ka' ? 'ქართული · KA' : at("English · EN")}{multiline ? <textarea required={!optional || !!value.ka.trim() || !!value.en.trim()} rows={3} value={value[language]} onChange={event => onChange({ ...value, [language]: event.target.value })} className={input} /> : <input required={!optional || !!value.ka.trim() || !!value.en.trim()} value={value[language]} onChange={event => onChange({ ...value, [language]: event.target.value })} className={input} />}</label>)}</div></fieldset>;
  const upload = async (event: ChangeEvent<HTMLInputElement>, id: string, apply: (url: string) => void) => {
    const file = event.target.files?.[0]; event.target.value = '';
    if (!file) return;
    if (isImageTooLarge(file)) { setError(IMAGE_SIZE_ERROR[lang]); return; }
    setUploading(id); setError('');
    try { apply(await uploadCmsImage(file)); } catch { setError(t.badUpload); } finally { setUploading(''); }
  };
  const imageField = (label: string, value: string, id: string, apply: (url: string) => void) => <div className="grid min-w-0 gap-3 sm:grid-cols-[1fr_auto]"><label className="text-sm font-semibold">{label}<input value={value} onChange={event => apply(event.target.value)} className={input} placeholder="/images/… / https://…" /></label><label className="flex cursor-pointer items-center gap-2 self-end rounded-lg border border-cdc-border px-4 py-2 text-sm font-semibold text-cdc-primary-ink"><ImagePlus size={17} />{uploading === id ? t.uploading : t.upload}<input type="file" accept="image/*" disabled={!!uploading} onChange={event => { void upload(event, id, apply); }} className="sr-only" /></label>{aboutAssetUrl(value) && <Image unoptimized width={320} height={180} src={aboutAssetUrl(value)} alt={label} className="max-h-36 max-w-full rounded-lg object-contain" />}</div>;
  const entryList = (key: EntryList) => {
    const entries = getList(content, key);
    const categories = key === 'team' ? ['team'] : key === 'accreditations' ? ['institutional'] : ABOUT_CATEGORIES[key];
    return <section className="space-y-5" aria-label={key === 'team' ? t.team : key === 'accreditations' ? t.accreditations : publicCopy.sections[key]}>
      <div className="flex flex-wrap gap-3"><button type="button" onClick={() => change(previous => withList(previous, key, [...getList(previous, key), { id: `${key}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: emptyCopy(), summary: emptyCopy(), category: categories[0], imageUrl: '', startDate: '', endDate: '', partners: emptyCopy(), metric: emptyCopy(), metricValue: '', url: '', isDemo: true }]))} className="inline-flex items-center gap-2 rounded-lg border border-cdc-border px-4 py-2 text-sm font-bold"><Plus size={16} />{t.add}</button>{entries.length === 0 && <button type="button" onClick={() => change(previous => withList(previous, key, getList(ABOUT_SEED, key)))} className="text-sm font-bold text-cdc-primary-ink">{t.starter}</button>}</div>
      {!entries.length && <p className="rounded-lg border border-dashed border-cdc-border p-6 text-sm text-cdc-muted">{t.empty}</p>}
      {entries.map((entry, index) => <article key={entry.id} data-about-editor-entry className="space-y-5 rounded-xl border border-cdc-border bg-cdc-surface p-5 sm:p-7">
        <div className="flex items-center justify-between gap-4"><span className="text-xs font-bold text-cdc-muted">{String(index + 1).padStart(2, '0')}</span><button type="button" disabled={uploading === entry.id} onClick={() => change(previous => withList(previous, key, getList(previous, key).filter(value => value.id !== entry.id)))} className="inline-flex items-center gap-2 text-xs font-bold text-red-600 dark:text-red-400"><Trash2 size={15} />{t.remove}</button></div>
        {bilingual(t.name, entry.title, title => updateEntry(key, entry.id, { title }))}
        {bilingual(t.description, entry.summary, summary => updateEntry(key, entry.id, { summary }), true)}
        <label className="block text-sm font-semibold">{t.category}<select value={entry.category} onChange={event => updateEntry(key, entry.id, { category: event.target.value })} className={input}>{categories.map(category => <option key={category} value={category}>{publicCopy.categories[category as keyof typeof publicCopy.categories]}</option>)}</select></label>
        {imageField(t.image, entry.imageUrl, entry.id, imageUrl => updateEntry(key, entry.id, { imageUrl }))}
        {key === 'projects' && <><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">{t.start}<input type="date" value={entry.startDate} onChange={event => updateEntry(key, entry.id, { startDate: event.target.value })} className={input} /></label><label className="text-sm font-semibold">{t.end}<input type="date" min={entry.startDate || undefined} value={entry.endDate} onChange={event => updateEntry(key, entry.id, { endDate: event.target.value })} className={input} /></label></div>{bilingual(t.partners, entry.partners, partners => updateEntry(key, entry.id, { partners }), false, true)}<label className="block text-sm font-semibold">{t.value}<input value={entry.metricValue} onChange={event => updateEntry(key, entry.id, { metricValue: event.target.value })} className={input} /></label></>}
        {(key === 'projects' || key === 'stories') && bilingual(t.metric, entry.metric, metric => updateEntry(key, entry.id, { metric }), false, true)}
        <label className="block text-sm font-semibold">{t.link}<input value={entry.url} onChange={event => updateEntry(key, entry.id, { url: event.target.value })} className={input} /></label>
        <label className="flex items-start gap-3 text-sm text-cdc-muted"><input type="checkbox" checked={entry.isDemo} onChange={event => updateEntry(key, entry.id, { isDemo: event.target.checked })} className="mt-1" />{t.demo}</label>
      </article>)}
    </section>;
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setError(''); setSaved(false);
    try { await updateSiteContent('about', content); setSaved(true); setDirty(false); setIsNew(false); } catch { setError(t.failed); } finally { setSaving(false); }
  };
  if (loading) return <p role="status">{t.loading}</p>;
  if (loadFailed) return <div role="alert"><p>{t.loadFailed}</p><button type="button" onClick={() => setReload(value => value + 1)} className="mt-4 font-bold text-cdc-primary-ink">{publicCopy.retry}</button></div>;
  return <div className="max-w-5xl text-cdc-ink"><header className="mb-6"><h1 className="text-2xl font-black">{t.title}</h1><p className="mt-3 text-sm text-cdc-muted">{t.intro}</p><p className="mt-2 text-xs text-cdc-muted">{t.bilingual}</p></header>
    <nav aria-label={t.title} className="mb-6 flex flex-wrap gap-2">{(Object.keys(ABOUT_PATHS) as AboutSection[]).map(section => <button type="button" key={section} aria-pressed={section === tab} onClick={() => setTab(section)} className={`rounded-lg border px-4 py-2 text-sm font-semibold ${tab === section ? 'border-cdc-primary bg-cdc-primary text-white' : 'border-cdc-border bg-cdc-surface text-cdc-ink'}`}>{publicCopy.sections[section]}</button>)}</nav>
    <form onSubmit={event => { void save(event); }}>
      <div className="sticky top-0 z-10 mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-cdc-border bg-cdc-surface p-4"><button type="submit" disabled={saving || !!uploading} className="learning-primary"><Save size={17} />{saving ? t.saving : t.save}</button><Link href={ABOUT_PATHS[tab]} target="_blank" className="inline-flex items-center gap-2 text-sm font-bold text-cdc-primary-ink no-underline">{t.preview}<ArrowUpRight size={16} /></Link><span role="status" className="text-xs text-cdc-muted">{saved ? t.saved : dirty ? t.dirty : isNew ? t.newContent : ''}</span></div>
      {error && <p role="alert" className="mb-5 rounded-lg border border-red-300 p-4 text-sm text-red-700 dark:text-red-300">{error}</p>}
      {tab === 'overview' ? <div className="space-y-7"><section className="space-y-6 rounded-xl border border-cdc-border bg-cdc-surface p-5 sm:p-7">{(['title', 'intro', 'mission', 'vision'] as const).map(key => <div key={key}>{bilingual(({ title: t.hero, intro: t.introField, mission: t.mission, vision: t.vision })[key], content.overview[key], value => overview({ [key]: value }), true)}</div>)}{imageField(t.heroImage, content.overview.heroImage, 'hero', heroImage => overview({ heroImage }))}</section>
        <section className="space-y-5"><h2 className="text-xl font-bold">{t.stats}</h2>{content.overview.stats.map((stat, index) => <div key={index} className="space-y-4 rounded-xl border border-cdc-border bg-cdc-surface p-5"><label className="block text-sm font-semibold">{t.value}<input required value={stat.value} onChange={event => { const value = event.target.value; change(previous => ({ ...previous, overview: { ...previous.overview, stats: previous.overview.stats.map((current, i) => i === index ? { ...current, value } : current) } })); }} className={input} /></label>{bilingual(t.label, stat.label, label => change(previous => ({ ...previous, overview: { ...previous.overview, stats: previous.overview.stats.map((current, i) => i === index ? { ...current, label } : current) } })))}<label className="flex gap-3 text-sm text-cdc-muted"><input type="checkbox" checked={stat.isDemo} onChange={event => { const isDemo = event.target.checked; change(previous => ({ ...previous, overview: { ...previous.overview, stats: previous.overview.stats.map((current, i) => i === index ? { ...current, isDemo } : current) } })); }} />{t.demo}</label></div>)}</section>
        <section><h2 className="mb-5 text-xl font-bold">{t.team}</h2>{entryList('team')}</section><section><h2 className="mb-5 text-xl font-bold">{t.accreditations}</h2>{entryList('accreditations')}</section>
      </div> : entryList(tab)}
    </form>
  </div>;
}
export default function AboutCmsPage() { return <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}><AdminLayout><AboutEditor /></AdminLayout></AdminGuard>; }
