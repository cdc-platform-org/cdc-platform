import { useState, useEffect } from 'react';
import Head from 'next/head';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { Download, FolderOpen, Sparkles, ChevronDown, ShoppingBag } from 'lucide-react';
import SiteHeader from '../../src/components/layout/SiteHeader';
import SiteFooter from '../../src/components/layout/SiteFooter';
import BackButton from '../../src/components/common/BackButton';
import MarkdownContent from '../../src/components/shared/MarkdownContent';
import { useAuth } from '../../src/context/AuthContext';
import { useAuthModal } from '../../src/context/AuthModalContext';
import { getProduct, claimFreeProduct, getProductDownloadUrl, DigitalProduct } from '../../src/services/productService';
import { checkoutProduct } from '../../src/services/paymentService';
import { formatPrice } from '../../src/utils/coursePricing';

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
    step3Body: 'აკოპირეთ მზა AI ბრძანებები (Prompts) ChatGPT/Claude-ში ან გახსენით UI Kit ფაილი Figma-ში და დაიწყეთ მუშაობა!',
    downloadFailed: 'ჩამოტვირთვა ვერ მოხერხდა.',
    checkoutFailed: 'გადახდის დაწყება ვერ მოხერხდა.',
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
  },
};

function StoreProductContent() {
  const router = useRouter();
  const { id } = router.query;
  const lang = router.locale === 'en' ? 'en' : 'ka';
  const t = dict[lang];
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();

  const [product, setProduct] = useState<DigitalProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(true);

  useEffect(() => {
    if (typeof id !== 'string') return;
    getProduct(id)
      .then(setProduct)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleBuy = async () => {
    if (!product) return;
    if (!isAuthenticated) {
      openAuthModal();
      return;
    }
    setActionError(null);
    setSubmitting(true);
    try {
      const { redirectUrl } = await checkoutProduct(product.id);
      window.location.href = redirectUrl;
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? t.checkoutFailed);
      setSubmitting(false);
    }
  };

  const handleClaim = async () => {
    if (!product) return;
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-400">…</p>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <p className="text-sm text-slate-500 dark:text-slate-400">{t.loadFailed}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Head>
        <title>{`${product.title} | CDC Store`}</title>
      </Head>
      <SiteHeader />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 md:py-12 flex-1 w-full">
        <div className="mb-6">
          <BackButton fallbackHref="/store" className="dark:text-slate-400 dark:hover:text-slate-100" />
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
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
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
    </div>
  );
}

export default function StoreProductPage() {
  return <StoreProductContent />;
}
