/**
 * Homepage overlays: Business-only AI assistant gate modals, post-action and
 * checkout-error toasts, the promo-code checkout modal and the promo video.
 */
import { AlertTriangle, Building2, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';
import PromoCheckoutModal from '../shared/PromoCheckoutModal';
import TutorialVideoModal from '../shared/TutorialVideoModal';
import { tutorialTitle } from '../../services/tutorialService';
import { Course } from '../../types/lms';
import { Tutorial } from '../../types/tutorial';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';

interface HomeOverlaysProps {
  aiInfoModal: "studentBlocked" | "verificationRequired" | null;
  setAiInfoModal: Dispatch<SetStateAction<"studentBlocked" | "verificationRequired" | null>>;
  darkMode: boolean;
  t: TFunction<"home", undefined>;
  toastMessage: string | null;
  checkoutCourseItem: Course | null;
  contentLang: "ka" | "en";
  enrollingId: string | null;
  checkoutError: string | null;
  startCheckout: (course: Course, promoCode?: string) => Promise<void>;
  setCheckoutCourseItem: Dispatch<SetStateAction<Course | null>>;
  setCheckoutError: Dispatch<SetStateAction<string | null>>;
  showPromoVideo: boolean;
  promoVideo: Tutorial | null;
  setShowPromoVideo: Dispatch<SetStateAction<boolean>>;
}

export default function HomeOverlays({ aiInfoModal, setAiInfoModal, darkMode, t, toastMessage, checkoutCourseItem, contentLang, enrollingId, checkoutError, startCheckout, setCheckoutCourseItem, setCheckoutError, showPromoVideo, promoVideo, setShowPromoVideo }: HomeOverlaysProps) {
  return (
    <>
      {/* Business-only gate modals for the Enterprise AI Assistant trial CTA */}
      {aiInfoModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] px-4"
          onClick={() => setAiInfoModal(null)}
        >
          <div
            className={`relative rounded-2xl shadow-xl w-full max-w-sm p-6 text-center ${darkMode ? 'bg-slate-900' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAiInfoModal(null)}
              aria-label={t('close')}
              className={`absolute top-4 right-4 p-2 cursor-pointer rounded-full transition-colors ${darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-slate-800' : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'}`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-cyan-500 to-purple-600 flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-7 h-7 text-white" />
            </div>

            {aiInfoModal === 'studentBlocked' ? (
              <>
                <h3 className="text-base font-black tracking-wide mb-2">
                  {t('studentBlockedTitle')}
                </h3>
                <p className={`text-sm leading-relaxed mb-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('studentBlockedBody')}
                </p>
                <Link
                  href="/contact"
                  onClick={() => setAiInfoModal(null)}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                  {t('learnAboutBusiness')}
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-base font-black tracking-wide mb-2">
                  {t('verificationRequiredTitle')}
                </h3>
                <p className={`text-sm leading-relaxed mb-5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  {t('verificationRequiredBody')}
                </p>
                <Link
                  href="/dashboard/client"
                  onClick={() => setAiInfoModal(null)}
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-black text-sm px-6 py-3 rounded-xl no-underline hover:shadow-lg hover:shadow-cyan-500/30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
                >
                  {t('completeVerification')}
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {/* POST-ACTION TOAST */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-2xl bg-emerald-600 text-white text-sm font-medium flex items-center gap-2 transition-opacity duration-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          {toastMessage}
        </div>
      )}

      {checkoutCourseItem && (
        <PromoCheckoutModal
          title={checkoutCourseItem.title}
          currentPrice={checkoutCourseItem.currentPrice}
          originalPrice={checkoutCourseItem.originalPrice}
          targetType="COURSE"
          targetId={checkoutCourseItem.id}
          lang={contentLang}
          busy={enrollingId === checkoutCourseItem.id}
          error={checkoutError}
          onConfirm={(code) => startCheckout(checkoutCourseItem, code)}
          onClose={() => { setCheckoutCourseItem(null); setCheckoutError(null); }}
        />
      )}

      {/* CHECKOUT ERROR TOAST */}
      {checkoutError && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-xl shadow-2xl bg-red-600 text-white text-sm font-medium flex items-center gap-2 transition-opacity duration-300">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {checkoutError}
        </div>
      )}

      {/* PROMO VIDEO — hero's "▶ გაიგე როგორ მუშაობს პლატფორმა" button */}
      {showPromoVideo && promoVideo && (
        <TutorialVideoModal
          tutorial={promoVideo}
          title={tutorialTitle(promoVideo, contentLang)}
          openExternallyLabel={t('heroPromoOpenExternally')}
          openInNewTabLabel={t('heroPromoOpenInNewTab')}
          onClose={() => setShowPromoVideo(false)}
        />
      )}
    </>
  );
}
