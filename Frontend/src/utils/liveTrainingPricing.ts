import { formatPrice } from './coursePricing';
import { LiveTraining } from '../types/liveTraining';

const FREE_LABEL = { ka: 'უფასო', en: 'Free' };

// Builds a pricing label that never lets a per-month rate on a multi-month
// program read as the program's full cost — e.g.
// "350 ₾ / თვეში (ხანგრძლივობა: 2 თვე, ჯამში 700 ₾)" for a MONTHLY training
// with durationMonths=2, or a plain "700 ₾" for a TOTAL-priced one.
export function formatLiveTrainingPriceLabel(
  training: Pick<LiveTraining, 'price' | 'priceType' | 'durationMonths'>,
  lang: 'ka' | 'en'
): string {
  if (!training.price) return FREE_LABEL[lang];
  const amount = formatPrice(training.price);
  if (training.priceType === 'TOTAL') return amount;

  const perMonthLabel = lang === 'ka' ? `${amount} / თვეში` : `${amount} / month`;
  if (!training.durationMonths || training.durationMonths <= 1) return perMonthLabel;

  const total = formatPrice(training.price * training.durationMonths);
  return lang === 'ka'
    ? `${perMonthLabel} (ხანგრძლივობა: ${training.durationMonths} თვე, ჯამში ${total})`
    : `${perMonthLabel} (duration: ${training.durationMonths} months, total ${total})`;
}
