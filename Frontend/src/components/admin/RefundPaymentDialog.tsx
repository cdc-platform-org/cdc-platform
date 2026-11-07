import { useEffect, useState } from 'react';
import {
  CoursePaymentRow,
  PaymentRefundRow,
  getPaymentRefunds,
  refundPayment,
} from '../../services/adminFinanceService';

// Escrow purposes can only be refunded in full while the money is still
// held (see Backend services/bogRefundService.ts).
const ESCROW_PURPOSES: CoursePaymentRow['purpose'][] = ['MENTORSHIP', 'HR_SUPPORT', 'GIG_ESCROW_FUNDING'];

const ACCESS_LABEL: Record<CoursePaymentRow['purpose'], string> = {
  COURSE: 'Remove the student from the course',
  LIVE_TRAINING: 'Cancel the live training seat',
  PRODUCT: 'Remove download access to the product',
  ENGLISH_TUTOR_SUBSCRIPTION: 'Take back the 30 days of AI English Tutor access',
  CHILDRENS_BOOK: 'Mark as refunded (the book itself is not changed automatically)',
  MENTORSHIP: 'Cancel the mentorship booking',
  HR_SUPPORT: 'Cancel the HR support request',
  GIG_ESCROW_FUNDING: 'Cancel the gig',
};

function money(minor: number, currency: string) {
  return `${(minor / 100).toFixed(2)} ${currency}`;
}

interface Props {
  payment: CoursePaymentRow;
  onClose: () => void;
  onRefunded: (message: string) => void;
}

export default function RefundPaymentDialog({ payment, onClose, onRefunded }: Props) {
  const remaining = payment.amount - (payment.refundedAmount ?? 0);
  const isEscrow = ESCROW_PURPOSES.includes(payment.purpose);

  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [amountInput, setAmountInput] = useState((remaining / 100).toFixed(2));
  const [revokeAccess, setRevokeAccess] = useState(true);
  const [recordOnly, setRecordOnly] = useState(false);
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<PaymentRefundRow[]>([]);

  useEffect(() => {
    getPaymentRefunds(payment.id).then(setHistory).catch(() => setHistory([]));
  }, [payment.id]);

  // Partial refunds keep access by default; full refunds revoke it.
  useEffect(() => {
    setRevokeAccess(mode === 'full');
  }, [mode]);

  const refundMinor = mode === 'full' ? remaining : Math.round(Number(amountInput.replace(',', '.')) * 100);
  const amountValid = Number.isFinite(refundMinor) && refundMinor > 0 && refundMinor <= remaining;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await refundPayment(payment.id, {
        amount: mode === 'full' ? undefined : refundMinor / 100,
        revokeAccess: isEscrow ? true : revokeAccess,
        recordOnly,
        reason: reason.trim() || undefined,
      });
      onRefunded(result.message);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message || 'Refund failed. Nothing was changed — please try again.');
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-white/10 shadow-xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Refund payment</h2>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
              {payment.user.name} ({payment.user.email}) · {payment.courseTitle}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 text-xl leading-none" aria-label="Close">
            ×
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs mb-4">
          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2">
            <div className="text-gray-500 dark:text-slate-400">Paid</div>
            <div className="font-semibold text-gray-900 dark:text-white">{money(payment.amount, payment.currency)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2">
            <div className="text-gray-500 dark:text-slate-400">Already refunded</div>
            <div className="font-semibold text-gray-900 dark:text-white">{money(payment.refundedAmount ?? 0, payment.currency)}</div>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-slate-800/60 p-2">
            <div className="text-gray-500 dark:text-slate-400">Can refund</div>
            <div className="font-semibold text-gray-900 dark:text-white">{money(remaining, payment.currency)}</div>
          </div>
        </div>

        {error && <div className="mb-4 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-xs text-red-700 dark:text-red-300">{error}</div>}

        {step === 'form' ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('full')}
                className={`flex-1 text-sm px-3 py-2 rounded-lg border ${mode === 'full' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'}`}
              >
                Full refund
              </button>
              <button
                type="button"
                disabled={isEscrow}
                title={isEscrow ? 'Escrow payments can only be refunded in full.' : undefined}
                onClick={() => setMode('partial')}
                className={`flex-1 text-sm px-3 py-2 rounded-lg border disabled:opacity-50 ${mode === 'partial' ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300'}`}
              >
                Partial refund
              </button>
            </div>

            {mode === 'partial' && (
              <label className="block text-sm">
                <span className="text-gray-700 dark:text-slate-300">Amount ({payment.currency})</span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0.01"
                  max={(remaining / 100).toFixed(2)}
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-2 text-sm"
                />
                {!amountValid && <span className="text-xs text-red-600 dark:text-red-400">Enter an amount between 0.01 and {(remaining / 100).toFixed(2)}.</span>}
              </label>
            )}

            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
              <input type="checkbox" className="mt-1" checked={isEscrow ? true : revokeAccess} disabled={isEscrow} onChange={(e) => setRevokeAccess(e.target.checked)} />
              <span>{ACCESS_LABEL[payment.purpose] ?? 'Revoke access'}</span>
            </label>

            <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-slate-300">
              <input type="checkbox" className="mt-1" checked={recordOnly} onChange={(e) => setRecordOnly(e.target.checked)} />
              <span>
                I already refunded this in the BOG business dashboard — only record it here
                <span className="block text-xs text-gray-500 dark:text-slate-400">No money is sent when this is checked.</span>
              </span>
            </label>

            <label className="block text-sm">
              <span className="text-gray-700 dark:text-slate-300">Reason (optional, saved in the audit log)</span>
              <textarea
                value={reason}
                maxLength={500}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border border-gray-300 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white px-3 py-2 text-sm"
              />
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300">
                Cancel
              </button>
              <button
                type="button"
                disabled={!amountValid || remaining <= 0}
                onClick={() => setStep('confirm')}
                className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-800 dark:text-red-200">
              <p className="font-semibold mb-1">
                {recordOnly ? 'Record a refund of ' : 'Send a refund of '}
                {money(refundMinor, payment.currency)} to {payment.user.email}?
              </p>
              <ul className="list-disc pl-5 text-xs space-y-1">
                {!recordOnly && <li>The money goes back through Bank of Georgia. This cannot be undone.</li>}
                {(isEscrow || revokeAccess) ? <li>{ACCESS_LABEL[payment.purpose]}.</li> : <li>The buyer keeps access.</li>}
                <li>The creator&apos;s share for the refunded part is taken back from their balance, if they had one.</li>
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={submitting} onClick={() => setStep('form')} className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-300">
                Back
              </button>
              <button type="button" disabled={submitting} onClick={handleSubmit} className="text-sm px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60">
                {submitting ? 'Refunding…' : 'Yes, refund'}
              </button>
            </div>
          </div>
        )}

        {history.length > 0 && (
          <div className="mt-6 border-t border-gray-200 dark:border-slate-800 pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Refund history</h3>
            <ul className="space-y-1 text-xs">
              {history.map((r) => (
                <li key={r.id} className="flex justify-between gap-2 text-gray-600 dark:text-slate-300">
                  <span>
                    {new Date(r.createdAt).toLocaleString()} · {money(r.amount, payment.currency)} · {r.status}
                    {r.recordOnly ? ' (recorded)' : ''}
                    {r.errorMessage ? ` — ${r.errorMessage}` : ''}
                  </span>
                  <span className="text-gray-400 whitespace-nowrap">{r.requestedBy.name}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
