/**
 * Homepage digital tools showcase promoting /tools and the AI assistant.
 * 2026-11 redesign: white cards and solid brand CTAs (cdc-* tokens).
 */
import { BarChart3, BookOpen, Bot, Code2, Gift, Globe, GraduationCap, Lock, MessageSquareText, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';
import Link from 'next/link';
import type { TFunction } from 'i18next';

interface ToolsShowcaseSectionProps {
  // Kept for the existing call site; styling is token-based now.
  darkMode?: boolean;
  t: TFunction<"home", undefined>;
  canUseAiAssistant: boolean;
  handleAiCtaClick: () => void;
}

export default function ToolsShowcaseSection({ t, canUseAiAssistant, handleAiCtaClick }: ToolsShowcaseSectionProps) {
  return (
    <>
      {/* 🛠️ DIGITAL TOOLS SHOWCASE — promotes /tools; the AI Assistant is the
          only currently purchasable/available product (subscription-style
          free trial, not a one-off sale), the other two are genuinely
          "coming soon" there too — mirrored here rather than inventing
          prices/buy buttons for products that don't have them yet. */}
      <section className="py-8 sm:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-16">
            <span className="cdc-eyebrow mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              CDC AI
            </span>
            <h2 style={{ lineHeight: 1.25 }} className="text-2xl sm:text-3xl lg:text-[2.5rem] font-extrabold tracking-tight text-cdc-ink mb-4">{t('toolsHeading')}</h2>
            <p className="text-sm sm:text-base text-cdc-muted leading-relaxed">
              {t('toolsSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="vip-card lg:col-span-3 p-6 sm:p-8 flex flex-col lg:flex-row gap-8 items-start">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-cdc-primary flex items-center justify-center">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-xl font-extrabold text-cdc-ink">{t('aiAssistantTitle')}</h3>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {t('availableNow')}
                  </span>
                </div>
                <p className="text-sm text-cdc-muted leading-relaxed mb-5">
                  {t('aiAssistantBody')}
                </p>
                <ul className="grid sm:grid-cols-2 gap-3 mb-6">
                  {[
                    { icon: MessageSquareText, key: 'aiFeature1' as const },
                    { icon: BookOpen, key: 'aiFeature2' as const },
                    { icon: Code2, key: 'aiFeature3' as const },
                    { icon: BarChart3, key: 'aiFeature4' as const },
                  ].map(({ icon: Icon, key }) => (
                    <li key={key} className="flex items-center gap-2.5 text-sm font-medium text-cdc-ink">
                      <Icon className="w-4 h-4 text-cdc-primary-ink shrink-0" />
                      {t(key)}
                    </li>
                  ))}
                </ul>
                {canUseAiAssistant ? (
                  <Link
                    href="/dashboard/tools/chatbot-builder"
                    className="vip-btn-primary no-underline"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t('sevenDaysFree')}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleAiCtaClick}
                    className="vip-btn-primary cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t('sevenDaysFree')}
                  </button>
                )}
              </div>
            </div>

            {/* IMIAKO — AI English Tutor, a Student-facing product shown
                alongside the Business-facing AI Assistant above (same
                full-width "flagship" card treatment, gradient-badged as its
                own distinct brand rather than reusing the cyan/purple
                Business-tools palette). Deliberately NOT added to the
                B2B-only /tools catalog or its nav link — that page is
                explicitly Business-account-scoped (see pages/tools.tsx's
                own subtitle) and its header link is hidden once a Student/
                Mentor is logged in, so putting IMIAKO there would hide it
                from the exact users it's for. */}
            <div className="vip-card lg:col-span-3 p-6 sm:p-8 flex flex-col lg:flex-row gap-8 items-start">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-cdc-accent flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-xl font-extrabold text-cdc-ink">{t('imiakoHeroTitle')}</h3>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {t('availableNow')}
                  </span>
                </div>
                <ul className="grid sm:grid-cols-2 gap-3 mb-6">
                  {[
                    { icon: Gift, key: 'imiakoHeroFeature1' as const },
                    { icon: Globe, key: 'imiakoHeroFeature2' as const },
                    { icon: Target, key: 'imiakoHeroFeature3' as const },
                  ].map(({ icon: Icon, key }) => (
                    <li key={key} className="flex items-center gap-2.5 text-sm font-medium text-cdc-ink">
                      <Icon className="w-4 h-4 text-cdc-primary-ink shrink-0" />
                      {t(key)}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard/english-tutor"
                  className="vip-btn-primary no-underline"
                >
                  <Sparkles className="w-4 h-4" />
                  {t('imiakoCta')}
                </Link>
              </div>
            </div>

            {[
              { icon: ShieldCheck, titleKey: 'examSystemTitle' as const, descKey: 'examSystemBody' as const },
              { icon: Users, titleKey: 'screenerTitle' as const, descKey: 'screenerBody' as const },
            ].map(({ icon: Icon, titleKey, descKey }) => (
              <div key={titleKey} className="vip-card p-6 sm:p-7 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-cdc-bg flex items-center justify-center">
                    <Icon className="w-6 h-6 text-cdc-muted" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <Lock className="w-3 h-3" />
                    {t('comingSoon')}
                  </span>
                </div>
                <h3 className="text-base font-bold text-cdc-ink mb-2">{t(titleKey)}</h3>
                <p className="text-sm text-cdc-muted leading-relaxed">{t(descKey)}</p>
              </div>
            ))}

            <div className="lg:col-span-3 text-center">
              <Link
                href="/tools"
                className="vip-btn-secondary no-underline"
              >
                {t('viewAllTools')}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
