export function formatPrice(minorUnits: number): string {
  return `${(minorUnits / 100).toFixed(2)} ₾`;
}

// "Sale ends in 2d 3h" / "დარჩა 2დღ 3სთ" style countdown — null once the
// deadline has passed (the API's saleActive flag already reflects expiry,
// this is purely for the UI label).
export function getSaleCountdownLabel(discountEndDate: string | null, lang: 'ka' | 'en'): string | null {
  if (!discountEndDate) return null;
  const msLeft = new Date(discountEndDate).getTime() - Date.now();
  if (msLeft <= 0) return null;

  const totalMinutes = Math.floor(msLeft / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(lang === 'ka' ? `${days}დღ` : `${days}d`);
  if (days > 0 || hours > 0) parts.push(lang === 'ka' ? `${hours}სთ` : `${hours}h`);
  if (days === 0) parts.push(lang === 'ka' ? `${minutes}წთ` : `${minutes}m`);

  const timeLeft = parts.join(' ');
  return lang === 'ka' ? `დარჩა ${timeLeft}` : `Ends in ${timeLeft}`;
}
