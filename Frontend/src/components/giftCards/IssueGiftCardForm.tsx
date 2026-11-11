import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Gift, User, Building2, Mail, Printer, Send, CalendarHeart, CheckCircle2, X } from 'lucide-react';
import GiftCardVisual, { GIFT_THEMES } from './GiftCardVisual';
import { issueComplimentaryGiftCard, formatGel, GiftCardDesign, MyGiftCard } from '../../services/giftCardService';

// Admin: issue a FREE gift card (no payment) to a person or an
// organization. Same card, code, email and printable card as a bought one.
const DESIGNS: { id: GiftCardDesign; label: string }[] = [
  { id: 'classic', label: 'კლასიკური' },
  { id: 'birthday', label: 'დაბადების დღე' },
  { id: 'celebration', label: 'ზეიმი' },
  { id: 'kids', label: 'ბავშვებისთვის' },
];
const PRESETS = [20, 50, 100, 200, 500];
const MAX_GEL = 5000;
const input = 'w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

function todayInTbilisi(): string {
  return new Date(Date.now() + 4 * 3600 * 1000).toISOString().slice(0, 10);
}

export default function IssueGiftCardForm({ onClose, onIssued }: { onClose: () => void; onIssued: () => void }) {
  const [recipientType, setRecipientType] = useState<'PERSON' | 'ORGANIZATION'>('PERSON');
  const [amount, setAmount] = useState('50');
  const [design, setDesign] = useState<GiftCardDesign>('classic');
  const [recipientName, setRecipientName] = useState('');
  const [senderName, setSenderName] = useState('CDC');
  const [byEmail, setByEmail] = useState(true);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendLater, setSendLater] = useState(false);
  const [deliverDate, setDeliverDate] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<MyGiftCard | null>(null);

  const amountGel = Number(amount.replace(',', '.'));
  const amountValid = Number.isFinite(amountGel) && amountGel >= 1 && amountGel <= MAX_GEL && Math.round(amountGel * 100) === amountGel * 100;
  const minDate = todayInTbilisi();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!amountValid) return setError(`თანხა უნდა იყოს 1-დან ${MAX_GEL} ₾-მდე.`);
    if (!recipientName.trim() || !senderName.trim()) return setError('შეავსე მიმღების და გამგზავნის სახელი.');
    if (byEmail && !/^\S+@\S+\.\S+$/.test(recipientEmail.trim())) return setError('ჩაწერე მიმღების ელფოსტა.');
    if (byEmail && sendLater && (!deliverDate || deliverDate < minDate)) return setError('აირჩიე გაგზავნის დღე (დღეს ან მომავალში).');
    if (!window.confirm(`გავცეთ ${amountGel} ₾-იანი უფასო სასაჩუქრე ბარათი „${recipientName.trim()}“-სთვის?`)) return;
    setBusy(true);
    try {
      const card = await issueComplimentaryGiftCard({
        amountGel,
        senderName: senderName.trim(),
        recipientName: recipientName.trim(),
        recipientType,
        recipientEmail: byEmail ? recipientEmail.trim() : null,
        message: message.trim() || null,
        design,
        deliverAt: byEmail && sendLater ? new Date(`${deliverDate}T05:00:00.000Z`).toISOString() : null,
      });
      setIssued(card);
      onIssued();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'ბარათის გაცემა ვერ მოხერხდა.');
    } finally {
      setBusy(false);
    }
  };

  const tabBtn = (active: boolean) =>
    `flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition ${
      active ? 'border-indigo-600 bg-indigo-50 text-indigo-800' : 'border-gray-200 text-gray-700 hover:border-indigo-400'
    }`;

  return (
    <div className="rounded-2xl border border-indigo-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Gift className="h-5 w-5 text-indigo-600" /> უფასო სასაჩუქრე ბარათის გაცემა
          </h2>
          <p className="text-xs text-gray-500">გადახდის გარეშე. მიმღები იგივე ლამაზ ბარათს და კოდს მიიღებს, რასაც ნაყიდი ბარათის შემთხვევაში.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:text-gray-700" aria-label="დახურვა">
          <X className="h-5 w-5" />
        </button>
      </div>

      {issued ? (
        <div className="grid gap-5 md:grid-cols-[320px_1fr]">
          <GiftCardVisual design={issued.design} amountLabel={formatGel(issued.amount)} recipientName={issued.recipientName} senderName={issued.senderName} code={issued.code} lang="ka" />
          <div className="space-y-3">
            <p className="flex items-center gap-2 text-base font-bold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> ბარათი გაიცა!
            </p>
            <p className="text-sm text-gray-700">
              კოდი: <span className="font-mono font-bold">{issued.code}</span>
            </p>
            <p className="text-sm text-gray-600">
              {issued.status === 'SCHEDULED'
                ? `ელფოსტა გაიგზავნება ${new Date(issued.deliverAt).toLocaleDateString('ka-GE')}-ს.`
                : issued.recipientEmail
                ? `ელფოსტა გაეგზავნა: ${issued.recipientEmail}`
                : 'ელფოსტა არ გაგზავნილა: დაბეჭდე და ხელით გადაეცი.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/gift-cards/print/${issued.id}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white no-underline hover:bg-indigo-700">
                <Printer className="h-3.5 w-3.5" /> დაბეჭდვა / PDF
              </Link>
              <button type="button" onClick={() => setIssued(null)} className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:border-indigo-400">
                კიდევ ერთის გაცემა
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={tabBtn(recipientType === 'PERSON')} onClick={() => setRecipientType('PERSON')}>
                <User className="h-4 w-4" /> ადამიანი
              </button>
              <button type="button" className={tabBtn(recipientType === 'ORGANIZATION')} onClick={() => setRecipientType('ORGANIZATION')}>
                <Building2 className="h-4 w-4" /> ორგანიზაცია
              </button>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">თანხა (₾)</p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setAmount(String(p))}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold ${amount === String(p) ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-200 text-gray-800 hover:border-indigo-400'}`}
                  >
                    {p} ₾
                  </button>
                ))}
                <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.,]/g, ''))} inputMode="decimal" className={`${input} w-28`} aria-label="თანხა" />
              </div>
              <p className="mt-1 text-[11px] text-gray-400">1–{MAX_GEL} ₾. ბარათი ნებისმიერ პროდუქტზე მუშაობს, 1 წელი მოქმედებს და ნაშთი არ იკარგება.</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-gray-600">
                {recipientType === 'ORGANIZATION' ? 'ორგანიზაციის სახელი' : 'მიმღების სახელი'}
                <input className={`${input} mt-1`} maxLength={120} value={recipientName} onChange={(e) => setRecipientName(e.target.value)} />
              </label>
              <label className="block text-xs font-semibold text-gray-600">
                ვისგან (ბარათზე ასე დაიწერება)
                <input className={`${input} mt-1`} maxLength={60} value={senderName} onChange={(e) => setSenderName(e.target.value)} />
              </label>
            </div>

            <label className="block text-xs font-semibold text-gray-600">
              მილოცვა (არასავალდებულო)
              <textarea
                className={`${input} mt-1 min-h-[80px]`}
                maxLength={500}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={recipientType === 'ORGANIZATION' ? 'მაგ.: მადლობა თანამშრომლობისთვის! ეს საჩუქარი თქვენი გუნდის განვითარებისთვისაა.' : 'მაგ.: გილოცავ! წარმატებებს გისურვებთ CDC-ის გუნდი.'}
              />
            </label>

            <div>
              <p className="mb-1 text-xs font-semibold text-gray-600">დიზაინი</p>
              <div className="grid grid-cols-4 gap-2">
                {DESIGNS.map((d) => (
                  <button
                    type="button"
                    key={d.id}
                    onClick={() => setDesign(d.id)}
                    className={`rounded-lg border p-1.5 text-left ${design === d.id ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-gray-200 hover:border-indigo-400'}`}
                  >
                    <div className="flex h-10 items-center justify-center rounded-md text-lg" style={{ background: GIFT_THEMES[d.id].swatch }}>
                      {GIFT_THEMES[d.id].emoji}
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-gray-700">{d.label}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={tabBtn(byEmail)} onClick={() => setByEmail(true)}>
                <Mail className="h-4 w-4" /> ელფოსტით
              </button>
              <button type="button" className={tabBtn(!byEmail)} onClick={() => setByEmail(false)}>
                <Printer className="h-4 w-4" /> დავბეჭდავ და გადავცემ
              </button>
            </div>
            {byEmail && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-gray-600">
                  მიმღების ელფოსტა
                  <input type="email" className={`${input} mt-1`} maxLength={200} value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" className={tabBtn(!sendLater)} onClick={() => setSendLater(false)}>
                    <Send className="h-4 w-4" /> ახლავე
                  </button>
                  <button type="button" className={tabBtn(sendLater)} onClick={() => setSendLater(true)}>
                    <CalendarHeart className="h-4 w-4" /> კონკრეტულ დღეს
                  </button>
                </div>
                {sendLater && <input type="date" min={minDate} value={deliverDate} onChange={(e) => setDeliverDate(e.target.value)} className={input} />}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <GiftCardVisual
              design={design}
              amountLabel={amountValid ? formatGel(Math.round(amountGel * 100)) : '0'}
              recipientName={recipientName.trim() || (recipientType === 'ORGANIZATION' ? 'ორგანიზაცია' : 'მიმღები')}
              senderName={senderName.trim() || 'CDC'}
              message={message.trim() || null}
              lang="ka"
            />
            {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-60"
            >
              <Gift className="h-4 w-4" /> {busy ? 'იცემა…' : 'უფასოდ გაცემა'}
            </button>
            <p className="text-center text-[11px] text-gray-400">გადახდა არ ხდება. ბარათი შენს „ჩემი სასაჩუქრე ბარათების“ გვერდზეც გამოჩნდება.</p>
          </div>
        </form>
      )}
    </div>
  );
}
