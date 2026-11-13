/**
 * Payout-request form state for the Wallet tab of /dashboard. After a
 * successful request it re-fetches the wallet summary and payout history
 * so the balances shown are the server's, not a client-side guess.
 */
import { FormEvent, useEffect, useState } from 'react';
import { User } from '../../../types/auth';
import { SupportedLocale } from '../../../utils/locale';
import {
  getWalletSummary,
  getMyPayoutRequests,
  createPayoutRequest,
  WalletSummary,
  PayoutRequestRow,
} from '../../../services/walletService';

export function useWalletPayout({
  user,
  lang,
  setWallet,
  setPayoutRequests,
}: {
  user: User | null | undefined;
  lang: SupportedLocale;
  setWallet: (wallet: WalletSummary) => void;
  setPayoutRequests: (rows: PayoutRequestRow[]) => void;
}) {
  const [payoutAmount, setPayoutAmount] = useState('');
  const [payoutIban, setPayoutIban] = useState('');
  const [payoutSubmitting, setPayoutSubmitting] = useState(false);
  const [payoutError, setPayoutError] = useState<string | null>(null);

  // Pre-fill the IBAN the user saved in settings.
  useEffect(() => {
    if (user?.payoutIban) setPayoutIban(user.payoutIban);
  }, [user?.payoutIban]);

  const handlePayoutSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPayoutError(null);
    // The form takes GEL; the API takes minor units. Minimum payout is 1 GEL.
    const minorAmount = Math.round(Number(payoutAmount) * 100);
    if (!minorAmount || minorAmount < 100) {
      setPayoutError(lang === 'ka' ? 'შეიყვანეთ სწორი თანხა.' : 'Enter a valid amount.');
      return;
    }
    setPayoutSubmitting(true);
    try {
      await createPayoutRequest(minorAmount, payoutIban || undefined);
      setPayoutAmount('');
      const [walletData, payoutData] = await Promise.all([getWalletSummary(), getMyPayoutRequests()]);
      setWallet(walletData);
      setPayoutRequests(payoutData);
    } catch (err: any) {
      setPayoutError(err?.response?.data?.message ?? (lang === 'ka' ? 'მოთხოვნის გაგზავნა ვერ მოხერხდა.' : 'Unable to submit request.'));
    } finally {
      setPayoutSubmitting(false);
    }
  };

  return {
    payoutAmount,
    setPayoutAmount,
    payoutIban,
    setPayoutIban,
    payoutSubmitting,
    payoutError,
    handlePayoutSubmit,
  };
}

export type WalletPayout = ReturnType<typeof useWalletPayout>;
