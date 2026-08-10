import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Download, FolderOpen, Sparkles, ChevronDown, ShoppingBag, Building2, X } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import MarkdownContent from '../../src/components/shared/MarkdownContent';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { getProduct, claimFreeProduct, getProductDownloadUrl, DigitalProduct } from '../../src/services/productService';
import { checkoutProduct } from '../../src/services/paymentService';
import { formatPrice } from '../../src/utils/coursePricing';
import { MARKETPLACE_CATEGORIES } from '../../src/data/marketplaceCategories';

// Canonical Business Tools category (see marketplaceCategories.ts) — matched
// against either language's value since `category` is free text set at
// product-creation time and may have been saved in either locale. Looked up
// by value rather than array position so a future reorder of the taxonomy
// can't silently break this check.
const BUSINESS_TOOLS_CATEGORY = MARKETPLACE_CATEGORIES.find((c) => c.value.en === 'Business Tools');
function isBusinessToolsCategory(category: string): boolean {
  return !!BUSINESS_TOOLS_CATEGORY && (category === BUSINESS_TOOLS_CATEGORY.value.ka || category === BUSINESS_TOOLS_CATEGORY.value.en);
}

const dict = {
  ka: {
    free: 'უფასო',
    buy: 'ყიდვა (BOG გადახდა)',
    claim: 'უფასოდ მიღება',
    download: 'ჩამოტვირთვა',
    processing: 'მუშავდება…',
    owned: 'შენი ნაყიდი',
    loadFailed: 'პროდუქტი ვერ მოიძებნა.',
    howToUse: 'როგორ გამოვიყენოთ?',
    step1Title: 'ჩამოტვირთვა',
    step1Body: 'დააჭირეთ „ჩამოტვირთვა“ ღილაკს და შეინახეთ ფაილი თქვენს მოწყობილობაში.',
    step2Title: 'გახსნა & ამოარქივება',
    step2Body: 'გახსენით ჩამოტვირთული ფაილი (ორჯერ დაწკაპუნებით) და წაიკითხეთ თანდართული README ინსტრუქცია.',
    step3Title: 'გამოყენება',
    step3Body: 'დააკოპირეთ მზა AI ბრძანებები (Prompts) ChatGPT/Claude-ში ან გახსენით UI Kit ფაილი Figma-ში და დაიწყეთ მუშაობა!',
    downloadFailed: 'ჩამოტვირთვა ვერ მოხერხდა.',
    checkoutFailed: 'გადახდის დაწყება ვერ მოხერხდა.',
    businessGateTitle: 'ხელმისაწვდომია მხოლოდ ვერიფიცირებული ბიზნესებისთვის',
    businessGateBody: 'ეს ინსტრუმენტი ხელმისაწვდომია მხოლოდ ვერიფიცირებული ბიზნეს ანგარიშებისთვის.',
    businessGateCta: 'ბიზნესის ვერიფიკაცია',
    modalClose: 'დახურვა',
  },
  en: {
    free: 'Free',
    buy: 'Buy (BOG Payment)',
    claim: 'Get for Free',
    download: 'Download',
    processing: 'Processing…',
    owned: 'Owned',
    loadFailed: 'Product not found.',
    howToUse: 'How to Use',
    step1Title: 'Download',
    step1Body: 'Click "Download" and save the file (.ZIP / .PDF) to your device.',
    step2Title: 'Open & Unzip',
    step2Body: 'Open the downloaded file (double-click) and read the included README for instructions.',
    step3Title: 'Use It',
    step3Body: 'Copy the ready-made AI prompts into ChatGPT/Claude, or open the UI Kit file in Figma and start working!',
    downloadFailed: 'Download failed.',
    checkoutFailed: 'Could not start checkout.',
    businessGateTitle: 'Available for Verified Businesses Only',
    businessGateBody: 'This tool is available exclusively to verified Business accounts.',
    businessGateCta: 'Verify Your Business',
    modalClose: 'Close',
  },
};

function StoreProductContent() {
  const router = useRouter();
  const { id } = router.query;
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { user, isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [product, setProduct] = useState<DigitalProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);
  const [showBusinessGate, setShowBusinessGate] = useState(false);

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

  const handleBuy = async () => {
    if (!product) return;
    if (isBusinessTool && !canPurchaseBusinessTool) {
      setShowBusinessGate(true);
      return;
    }
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    setActionError(null);
    setSubmitting(true);
    try {
      const { redirectUrl } = await checkoutProduct(product.id, lang);
      window.location.href = redirectUrl;
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? t.checkoutFailed);
      setSubmitting(false);
    }
  };

  const handleClaim = async () => {
    if (!product) return;
    if (isBusinessTool && !canPurchaseBusinessTool) {
      setShowBusinessGate(true);
      return;
    }
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    setActionError(null);
    setSubmitting(true);
    try {
      await claimFreeProduct(product.id);
      setProduct({ ...product, purchased: true });
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? t.checkoutFailed);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async () => {
    if (!product) return;
    setActionError(null);
    setSubmitting(true);
    try {
      const fileUrl = await getProductDownloadUrl(product.id);
      window.open(fileUrl, '_blank', 'noopener,noreferrer');
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? t.downloadFailed);
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
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.loadFailed}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${product.title} | CDC Store`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-6">
          <BackButton fallbackHref="/marketplace" className="dark:text-slate-400 dark:hover:text-slate-100" />
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-10">
          <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
            <Image src={product.imageUrl} alt={product.title} fill className="object-cover" unoptimized />
          </div>
          <div className="flex flex-col">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 mb-2 w-fit">
              <ShoppingBag className="w-3 h-3" />
              {product.category}
            </span>
            <h1 className="text-2xl md:text-3xl font-black tracking-wide mb-3">{product.title}</h1>
            <MarkdownContent content={product.description} className="mb-6 flex-1" />

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
                {submitting ? t.processing : t.download}
              </button>
            ) : (
              <div className="space-y-3">
                <span className="text-2xl font-black block">{product.price === 0 ? t.free : formatPrice(product.price)}</span>
                <button
                  type="button"
                  onClick={product.price === 0 ? handleClaim : handleBuy}
                  disabled={submitting}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3.5 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-60"
                >
                  <Sparkles className="w-4 h-4" />
                  {submitting ? t.processing : product.price === 0 ? t.claim : t.buy}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* HOW TO USE — expandable premium card under the buy/download button */}
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 backdrop-blur-sm transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden">
          <button
            type="button"
            onClick={() => setGuideOpen((open) => !open)}
            className="w-full flex items-center justify-between px-6 py-4 bg-transparent border-none cursor-pointer text-left"
          >
            <span className="text-sm font-black tracking-wide">{t.howToUse}</span>
            <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${guideOpen ? 'rotate-180' : ''}`} />
          </button>
          {guideOpen && (
            <div className="px-6 pb-6 grid sm:grid-cols-3 gap-5">
              {[
                { icon: Download, step: '1', title: t.step1Title, body: t.step1Body },
                { icon: FolderOpen, step: '2', title: t.step2Title, body: t.step2Body },
                { icon: Sparkles, step: '3', title: t.step3Title, body: t.step3Body },
              ].map(({ icon: Icon, step, title, body }) => (
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

      <SiteFooter lang={lang === 'ka' ? 'GEO' : 'ENG'} />

      {showBusinessGate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4" onClick={() => setShowBusinessGate(false)}>
          <div
            className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowBusinessGate(false)}
              aria-label={t.modalClose}
              className="absolute top-4 right-4 p-2 cursor-pointer text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-white" />
            </div>

            <h3 className="text-base font-black tracking-wide mb-2">{t.businessGateTitle}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">{t.businessGateBody}</p>
            <Link
              href="/dashboard/client"
              onClick={() => setShowBusinessGate(false)}
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
            >
              {t.businessGateCta}
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
