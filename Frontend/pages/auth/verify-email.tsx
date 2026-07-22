import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { GetStaticProps } from 'next';
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        {status === 'verifying' && (
          <>
            <div className="text-4xl mb-3">⏳</div>
            <p className="text-sm text-gray-600">{t('verifyEmail.verifying')}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-4xl mb-3">✅</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('verifyEmail.successTitle')}</h1>
            <p className="text-sm text-gray-600 mb-6">{t('verifyEmail.successMessage')}</p>
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
            <div className="text-4xl mb-3">⚠️</div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">{t('verifyEmail.errorTitle')}</h1>
            {errorMessage && <p className="text-sm text-red-600 mb-4">{errorMessage}</p>}

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
                  <p className="text-sm text-red-600 mt-2">{t('verifyEmail.resendError')}</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export const getStaticProps: GetStaticProps = async ({ locale }) => ({
  props: { ...(await serverSideTranslations(locale ?? 'ka', ['auth'])) },
});
