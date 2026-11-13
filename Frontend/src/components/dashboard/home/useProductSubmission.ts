/**
 * State + handlers for the "Sell products" tab of /dashboard: the
 * create/edit product form, asset and demo-video uploads, live price
 * validation and the seller's own submissions list.
 *
 * Lives in the page component (not inside ProductsTab) so the half-filled
 * form survives switching to another dashboard tab and back.
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { User } from '../../../types/auth';
import { getFeeSchedule, findRate } from '../../../services/commissionsService';
import {
  submitProduct,
  updateMyProduct,
  getMySubmissions,
  uploadMyProductFile,
  uploadMyProductVideo,
  DigitalProduct,
  ProductLicenseType,
  validateProductDiscount,
} from '../../../services/productService';
import { DashboardStrings } from './dashboardDict';
import { DashboardTab } from './dashboardShared';

// Mirrors Backend's products.ts validateSubmitterPrice exactly: only an
// admin-team member (user.adminRole set) may publish a 0 GEL product —
// a regular seller's price must clear the 2 GEL floor that covers the
// payment gateway's own per-transaction fee. Checked live as the seller
// types, not just on submit, so the button disables before they even try.
const MIN_SUBMITTER_PRICE_GEL = 2;

export function useProductSubmission({
  user,
  t,
  activeTab,
  canSubmitProduct,
}: {
  user: User | null | undefined;
  t: DashboardStrings;
  activeTab: DashboardTab;
  canSubmitProduct: boolean;
}) {
  const [mySubmissions, setMySubmissions] = useState<DigitalProduct[]>([]);
  const [showSubmitForm, setShowSubmitForm] = useState(false);
  const [submitTitle, setSubmitTitle] = useState('');
  const [submitDescription, setSubmitDescription] = useState('');
  const [submitPrice, setSubmitPrice] = useState('');
  const [submitCategory, setSubmitCategory] = useState('');
  const [submitImageUrl, setSubmitImageUrl] = useState('');
  const [submitPreviewImages, setSubmitPreviewImages] = useState<string[]>([]);
  const [submitFileUrl, setSubmitFileUrl] = useState('');
  const [submitVideoUrl, setSubmitVideoUrl] = useState('');
  const [submitVideoUploading, setSubmitVideoUploading] = useState(false);
  const [submitLicenseType, setSubmitLicenseType] = useState<ProductLicenseType>('PERSONAL_USE');
  const [submitDiscountedPrice, setSubmitDiscountedPrice] = useState('');
  const [submitSaleEndsAt, setSubmitSaleEndsAt] = useState('');
  const [submitFileUploading, setSubmitFileUploading] = useState(false);
  const [submitFileUploadError, setSubmitFileUploadError] = useState<string | null>(null);
  const [editingSubmissionId, setEditingSubmissionId] = useState<string | null>(null);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Fallback only (matches productSaleService.ts's own FALLBACK_PERCENTAGE
  // for DIGITAL_PRODUCT_VERIFIED) — used until GET /commissions resolves, so
  // the commission banner never shows a stale/wrong rate while loading.
  // NOTE: always looks up the VERIFIED rate, not the +5% Unverified Tier
  // Surcharge one — the dashboard's `user` doesn't carry
  // verificationLevel/verificationStatus/isVerified (only isVerifiedGraduate),
  // so it can't reproduce the backend's full isIdentityVerified() check.
  // An unverified uploader will see a lower estimate here than they're
  // actually charged at sale time; flagged, not fixed.
  const [digitalProductCommissionPct, setDigitalProductCommissionPct] = useState(20);

  useEffect(() => {
    getFeeSchedule()
      .then((schedule) => {
        const pct = findRate(schedule, 'DIGITAL_PRODUCT_VERIFIED');
        if (pct != null) setDigitalProductCommissionPct(pct);
      })
      .catch(() => {
        // Commission banner just keeps showing the fallback rate above.
      });
  }, []);

  useEffect(() => {
    if (activeTab === 'products' && canSubmitProduct) {
      getMySubmissions()
        .then(setMySubmissions)
        .catch(() => {});
    }
  }, [activeTab, canSubmitProduct]);

  const submitDiscountError = useMemo(() => {
    if (!submitDiscountedPrice) return null;
    return validateProductDiscount(Number(submitPrice) || 0, Number(submitDiscountedPrice) || 0);
  }, [submitPrice, submitDiscountedPrice]);

  const submitPriceError =
    submitPrice === '' || !!user?.adminRole
      ? null
      : Number(submitPrice) === 0
        ? 'Only CDC admins can publish a free (0 GEL) product. Set a price of at least 2 GEL, or ask an admin to publish it as a free lead-magnet listing.'
        : Number(submitPrice) < MIN_SUBMITTER_PRICE_GEL
          ? `Price must be at least ${MIN_SUBMITTER_PRICE_GEL} GEL to cover payment processing fees.`
          : null;

  const handleSubmitProduct = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    if (submitPriceError) return setSubmitError(submitPriceError);
    if (submitDiscountError) return setSubmitError(submitDiscountError);
    setSubmittingProduct(true);
    try {
      // Editing an existing NEEDS_REVISION/PENDING submission resubmits it
      // (server resets status back to PENDING) rather than creating a
      // second, duplicate product — see productService.ts's updateMyProduct.
      // fileUrl is never returned by GET /mine/submissions (DigitalProduct
      // has no fileUrl field client-side at all), so startEditSubmission
      // leaves submitFileUrl blank — only sent when the submitter actually
      // picks a replacement file; otherwise the existing file is left as-is.
      if (editingSubmissionId) {
        await updateMyProduct(editingSubmissionId, {
          title: submitTitle,
          description: submitDescription,
          price: Number(submitPrice) || 0,
          category: submitCategory,
          imageUrl: submitImageUrl,
          previewImages: submitPreviewImages,
          previewVideoUrl: submitVideoUrl || null,
          licenseType: submitLicenseType,
          discountedPrice: submitDiscountedPrice ? Number(submitDiscountedPrice) : null,
          saleEndsAt: submitSaleEndsAt || null,
          ...(submitFileUrl ? { fileUrl: submitFileUrl } : {}),
        });
      } else {
        await submitProduct({
          title: submitTitle,
          description: submitDescription,
          price: Number(submitPrice) || 0,
          category: submitCategory,
          imageUrl: submitImageUrl,
          previewImages: submitPreviewImages,
          previewVideoUrl: submitVideoUrl || null,
          fileUrl: submitFileUrl,
          licenseType: submitLicenseType,
          discountedPrice: submitDiscountedPrice ? Number(submitDiscountedPrice) : null,
          saleEndsAt: submitSaleEndsAt || null,
        });
      }
      setSubmitTitle('');
      setSubmitDescription('');
      setSubmitPrice('');
      setSubmitCategory('');
      setSubmitImageUrl('');
      setSubmitPreviewImages([]);
      setSubmitFileUrl('');
      setSubmitVideoUrl('');
      setSubmitLicenseType('PERSONAL_USE');
      setSubmitDiscountedPrice('');
      setSubmitSaleEndsAt('');
      setEditingSubmissionId(null);
      setShowSubmitForm(false);
      setMySubmissions(await getMySubmissions());
    } catch (err: any) {
      setSubmitError(err?.response?.data?.message ?? t.submitProductFailed);
    } finally {
      setSubmittingProduct(false);
    }
  };

  const startEditSubmission = (s: DigitalProduct) => {
    setEditingSubmissionId(s.id);
    setSubmitTitle(s.title);
    setSubmitDescription(s.description);
    setSubmitPrice(String(s.price / 100));
    setSubmitCategory(s.category);
    setSubmitImageUrl(s.imageUrl);
    setSubmitPreviewImages(s.previewImages);
    setSubmitVideoUrl(s.previewVideoUrl ?? '');
    setSubmitLicenseType(s.licenseType);
    setSubmitDiscountedPrice(s.discountedPrice != null ? String(s.discountedPrice / 100) : '');
    // <input type="datetime-local"> needs "YYYY-MM-DDTHH:mm", not a full ISO
    // string with seconds/ms/timezone — slice(0, 16) trims exactly that.
    setSubmitSaleEndsAt(s.saleEndsAt ? s.saleEndsAt.slice(0, 16) : '');
    setSubmitFileUrl(''); // fileUrl is never exposed to the client — re-upload if it needs to change, otherwise the existing file stays untouched (omitted from the payload).
    setSubmitError(null);
    setShowSubmitForm(true);
  };

  const cancelEdit = () => {
    setShowSubmitForm(false);
    setEditingSubmissionId(null);
  };

  const handleSubmitAssetFile = async (file: File) => {
    setSubmitFileUploadError(null);
    setSubmitFileUploading(true);
    try {
      setSubmitFileUrl(await uploadMyProductFile(file));
    } catch (err: any) {
      setSubmitFileUploadError(err?.response?.data?.message ?? t.fileUploadFailed);
    } finally {
      setSubmitFileUploading(false);
    }
  };

  const handleSubmitVideoFile = async (file: File) => {
    setSubmitVideoUploading(true);
    try {
      setSubmitVideoUrl(await uploadMyProductVideo(file));
    } catch {
      // Non-fatal — the demo video is optional, leave whatever was there.
    } finally {
      setSubmitVideoUploading(false);
    }
  };

  return {
    mySubmissions,
    showSubmitForm,
    setShowSubmitForm,
    submitTitle,
    setSubmitTitle,
    submitDescription,
    setSubmitDescription,
    submitPrice,
    setSubmitPrice,
    submitCategory,
    setSubmitCategory,
    submitImageUrl,
    setSubmitImageUrl,
    submitPreviewImages,
    setSubmitPreviewImages,
    submitFileUrl,
    submitVideoUrl,
    setSubmitVideoUrl,
    submitVideoUploading,
    submitLicenseType,
    setSubmitLicenseType,
    submitDiscountedPrice,
    setSubmitDiscountedPrice,
    submitSaleEndsAt,
    setSubmitSaleEndsAt,
    submitFileUploading,
    submitFileUploadError,
    editingSubmissionId,
    submittingProduct,
    submitError,
    submitDiscountError,
    submitPriceError,
    digitalProductCommissionPct,
    handleSubmitProduct,
    startEditSubmission,
    cancelEdit,
    handleSubmitAssetFile,
    handleSubmitVideoFile,
  };
}

export type ProductSubmission = ReturnType<typeof useProductSubmission>;
