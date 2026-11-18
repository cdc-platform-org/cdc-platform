import { isMoneyKey, stripMoneyFields } from '../moneyVisibility';

test('detects money keys by word, not substring', () => {
  for (const k of ['price', 'priceMinor', 'amountGel', 'totalRevenue', 'escrowStatus', 'bogPayment', 'mentorHourlyRate', 'salesCount', 'net_amount']) expect(isMoneyKey(k)).toBe(true);
  for (const k of ['feedback', 'network', 'sortOrder', 'totalCount', 'successRate', 'title', 'isPaid', 'paidAt']) expect(isMoneyKey(k)).toBe(false);
});

test('strips nested money fields and keeps dates', () => {
  const d = new Date();
  expect(stripMoneyFields({ id: 1, at: d, list: [{ price: 5, name: 'x', volume: { gross: 1 } }] })).toEqual({ id: 1, at: d, list: [{ name: 'x' }] });
});
