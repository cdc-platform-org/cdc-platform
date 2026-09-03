import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { GetServerSideProps } from 'next';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Download, FolderOpen, Sparkles, ChevronDown, ShoppingBag, Zap, Upload, Code2, ShieldCheck, Tag, ExternalLink } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import MarkdownContent from '../../src/components/shared/MarkdownContent';
import ProductGallery from '../../src/components/shared/ProductGallery';
import VideoEmbed from '../../src/components/shared/VideoEmbed';
import ProductReviewsSection from '../../src/components/store/ProductReviewsSection';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import StarRating from '../../src/components/community/StarRating';
import {
  getProduct,
  claimFreeProduct,
  getProductDownload,
  productTitle,
  productDescription,
  DigitalProduct,
  LICENSE_LABELS,
  HowItWorksIcon,
} from '../../src/services/productService';
import { checkoutProduct } from '../../src/services/paymentService';
import { checkoutProductStripe } from '../../src/services/stripePaymentService';
import { formatPrice } from '../../src/utils/coursePricing';
import { resolveLocale } from '@/src/utils/locale';

// Fixed id of the seeded "AI Business Assistant" trial listing (see
// Backend's 20260807010000_seed_ai_business_trial_product migration) — a
// web-based SaaS tool represented as a $0 marketplace product, not a real
// downloadable file (its fileUrl points at /dashboard/ai-tools, but that
// field is deliberately never sent to this public page — see
// DigitalProduct's own comment in productService.ts — so matching by id is
// the only safe discriminator here). Other Business Tools category products
// are real downloads and keep the generic steps below.
const AI_BUSINESS_TRIAL_PRODUCT_ID = 'a5f877bb-6875-448a-ac00-40f09d3e2ca3';

// Must cover every name in Backend's adminProducts.ts HOW_IT_WORKS_ICONS —
// that's the actual enforcement point (an admin can't save a name outside
// it), this is just the render-side lookup for whichever one they picked.
const HOW_IT_WORKS_ICON_MAP: Record<HowItWorksIcon, typeof Download> = {
  Download, FolderOpen, Sparkles, Zap, Upload, Code2, ShieldCheck, Tag,
};

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
  const isAiBusinessTrial = product?.id === AI_BUSINESS_TRIAL_PRODUCT_ID;

  useEffect(() => {
    if (typeof id !== 'string') return;
    // Resets stale flags from whatever the PREVIOUS id showed — without
    // this, client-navigating from a deleted/invalid product straight to a
    // valid one left notFound stuck true (and the old product's stale
    // title/price rendered until the new fetch resolved).
    setLoading(true);
    setNotFound(false);
    getProduct(id)
      .then(setProduct)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

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
    if (!isAuthenticated) {
      openAuthModal({ onSuccess: startCheckout });
      return;
    }
    startCheckout();
  };

  const handleClaim = () => {
    if (!product) return;
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
            <h1 className="blog-heading-safe text-2xl md:text-3xl font-black tracking-wide mb-3">{productTitle(product, contentLang)}</h1>
            {product.reviewCount > 0 && (
              <div className="flex items-center gap-2 mb-3">
                <StarRating value={product.averageRating ?? 0} size="sm" />
                <span className="text-sm font-bold">{product.averageRating?.toFixed(1)}</span>
                <span className="text-xs text-slate-400">({product.reviewCount})</span>
              </div>
            )}
            <MarkdownContent content={productDescription(product, contentLang)} className="mb-6 flex-1" />
            <p className="text-xs text-slate-500 dark:text-slate-400 -mt-4 mb-6">{LICENSE_LABELS[product.licenseType][contentLang === 'ka' ? 'descriptionKa' : 'descriptionEn']}</p>

            {actionError && (
              <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">{actionError}</div>
            )}

            {product.purchased ? (
              product.toolRoute ? (
                <Link
                  href={product.toolRoute}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-black text-sm px-6 py-3.5 rounded-xl no-underline hover:shadow-lg hover:shadow-emerald-500/30 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('launchTool')}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-cyan-600 text-white font-black text-sm px-6 py-3.5 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-60"
                >
                  <Download className="w-4 h-4" />
                  {submitting ? t('processing') : t('download')}
                </button>
              )
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

        {product.previewVideoUrl && (
          <div className="mb-10">
            <VideoEmbed url={product.previewVideoUrl} title={productTitle(product, contentLang)} />
          </div>
        )}

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
              {(product.howItWorksSteps && product.howItWorksSteps.length === 3
                ? product.howItWorksSteps.map((s, i) => ({
                    icon: HOW_IT_WORKS_ICON_MAP[s.icon],
                    step: String(i + 1),
                    title: contentLang === 'ka' ? s.titleKa : s.titleEn,
                    body: contentLang === 'ka' ? s.bodyKa : s.bodyEn,
                  }))
                : isAiBusinessTrial
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

        <ProductReviewsSection productId={product.id} />
      </div>

      <SiteFooter />
    </div>
  );
}

export default function StoreProductPage() {
  return <StoreProductContent />;
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['marketplace'])) },
});
