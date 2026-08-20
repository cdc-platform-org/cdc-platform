import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Download, FolderOpen, Sparkles, ChevronDown, ShoppingBag, Building2, X, Zap, Upload, Code2, ShieldCheck, Tag } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import MarkdownContent from '../../src/components/shared/MarkdownContent';
import ProductGallery from '../../src/components/shared/ProductGallery';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { getProduct, claimFreeProduct, getProductDownload, productTitle, productDescription, DigitalProduct, LICENSE_LABELS } from '../../src/services/productService';
import { checkoutProduct } from '../../src/services/paymentService';
import { checkoutProductStripe } from '../../src/services/stripePaymentService';
import { formatPrice } from '../../src/utils/coursePricing';
import { MARKETPLACE_CATEGORIES } from '../../src/data/marketplaceCategories';
import { resolveLocale } from '@/src/utils/locale';

// Canonical Business Tools category (see marketplaceCategories.ts) — matched
// against either language's value since `category` is free text set at
// product-creation time and may have been saved in either locale. Looked up
// by value rather than array position so a future reorder of the taxonomy
// can't silently break this check.
const BUSINESS_TOOLS_CATEGORY = MARKETPLACE_CATEGORIES.find((c) => c.value.en === 'Business Tools');
function isBusinessToolsCategory(category: string): boolean {
  return !!BUSINESS_TOOLS_CATEGORY && (category === BUSINESS_TOOLS_CATEGORY.value.ka || category === BUSINESS_TOOLS_CATEGORY.value.en);
}

// Fixed id of the seeded "AI Business Assistant" trial listing (see
// Backend's 20260807010000_seed_ai_business_trial_product migration) — a
// web-based SaaS tool represented as a $0 marketplace product, not a real
// downloadable file (its fileUrl points at /dashboard/ai-tools, but that
// field is deliberately never sent to this public page — see
// DigitalProduct's own comment in productService.ts — so matching by id is
// the only safe discriminator here). Other Business Tools category products
// are real downloads and keep the generic steps below.
const AI_BUSINESS_TRIAL_PRODUCT_ID = 'a5f877bb-6875-448a-ac00-40f09d3e2ca3';

function StoreProductContent() {
  const { t } = useTranslation('marketplace');
  const router = useRouter();
  const { id } = router.query;
  const lang = resolveLocale(router.locale);
  // Products only store ka/en text (title/titleEn etc.) — collapse for content lookups.
  const contentLang = lang === 'ka' ? 'ka' : 'en';
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [product, setProduct] = useState<DigitalProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  const [showBusinessGate, setShowBusinessGate] = useState(false);
  const isAiBusinessTrial = product?.id === AI_BUSINESS_TRIAL_PRODUCT_ID;

  useEffect(() => {
    if (typeof id !== 'string') return;
    getProduct(id)
      .then(setProduct)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  // Business Tools purchases are restricted to verified Business accounts —
  // checked ahead of the normal auth prompt so a guest/individual/unverified
  // user sees the "verified businesses only" explainer instead of a plain
  // login modal that would otherwise let them log in only to hit the same
  // wall immediately after.
  const isBusinessTool = !!product && isBusinessToolsCategory(product.category);
  // SuperAdmin bypasses the verification requirement (testing/support
  // access) — same convention as the Enterprise AI Tools gate on /tools
  // and the homepage (see pages/tools.tsx's canUseAiAssistant).
  const canPurchaseBusinessTool =
    isAuthenticated && (user?.role === 'SuperAdmin' || (user?.role === 'Client' && !!user.isVerified));

  // Pure actions — no auth check inside, unlike the gated handleBuy/
  // handleClaim below that call these. Passed directly as openAuthModal's
  // onSuccess so a guest who logs in mid-purchase resumes straight into
  // checkout instead of landing back on the page with nothing continued —
  // same "sign in, then resume" pattern as courses/[id]/index.tsx's
  // startCheckout/handleEnroll. A function checking `isAuthenticated` itself
  // would still see the stale pre-login value from the closure that was
  // captured when openAuthModal was first called, so the check has to live
  // only in the outer gate, never in the part onSuccess invokes.
  const startCheckout = async () => {
    if (!product) return;
    setActionError(null);
    setSubmitting(true);
    try {
      // Georgian users pay via BOG (GEL); everyone else via Stripe (USD/EUR).
      const result = lang === 'ka' ? await checkoutProduct(product.id, 'ka') : await checkoutProductStripe(product.id, 'usd');
      if (result.purchased) {
        // Admin test-mode bypass fired server-side — already owned, no
        // gateway redirect to follow. Reload so the page's own
        // already-purchased state (download button, etc.) picks it up.
        window.location.reload();
        return;
      }
      window.location.href = result.redirectUrl!;
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? t('checkoutFailed'));
      setSubmitting(false);
    }
  };

  const startClaim = async () => {
    if (!product) return;
    setActionError(null);
    setSubmitting(true);
    try {
      await claimFreeProduct(product.id);
      setProduct({ ...product, purchased: true });
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? t('checkoutFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleBuy = () => {
    if (!product) return;
    if (isBusinessTool && !canPurchaseBusinessTool) {
      setShowBusinessGate(true);
      return;
    }
    if (!isAuthenticated) {
      openAuthModal({ onSuccess: startCheckout });
      return;
    }
    startCheckout();
  };

  const handleClaim = () => {
    if (!product) return;
    if (isBusinessTool && !canPurchaseBusinessTool) {
      setShowBusinessGate(true);
      return;
    }
    if (!isAuthenticated) {
      openAuthModal({ onSuccess: startClaim });
      return;
    }
    startClaim();
  };

  const handleDownload = async () => {
    if (!product) return;
    setActionError(null);
    setSubmitting(true);
    try {
      const { fileUrl } = await getProductDownload(product.id);
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? t('downloadFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="text-sm text-slate-400">…</p>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">{t('productNotFound')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${productTitle(product, contentLang)} | CDC Store`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-6">
          <BackButton fallbackHref="/marketplace" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div>
            <ProductGallery images={[product.imageUrl, ...product.previewImages]} alt={productTitle(product, contentLang)} />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 w-fit">
                <ShoppingBag className="w-3 h-3" />
                {product.category}
              </span>
              {product.fileFormat && (
                <span className="inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                  {product.fileFormat}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-3 h-3" />
                {LICENSE_LABELS[product.licenseType][contentLang]}
              </span>
              {product.saleActive && (
                <span className="inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg shadow-rose-500/30">
                  -{Math.round((1 - product.currentPrice / product.price) * 100)}%
                </span>
              )}
              {product.salesCount > 0 && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                  <Tag className="w-3 h-3" />
                  {t(product.salesCount === 1 ? 'salesCount' : 'salesCountPlural', { count: product.salesCount })}
                </span>
              )}
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-wide mb-3">{productTitle(product, contentLang)}</h1>
            <MarkdownContent content={productDescription(product, contentLang)} className="mb-6 flex-1" />
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-4 mb-6">{LICENSE_LABELS[product.licenseType][contentLang === 'ka' ? 'descriptionKa' : 'descriptionEn']}</p>

            {actionError && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">{actionError}</div>
            )}

            {product.purchased ? (
              <button
                type="button"
                onClick={handleDownload}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-black text-sm px-6 py-3.5 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-60"
              >
                <Download className="w-4 h-4" />
                {submitting ? t('processing') : t('download')}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  {product.saleActive && <s className="text-base text-slate-500">{formatPrice(product.price)}</s>}
                  <span className="text-2xl font-black block">{product.currentPrice === 0 ? t('free') : formatPrice(product.currentPrice)}</span>
                </div>
                <button
                  type="button"
                  onClick={product.price === 0 ? handleClaim : handleBuy}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3.5 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4" />
                  {submitting ? t('processing') : product.price === 0 ? t('claim') : t('buy')}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* HOW TO USE — expandable premium card under the buy/download button */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-md shadow-md shadow-slate-200/40 dark:shadow-none transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setGuideOpen((open) => !open)}
            className="w-full flex items-center justify-between px-6 py-4 bg-transparent border-none cursor-pointer text-left"
          >
            <span className="text-sm font-black tracking-wide">{t('howToUse')}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
          </button>
          {guideOpen && (
            <div className="px-6 pb-6 grid sm:grid-cols-3 gap-5">
              {(isAiBusinessTrial
                ? [
                    { icon: Zap, step: '1', title: t('aiStep1Title'), body: t('aiStep1Body') },
                    { icon: Upload, step: '2', title: t('aiStep2Title'), body: t('aiStep2Body') },
                    { icon: Code2, step: '3', title: t('aiStep3Title'), body: t('aiStep3Body') },
                  ]
                : [
                    { icon: Download, step: '1', title: t('step1Title'), body: t('step1Body') },
                    { icon: FolderOpen, step: '2', title: t('step2Title'), body: t('step2Body') },
                    { icon: Sparkles, step: '3', title: t('step3Title'), body: t('step3Body') },
                  ]
              ).map(({ icon: Icon, step, title, body }) => (
                <div key={step} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-xs font-black text-slate-400">STEP {step}</span>
                  </div>
                  <h3 className="text-xs font-black tracking-wide mb-1.5">{title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <SiteFooter />

      {showBusinessGate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setShowBusinessGate(false)}>
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowBusinessGate(false)}
              aria-label={t('modalClose')}
              className="absolute top-4 right-4 p-2 cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-white" />
            </div>

            <h3 className="text-base font-black tracking-wide mb-2">{t('businessGateTitle')}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t('businessGateBody')}</p>
            <Link
              href="/dashboard/client"
              onClick={() => setShowBusinessGate(false)}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
            >
              {t('businessGateCta')}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StoreProductPage() {
  return <StoreProductContent />;
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['marketplace'])) },
});
