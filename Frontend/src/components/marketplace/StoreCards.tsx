// Cards for the Digital Store (pages/marketplace/index.tsx): ToolCard for a
// CDC-built AI tool (useStoreTools.ts) and ProductCard for a DigitalProduct.
// Both show the admin "highlight" ribbon (src/data/productCategories.ts).
import Link from 'next/link';
import Image from 'next/image';
import { useTranslation } from 'next-i18next';
import { CheckCircle2, Star, Tag } from 'lucide-react';
import AiToolSubscriptionActions from '../tools/AiToolSubscriptionActions';
import { productTitle, productDescription, DigitalProduct } from '../../services/productService';
import { resolveBlogImageUrl } from '../../services/blogService';
import { formatPrice } from '../../utils/coursePricing';
import { onImageErrorFallback } from '../../utils/imageFallback';
import { HIGHLIGHT_LABELS, isProductHighlight, productCategoryLabel } from '../../data/productCategories';
import type { StoreTool } from './useStoreTools';

const cardClass =
  'group relative w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-900/60 shadow-md shadow-slate-200/40 dark:shadow-none overflow-hidden flex flex-col transition-all duration-300 hover:border-cyan-400/50 dark:hover:border-cyan-400/40 hover:shadow-lg hover:shadow-cyan-500/10';

export function HighlightRibbon({ value, lang }: { value?: string | null; lang: 'ka' | 'en' }) {
  if (!isProductHighlight(value)) return null;
  const h = HIGHLIGHT_LABELS[value];
  return (
    <span className={`absolute top-3 left-3 z-10 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-white px-2.5 py-1 rounded-full bg-gradient-to-r ${h.className} shadow-lg`}>
      {h.emoji} {lang === 'ka' ? h.ka : h.en}
    </span>
  );
}

export function ToolCard({ tool, lang }: { tool: StoreTool; lang: 'ka' | 'en' }) {
  const { t } = useTranslation('marketplace');
  const Icon = tool.icon;
  return (
    <div data-ai-tool={tool.id} className={`${cardClass} ${tool.comingSoon ? 'opacity-80' : ''}`}>
      <div className="relative w-full aspect-[2/1] overflow-hidden bg-slate-100 dark:bg-slate-800">
        {tool.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded CMS image on the API origin
          <img src={resolveBlogImageUrl(tool.imageUrl)} alt={tool.title} onError={onImageErrorFallback} loading="lazy" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-tr ${tool.accent} flex items-center justify-center`}>
            <Icon className="w-10 h-10 text-white/90" />
          </div>
        )}
        <HighlightRibbon value={tool.highlight} lang={lang} />
      </div>
      <div className="p-5 flex flex-col flex-1">
        <span className="self-start text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 mb-2">
          {tool.comingSoon ? t('comingSoonBadge') : tool.badge}
        </span>
        <h3 className="text-sm font-black tracking-wide mb-1.5">{tool.title}</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-3">{tool.desc}</p>
        {tool.features.length > 0 && (
          <ul className="mb-3 grid gap-1 text-xs text-slate-600 dark:text-slate-300">
            {tool.features.slice(0, 3).map((feature) => (
              <li key={feature} className="line-clamp-1">• {feature}</li>
            ))}
          </ul>
        )}
        <div className="mt-auto">{!tool.comingSoon && <AiToolSubscriptionActions toolKey={tool.id} href={tool.href} lang={lang} />}</div>
      </div>
    </div>
  );
}

export function ProductCard({ product, lang }: { product: DigitalProduct; lang: 'ka' | 'en' }) {
  const { t } = useTranslation('marketplace');
  return (
    <Link href={`/store/${product.id}`} className={`${cardClass} no-underline text-current`}>
      <div className="relative w-full aspect-video overflow-hidden bg-slate-900">
        <Image src={product.imageUrl} alt={productTitle(product, lang)} fill className="object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]" unoptimized onError={onImageErrorFallback} />
        <HighlightRibbon value={product.highlight} lang={lang} />
        {product.saleActive && (
          <span className="absolute top-3 right-3 z-10 text-xs font-black text-white px-2.5 py-1 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 shadow-lg shadow-rose-500/30">
            -{Math.round((1 - product.currentPrice / product.price) * 100)}%
          </span>
        )}
        {product.fileFormat && (
          <span className="absolute bottom-3 left-3 inline-flex items-center text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-full bg-black/60 text-white shadow">
            {product.fileFormat}
          </span>
        )}
        {product.purchased && (
          <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500 text-white shadow">
            <CheckCircle2 className="w-3 h-3" />
            {t('owned', 'შეძენილი')}
          </span>
        )}
      </div>
      <div className="p-5 flex flex-col flex-1">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400 line-clamp-1">{productCategoryLabel(product.category, lang, product.title)}</span>
          {product.salesCount > 0 && (
            <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
              <Tag className="w-3 h-3" />
              {t(product.salesCount === 1 ? 'salesCount' : 'salesCountPlural', { count: product.salesCount })}
            </span>
          )}
        </div>
        <h3 className="text-sm font-black tracking-wide mb-1.5 line-clamp-2 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">{productTitle(product, lang)}</h3>
        {product.reviewCount > 0 && (
          <div className="flex items-center gap-1 mb-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{product.averageRating?.toFixed(1)}</span>
            <span className="text-xs text-slate-400">({product.reviewCount})</span>
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2 mb-4 flex-1">{productDescription(product, lang)}</p>
        <div className="flex items-center justify-between">
          <span className="flex items-baseline gap-1.5">
            {product.saleActive && <s className="text-xs text-slate-500">{formatPrice(product.price)}</s>}
            <span className="text-base font-black">{product.currentPrice === 0 ? t('free') : formatPrice(product.currentPrice)}</span>
          </span>
          <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">{t('details')} →</span>
        </div>
      </div>
    </Link>
  );
}
