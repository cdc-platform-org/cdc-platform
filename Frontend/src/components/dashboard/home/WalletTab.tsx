/**
 * Wallet tab of /dashboard: available + escrow balances, payout request
 * form, payout history and payment history (with invoice download).
 */
import { Download } from 'lucide-react';
import { WalletSummary, PayoutRequestRow } from '../../../services/walletService';
import { MyPaymentRow } from '../../../services/paymentService';
import { DashboardStrings } from './dashboardDict';
import { CARD_CLASS, PAYMENT_STATUS_BADGE, PAYOUT_STATUS_BADGE, formatGel, formatMoney } from './dashboardShared';
import { WalletPayout } from './useWalletPayout';

interface WalletTabProps {
  t: DashboardStrings;
  wallet: WalletSummary | null;
  /** Sum of gig earnings still held in escrow (not yet withdrawable). */
  escrowBalance: number;
  payoutRequests: PayoutRequestRow[];
  payments: MyPaymentRow[];
  payout: WalletPayout;
  invoiceError: string | null;
  downloadingInvoiceId: string | null;
  onDownloadInvoice: (paymentId: string) => void;
}

export default function WalletTab({
  t,
  wallet,
  escrowBalance,
  payoutRequests,
  payments,
  payout,
  invoiceError,
  downloadingInvoiceId,
  onDownloadInvoice,
}: WalletTabProps) {
  return (
    <div className="space-y-8">
      <h2 className="text-lg font-extrabold tracking-wide">{t.walletTitle}</h2>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className={`${CARD_CLASS} p-6`}>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.availableBalance}</p>
          <p className="text-3xl font-black text-cyan-600 dark:text-cyan-300">{formatGel(wallet?.earningsBalance ?? 0)}</p>
        </div>
        <div className={`${CARD_CLASS} p-6`}>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{t.escrowBalance}</p>
          <p className="text-3xl font-black text-amber-600 dark:text-amber-300">{formatGel(escrowBalance)}</p>
        </div>
      </div>

      <div className={`${CARD_CLASS} p-6`}>
        <h3 className="text-sm font-bold mb-1">{t.requestPayout}</h3>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">{t.ibanHint}</p>
        {payout.payoutError && (
          <div className="mb-4 rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-3 text-xs text-red-600 dark:text-red-300">
            {payout.payoutError}
          </div>
        )}
        <form onSubmit={payout.handlePayoutSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="number"
            step="0.01"
            required
            placeholder={t.amount}
            value={payout.payoutAmount}
            onChange={(e) => payout.setPayoutAmount(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <input
            placeholder={t.iban}
            value={payout.payoutIban}
            onChange={(e) => payout.setPayoutIban(e.target.value)}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button
            type="submit"
            disabled={payout.payoutSubmitting}
            className="rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {payout.payoutSubmitting ? t.submitting : t.submit}
          </button>
        </form>
      </div>

      <div>
        <h3 className="text-sm font-bold mb-4">{t.payoutHistory}</h3>
        {payoutRequests.length === 0 ? (
          <div className={`${CARD_CLASS} p-8 text-center`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.noPayouts}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <tbody>
                {payoutRequests.map((r) => (
                  <tr key={r.id} className="border-b last:border-0 border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatGel(r.amount)}</td>
                    <td className="px-4 py-3 font-mono text-slate-500 dark:text-slate-400">{r.iban}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-500">{new Date(r.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${PAYOUT_STATUS_BADGE[r.status]}`}>
                        {r.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-sm font-bold mb-4">{t.paymentHistory}</h3>
        {invoiceError && (
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400 mb-3">{invoiceError}</p>
        )}
        {payments.length === 0 ? (
          <div className={`${CARD_CLASS} p-8 text-center`}>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.noPayments}</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-xs">
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 border-slate-200 dark:border-slate-800">
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{t.paymentPurpose[p.purpose] ?? p.purpose}</td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200">
                      {p.referenceTitle ?? '—'}
                      {p.promoCode && (
                        <span className="ml-2 inline-block text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          {p.promoCode}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{formatMoney(p.amount, p.currency)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-500">{new Date(p.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded border ${PAYMENT_STATUS_BADGE[p.status]}`}>
                          {p.status}
                        </span>
                        {p.status === 'COMPLETED' && (
                          <button
                            type="button"
                            onClick={() => onDownloadInvoice(p.id)}
                            disabled={downloadingInvoiceId === p.id}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60"
                          >
                            <Download className="w-3 h-3" />
                            {downloadingInvoiceId === p.id ? t.loading : t.downloadInvoiceLabel}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
