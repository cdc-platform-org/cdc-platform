/**
 * "Sell products" tab of /dashboard — the seller workspace: create/edit
 * product form and the list of the seller's own submissions with their
 * moderation status. Purely presentational; all state comes from
 * useProductSubmission (owned by the page).
 *
 * Products the user *bought* are shown in MyPurchasesPanel, not here.
 */
import { Crown } from 'lucide-react';
import RichTextEditor from '../../shared/RichTextEditor';
import FileDropzone from '../../shared/FileDropzone';
import ImageGalleryUploader from '../../shared/ImageGalleryUploader';
import VideoTutorialLink from '../../shared/VideoTutorialLink';
import { assetFilenameFromUrl } from '../../../utils/assetFilename';
import { SupportedLocale } from '../../../utils/locale';
import { DIGITAL_PRODUCT_CATEGORIES } from '../../../data/digitalProductCategories';
import { uploadMyProductImage, ProductLicenseType, LICENSE_LABELS } from '../../../services/productService';
import { DashboardStrings } from './dashboardDict';
import { CARD_CLASS, PRODUCT_ASSET_ACCEPT } from './dashboardShared';
import { ProductSubmission } from './useProductSubmission';

interface ProductsTabProps {
  t: DashboardStrings;
  lang: SupportedLocale;
  canSubmitProduct: boolean;
  submission: ProductSubmission;
  onOpenAiMarketingAssistant: () => void;
  onOpenLaunchKit: (target: { productId: string; title: string }) => void;
  onShowPurchases: () => void;
}

export default function ProductsTab({
  t,
  lang,
  canSubmitProduct,
  submission: s,
  onOpenAiMarketingAssistant,
  onOpenLaunchKit,
  onShowPurchases,
}: ProductsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <h2 className="text-lg font-extrabold tracking-wide">{t.productsTitle}</h2>
        {canSubmitProduct && (
          <button
            type="button"
            onClick={() => s.setShowSubmitForm((open) => !open)}
            className="text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-cyan-600 text-white border-none cursor-pointer"
          >
            {t.addProduct}
          </button>
        )}
      </div>

      {s.showSubmitForm && (
        <form onSubmit={s.handleSubmitProduct} className={`${CARD_CLASS} p-6 space-y-3`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="text-sm font-bold">{s.editingSubmissionId ? t.editSubmissionTitle : t.submitProductTitle}</h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenAiMarketingAssistant}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white border-none cursor-pointer shadow-md shadow-purple-500/30 hover:shadow-purple-500/50 transition-shadow"
              >
                <Crown className="w-3.5 h-3.5" />
                {lang === 'ka' ? 'AI მარკეტინგული ასისტენტი' : 'AI Marketing Assistant'}
              </button>
              <VideoTutorialLink lang={lang} />
            </div>
          </div>
          {s.submitError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2.5 text-xs text-red-600 dark:text-red-300">
              {s.submitError}
            </div>
          )}
          <input
            required
            placeholder={t.formTitle}
            value={s.submitTitle}
            onChange={(e) => s.setSubmitTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
          />
          <RichTextEditor required rows={3} placeholder={t.formDescription} value={s.submitDescription} onChange={s.setSubmitDescription} />
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                placeholder={t.formPrice}
                value={s.submitPrice}
                onChange={(e) => s.setSubmitPrice(e.target.value)}
                className={`w-full rounded-lg border bg-white dark:bg-slate-800 px-3 py-2 text-sm ${s.submitPriceError ? 'border-red-400' : 'border-slate-300 dark:border-slate-700'}`}
              />
              {s.submitPriceError && <p className="text-xs text-red-500 mt-1">{s.submitPriceError}</p>}
            </div>
            <select
              required
              value={s.submitCategory}
              onChange={(e) => s.setSubmitCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            >
              <option value="" disabled>
                {t.formCategory}
              </option>
              {/* Preserves an existing product's category during edit even if it
                  predates this curated list, instead of silently swapping it on save. */}
              {s.submitCategory && !DIGITAL_PRODUCT_CATEGORIES.some((c) => c.value === s.submitCategory) && (
                <option value={s.submitCategory}>{s.submitCategory}</option>
              )}
              {DIGITAL_PRODUCT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.emoji} {lang === 'ka' ? c.labelKa : c.labelEn}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg border border-cyan-400/30 bg-cyan-50/60 dark:bg-cyan-500/10 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
            <p>{t.commissionBannerText.replace('{{rate}}', String(s.digitalProductCommissionPct))}</p>
            <p className="font-bold text-cyan-700 dark:text-cyan-400 mt-0.5">
              {t.commissionBannerNet.replace(
                '{{amount}}',
                (Number(s.submitPrice || 0) * (1 - s.digitalProductCommissionPct / 100)).toFixed(2)
              )}
            </p>
          </div>
          <ImageGalleryUploader
            coverUrl={s.submitImageUrl}
            onCoverChange={s.setSubmitImageUrl}
            previewImages={s.submitPreviewImages}
            onPreviewImagesChange={s.setSubmitPreviewImages}
            uploadImage={uploadMyProductImage}
            lang={lang}
            labels={{
              coverLabel: t.formCoverImage,
              coverHint: t.formCoverHint,
              coverSizeHint: t.formCoverSizeHint,
              galleryLabel: t.formGalleryLabel,
              gallerySizeHint: t.formGallerySizeHint,
              addMore: t.formGalleryAdd,
              uploading: t.formUploading,
              remove: t.formRemove,
              uploadFailed: t.imageUploadFailed,
            }}
          />
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{t.formAssetLabel}</label>
            <FileDropzone
              accept={PRODUCT_ASSET_ACCEPT}
              uploading={s.submitFileUploading}
              selectedFileName={assetFilenameFromUrl(s.submitFileUrl)}
              onFile={s.handleSubmitAssetFile}
              label={t.formAssetLabel}
              hint={s.editingSubmissionId ? t.formAssetHintEditing : t.formAssetHint}
              uploadingLabel={t.formUploading}
            />
            {s.submitFileUploadError && <p className="text-xs text-red-500 mt-1">{s.submitFileUploadError}</p>}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
              {lang === 'ka' ? 'დემო ვიდეო (არასავალდებულო)' : 'Demo Video (optional)'}
            </label>
            <input
              value={s.submitVideoUrl}
              onChange={(e) => s.setSubmitVideoUrl(e.target.value)}
              placeholder={lang === 'ka' ? 'YouTube/Vimeo ბმული, ან ატვირთეთ ფაილი ქვემოთ' : 'YouTube/Vimeo link, or upload a file below'}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm mb-2"
            />
            <FileDropzone
              accept=".mp4,.mov"
              uploading={s.submitVideoUploading}
              selectedFileName={s.submitVideoUrl ? assetFilenameFromUrl(s.submitVideoUrl) : null}
              onFile={s.handleSubmitVideoFile}
              label={lang === 'ka' ? 'ვიდეოს ატვირთვა' : 'Upload video'}
              hint={lang === 'ka' ? 'MP4 ან MOV, მაქს. 50MB' : 'MP4 or MOV, up to 50MB'}
              uploadingLabel={t.formUploading}
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">{lang === 'ka' ? 'ლიცენზია' : 'License'}</label>
            <select
              value={s.submitLicenseType}
              onChange={(e) => s.setSubmitLicenseType(e.target.value as ProductLicenseType)}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm"
            >
              {(Object.keys(LICENSE_LABELS) as ProductLicenseType[]).map((key) => (
                <option key={key} value={key}>{LICENSE_LABELS[key][lang === 'ka' ? 'ka' : 'en']}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                {lang === 'ka' ? 'ფასდაკლებული ფასი (GEL)' : 'Discounted Price (GEL)'}
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={s.submitDiscountedPrice}
                onChange={(e) => s.setSubmitDiscountedPrice(e.target.value)}
                placeholder={lang === 'ka' ? 'ცარიელი — ფასდაკლების გარეშე' : 'Leave blank for no sale'}
                className={`w-full rounded-xl border bg-white dark:bg-slate-900 px-3 py-2 text-sm ${s.submitDiscountError ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5">
                {lang === 'ka' ? 'ფასდაკლება მთავრდება' : 'Sale Ends At'}
              </label>
              <input
                type="datetime-local"
                value={s.submitSaleEndsAt}
                onChange={(e) => s.setSubmitSaleEndsAt(e.target.value)}
                disabled={!s.submitDiscountedPrice}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm disabled:opacity-50"
              />
            </div>
          </div>
          {s.submitDiscountError && <p className="text-xs text-red-500">{s.submitDiscountError}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={
                s.submittingProduct ||
                !s.submitImageUrl ||
                (!s.editingSubmissionId && !s.submitFileUrl) ||
                s.submitFileUploading ||
                !!s.submitDiscountError ||
                !!s.submitPriceError
              }
              className="text-xs font-bold px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-cyan-600 text-white disabled:opacity-60"
            >
              {s.submittingProduct ? t.formSubmitting : s.editingSubmissionId ? t.formResubmit : t.formSubmit}
            </button>
            <button
              type="button"
              onClick={s.cancelEdit}
              className="text-xs font-bold px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
            >
              {t.formCancel}
            </button>
          </div>
        </form>
      )}

      {s.mySubmissions.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">{t.mySubmissionsTitle}</h3>
          {s.mySubmissions.map((sub) => (
            <div
              key={sub.id}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 flex items-center justify-between gap-3 flex-wrap"
            >
              <div>
                <p className="text-sm font-bold text-slate-900 dark:text-white">{sub.title}</p>
                {(sub.status === 'REJECTED' || sub.status === 'NEEDS_REVISION') && sub.rejectionReason && (
                  <p className={`text-xs mt-0.5 ${sub.status === 'NEEDS_REVISION' ? 'text-orange-600' : 'text-red-500'}`}>
                    {t.rejectionReasonLabel}: {sub.rejectionReason}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {(sub.status === 'PENDING' || sub.status === 'NEEDS_REVISION') && (
                  <button
                    type="button"
                    onClick={() => s.startEditSubmission(sub)}
                    className="text-[11px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline bg-transparent border-none cursor-pointer"
                  >
                    {t.editAndResubmit}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onOpenLaunchKit({ productId: sub.id, title: sub.title })}
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline bg-transparent border-none cursor-pointer"
                >
                  Launch Kit
                </button>
                <span
                  className={`text-[10px] font-bold uppercase px-2 py-1 rounded border whitespace-nowrap ${
                    sub.status === 'APPROVED'
                      ? 'text-emerald-600 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30'
                      : sub.status === 'REJECTED'
                      ? 'text-red-600 border-red-300 bg-red-50 dark:bg-red-950/30'
                      : sub.status === 'NEEDS_REVISION'
                      ? 'text-orange-600 border-orange-300 bg-orange-50 dark:bg-orange-950/30'
                      : 'text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/30'
                  }`}
                >
                  {sub.status === 'APPROVED'
                    ? t.statusApproved
                    : sub.status === 'REJECTED'
                    ? t.statusRejected
                    : sub.status === 'NEEDS_REVISION'
                    ? t.statusNeedsRevision
                    : t.statusPending}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {lang === 'ka' ? 'შენ მიერ ნაყიდი პროდუქტები ახლა „ჩემი შენაძენების“ განყოფილებაშია.' : 'Products you bought are now under "My purchases".'}{' '}
        <button type="button" onClick={onShowPurchases} className="font-bold text-cyan-600 dark:text-cyan-400 bg-transparent border-none cursor-pointer p-0">
          {lang === 'ka' ? 'ნახვა →' : 'Open →'}
        </button>
      </p>
    </div>
  );
}
