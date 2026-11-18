// The CDC-built AI tools shown in the Digital Store's "AI tools" section
// (pages/marketplace/index.tsx). They are NOT DigitalProduct rows (no file,
// no seller: they are live dashboard tools sold by monthly access), so they
// are a fixed list here. Text comes from each tool's own namespace or the
// defaults below, and the admin Tool Catalog CMS (pages/admin/tools.tsx)
// can override text, cover, status and the store "highlight" flag.
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'next-i18next';
import { BookOpen, Crown, Mic, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import { getSiteContent } from '../../services/siteContentService';
import { ToolCatalogContent, ToolCatalogEntry } from '../../types/siteContent';
import { findToolEntry, isHiddenAdminOnly, overrideText, overrideList } from '../../utils/toolCatalog';
import { highlightRank } from '../../data/productCategories';

const STORE_TOOLS = [
  { id: 'ai-agents', href: '/dashboard/ai-tools', icon: Sparkles, accent: 'from-violet-500 to-cyan-600' },
  { id: 'chatbot-builder', href: '/dashboard/tools/chatbot-builder', icon: Sparkles, accent: 'from-indigo-500 to-purple-600' },
  { id: 'coloring-pages', href: '/dashboard/tools/coloring-pages', icon: Sparkles, accent: 'from-emerald-500 to-cyan-600' },
  { id: 'design-studio', href: '/dashboard/tools/design-studio', icon: Sparkles, accent: 'from-sky-500 to-amber-500' },
  { id: 'english-tutor', href: '/dashboard/english-tutor', icon: BookOpen, accent: 'from-purple-500 to-cyan-600' },
  { id: 'educator-hub', href: '/dashboard/tools/educator-hub', icon: Crown, accent: 'from-amber-500 to-purple-600' },
  { id: 'media-studio', href: '/dashboard/tools/media-studio', icon: Mic, accent: 'from-cyan-500 to-purple-600' },
  { id: 'smart-reader', href: '/dashboard/tools/smart-reader', icon: BookOpen, accent: 'from-cyan-500 to-emerald-600' },
  // Self-service practice version, distinct from the Business-gated
  // candidate-screening system at /dashboard/ai-tools.
  { id: 'proctoring', href: '/dashboard/tools/proctored-exam', icon: ShieldCheck, accent: 'from-cyan-500 to-purple-600' },
  // Server-priced one-time purchase, linked into the dashboard wizard.
  { id: 'childrens-book', href: '/dashboard/tools/childrens-book', icon: BookOpen, accent: 'from-pink-500 to-purple-600' },
] as const;

type ToolId = (typeof STORE_TOOLS)[number]['id'];

export interface StoreTool {
  id: ToolId;
  href: string;
  icon: LucideIcon;
  accent: string;
  title: string;
  desc: string;
  badge: string;
  features: string[];
  imageUrl?: string;
  comingSoon: boolean;
  highlight?: string;
}

// CMS slug differs from the card id for the two enterprise cards.
const cmsSlug = (id: ToolId) => (id === 'chatbot-builder' || id === 'ai-agents' ? 'enterprise-ai' : id);

export function useStoreTools(lang: 'ka' | 'en', viewerIsAdmin: boolean): { tools: StoreTool[]; loaded: boolean } {
  const { t } = useTranslation('marketplace');
  const { t: tEdu } = useTranslation('educatorHub');
  const { t: tm } = useTranslation('mediaStudio');
  const { t: th } = useTranslation('home');
  const { t: tCB } = useTranslation('childrensBook');
  const [catalog, setCatalog] = useState<ToolCatalogContent | null>(null);

  useEffect(() => {
    getSiteContent<ToolCatalogContent>('tool-catalog')
      .then((row) => setCatalog(row?.content ?? {}))
      .catch(() => setCatalog({}));
  }, []);

  const tools = useMemo(() => {
    const ka = lang === 'ka';
    const defaults: Record<ToolId, { title: string; desc: string; badge: string; features?: string[] }> = {
      'ai-agents': { title: ka ? 'AI აგენტები' : 'AI Agents', desc: ka ? 'კონტენტი, ანალიზი და AI ასისტენტი' : 'Content, analysis and AI assistance', badge: 'AI' },
      'chatbot-builder': { title: ka ? 'AI ჩატბოტის კონსტრუქტორი' : 'AI Chatbot Builder', desc: ka ? 'შექმენი და მართე საკუთარი ჩატბოტი' : 'Build and manage your own chatbot', badge: 'AI' },
      'coloring-pages': { title: ka ? 'AI გასაფერადებელი გვერდები' : 'AI Coloring Pages', desc: ka ? 'შექმენი დასაბეჭდი გასაფერადებელი გვერდები' : 'Create printable coloring pages', badge: 'AI' },
      'design-studio': {
        title: ka ? 'Ps + Ai დიზაინის სტუდია (2-in-1)' : 'Ps + Ai Design Studio (2-in-1)',
        desc: ka ? 'Photoshop-ისა და Illustrator-ის სიმულაციური სამუშაო გარემო — ფენები, ფილტრები, ვექტორი და PNG/SVG ექსპორტი' : 'Photoshop & Illustrator simulation workspace — layers, filters, vectors & PNG/SVG export',
        badge: 'Ps + Ai',
      },
      'english-tutor': { title: th('imiakoCardTitle'), desc: th('imiakoFeature1'), badge: th('imiakoBadgeFreeTrial') },
      'educator-hub': { title: tEdu('pageTitle'), desc: tEdu('pageSubtitle'), badge: tEdu('vipBadge') },
      'media-studio': { title: tm('catalogTitle'), desc: tm('catalogDesc'), badge: tm('catalogTag') },
      'smart-reader': {
        title: ka ? 'AI ჭკვიანი წამკითხველი' : 'AI Smart Reader',
        desc: ka ? 'ივარჯიშე კითხვასა და გამოთქმაში AI-ის პერსონალური დახმარებით.' : 'Practice reading and pronunciation with interactive AI guidance.',
        badge: ka ? 'AI ხელსაწყო' : 'AI tool',
      },
      proctoring: { title: t('proctoringTitle'), desc: t('proctoringDesc'), badge: t('proctoringBadge') },
      'childrens-book': {
        title: ka ? 'პერსონალური საბავშვო წიგნი' : "Personalized Children's Book",
        desc: ka ? 'შექმენი უნიკალური ისტორია, სადაც შენი ბავშვი მთავარი გმირია.' : 'Create a unique story where your child is the main character.',
        badge: tCB('cardBadge'),
      },
    };

    const list: StoreTool[] = [];
    STORE_TOOLS.forEach((tool) => {
      const cms: ToolCatalogEntry | undefined = findToolEntry(catalog?.tools, cmsSlug(tool.id));
      if (cms?.status === 'DISABLED' || isHiddenAdminOnly(catalog?.tools, tool.id, viewerIsAdmin)) return;
      const d = defaults[tool.id];
      list.push({
        ...tool,
        title: overrideText(d.title, ka ? cms?.titleKa : cms?.titleEn),
        desc: overrideText(d.desc, ka ? cms?.descriptionKa : cms?.descriptionEn),
        badge: overrideText(d.badge, ka ? cms?.badgeKa : cms?.badgeEn),
        features: overrideList(d.features ?? [], ka ? cms?.featuresKa : cms?.featuresEn),
        imageUrl: cms?.imageUrl?.trim() || undefined,
        comingSoon: cms?.status === 'COMING_SOON',
        highlight: cms?.highlight || undefined,
      });
    });
    // Admin-flagged tools first; Array.prototype.sort is stable, so the
    // fixed order above is kept inside each rank. Coming-soon tools last.
    return list.sort((a, b) => Number(a.comingSoon) - Number(b.comingSoon) || highlightRank(a.highlight) - highlightRank(b.highlight));
  }, [catalog, lang, viewerIsAdmin, t, tEdu, tm, th, tCB]);

  return { tools, loaded: catalog !== null };
}
