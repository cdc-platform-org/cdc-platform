import { FormEvent, useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import AdminGuard from '@/src/components/admin/AdminGuard';
import AdminLayout from '@/src/components/admin/AdminLayout';
import {
  LiveTrainingEnrollmentRow, LiveTrainingInvite, cancelEnrollment, createInvite, getInviteQr,
  listEnrollments, listInvites, manualEnroll, revokeInvite, rotateInvite, listInviteRequests, reviewInviteRequest, InviteRequest,
} from '@/src/services/liveTrainingInviteService';

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-500';
const buttonClass = 'rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
const primaryClass = 'rounded-xl bg-cyan-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50';

function AdminEnrollmentsContent() {
  const router = useRouter();
  const trainingId = typeof router.query.id === 'string' ? router.query.id : '';
  const lang = router.locale === 'ka' ? 'ka' : 'en';
  const [enrollments, setEnrollments] = useState<LiveTrainingEnrollmentRow[]>([]);
  const [invites, setInvites] = useState<LiveTrainingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [enrollEmail, setEnrollEmail] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMax, setInviteMax] = useState(1);
  const [inviteExpires, setInviteExpires] = useState('');
  const [inviteStarts, setInviteStarts] = useState('');
  const [invitePolicy, setInvitePolicy] = useState<LiveTrainingInvite['policy'] | ''>('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [requests, setRequests] = useState<{ inviteId: string; rows: InviteRequest[] } | null>(null);
  const [qr, setQr] = useState<{ id: string; url: string; qrDataUrl: string } | null>(null);

  const load = useCallback(async () => {
    if (!trainingId) return;
    const [e, i] = await Promise.all([listEnrollments(trainingId), listInvites(trainingId)]);
    setEnrollments(e); setInvites(i);
  }, [trainingId]);
  useEffect(() => {
    setLoading(true);
    void load().catch(() => setError('Could not load enrollments.')).finally(() => setLoading(false));
  }, [load]);

  const submitManualEnroll = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try { await manualEnroll(trainingId, enrollEmail); setEnrollEmail(''); await load(); }
    catch { setError('Could not enroll this email — check it belongs to a real account.'); }
    finally { setBusy(false); }
  };
  const doCancelEnrollment = async (userId: string) => {
    setBusy(true); setError('');
    try { await cancelEnrollment(trainingId, userId); await load(); }
    catch { setError('Could not cancel this enrollment. Please try again.'); }
    finally { setBusy(false); }
  };
  const submitCreateInvite = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await createInvite(trainingId, { email: inviteEmail || null, maxRedemptions: inviteMax, startsAt: inviteStarts ? new Date(inviteStarts).toISOString() : null, ...(invitePolicy ? { policy: invitePolicy } : {}), requiresApproval, expiresAt: inviteExpires ? new Date(inviteExpires).toISOString() : null });
      setInviteEmail(''); setInviteMax(1); setInviteExpires(''); setInviteStarts(''); setInvitePolicy(''); setRequiresApproval(false);
      await load();
    } catch { setError('Could not create this invite.'); }
    finally { setBusy(false); }
  };
  const doRevokeInvite = async (id: string) => {
    setBusy(true); setError('');
    try { await revokeInvite(trainingId, id); await load(); }
    catch { setError('Could not revoke this invite. Please try again.'); }
    finally { setBusy(false); }
  };
  const showQr = async (id: string) => {
    setBusy(true); setError('');
    try { setQr({ id, ...(await getInviteQr(trainingId, id)) }); }
    catch { setError('Could not load this invite QR code. Please try again.'); }
    finally { setBusy(false); }
  };

  const manageRequests = async (inviteId: string) => {
    setBusy(true); setError('');
    try { setRequests({ inviteId, rows: await listInviteRequests(trainingId, inviteId) }); }
    catch { setError(lang === 'ka' ? 'მოთხოვნები ვერ ჩაიტვირთა.' : 'Could not load requests.'); }
    finally { setBusy(false); }
  };
  const decideRequest = async (userId: string, decision: 'approve' | 'reject') => {
    if (!requests) return;
    setBusy(true); setError('');
    try { await reviewInviteRequest(trainingId, requests.inviteId, userId, decision); await manageRequests(requests.inviteId); await load(); }
    catch { setError(lang === 'ka' ? 'მოთხოვნა ვერ განახლდა.' : 'Could not update this request.'); }
    finally { setBusy(false); }
  };
  const rotate = async (inviteId: string) => {
    setBusy(true); setError('');
    try { await rotateInvite(trainingId, inviteId); setQr(null); await load(); }
    catch { setError(lang === 'ka' ? 'ბმული ვერ განახლდა.' : 'Could not rotate this invite.'); }
    finally { setBusy(false); }
  };

  return <main className="max-w-6xl mx-auto p-4 sm:p-8 text-slate-900">
    <Head><title>Enrollments & Invites | CDC Admin</title></Head>
    <Link href="/admin/live-trainings" className="text-sm text-cyan-700">← {lang === 'ka' ? 'ლაივ ტრენინგების მართვა' : 'Manage live trainings'}</Link>
    <h1 className="mt-5 text-2xl sm:text-3xl font-black">{lang === 'ka' ? 'ჩარიცხვები და მოწვევები' : 'Enrollments & Invites'}</h1>
    <p className="text-sm text-slate-500 mt-2 mb-7">{lang === 'ka' ? 'ხელით ჩარიცხვა უგულებელყოფს გადახდას — ეს ადმინისტრატორის შეგნებული გადაწყვეტილებაა. ფასიან ტრენინგზე მოწვევა ნაგულისხმევად მოითხოვს გადახდას. უფასო ჩარიცხვა აირჩიეთ მხოლოდ საფასურის შეგნებულად გაუქმებისას.' : 'Manual enrollment intentionally bypasses payment — an admin decision. Invites require payment on paid training by default. Choose Free enrollment only when you intend to waive payment.'}</p>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 mb-5 text-sm text-red-700">{error}</div>}

    {loading ? <p role="status">Loading…</p> : <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 mb-7">
        <h2 className="text-xl font-bold mb-4">{lang === 'ka' ? 'ხელით ჩარიცხვა' : 'Manual enrollment'}</h2>
        <form onSubmit={submitManualEnroll} className="flex flex-wrap gap-3">
          <input type="email" required aria-label={lang === 'ka' ? 'მოსწავლის ელფოსტა' : 'Learner email'} placeholder="learner@example.com" value={enrollEmail} onChange={(e) => setEnrollEmail(e.target.value)} className={`${inputClass} max-w-sm`} disabled={busy} />
          <button type="submit" className={primaryClass} disabled={busy}>{lang === 'ka' ? 'ჩარიცხვა' : 'Enroll'}</button>
        </form>
        <ul className="mt-5 divide-y divide-slate-100">
          {enrollments.map((row) => <li key={row.id} className="py-3 flex flex-wrap justify-between items-center gap-3 text-sm">
            <span>{row.user.name} · {row.user.email} · <span className="font-semibold">{row.status}</span></span>
            {row.status !== 'CANCELLED' && <button type="button" disabled={busy} onClick={() => void doCancelEnrollment(row.userId)} className={buttonClass}>{lang === 'ka' ? 'გაუქმება' : 'Cancel'}</button>}
          </li>)}
          {!enrollments.length && <p className="text-sm text-slate-500 py-3">{lang === 'ka' ? 'ჩარიცხვები არ არის.' : 'No enrollments yet.'}</p>}
        </ul>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold mb-4">{lang === 'ka' ? 'QR / ბმულის მოწვევები' : 'QR / link invites'}</h2>
        <form onSubmit={submitCreateInvite} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
          <label className="text-sm font-medium">{lang === 'ka' ? 'ელფოსტა (არასავალდებულო)' : 'Email (optional)'}<input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} className={`${inputClass} mt-2`} disabled={busy} /></label>
          <label className="text-sm font-medium">{lang === 'ka' ? 'გამოყენებები' : 'Max uses'}<input type="number" min={1} max={10000} value={inviteMax} onChange={(e) => setInviteMax(Number(e.target.value))} className={`${inputClass} mt-2`} disabled={busy} /></label>
          <label className="text-sm font-medium">{lang === 'ka' ? 'იწყება (არასავალდებულო)' : 'Starts (optional)'}<input type="datetime-local" value={inviteStarts} onChange={(e) => setInviteStarts(e.target.value)} className={`${inputClass} mt-2`} disabled={busy} /></label>
          <label className="text-sm font-medium">{lang === 'ka' ? 'ჩარიცხვის წესი' : 'Enrollment policy'}<select value={invitePolicy} onChange={(e) => setInvitePolicy(e.target.value as LiveTrainingInvite['policy'] | '')} disabled={busy} className={`${inputClass} mt-2`}><option value="">{lang === 'ka' ? 'ნაგულისხმევი (ფასიანზე გადახდა)' : 'Default (payment for paid training)'}</option><option value="PAYMENT_REQUIRED">{lang === 'ka' ? 'საჭიროა გადახდა' : 'Payment required'}</option><option value="REGISTRATION_ONLY">{lang === 'ka' ? 'მხოლოდ რეგისტრაცია' : 'Registration only'}</option><option value="FREE_ENROLLMENT">{lang === 'ka' ? 'უფასო ჩარიცხვა (საფასურის გარეშე)' : 'Free enrollment (waive payment)'}</option></select></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} disabled={busy} />{lang === 'ka' ? 'ადმინისტრატორის დასტური' : 'Require approval'}</label>
          <label className="text-sm font-medium">{lang === 'ka' ? 'ვადა (არასავალდებულო)'  : 'Expires (optional)'}<input type="datetime-local" value={inviteExpires} onChange={(e) => setInviteExpires(e.target.value)} className={`${inputClass} mt-2`} disabled={busy} /></label>
          <button type="submit" className={primaryClass} disabled={busy}>{lang === 'ka' ? 'შექმნა' : 'Create'}</button>
        </form>
        <ul className="mt-5 divide-y divide-slate-100">
          {invites.map((invite) => <li key={invite.id} className="py-3 flex flex-wrap justify-between items-center gap-3 text-sm">
            <span>{invite.email ?? (lang === 'ka' ? 'ზოგადი ბმული' : 'Generic link')} · {invite.redemptionCount}/{invite.maxRedemptions} {lang === 'ka' ? 'გამოყენებული' : 'used'}{invite.revokedAt ? ` · ${lang === 'ka' ? 'გაუქმებული' : 'revoked'}` : ''}</span>
            <span className="flex flex-wrap gap-2">
              <button type="button" disabled={busy} onClick={() => void showQr(invite.id)} className={buttonClass}>{lang === 'ka' ? 'QR ნახვა' : 'Show QR'}</button>
              <button type="button" disabled={busy} onClick={() => void manageRequests(invite.id)} className={buttonClass}>{lang === 'ka' ? 'მოთხოვნები' : 'Requests'}</button>
              {!invite.revokedAt && <button type="button" disabled={busy} onClick={() => void rotate(invite.id)} className={buttonClass}>{lang === 'ka' ? 'ბმულის განახლება' : 'Rotate link'}</button>}
              {!invite.revokedAt && <button type="button" disabled={busy} onClick={() => void doRevokeInvite(invite.id)} className={buttonClass}>{lang === 'ka' ? 'გაუქმება' : 'Revoke'}</button>}
            </span>
          </li>)}
          {!invites.length && <p className="text-sm text-slate-500 py-3">{lang === 'ka' ? 'მოწვევები არ არის.' : 'No invites yet.'}</p>}
        </ul>
      </section>

      {requests && <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-xl font-bold mb-4">{lang === 'ka' ? 'ჩარიცხვის მოთხოვნები' : 'Enrollment requests'}</h2><ul className="space-y-3">{requests.rows.map((row) => <li key={row.userId} className="flex flex-wrap justify-between gap-3 text-sm"><span className="break-all">{row.user.email} · {row.status}</span>{row.status === 'PENDING_APPROVAL' && <span className="flex gap-2"><button disabled={busy} type="button" onClick={() => void decideRequest(row.userId, 'approve')} className={primaryClass}>{lang === 'ka' ? 'დადასტურება' : 'Approve'}</button><button disabled={busy} type="button" onClick={() => void decideRequest(row.userId, 'reject')} className={buttonClass}>{lang === 'ka' ? 'უარყოფა' : 'Reject'}</button></span>}</li>)}</ul>{!requests.rows.length && <p>{lang === 'ka' ? 'მოთხოვნები არ არის.' : 'No requests yet.'}</p>}</section>}
      {qr && <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setQr(null)}>
        <div role="dialog" aria-modal="true" aria-label="Invite QR code" className="max-w-sm w-full bg-white rounded-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL, next/image gains nothing here */}
          <img src={qr.qrDataUrl} alt="Invite QR code" className="mx-auto w-64 h-64" />
          <p className="text-xs break-all mt-4 text-slate-500">{qr.url}</p>
          <button type="button" onClick={() => setQr(null)} className={`${buttonClass} mt-4`}>{lang === 'ka' ? 'დახურვა' : 'Close'}</button>
        </div>
      </div>}
    </>}
  </main>;
}

export default function AdminEnrollmentsPage() { return <AdminGuard requiredTiers={['SUPER_ADMIN', 'MANAGER']}><AdminLayout><AdminEnrollmentsContent /></AdminLayout></AdminGuard>; }
