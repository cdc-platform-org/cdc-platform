import { useMemo, useState } from 'react';
import { DigitalProduct, UpdateProductPayload, validateProductDiscount } from '../../services/productService';

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function toIso(local: string): string | null {
  return local ? new Date(local).toISOString() : null;
}
const gel = (minor: number | null | undefined) => (minor ? String(minor / 100) : '');

export default function ProductPricingPanel({
  product: p,
  onSave,
  onClose,
}: {
  product: DigitalProduct;
  onSave: (patch: UpdateProductPayload) => Promise<void>;
  onClose: () => void;
}) {
  const [price, setPrice] = useState(String(p.price / 100));
  const [salePrice, setSalePrice] = useState(gel(p.discountedPrice));
  const [startsAt, setStartsAt] = useState(toLocalInput(p.saleStartsAt));
  const [endsAt, setEndsAt] = useState(toLocalInput(p.saleEndsAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const priceNum = Number(price) || 0;
  const saleNum = Number(salePrice) || 0;
  const percentOff = priceNum > 0 && saleNum > 0 ? Math.round((1 - saleNum / priceNum) * 100) : 0;

  const validation = useMemo(() => {
    if (!price.trim() || priceNum < 0) return 'შეიყვანე სწორი ფასი.';
    if (!salePrice) return null;
    const discountError = validateProductDiscount(priceNum, saleNum);
    if (discountError) return discountError;
    if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return 'დასრულების თარიღი დაწყებაზე გვიან უნდა იყოს.';
    return null;
  }, [price, priceNum, salePrice, saleNum, startsAt, endsAt]);

  const applyPercent = (value: string) => {
    const pct = Number(value);
    if (!value || !pct || priceNum <= 0) return setSalePrice('');
    setSalePrice(String(Math.round(priceNum * (1 - pct / 100) * 100) / 100));
  };

  const save = async (patch: UpdateProductPayload) => {
    setError(null);
    setSaving(true);
    try {
      await onSave(patch);
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? 'შენახვა ვერ მოხერხდა.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (validation) return setError(validation);
    const label = priceNum === 0 ? 'უფასო (0 ₾)' : salePrice ? `ფასდაკლება: ${price} → ${salePrice} ₾ (-${percentOff}%)` : `ფასი: ${price} ₾`;
    if (!window.confirm(`შევინახო ახალი ფასი? ${label}`)) return;
    save({
      price: priceNum,
      discountedPrice: priceNum === 0 ? null : (salePrice ? saleNum : null),
      saleStartsAt: priceNum === 0 ? null : (salePrice ? toIso(startsAt) : null),
      saleEndsAt: priceNum === 0 ? null : (salePrice ? toIso(endsAt) : null),
    });
  };

  const handleMakeFree = () => {
    if (!window.confirm('მოვნიშნო ეს პროდუქტი უფასოდ (0 ₾)? მომხმარებლები გადახდის გარეშე შეძლებენ ჩამოტვირთვას.')) return;
    save({ price: 0, discountedPrice: null, saleStartsAt: null, saleEndsAt: null });
  };

  const handleRemoveSale = () => {
    if (!window.confirm('მოვხსნა ფასდაკლება? პროდუქტი ისევ ჩვეულებრივ ფასად გაიყიდება.')) return;
    save({ discountedPrice: null, saleStartsAt: null, saleEndsAt: null });
  };

  const input = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm';
  return (
    <div className="mt-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-xs font-semibold text-gray-800">ფასი და ფასდაკლება</p>
        {p.price === 0 ? (
          <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
            ✓ მონიშნულია როგორც უფასო (0 ₾)
          </span>
        ) : (
          <button
            type="button"
            onClick={handleMakeFree}
            disabled={saving}
            className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg hover:bg-emerald-100 disabled:opacity-60 cursor-pointer"
          >
            🎁 უფასოდ მონიშვნა (0 ₾)
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-xs text-gray-600">
          ფასი (₾ — 0 = უფასო)
          <input type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={input} />
        </label>
        <label className="text-xs text-gray-600">
          ფასდაკლების ფასი (₾)
          <input
            type="number"
            min="0"
            step="0.01"
            value={salePrice}
            onChange={(e) => setSalePrice(e.target.value)}
            disabled={priceNum === 0}
            placeholder="ცარიელი = ფასდაკლების გარეშე"
            className={input}
          />
        </label>
        <label className="text-xs text-gray-600">
          ან ფასდაკლება %
          <input
            type="number"
            min="1"
            max="80"
            step="1"
            value={percentOff || ''}
            onChange={(e) => applyPercent(e.target.value)}
            disabled={priceNum === 0}
            placeholder="მაგ. 20"
            className={input}
          />
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-gray-600">
          იწყება (არასავალდებულო — ცარიელი = ახლავე)
          <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} disabled={!salePrice || priceNum === 0} className={input} />
        </label>
        <label className="text-xs text-gray-600">
          მთავრდება (არასავალდებულო — ცარიელი = ვადის გარეშე)
          <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} disabled={!salePrice || priceNum === 0} className={input} />
        </label>
      </div>
      {salePrice && priceNum > 0 && !validation && (
        <p className="text-xs text-gray-600">
          საიტზე გამოჩნდება: <s className="text-gray-400">{price} ₾</s> <b>{salePrice} ₾</b>{' '}
          <span className="text-rose-600 font-semibold">-{percentOff}%</span>
        </p>
      )}
      {(error || validation) && <p className="text-xs text-red-600">{error || validation}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !!validation}
          className="text-xs font-medium text-white bg-indigo-600 px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-60"
        >
          {saving ? 'ინახება…' : 'შენახვა'}
        </button>
        {p.discountedPrice ? (
          <button
            type="button"
            onClick={handleRemoveSale}
            disabled={saving}
            className="text-xs font-medium text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg hover:bg-rose-50 disabled:opacity-60"
          >
            ფასდაკლების მოხსნა
          </button>
        ) : null}
        <button type="button" onClick={onClose} className="text-xs font-medium text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200">
          გაუქმება
        </button>
      </div>
    </div>
  );
}