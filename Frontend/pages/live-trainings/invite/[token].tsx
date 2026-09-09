import { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import SiteHeader from '@/src/components/layout/SiteHeader';
import { useAuth } from '@/src/context/AuthContext';
import { useAuthModal } from '@/src/context/AuthModalContext';
import { redeemInvite } from '@/src/services/liveTrainingInviteService';

const copy = {
  ka: {
    title: 'ტრენინგზე ჩარიცხვის მოწვევა', redeeming: 'მოწვევა მუშავდება…',
    success: 'წარმატებით ჩაირიცხეთ', successHint: 'გადამისამართდებით ტრენინგის გვერდზე…',
    failed: 'მოწვევის გამოყენება ვერ მოხერხდა.', signIn: 'გასაგრძელებლად შედით ანგარიშში',
    retry: 'ხელახლა ცდა',
  },
  en: {
    title: 'Live Training Invite', redeeming: 'Redeeming your invite…',
    success: 'You are enrolled', successHint: 'Redirecting to the training page…',
    failed: 'This invite could not be used.', signIn: 'Sign in to continue',
    retry: 'Try again',
  },
};

export default function LiveTrainingInvitePage() {
  const router = useRouter();
  const token = typeof router.query.token === 'string' ? router.query.token : '';
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const t = copy[lang];
  const { isAuthenticated } = useAuth();
  const { openAuthModal } = useAuthModal();
  const [status, setStatus] = useState<'idle' | 'working' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const attempted = useRef(false);

  const attemptRedeem = useCallback(async () => {
    if (!token) return;
    setStatus('working'); setErrorMessage('');
    try {
      const result = await redeemInvite(token, router.locale);
      setStatus('success');
      setTimeout(() => void router.replace(`/live-trainings/${result.liveTraining.id}`), 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err?.response?.data?.message ?? t.failed);
    }
  }, [token, router, t.failed]);

  useEffect(() => {
    if (!token || attempted.current) return;
    if (!isAuthenticated) {
      openAuthModal({ redirectPath: `/live-trainings/invite/${token}`, onSuccess: () => { attempted.current = true; void attemptRedeem(); } });
      return;
    }
    attempted.current = true;
    void attemptRedeem();
  }, [token, isAuthenticated, openAuthModal, attemptRedeem]);

  return <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
    <Head><title>{t.title} | CDC</title></Head>
    <SiteHeader />
    <main className="max-w-md mx-auto px-4 py-16 text-center">
      <h1 className="text-2xl font-black mb-6">{t.title}</h1>
      {!isAuthenticated && status === 'idle' && <p className="text-slate-500">{t.signIn}</p>}
      {status === 'working' && <p role="status">{t.redeeming}</p>}
      {status === 'success' && <div role="status"><p className="text-emerald-600 font-bold">{t.success}</p><p className="text-sm text-slate-500 mt-2">{t.successHint}</p></div>}
      {status === 'error' && <div role="alert"><p className="text-red-600">{errorMessage}</p><button type="button" onClick={() => void attemptRedeem()} className="mt-4 rounded-xl bg-cyan-700 text-white px-4 py-2.5 text-sm font-bold">{t.retry}</button></div>}
    </main>
  </div>;
}
