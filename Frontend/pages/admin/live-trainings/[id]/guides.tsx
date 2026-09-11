import { FormEvent, useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AdminGuard from '@/src/components/admin/AdminGuard';
import AdminLayout from '@/src/components/admin/AdminLayout';
import TrainingDayContent, { guideSectionLabels } from '@/src/components/training-guides/TrainingDayContent';
import { AdminGuide, getAdminGuide, GuideSection, GuideSectionKind, GuideSettings, GuideSource, GuideVisibility, guideDayInput, importVibeCodingGuide, reorderGuideDays, saveGuideDay, saveGuideSettings, saveGuideSource, TrainingDay, TrainingDayInput } from '@/src/services/trainingGuideService';
import { IakoProfile, assignIakoProfile, listIakoProfiles } from '@/src/services/iakoAssistantService';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500';
const buttonClass = 'rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primaryClass = 'rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50';
const copy = {
  ka: { title: 'IAKO — ყოველდღიური გზამკვლევები', back: 'ლაივ ტრენინგების მართვა', intro: 'შექმენი სტრუქტურირებული სასწავლო დღეები და მართე მონაწილეებისთვის ხილული მასალა.', schedule: 'განრიგი და წვდომა', timezone: 'დროის სარტყელი', start: 'საწყისი თარიღი', current: 'მიმდინარე დღის არჩევა', automatic: 'ავტომატურად, განრიგით', paused: 'განრიგის შეჩერება', visibility: 'გზამკვლევის ხილვადობა', TODAY_ONLY: 'მხოლოდ დღეს', CURRENT_AND_PREVIOUS: 'დღეს და წინა დღეები', ALL_DAYS: 'ყველა დღე', saveSettings: 'პარამეტრების შენახვა', days: 'სასწავლო დღეები', create: 'დღის დამატება', import: 'Vibe Coding-ის 10 დღის იმპორტი', importHelp: 'ოფიციალური პროგრამის იმპორტი შესაძლებელია მხოლოდ ცარიელ გზამკვლევში.', day: 'დღე', published: 'გამოქვეყნებული', draft: 'მონახაზი', edit: 'რედაქტირება', moveUp: 'ზემოთ გადატანა', moveDown: 'ქვემოთ გადატანა', publish: 'გამოქვეყნება', unpublish: 'გამოქვეყნების გაუქმება', editor: 'დღის რედაქტორი', number: 'დღის ნომერი', dayTitle: 'დღის სათაური', date: 'თარიღი (არასავალდებულო)', summary: 'მოკლე შეჯამება', sourcePages: 'წყაროს გვერდები (მძიმით გამოყოფილი)', publishedLabel: 'გამოქვეყნდეს მონაწილეებისთვის', sections: 'გზამკვლევის სექციები', addSection: 'სექციის დამატება', sectionType: 'სექციის ტიპი', sectionTitle: 'სექციის სათაური', removeSection: 'სექციის წაშლა', addItem: 'პუნქტის დამატება', itemTitle: 'პუნქტის სათაური', itemBody: 'აღწერა / ინსტრუქცია', language: 'კოდის ენა', url: 'რესურსის ბმული', removeItem: 'პუნქტის წაშლა', saveDay: 'დღის შენახვა', preview: 'მონაწილის ხედვის ნახვა', closePreview: 'რედაქტორზე დაბრუნება', previewNote: 'გადახედვა — პირადი პროგრესი და ჩატი აქ არ ინახება.', cancel: 'გაუქმება', metrics: 'ჯგუფის პროგრესი', metricsHelp: 'ჯამური პროგრესი დღის ყველა პუნქტის მიხედვით. პირადი ჩატები აქ არ ჩანს.', completed: 'მონაწილემ დაასრულა', sources: 'ცოდნის ბაზა — წყაროები', sourcesHelp: 'საწყისი და საცნობარო მასალა. წყაროს ცვლილება დღის გზამკვლევს ავტომატურად არ ცვლის.', sourceTitle: 'წყაროს სათაური', sourceContent: 'წყაროს ტექსტი', newSource: 'წყაროს დამატება', saveSource: 'წყაროს შენახვა', loading: 'იტვირთება…', saved: 'ცვლილებები შენახულია.', failed: 'ცვლილება ვერ შესრულდა. შეამოწმეთ მონაცემები და სცადეთ თავიდან.', loadFailed: 'გზამკვლევების ჩატვირთვა ვერ მოხერხდა.', retry: 'ხელახლა ცდა', noDays: 'სასწავლო დღეები ჯერ არ არის.', noSources: 'წყარო ჯერ არ არის დამატებული.', noMetrics: 'გამოქვეყნებული დღეების პროგრესი აქ გამოჩნდება.', invalidTimezone: 'მიუთითეთ სწორი დროის სარტყელი, მაგალითად Asia/Tbilisi.', sourceHint: 'მიუთითეთ მხოლოდ ოფიციალურ წყაროში არსებული გვერდები.', saving: 'ინახება…' },
  en: { title: 'IAKO — Daily Guides', back: 'Manage live trainings', intro: 'Create structured training days and control the material available to participants.', schedule: 'Schedule and access', timezone: 'Time zone', start: 'Start date', current: 'Current day', automatic: 'Automatic, from schedule', paused: 'Pause schedule', visibility: 'Guide visibility', TODAY_ONLY: 'Today only', CURRENT_AND_PREVIOUS: 'Current and previous days', ALL_DAYS: 'All days', saveSettings: 'Save settings', days: 'Training days', create: 'Add day', import: 'Import 10-day Vibe Coding guide', importHelp: 'The official syllabus can be imported only into an empty guide.', day: 'Day', published: 'Published', draft: 'Draft', edit: 'Edit', moveUp: 'Move up', moveDown: 'Move down', publish: 'Publish', unpublish: 'Unpublish', editor: 'Day editor', number: 'Day number', dayTitle: 'Day title', date: 'Date (optional)', summary: 'Short summary', sourcePages: 'Source pages (comma-separated)', publishedLabel: 'Publish to participants', sections: 'Guide sections', addSection: 'Add section', sectionType: 'Section type', sectionTitle: 'Section title', removeSection: 'Remove section', addItem: 'Add item', itemTitle: 'Item title', itemBody: 'Description / instructions', language: 'Code language', url: 'Resource link', removeItem: 'Remove item', saveDay: 'Save day', preview: 'Preview student view', closePreview: 'Back to editor', previewNote: 'Preview — personal progress and chat are not saved here.', cancel: 'Cancel', metrics: 'Class progress', metricsHelp: 'Aggregate completion of all guide items per day. Private chats are not shown.', completed: 'participants completed', sources: 'Knowledge base — sources', sourcesHelp: 'Source and reference material. Editing a source does not automatically change the daily guide.', sourceTitle: 'Source title', sourceContent: 'Source text', newSource: 'Add source', saveSource: 'Save source', loading: 'Loading…', saved: 'Changes saved.', failed: 'Could not complete this change. Check the fields and try again.', loadFailed: 'Could not load training guides.', retry: 'Try again', noDays: 'No training days yet.', noSources: 'No sources have been added.', noMetrics: 'Published-day progress will appear here.', invalidTimezone: 'Enter a valid time zone, such as Asia/Tbilisi.', sourceHint: 'Only cite pages that exist in the official source.', saving: 'Saving…' },
};

const emptyDay = (dayNumber: number): TrainingDayInput => ({ dayNumber, title: '', summary: '', scheduledDate: null, published: false, sourcePages: [], sections: [] });

function AdminGuidesContent() {
  const router = useRouter();
  const trainingId = typeof router.query.id === 'string' ? router.query.id : '';
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const t = copy[lang];
  const [data, setData] = useState<AdminGuide | null>(null);
  const [settings, setSettings] = useState<GuideSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [draft, setDraft] = useState<TrainingDayInput | null>(null);
  const [sourcePagesText, setSourcePagesText] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [preview, setPreview] = useState(false);
  const [source, setSource] = useState<{ title: string; content: string } | null>(null);
  const [sourceId, setSourceId] = useState<string>();
  const [iakoProfiles, setIakoProfiles] = useState<IakoProfile[]>([]);
  const [iakoBusy, setIakoBusy] = useState(false);

  const load = useCallback(async () => {
    if (!trainingId) return;
    const [result, profiles] = await Promise.all([getAdminGuide(trainingId), listIakoProfiles()]);
    setData(result); setSettings(result.settings); setIakoProfiles(profiles);
  }, [trainingId]);
  useEffect(() => {
    setLoading(true);
    void load().catch(() => setError(t.loadFailed)).finally(() => setLoading(false));
  }, [load, t.loadFailed]);
  const assignedIakoProfile = iakoProfiles.find((profile) => profile.assignments?.some((a) => a.liveTrainingId === trainingId));
  const changeIakoAssignment = async (profileId: string) => {
    setIakoBusy(true); setError(''); setSaved(false);
    try { await assignIakoProfile({ liveTrainingId: trainingId }, profileId || null); await load(); setSaved(true); }
    catch { setError(t.failed); }
    finally { setIakoBusy(false); }
  };

  const mutate = async (action: () => Promise<void>, after?: () => void) => {
    setBusy(true); setError(''); setSaved(false);
    try { await action(); await load(); after?.(); setSaved(true); }
    catch { setError(t.failed); }
    finally { setBusy(false); }
  };
  const editDay = (day: TrainingDay) => { setDraft(guideDayInput(day)); setSourcePagesText(day.sourcePages.join(', ')); setEditingId(day.id); setPreview(false); setSaved(false); };
  const editSource = (entry?: GuideSource) => { setSource(entry ? { title: entry.title, content: entry.content } : { title: '', content: '' }); setSourceId(entry?.id); };
  const changeSection = (sectionId: string, update: Partial<GuideSection>) => setDraft((current) => current ? { ...current, sections: current.sections.map((section) => section.id === sectionId ? { ...section, ...update } : section) } : current);
  const moveDay = (index: number, direction: -1 | 1) => {
    if (!data) return;
    const ids = data.days.map((day) => day.id);
    [ids[index], ids[index + direction]] = [ids[index + direction], ids[index]];
    void mutate(() => reorderGuideDays(trainingId, ids), () => { setDraft(null); setEditingId(undefined); });
  };
  const submitSettings = (event: FormEvent) => {
    event.preventDefault();
    if (!settings) return;
    try { new Intl.DateTimeFormat('en', { timeZone: settings.timeZone }); }
    catch { setError(t.invalidTimezone); return; }
    void mutate(() => saveGuideSettings(trainingId, settings));
  };

  return <main className="max-w-6xl mx-auto p-4 sm:p-8 text-slate-900">
    <Head><title>{t.title} | CDC Admin</title></Head>
    <Link href="/admin/live-trainings" className="text-sm text-cyan-700">← {t.back}</Link>
    <h1 className="mt-5 text-2xl sm:text-3xl font-black">{t.title}</h1><p className="text-sm text-slate-500 mt-2 mb-7">{t.intro}</p>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 mb-5 text-sm text-red-700">{error}{!data && <button type="button" onClick={() => void mutate(load)} className="ml-3 underline">{t.retry}</button>}</div>}
    {saved && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 mb-5 text-sm text-emerald-700">{t.saved}</p>}
    {loading ? <p role="status">{t.loading}</p> : data && settings && <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-7" aria-label={t.schedule}>
        <h2 className="text-xl font-bold mb-5">{t.schedule}</h2>
        <form onSubmit={submitSettings}><fieldset disabled={busy}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <label className="text-sm font-medium">{t.timezone}<input required value={settings.timeZone} onChange={(event) => setSettings({ ...settings, timeZone: event.target.value })} placeholder="Asia/Tbilisi" className={`${inputClass} mt-2`} /></label>
            <label className="text-sm font-medium">{t.start}<input type="date" value={settings.startDate?.slice(0, 10) || ''} onChange={(event) => setSettings({ ...settings, startDate: event.target.value || null })} className={`${inputClass} mt-2`} /></label>
            <label className="text-sm font-medium">{t.current}<select value={settings.currentDayOverride ?? ''} onChange={(event) => setSettings({ ...settings, currentDayOverride: event.target.value ? Number(event.target.value) : null })} className={`${inputClass} mt-2`}><option value="">{t.automatic}</option>{data.days.map((day) => <option key={day.id} value={day.dayNumber}>{t.day} {day.dayNumber}: {day.title}</option>)}</select></label>
            <label className="text-sm font-medium">{t.visibility}<select value={settings.visibility} onChange={(event) => setSettings({ ...settings, visibility: event.target.value as GuideVisibility })} className={`${inputClass} mt-2`}>{(['TODAY_ONLY', 'CURRENT_AND_PREVIOUS', 'ALL_DAYS'] as const).map((option) => <option key={option} value={option}>{t[option]}</option>)}</select></label>
          </div>
          <div className="flex flex-wrap justify-between gap-4 mt-5"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.paused} onChange={(event) => setSettings({ ...settings, paused: event.target.checked })} className="h-4 w-4 accent-cyan-700" />{t.paused}</label><button type="submit" className={primaryClass}>{t.saveSettings}</button></div>
        </fieldset></form>
      </section>
      <section aria-label="IAKO Assistant" className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-7">
        <h2 className="text-xl font-bold mb-2">{lang === 'ka' ? 'IAKO ასისტენტი' : 'IAKO Assistant'}</h2>
        <p className="text-sm text-slate-500 mb-4">{lang === 'ka' ? 'აირჩიეთ ასისტენტის პროფილი ამ ტრენინგისთვის — მართავს მოცემულობის ცოდნის ბაზას, სქრინშოთებს და საკუთარ საუბრის ისტორიას.' : 'Choose the IAKO profile participants use for this training. Guide questions open the same mentor conversation.'}</p>
        <select aria-label="IAKO Assistant profile" disabled={iakoBusy || busy} value={assignedIakoProfile?.id ?? ''} onChange={(event) => void changeIakoAssignment(event.target.value)} className={`${inputClass} max-w-sm`}>
          <option value="">{lang === 'ka' ? '— ასისტენტის გარეშე —' : '— No assistant —'}</option>
          {iakoProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
        </select>
        <p className="text-xs text-slate-400 mt-3">
          <Link href="/admin/iako/profiles" className="underline">{lang === 'ka' ? 'პროფილების მართვა →' : 'Manage profiles →'}</Link>
        </p>
      </section>
      <section aria-label={t.days} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-7">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5"><h2 className="text-xl font-bold">{t.days}</h2><button type="button" disabled={busy} onClick={() => { setDraft(emptyDay(Math.max(0, ...data.days.map((day) => day.dayNumber)) + 1)); setSourcePagesText(''); setEditingId(undefined); setPreview(false); }} className={primaryClass}>{t.create}</button></div>
        {!data.days.length ? <div className="text-sm text-slate-500"><p>{t.noDays}</p><p className="mt-2">{t.importHelp}</p><button type="button" disabled={busy} onClick={() => void mutate(() => importVibeCodingGuide(trainingId))} className={`${buttonClass} mt-4`}>{t.import}</button></div> : <ol className="divide-y divide-slate-100">
          {data.days.map((day, index) => <li key={day.id} className="py-4 flex flex-wrap justify-between items-center gap-4">
            <div className="min-w-0"><p className="text-xs font-bold text-cyan-700">{t.day} {day.dayNumber} · {day.published ? t.published : t.draft}{day.scheduledDate ? ` · ${day.scheduledDate.slice(0, 10)}` : ''}</p><h3 className="font-semibold mt-1 break-words">{day.title}</h3></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={() => moveDay(index, -1)} disabled={busy || index === 0} aria-label={`${t.moveUp}: ${t.day} ${day.dayNumber}`} className={buttonClass}>↑</button><button type="button" onClick={() => moveDay(index, 1)} disabled={busy || index === data.days.length - 1} aria-label={`${t.moveDown}: ${t.day} ${day.dayNumber}`} className={buttonClass}>↓</button><button type="button" onClick={() => editDay(day)} disabled={busy} aria-label={`${t.edit}: ${t.day} ${day.dayNumber}`} className={buttonClass}>{t.edit}</button><button type="button" disabled={busy} onClick={() => void mutate(() => saveGuideDay(trainingId, { ...guideDayInput(day), published: !day.published }, day.id))} aria-label={`${day.published ? t.unpublish : t.publish}: ${t.day} ${day.dayNumber}`} className={buttonClass}>{day.published ? t.unpublish : t.publish}</button></div>
          </li>)}
        </ol>}
      </section>
      {draft && <section aria-label={t.editor} className="rounded-2xl border border-cyan-200 bg-cyan-50/30 p-5 sm:p-6 mb-7">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-5"><h2 className="text-xl font-bold">{t.editor}</h2><div className="flex gap-2"><button type="button" onClick={() => setPreview(!preview)} className={buttonClass}>{preview ? t.closePreview : t.preview}</button><button type="button" disabled={busy} onClick={() => setDraft(null)} className={buttonClass}>{t.cancel}</button></div></div>
        {preview ? <><p className="text-sm text-slate-500 mb-5">{t.previewNote}</p><h2 className="font-black text-2xl">{t.day} {draft.dayNumber}: {draft.title}</h2><p className="my-4 leading-7">{draft.summary}</p><TrainingDayContent day={draft} lang={lang} /></> : <form onSubmit={(event) => { event.preventDefault(); void mutate(() => saveGuideDay(trainingId, { ...draft, sourcePages: sourcePagesText.split(',').map((value) => Number(value.trim())).filter((value) => value > 0) }, editingId), () => setDraft(null)); }}><fieldset disabled={busy} className="space-y-5">
          <div className="grid sm:grid-cols-[100px_1fr_180px] gap-4"><label className="text-sm font-medium">{t.number}<input type="number" min={1} max={366} required value={draft.dayNumber} onChange={(event) => setDraft({ ...draft, dayNumber: Number(event.target.value) })} className={`${inputClass} mt-2`} /></label><label className="text-sm font-medium">{t.dayTitle}<input required maxLength={200} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className={`${inputClass} mt-2`} /></label><label className="text-sm font-medium">{t.date}<input type="date" value={draft.scheduledDate?.slice(0, 10) || ''} onChange={(event) => setDraft({ ...draft, scheduledDate: event.target.value || null })} className={`${inputClass} mt-2`} /></label></div>
          <label className="block text-sm font-medium">{t.summary}<textarea rows={3} maxLength={2000} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className={`${inputClass} mt-2`} /></label>
          <label className="block text-sm font-medium">{t.sourcePages}<input value={sourcePagesText} pattern="[0-9, ]*" onChange={(event) => setSourcePagesText(event.target.value)} className={`${inputClass} mt-2`} /><span className="block text-xs text-slate-500 font-normal mt-1">{t.sourceHint}</span></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published: event.target.checked })} className="h-4 w-4 accent-cyan-700" />{t.publishedLabel}</label>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cyan-100 pt-5"><h3 className="font-bold">{t.sections}</h3><button type="button" onClick={() => setDraft({ ...draft, sections: [...draft.sections, { id: crypto.randomUUID(), kind: 'topics', title: guideSectionLabels[lang].topics, items: [] }] })} className={buttonClass}>{t.addSection}</button></div>
          {draft.sections.map((section, sectionIndex) => <fieldset key={section.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4"><legend className="px-2 text-sm font-bold text-slate-500">{sectionIndex + 1}. {section.title}</legend>
            <div className="grid sm:grid-cols-[200px_1fr_auto] items-end gap-3"><label className="text-sm font-medium">{t.sectionType}<select value={section.kind} onChange={(event) => { const kind = event.target.value as GuideSectionKind; changeSection(section.id, { kind, title: guideSectionLabels[lang][kind] }); }} className={`${inputClass} mt-2`}>{(Object.keys(guideSectionLabels[lang]) as GuideSectionKind[]).map((kind) => <option key={kind} value={kind}>{guideSectionLabels[lang][kind]}</option>)}</select></label><label className="text-sm font-medium">{t.sectionTitle}<input required value={section.title} maxLength={200} onChange={(event) => changeSection(section.id, { title: event.target.value })} className={`${inputClass} mt-2`} /></label><button type="button" onClick={() => setDraft({ ...draft, sections: draft.sections.filter((entry) => entry.id !== section.id) })} className={buttonClass}>{t.removeSection}</button></div>
            {section.items.map((item, itemIndex) => <div key={item.id} className="rounded-xl bg-slate-50 p-4 space-y-3">
              <div className="flex justify-between items-center"><span className="text-xs text-slate-500">{sectionIndex + 1}.{itemIndex + 1}</span><button type="button" onClick={() => changeSection(section.id, { items: section.items.filter((entry) => entry.id !== item.id) })} className="text-xs text-red-600 underline">{t.removeItem}</button></div>
              <label className="block text-sm font-medium">{t.itemTitle}<input required maxLength={200} value={item.title} onChange={(event) => changeSection(section.id, { items: section.items.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry) })} className={`${inputClass} mt-2`} /></label>
              <label className="block text-sm font-medium">{t.itemBody}<textarea rows={section.kind === 'code' ? 6 : 3} maxLength={12000} value={item.body} onChange={(event) => changeSection(section.id, { items: section.items.map((entry) => entry.id === item.id ? { ...entry, body: event.target.value } : entry) })} className={`${inputClass} mt-2 ${section.kind === 'code' ? 'font-mono' : ''}`} /></label>
              <div className="grid sm:grid-cols-2 gap-3">{section.kind === 'code' && <label className="text-sm font-medium">{t.language}<input value={item.language ?? ''} maxLength={40} onChange={(event) => changeSection(section.id, { items: section.items.map((entry) => entry.id === item.id ? { ...entry, language: event.target.value } : entry) })} className={`${inputClass} mt-2`} /></label>}<label className="text-sm font-medium">{t.url}<input type="url" value={item.url ?? ''} maxLength={2000} onChange={(event) => changeSection(section.id, { items: section.items.map((entry) => entry.id === item.id ? { ...entry, url: event.target.value } : entry) })} placeholder="https://" className={`${inputClass} mt-2`} /></label></div>
            </div>)}
            <button type="button" onClick={() => changeSection(section.id, { items: [...section.items, { id: crypto.randomUUID(), title: '', body: '' }] })} className={buttonClass}>{t.addItem}</button>
          </fieldset>)}
          <button type="submit" className={primaryClass}>{busy ? t.saving : t.saveDay}</button>
        </fieldset></form>}
      </section>}
      <section aria-label={t.metrics} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-7"><h2 className="text-xl font-bold">{t.metrics}</h2><p className="text-sm text-slate-500 mt-2 mb-5">{t.metricsHelp}</p>{data.metrics.length ? <ul className="grid sm:grid-cols-2 gap-3">{data.metrics.map((metric) => <li key={metric.dayId} className="rounded-xl bg-slate-50 p-4"><p className="font-bold text-sm">{t.day} {metric.dayNumber}</p><p className="text-sm mt-2">{metric.completedParticipants} / {metric.totalParticipants} {t.completed}</p><progress aria-label={`${t.day} ${metric.dayNumber}`} value={metric.completedParticipants} max={Math.max(1, metric.totalParticipants)} className="w-full h-2 mt-3 accent-cyan-700" /></li>)}</ul> : <p className="text-sm text-slate-500">{t.noMetrics}</p>}</section>
      <section aria-label={t.sources} className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><div className="flex flex-wrap justify-between gap-4"><h2 className="text-xl font-bold">{t.sources}</h2><button type="button" disabled={busy} onClick={() => editSource()} className={buttonClass}>{t.newSource}</button></div><p className="text-sm text-slate-500 mt-2 mb-5">{t.sourcesHelp}</p>{data.sources.length ? <ul className="space-y-2">{data.sources.map((entry) => <li key={entry.id} className="flex justify-between gap-3 border-b border-slate-100 py-3"><span className="text-sm font-semibold">{entry.title}</span><button type="button" disabled={busy} onClick={() => editSource(entry)} className="text-sm text-cyan-700 underline" aria-label={`${t.edit}: ${entry.title}`}>{t.edit}</button></li>)}</ul> : <p className="text-sm text-slate-500">{t.noSources}</p>}
        {source && <form className="mt-5" onSubmit={(event) => { event.preventDefault(); void mutate(() => saveGuideSource(trainingId, source, sourceId), () => setSource(null)); }}><fieldset disabled={busy} className="space-y-4"><label className="block text-sm font-medium">{t.sourceTitle}<input required maxLength={200} value={source.title} onChange={(event) => setSource({ ...source, title: event.target.value })} className={`${inputClass} mt-2`} /></label><label className="block text-sm font-medium">{t.sourceContent}<textarea required rows={10} maxLength={50000} value={source.content} onChange={(event) => setSource({ ...source, content: event.target.value })} className={`${inputClass} mt-2`} /></label><div className="flex gap-3"><button type="submit" className={primaryClass}>{t.saveSource}</button><button type="button" onClick={() => setSource(null)} className={buttonClass}>{t.cancel}</button></div></fieldset></form>}
      </section>
    </>}
  </main>;
}

export default function AdminDailyGuidesPage() { return <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}><AdminLayout><AdminGuidesContent /></AdminLayout></AdminGuard>; }
