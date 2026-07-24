import { useState, useEffect, useCallback, useRef, ChangeEvent } from 'react';
import Head from 'next/head';
import AdminGuard from '../../../src/components/admin/AdminGuard';
import AdminLayout from '../../../src/components/admin/AdminLayout';
import { HomepageContent, HomepageStat, HomepageFaqItem } from '../../../src/types/siteContent';
import { getAdminSiteContent, updateSiteContent, uploadCmsImage } from '../../../src/services/siteContentService';
import { resolveBlogImageUrl } from '../../../src/services/blogService';

const emptyStat: HomepageStat = { valueKa: '', labelKa: '', valueEn: '', labelEn: '' };
const emptyFaq: HomepageFaqItem = { questionKa: '', answerKa: '', questionEn: '', answerEn: '' };

const inputClass = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function HomepageCmsDashboard() {
  const [content, setContent] = useState<HomepageContent>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingHeksImage, setUploadingHeksImage] = useState(false);
  const [heksUploadError, setHeksUploadError] = useState<string | null>(null);
  const heksFileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await getAdminSiteContent<HomepageContent>('homepage');
      setContent(row?.content ?? {});
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateSiteContent('homepage', content);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  const updateStat = (i: number, patch: Partial<HomepageStat>) => {
    const stats = [...(content.stats ?? [])];
    stats[i] = { ...stats[i], ...patch };
    setContent({ ...content, stats });
  };

  const updateFaq = (i: number, patch: Partial<HomepageFaqItem>) => {
    const faq = [...(content.faq ?? [])];
    faq[i] = { ...faq[i], ...patch };
    setContent({ ...content, faq });
  };

  const updateHeksCard = (patch: Partial<NonNullable<HomepageContent['heksCard']>>) => {
    setContent({ ...content, heksCard: { ...content.heksCard, ...patch } });
  };

  const handleHeksFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingHeksImage(true);
    setHeksUploadError(null);
    try {
      const url = await uploadCmsImage(file);
      updateHeksCard({ imageUrl: url });
    } catch {
      setHeksUploadError('სურათის ატვირთვა ვერ მოხერხდა.');
    } finally {
      setUploadingHeksImage(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-400">Loading…</p>;
  }

  return (
    <>
      <Head>
        <title>Homepage CMS | Admin</title>
      </Head>
      <div className="max-w-4xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Homepage CMS</h1>
            <p className="text-sm text-gray-500 mt-1">
              Leave a field blank to keep the site's default. Changes apply immediately once saved.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-xs font-medium text-emerald-600">Saved ✓</span>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>

        {/* Hero */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-sm text-gray-900 mb-4">Hero Section</h2>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Title (Georgian)</label>
              <input
                value={content.heroTitleKa ?? ''}
                onChange={(e) => setContent({ ...content, heroTitleKa: e.target.value })}
                className={inputClass}
                placeholder="(default) გახდი მოთხოვნადი ციფრული ეპოქის პროფესიონალი"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Title (English)</label>
              <input
                value={content.heroTitleEn ?? ''}
                onChange={(e) => setContent({ ...content, heroTitleEn: e.target.value })}
                className={inputClass}
                placeholder="(default) Become a High-Demand Digital-Era Professional"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Subtitle (Georgian)</label>
              <input
                value={content.heroSubtitleKa ?? ''}
                onChange={(e) => setContent({ ...content, heroSubtitleKa: e.target.value })}
                className={inputClass}
                placeholder="(default) ...და დასაქმდი ჩვენივე პლატფორმაზე!"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Subtitle (English)</label>
              <input
                value={content.heroSubtitleEn ?? ''}
                onChange={(e) => setContent({ ...content, heroSubtitleEn: e.target.value })}
                className={inputClass}
                placeholder="(default) ...and get hired directly on our platform!"
              />
            </div>
          </div>
        </div>

        {/* HEKS/EPER card image */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <h2 className="font-semibold text-sm text-gray-900 mb-1">HEKS/EPER Card Image</h2>
          <p className="text-xs text-gray-500 mb-4">
            Controls the photo on the "Ecosystem Achievements" section's large HEKS/EPER card. Leave blank to use the
            bundled default image.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Image URL</label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    value={content.heksCard?.imageUrl ?? ''}
                    onChange={(e) => updateHeksCard({ imageUrl: e.target.value })}
                    className={`${inputClass} flex-1`}
                    placeholder="https://... or /images/heks-eper.jpg"
                  />
                  <label className="shrink-0 inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50">
                    {uploadingHeksImage ? 'იტვირთება…' : '📁 Upload'}
                    <input
                      ref={heksFileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleHeksFileChange}
                      className="hidden"
                      disabled={uploadingHeksImage}
                    />
                  </label>
                </div>
                {heksUploadError && <p className="text-xs text-red-600 mt-1.5">{heksUploadError}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Focus / Crop Position</label>
                  <select
                    value={content.heksCard?.objectPosition ?? 'top'}
                    onChange={(e) => updateHeksCard({ objectPosition: e.target.value as 'top' | 'center' | 'bottom' })}
                    className={inputClass}
                  >
                    <option value="top">Top (faces near top)</option>
                    <option value="center">Center</option>
                    <option value="bottom">Bottom</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Container Height</label>
                  <select
                    value={content.heksCard?.heightPreset ?? 'normal'}
                    onChange={(e) => updateHeksCard({ heightPreset: e.target.value as 'normal' | 'tall' })}
                    className={inputClass}
                  >
                    <option value="normal">Normal</option>
                    <option value="tall">Tall (more of the photo visible)</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Preview</label>
              <div className={`rounded-lg overflow-hidden border border-gray-200 ${content.heksCard?.heightPreset === 'tall' ? 'h-56' : 'h-40'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={content.heksCard?.imageUrl ? resolveBlogImageUrl(content.heksCard.imageUrl) : '/images/heks-eper.jpg'}
                  alt="HEKS/EPER card preview"
                  className="w-full h-full object-cover"
                  style={{ objectPosition: content.heksCard?.objectPosition ?? 'top' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-gray-900">Achievement Stats</h2>
            <button
              type="button"
              onClick={() => setContent({ ...content, stats: [...(content.stats ?? []), emptyStat] })}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              + Add stat
            </button>
          </div>
          {(content.stats ?? []).length === 0 && <p className="text-xs text-gray-400 mb-2">Using default stats (200+ Graduates, 100% Practical Tasks).</p>}
          <div className="space-y-3">
            {(content.stats ?? []).map((stat, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-2 items-center">
                <input placeholder="Value KA" value={stat.valueKa} onChange={(e) => updateStat(i, { valueKa: e.target.value })} className={inputClass} />
                <input placeholder="Label KA" value={stat.labelKa} onChange={(e) => updateStat(i, { labelKa: e.target.value })} className={inputClass} />
                <input placeholder="Value EN" value={stat.valueEn} onChange={(e) => updateStat(i, { valueEn: e.target.value })} className={inputClass} />
                <input placeholder="Label EN" value={stat.labelEn} onChange={(e) => updateStat(i, { labelEn: e.target.value })} className={inputClass} />
                <button
                  type="button"
                  onClick={() => setContent({ ...content, stats: (content.stats ?? []).filter((_, idx) => idx !== i) })}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm text-gray-900">FAQ</h2>
            <button
              type="button"
              onClick={() => setContent({ ...content, faq: [...(content.faq ?? []), emptyFaq] })}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              + Add question
            </button>
          </div>
          {(content.faq ?? []).length === 0 && <p className="text-xs text-gray-400 mb-2">No FAQ items — the section is hidden on the homepage until you add one.</p>}
          <div className="space-y-4">
            {(content.faq ?? []).map((item, i) => (
              <div key={i} className="border border-gray-100 rounded-lg p-4">
                <div className="grid md:grid-cols-2 gap-2 mb-2">
                  <input placeholder="Question (KA)" value={item.questionKa} onChange={(e) => updateFaq(i, { questionKa: e.target.value })} className={inputClass} />
                  <input placeholder="Question (EN)" value={item.questionEn} onChange={(e) => updateFaq(i, { questionEn: e.target.value })} className={inputClass} />
                </div>
                <div className="grid md:grid-cols-2 gap-2 mb-2">
                  <textarea rows={2} placeholder="Answer (KA)" value={item.answerKa} onChange={(e) => updateFaq(i, { answerKa: e.target.value })} className={inputClass} />
                  <textarea rows={2} placeholder="Answer (EN)" value={item.answerEn} onChange={(e) => updateFaq(i, { answerEn: e.target.value })} className={inputClass} />
                </div>
                <button
                  type="button"
                  onClick={() => setContent({ ...content, faq: (content.faq ?? []).filter((_, idx) => idx !== i) })}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Remove question
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function HomepageCmsPage() {
  return (
    <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}>
      <AdminLayout>
        <HomepageCmsDashboard />
      </AdminLayout>
    </AdminGuard>
  );
}
