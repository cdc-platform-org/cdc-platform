import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetStaticProps } from 'next';
import { Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../src/context/AuthContext';
import { verifyEmail, resendVerificationEmail } from '../../src/services/authService';

type Status = 'verifying' | 'success' | 'error';

export default function VerifyEmailPage() {
  const router = useRouter();
  const { t } = useTranslation('auth');
  const { isAuthenticated } = useAuth();

  const [status, setStatus] = useState<Status>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const runVerification = useCallback(async (token: string) => {
    try {
      await verifyEmail(token);
      setStatus('success');
    } catch (err: any) {
      setErrorMessage(err?.response?.data?.message ?? null);
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const token = router.query.token;
    if (typeof token !== 'string' || !token) {
      setErrorMessage(t('verifyEmail.missingToken'));
      setStatus('error');
      return;
    }
    runVerification(token);
  }, [router.isReady, router.query.token, runVerification, t]);

  const handleResend = async () => {
    setResendState('sending');
    try {
      await resendVerificationEmail();
      setResendState('sent');
    } catch {
      setResendState('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-[#0b0f19] px-4">
      <div className="w-full max-w-md bg-white/90 dark:bg-slate-900/70 backdrop-blur-md rounded-2xl shadow-lg shadow-slate-200/40 dark:shadow-none border border-slate-200/80 dark:border-white/10 p-8 text-center transition-colors">
        {status === 'verifying' && (
          <>
            <Loader2 className="w-10 h-10 text-indigo-600 mx-auto mb-3 animate-spin" />
            <p className="text-sm text-gray-600 dark:text-slate-400">{t('verifyEmail.verifying')}</p>
            <Link href="/" className="mt-4 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-500">
              {t('verifyEmail.returnHomeLink')}
            </Link>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('verifyEmail.successTitle')}</h1>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-6">{t('verifyEmail.successMessage')}</p>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              {t('verifyEmail.continueButton')}
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <AlertTriangle className="w-10 h-10 text-amber-600 mx-auto mb-3" />
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">{t('verifyEmail.errorTitle')}</h1>
            {errorMessage && <p className="text-sm text-red-600 dark:text-red-400 mb-4">{errorMessage}</p>}

            {isAuthenticated && (
              <>
                {resendState === 'sent' ? (
                  <p className="text-sm text-emerald-600 mb-2">{t('verifyEmail.resendSuccess')}</p>
                ) : (
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendState === 'sending'}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {t('verifyEmail.resendButton')}
                  </button>
                )}
                {resendState === 'error' && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-2">{t('verifyEmail.resendError')}</p>
                )}
              </>
            )}
            <Link href="/" className="mt-4 inline-block text-xs font-medium text-indigo-600 hover:text-indigo-500">
              {t('verifyEmail.returnHomeLink')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['auth'])) },
});
