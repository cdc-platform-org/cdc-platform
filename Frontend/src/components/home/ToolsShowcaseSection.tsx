/**
 * Homepage digital tools showcase promoting /tools and the AI assistant.
 */
import { BarChart3, BookOpen, Bot, Code2, Gift, Globe, GraduationCap, Lock, MessageSquareText, ShieldCheck, Sparkles, Target, Users } from 'lucide-react';
import Link from 'next/link';
import type { TFunction } from 'i18next';

interface ToolsShowcaseSectionProps {
  darkMode: boolean;
  t: TFunction<"home", undefined>;
  canUseAiAssistant: boolean;
  handleAiCtaClick: () => void;
}

export default function ToolsShowcaseSection({ darkMode, t, canUseAiAssistant, handleAiCtaClick }: ToolsShowcaseSectionProps) {
  return (
    <>
      {/* 🛠️ DIGITAL TOOLS SHOWCASE — promotes /tools; the AI Assistant is the
          only currently purchasable/available product (subscription-style
          free trial, not a one-off sale), the other two are genuinely
          "coming soon" there too — mirrored here rather than inventing
          prices/buy buttons for products that don't have them yet. */}
      <section className={`py-16 sm:py-28 border-t ${darkMode ? 'bg-[#0e1422]/40 border-slate-800' : 'bg-slate-50/60 border-slate-200'}`}>
        <div className="max-w-7xl mx-auto px-0 sm:px-6">
          <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-16">
            <span className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-widest px-4 py-2 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-full border border-purple-500/20 mb-4">
              <Sparkles className="w-3.5 h-3.5" />
              CDC AI
            </span>
            <h2 className="section-title text-center text-2xl md:text-[2.15rem] font-black tracking-wide mb-4">{t('toolsHeading')}</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              {t('toolsSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-3 rounded-3xl border border-cyan-500/30 bg-white dark:bg-slate-900/60 bg-gradient-to-br from-cyan-500/5 to-purple-600/5 p-5 sm:p-8 flex flex-col lg:flex-row gap-8 items-start">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center">
                <Bot className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-xl font-black tracking-wide">{t('aiAssistantTitle')}</h3>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                    {t('availableNow')}
                  </span>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                  {t('aiAssistantBody')}
                </p>
                <ul className="grid sm:grid-cols-2 gap-3 mb-6">
                  {[
                    { icon: MessageSquareText, key: 'aiFeature1' as const },
                    { icon: BookOpen, key: 'aiFeature2' as const },
                    { icon: Code2, key: 'aiFeature3' as const },
                    { icon: BarChart3, key: 'aiFeature4' as const },
                  ].map(({ icon: Icon, key }) => (
                    <li key={key} className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <Icon className="w-4 h-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      {t(key)}
                    </li>
                  ))}
                </ul>
                {canUseAiAssistant ? (
                  <Link
                    href="/dashboard/tools/chatbot-builder"
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                  >
                    <Sparkles className="w-4 h-4" />
                    {t('sevenDaysFree')}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={handleAiCtaClick}
                    className="inline-flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl border-none cursor-pointer hover:shadow-lg hover:shadow-cyan-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
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
            <div className="lg:col-span-3 rounded-3xl border border-purple-500/30 bg-white dark:bg-slate-900/60 bg-gradient-to-br from-amber-400/5 via-purple-500/5 to-cyan-500/5 p-5 sm:p-8 flex flex-col lg:flex-row gap-8 items-start">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-400 via-purple-500 to-cyan-500 flex items-center justify-center">
                <GraduationCap className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h3 className="text-xl font-black tracking-wide">{t('imiakoHeroTitle')}</h3>
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
                    <li key={key} className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                      <Icon className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                      {t(key)}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard/english-tutor"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-400 via-purple-500 to-cyan-500 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-purple-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
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
              <div key={titleKey} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-5 sm:p-7 flex flex-col opacity-90">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                    <Lock className="w-3 h-3" />
                    {t('comingSoon')}
                  </span>
                </div>
                <h3 className="text-base font-black tracking-wide mb-2">{t(titleKey)}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{t(descKey)}</p>
              </div>
            ))}

            <div className="lg:col-span-3 text-center">
              <Link
                href="/tools"
                className={`inline-flex items-center gap-2 font-black text-sm px-6 py-3 rounded-xl no-underline transition-colors ${darkMode ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'}`}
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
